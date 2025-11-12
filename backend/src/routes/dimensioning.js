const express = require('express');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// GET - Récupérer toutes les températures de base
router.get('/temperature-data', authenticateToken, requireAdmin, (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM temperature_base_data ORDER BY zone, altitude_min').all();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Récupérer tous les coefficients G
router.get('/coefficient-data', authenticateToken, requireAdmin, (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM coefficient_g_data ORDER BY typologie').all();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Mettre à jour une température de base
router.put('/temperature-data/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { temperature } = req.body;
    db.prepare('UPDATE temperature_base_data SET temperature = ? WHERE id = ?').run(temperature, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Mettre à jour un coefficient G
router.put('/coefficient-data/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { coefficient, description } = req.body;
    db.prepare('UPDATE coefficient_g_data SET coefficient = ?, description = ? WHERE id = ?')
      .run(coefficient, description, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Récupérer température de base pour une zone et altitude
router.get('/temperature-base', authenticateToken, (req, res) => {
  try {
    const { zone, altitude } = req.query;
    const temp = db.prepare(`
      SELECT temperature FROM temperature_base_data
      WHERE zone = ? AND altitude_min <= ? AND altitude_max >= ?
      LIMIT 1
    `).get(zone, altitude, altitude);

    if (!temp) {
      return res.status(404).json({ error: 'Température de base non trouvée' });
    }

    res.json({ temperature: temp.temperature });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Récupérer coefficient G pour une typologie
router.get('/coefficient-g', authenticateToken, (req, res) => {
  try {
    const { typologie } = req.query;
    const coef = db.prepare('SELECT coefficient FROM coefficient_g_data WHERE typologie = ?').get(typologie);

    if (!coef) {
      return res.status(404).json({ error: 'Coefficient G non trouvé' });
    }

    res.json({ coefficient: coef.coefficient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Liste des zones climatiques disponibles
router.get('/zones', authenticateToken, (req, res) => {
  try {
    const zones = db.prepare('SELECT DISTINCT zone FROM temperature_base_data ORDER BY zone').all();
    res.json(zones.map(z => z.zone));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Liste des typologies disponibles
router.get('/typologies', authenticateToken, (req, res) => {
  try {
    const typologies = db.prepare('SELECT typologie, description FROM coefficient_g_data ORDER BY typologie').all();
    res.json(typologies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Générer une note de dimensionnement
router.post('/generate/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    console.log('🔍 DEBUG req.user:', req.user);
    const userId = req.user.id; // Correction: req.user.id au lieu de req.user.userId
    console.log('🔍 DEBUG userId:', userId);
    const data = req.body;

    // 1. Récupérer les infos du client
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // 2. Calculs
    const volume = data.surface_chauffee * data.hauteur_plafond;

    // Récupérer température de base
    const tempBase = db.prepare(`
      SELECT temperature FROM temperature_base_data
      WHERE zone = ? AND altitude_min <= ? AND altitude_max >= ?
      LIMIT 1
    `).get(data.zone_climatique, data.altitude, data.altitude);

    if (!tempBase) {
      return res.status(400).json({ error: 'Température de base non trouvée pour cette zone et altitude' });
    }

    // Récupérer coefficient G
    const coeffG = db.prepare('SELECT coefficient FROM coefficient_g_data WHERE typologie = ?').get(data.typologie);

    if (!coeffG) {
      return res.status(400).json({ error: 'Coefficient G non trouvé pour cette typologie' });
    }

    const temperatureBase = tempBase.temperature;
    const coefficientG = coeffG.coefficient;
    const deltaT = data.temperature_confort - temperatureBase;
    const deperditions = coefficientG * volume * deltaT;
    const tauxCouverture = (data.puissance_tbase / deperditions) * 100;

    // 3. Sauvegarder dans la base
    const result = db.prepare(`
      INSERT INTO dimensioning_notes (
        client_id, user_id,
        surface_chauffee, hauteur_plafond, zone_climatique, altitude, typologie, temperature_confort,
        marque, reference_exterieur, reference_hydraulique, modele,
        puissance_nominale, efficacite_saisonniere, puissance_tbase, temperature_arret,
        compatibilite_emetteurs, regime_fonctionnement,
        volume, temperature_base, coefficient_g, delta_t, deperditions, taux_couverture
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clientId, userId,
      data.surface_chauffee, data.hauteur_plafond, data.zone_climatique, data.altitude, data.typologie, data.temperature_confort,
      data.marque, data.reference_exterieur, data.reference_hydraulique, data.modele,
      data.puissance_nominale, data.efficacite_saisonniere, data.puissance_tbase, data.temperature_arret,
      data.compatibilite_emetteurs, data.regime_fonctionnement,
      volume, temperatureBase, coefficientG, deltaT, deperditions, tauxCouverture
    );

    // 4. Générer le PDF
    const noteId = result.lastInsertRowid;
    const pdfPath = await generatePDF(noteId, client, data, {
      volume, temperatureBase, coefficientG, deltaT, deperditions, tauxCouverture
    });

    // 5. Mettre à jour le chemin du PDF
    db.prepare('UPDATE dimensioning_notes SET pdf_path = ? WHERE id = ?').run(pdfPath, noteId);

    res.json({
      success: true,
      noteId,
      pdfPath,
      calculations: {
        volume,
        temperatureBase,
        coefficientG,
        deltaT,
        deperditions,
        tauxCouverture
      }
    });

  } catch (error) {
    console.error('Erreur génération note:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Télécharger le PDF d'une note
router.get('/pdf/:noteId', authenticateToken, (req, res) => {
  try {
    const note = db.prepare('SELECT * FROM dimensioning_notes WHERE id = ?').get(req.params.noteId);

    if (!note) {
      return res.status(404).json({ error: 'Note non trouvée' });
    }

    if (!note.pdf_path || !fs.existsSync(note.pdf_path)) {
      return res.status(404).json({ error: 'PDF non trouvé' });
    }

    res.download(note.pdf_path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Liste des notes de dimensionnement d'un client
router.get('/client/:clientId', authenticateToken, (req, res) => {
  try {
    const notes = db.prepare(`
      SELECT d.*, u.username
      FROM dimensioning_notes d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.client_id = ?
      ORDER BY d.created_at DESC
    `).all(req.params.clientId);

    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fonction de génération PDF
async function generatePDF(noteId, client, data, calculations) {
  return new Promise((resolve, reject) => {
    try {
      // Créer le dossier pdfs s'il n'existe pas
      const pdfsDir = path.join(__dirname, '../../pdfs');
      if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
      }

      const fileName = `note_dimensionnement_${client.id}_${Date.now()}.pdf`;
      const filePath = path.join(pdfsDir, fileName);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // ========================================
      // EN-TÊTE AVEC LOGO ET INFOS SOCIÉTÉ
      // ========================================
      const logoPath = path.join(__dirname, '../../assets/logo.png');
      const startY = doc.y;

      // Logo à gauche (si existe)
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 50, startY, {
            width: 120,
            height: 80,
            fit: [120, 80]
          });
        } catch (err) {
          console.log('Erreur chargement logo:', err);
        }
      }

      // Informations société à droite
      const companyInfo = {
        name: 'FRANCE ECO ENERGIE',
        address: 'Adresse de la société', // À remplacer
        postalCode: 'Code postal', // À remplacer
        city: 'Ville', // À remplacer
        phone: 'Téléphone', // À remplacer
        email: 'contact@france-eco-energie.fr', // À remplacer
        siret: 'SIRET: XXXXX' // À remplacer
      };

      doc.fontSize(12).fillColor('#059669').font('Helvetica-Bold')
        .text(companyInfo.name, 320, startY, { align: 'right' });
      doc.fontSize(9).fillColor('#333').font('Helvetica')
        .text(companyInfo.address, 320, doc.y + 5, { align: 'right' })
        .text(`${companyInfo.postalCode} ${companyInfo.city}`, { align: 'right' })
        .text(`Tél: ${companyInfo.phone}`, { align: 'right' })
        .text(`Email: ${companyInfo.email}`, { align: 'right' })
        .text(companyInfo.siret, { align: 'right' });

      // Ligne de séparation
      doc.moveTo(50, startY + 95).lineTo(545, startY + 95).stroke('#10b981');
      doc.moveDown(1);

      // Titre du document
      doc.fontSize(20).fillColor('#059669').font('Helvetica-Bold')
        .text('NOTE DE DIMENSIONNEMENT', { align: 'center' });
      doc.fontSize(10).fillColor('#666').font('Helvetica')
        .text(`Générée le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
      doc.moveDown(2);

      // Informations client
      doc.fontSize(14).fillColor('#000').text('INFORMATIONS CLIENT', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11)
        .text(`Nom: ${client.first_name} ${client.last_name}`)
        .text(`Adresse: ${client.address || 'N/A'}`)
        .text(`Code postal et Ville: ${client.postal_code || ''} ${client.city || ''}`)
        .text(`Téléphone: ${client.landline_phone || client.phone || 'N/A'}`);
      doc.moveDown(1);

      // Carte de France avec zones climatiques
      doc.fontSize(14).fillColor('#000').text('ZONE CLIMATIQUE', { underline: true });
      doc.moveDown(0.5);

      const mapImagePath = path.join(__dirname, '../../assets/france-climate-zones.png');
      if (fs.existsSync(mapImagePath)) {
        try {
          // Calcul de la position centrée pour l'image
          const pageWidth = 595; // Largeur A4 en points
          const imageWidth = 250;
          const imageHeight = 250;
          const imageX = (pageWidth - imageWidth) / 2;
          const currentY = doc.y;

          // Insérer l'image avec position explicite
          doc.image(mapImagePath, imageX, currentY, {
            width: imageWidth,
            fit: [imageWidth, imageHeight]
          });

          // Mettre à jour manuellement la position Y
          doc.y = currentY + imageHeight + 10; // +10 pour l'espacement
        } catch (err) {
          console.log('Erreur chargement carte:', err);
        }
      }

      doc.fontSize(11).fillColor('#10b981')
        .text(`Zone du client: ${data.zone_climatique}`, { align: 'center' });
      doc.fillColor('#000').fontSize(9)
        .text('(Les zones climatiques vont de A (plus froid) à I (plus doux))', { align: 'center' });
      doc.moveDown(1.5);

      // Calculs
      doc.fontSize(14).fillColor('#000').text('CALCUL DES DÉPERDITIONS', { underline: true });
      doc.moveDown(0.5);

      // Volume
      doc.fontSize(11).text(`Surface chauffée: ${data.surface_chauffee} m²`);
      doc.text(`Hauteur sous plafond: ${data.hauteur_plafond} m`);
      doc.fillColor('#10b981').text(`Volume: ${calculations.volume.toFixed(2)} m³`, { continued: false });
      doc.fillColor('#000');
      doc.moveDown(1);

      // Température de base
      doc.text(`Zone climatique: ${data.zone_climatique}`);
      doc.text(`Altitude: ${data.altitude} m`);
      doc.fillColor('#10b981').text(`Température de base: ${calculations.temperatureBase}°C`);
      doc.fillColor('#000');
      doc.moveDown(1);

      // Coefficient G
      doc.text(`Typologie: ${data.typologie}`);
      doc.fillColor('#10b981').text(`Coefficient G: ${calculations.coefficientG} W/(m³·K)`);
      doc.fillColor('#000');
      doc.moveDown(1);

      // ΔT et Déperditions
      doc.text(`Température de confort: ${data.temperature_confort}°C`);
      doc.fillColor('#10b981').text(`ΔT: ${calculations.deltaT.toFixed(1)}°C`);
      doc.fillColor('#000');
      doc.moveDown(1);

      doc.fontSize(12).fillColor('#10b981')
        .text(`DÉPERDITIONS À TBASE: ${calculations.deperditions.toFixed(0)} W`, { underline: true });
      doc.fillColor('#000');
      doc.moveDown(2);

      // Pompe à chaleur
      doc.fontSize(14).text('POMPE À CHALEUR CHOISIE', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11)
        .text(`Marque: ${data.marque}`)
        .text(`Modèle: ${data.modele}`)
        .text(`Référence extérieur: ${data.reference_exterieur || 'N/A'}`)
        .text(`Référence hydraulique: ${data.reference_hydraulique || 'N/A'}`)
        .text(`Puissance nominale: ${data.puissance_nominale} kW`)
        .text(`Efficacité saisonnière (ETAS): ${data.efficacite_saisonniere || 'N/A'}%`)
        .text(`Puissance à Tbase: ${data.puissance_tbase} W`)
        .text(`Température d'arrêt: ${data.temperature_arret || 'N/A'}°C`)
        .text(`Compatibilité émetteurs: ${data.compatibilite_emetteurs || 'N/A'}`)
        .text(`Régime de fonctionnement: ${data.regime_fonctionnement || 'N/A'}`);
      doc.moveDown(2);

      // Vérification dimensionnement
      doc.fontSize(14).text('VÉRIFICATION DU DIMENSIONNEMENT', { underline: true });
      doc.moveDown(0.5);

      const tauxOk = calculations.tauxCouverture >= 80 && calculations.tauxCouverture <= 120;
      const puissanceOk = data.puissance_tbase >= calculations.deperditions;
      const globalOk = tauxOk && puissanceOk;

      doc.fontSize(12).fillColor(globalOk ? '#10b981' : '#ef4444')
        .text(`Taux de couverture: ${calculations.tauxCouverture.toFixed(1)}%`);

      doc.fillColor('#000').fontSize(11);
      doc.moveDown(0.5);

      // Vérifications
      doc.fillColor(tauxOk ? '#10b981' : '#ef4444')
        .text(`✓ Taux de couverture compris entre 80% et 120%: ${tauxOk ? 'OUI' : 'NON'}`);
      doc.fillColor(puissanceOk ? '#10b981' : '#ef4444')
        .text(`✓ Puissance PAC supérieure aux déperditions: ${puissanceOk ? 'OUI' : 'NON'}`);
      doc.fillColor(globalOk ? '#10b981' : '#ef4444')
        .text(`✓ Dimensionnement conforme: ${globalOk ? 'OUI' : 'NON'}`);

      // Pied de page
      doc.fillColor('#666').fontSize(9);
      doc.moveDown(3);
      doc.text('France Eco Energie - Note de dimensionnement v1.0', { align: 'center' });
      doc.text(`Générée le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (err) => {
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = router;
