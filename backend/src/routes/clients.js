const express = require('express');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Récupérer les clients (filtrage selon le rôle)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { page = 1, limit = 20, search, statut, type_produit, code_naf, code_postal } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT clients.*, users.username as assigned_username FROM clients LEFT JOIN users ON clients.assigned_to = users.id';
    let countQuery = 'SELECT COUNT(*) as total FROM clients';
    let params = [];
    let conditions = [];

    // Si télépro, voir seulement ses clients
    if (req.user.role === 'telepro') {
      conditions.push('assigned_to = ?');
      params.push(req.user.id);
    }

    // Filtrer par statut
    if (statut) {
      conditions.push('statut = ?');
      params.push(statut);
    }

    // Filtrer par type de produit
    if (type_produit) {
      conditions.push('type_produit = ?');
      params.push(type_produit);
    }

    // Filtrer par code NAF
    if (code_naf) {
      conditions.push('code_naf LIKE ?');
      params.push(`%${code_naf}%`);
    }

    // Filtrer par code postal
    if (code_postal) {
      conditions.push('code_postal LIKE ?');
      params.push(`%${code_postal}%`);
    }

    // Recherche par société, téléphone, adresse, nom signataire, SIRET
    if (search) {
      conditions.push('(societe LIKE ? OR telephone LIKE ? OR adresse LIKE ? OR nom_signataire LIKE ? OR siret LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';

    const clients = db.prepare(query).all(...params, parseInt(limit), offset);
    const total = db.prepare(countQuery).get(...params).total;

    // Parse les données techniques JSON pour chaque client
    const clientsWithParsedData = clients.map(client => ({
      ...client,
      donnees_techniques: client.donnees_techniques ? JSON.parse(client.donnees_techniques) : null
    }));

    // Si c'est une recherche, retourner directement le tableau
    if (search) {
      return res.json(clientsWithParsedData);
    }

    res.json({
      clients: clientsWithParsedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un client par ID
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);

    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Parse les données techniques JSON
    if (client.donnees_techniques) {
      client.donnees_techniques = JSON.parse(client.donnees_techniques);
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un client
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      // Bénéficiaire
      societe, adresse, code_postal, telephone, siret,
      // Site Travaux
      nom_site, adresse_travaux, code_postal_travaux,
      // Contact Signataire
      nom_signataire, fonction, telephone_signataire, mail_signataire,
      // Contact sur Site
      nom_contact_site, prenom_contact_site, fonction_contact_site, mail_contact_site, telephone_contact_site,
      // Produit et données
      type_produit, donnees_techniques,
      // Code NAF
      code_naf
    } = req.body;

    if (!type_produit) {
      return res.status(400).json({ error: 'Type de produit requis' });
    }

    // Stringify les données techniques si présentes
    const donneesJSON = donnees_techniques ? JSON.stringify(donnees_techniques) : null;

    const result = db.prepare(`
      INSERT INTO clients (
        societe, adresse, code_postal, telephone, siret,
        nom_site, adresse_travaux, code_postal_travaux,
        nom_signataire, fonction, telephone_signataire, mail_signataire,
        nom_contact_site, prenom_contact_site, fonction_contact_site, mail_contact_site, telephone_contact_site,
        type_produit, donnees_techniques, code_naf,
        assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      societe, adresse, code_postal, telephone, siret,
      nom_site, adresse_travaux, code_postal_travaux,
      nom_signataire, fonction, telephone_signataire, mail_signataire,
      nom_contact_site, prenom_contact_site, fonction_contact_site, mail_contact_site, telephone_contact_site,
      type_produit, donneesJSON, code_naf,
      req.user.id
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      societe,
      type_produit,
      nom_signataire,
      statut: 'nouveau'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour un client
router.patch('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const {
      // Bénéficiaire
      societe, adresse, code_postal, telephone, siret,
      // Site Travaux
      nom_site, adresse_travaux, code_postal_travaux,
      // Contact Signataire
      nom_signataire, fonction, telephone_signataire, mail_signataire,
      // Contact sur Site
      nom_contact_site, prenom_contact_site, fonction_contact_site, mail_contact_site, telephone_contact_site,
      // Produit et données
      type_produit, donnees_techniques,
      // Code NAF
      code_naf,
      // Statut
      statut
    } = req.body;

    const updates = [];
    const params = [];

    // Bénéficiaire
    if (societe !== undefined) { updates.push('societe = ?'); params.push(societe); }
    if (adresse !== undefined) { updates.push('adresse = ?'); params.push(adresse); }
    if (code_postal !== undefined) { updates.push('code_postal = ?'); params.push(code_postal); }
    if (telephone !== undefined) { updates.push('telephone = ?'); params.push(telephone); }
    if (siret !== undefined) { updates.push('siret = ?'); params.push(siret); }

    // Site Travaux
    if (nom_site !== undefined) { updates.push('nom_site = ?'); params.push(nom_site); }
    if (adresse_travaux !== undefined) { updates.push('adresse_travaux = ?'); params.push(adresse_travaux); }
    if (code_postal_travaux !== undefined) { updates.push('code_postal_travaux = ?'); params.push(code_postal_travaux); }

    // Contact Signataire
    if (nom_signataire !== undefined) { updates.push('nom_signataire = ?'); params.push(nom_signataire); }
    if (fonction !== undefined) { updates.push('fonction = ?'); params.push(fonction); }
    if (telephone_signataire !== undefined) { updates.push('telephone_signataire = ?'); params.push(telephone_signataire); }
    if (mail_signataire !== undefined) { updates.push('mail_signataire = ?'); params.push(mail_signataire); }

    // Contact sur Site
    if (nom_contact_site !== undefined) { updates.push('nom_contact_site = ?'); params.push(nom_contact_site); }
    if (prenom_contact_site !== undefined) { updates.push('prenom_contact_site = ?'); params.push(prenom_contact_site); }
    if (fonction_contact_site !== undefined) { updates.push('fonction_contact_site = ?'); params.push(fonction_contact_site); }
    if (mail_contact_site !== undefined) { updates.push('mail_contact_site = ?'); params.push(mail_contact_site); }
    if (telephone_contact_site !== undefined) { updates.push('telephone_contact_site = ?'); params.push(telephone_contact_site); }

    // Produit et données
    if (type_produit !== undefined) { updates.push('type_produit = ?'); params.push(type_produit); }
    if (donnees_techniques !== undefined) {
      updates.push('donnees_techniques = ?');
      params.push(JSON.stringify(donnees_techniques));
    }

    // Code NAF
    if (code_naf !== undefined) { updates.push('code_naf = ?'); params.push(code_naf); }

    // Statut
    if (statut !== undefined) { updates.push('statut = ?'); params.push(statut); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);

    // Parse les données techniques
    if (client.donnees_techniques) {
      client.donnees_techniques = JSON.parse(client.donnees_techniques);
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un client
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    res.json({ message: 'Client supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes pour les commentaires des clients
router.get('/:id/comments', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Validate client exists
    const clientExists = db.prepare('SELECT id FROM clients WHERE id = ?').get(parseInt(id));
    if (!clientExists) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    const comments = db.prepare(`
      SELECT client_comments.*, users.username
      FROM client_comments
      LEFT JOIN users ON client_comments.user_id = users.id
      WHERE client_id = ?
      ORDER BY created_at DESC
    `).all(parseInt(id));

    res.json(comments);
  } catch (error) {
    console.error('Erreur GET comments:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/comments', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Le contenu est requis' });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const result = db.prepare(
      'INSERT INTO client_comments (client_id, user_id, content) VALUES (?, ?, ?)'
    ).run(parseInt(id), req.user.id, content.trim());

    res.status(201).json({
      id: result.lastInsertRowid,
      client_id: parseInt(id),
      user_id: req.user.id,
      content: content.trim(),
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur POST comment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/comments/:commentId', authenticateToken, (req, res) => {
  try {
    const { commentId } = req.params;

    // Verify comment exists before deleting
    const comment = db.prepare('SELECT id FROM client_comments WHERE id = ?').get(parseInt(commentId));
    if (!comment) {
      return res.status(404).json({ error: 'Commentaire non trouvé' });
    }

    db.prepare('DELETE FROM client_comments WHERE id = ?').run(parseInt(commentId));
    res.json({ message: 'Commentaire supprimé' });
  } catch (error) {
    console.error('Erreur DELETE comment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Routes pour les rendez-vous des clients
router.get('/:id/appointments', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const appointments = db.prepare(`
      SELECT client_appointments.*, users.username
      FROM client_appointments
      LEFT JOIN users ON client_appointments.user_id = users.id
      WHERE client_id = ?
      ORDER BY date ASC, time ASC
    `).all(id);

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/appointments', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, time } = req.body;

    if (!title || !date || !time) {
      return res.status(400).json({ error: 'Titre, date et heure requis' });
    }

    const result = db.prepare(
      'INSERT INTO client_appointments (client_id, user_id, title, date, time) VALUES (?, ?, ?, ?, ?)'
    ).run(id, req.user.id, title, date, time);

    res.status(201).json({
      id: result.lastInsertRowid,
      client_id: id,
      user_id: req.user.id,
      title,
      date,
      time
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/appointments/:appointmentId', authenticateToken, (req, res) => {
  try {
    const { appointmentId } = req.params;
    db.prepare('DELETE FROM client_appointments WHERE id = ?').run(appointmentId);
    res.json({ message: 'Rendez-vous supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import CSV
router.post('/import/csv', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const multer = require('multer');
    const csv = require('csv-parser');
    const fs = require('fs');
    const upload = multer({ dest: 'uploads/' });

    upload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'Erreur lors de l\'upload' });
      }

      const results = [];
      const filePath = req.file.path;

      fs.createReadStream(filePath, { encoding: 'utf8' })
        .pipe(csv({ separator: ';', skipLines: 0, mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          let imported = 0;

          for (const row of results) {
            try {
              const stmt = db.prepare(`
                INSERT INTO clients (societe, adresse, code_postal, telephone, siret, nom_site, adresse_travaux, code_postal_travaux,
                                     nom_signataire, fonction, telephone_signataire, mail_signataire, type_produit, code_naf, statut, assigned_to)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);

              stmt.run(
                row.societe || null,
                row.adresse || null,
                row.code_postal || null,
                row.telephone || null,
                row.siret || null,
                row.nom_site || null,
                row.adresse_travaux || null,
                row.code_postal_travaux || null,
                row.nom_signataire || null,
                row.fonction || null,
                row.telephone_signataire || null,
                row.mail_signataire || null,
                row.type_produit || 'destratification',
                row.code_naf || null,
                row.statut || 'nouveau',
                req.user.id
              );

              imported++;
            } catch (error) {
              console.error('Erreur import ligne:', error.message);
            }
          }

          // Supprimer le fichier temporaire
          fs.unlinkSync(filePath);

          res.json({ message: 'Import réussi', imported });
        });
    });
  } catch (error) {
    console.error('Erreur import CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exporter les clients en Excel
router.get('/export/excel', authenticateToken, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');

    let query = 'SELECT clients.*, users.username as assigned_username FROM clients LEFT JOIN users ON clients.assigned_to = users.id';
    let params = [];
    let conditions = [];

    // Si télépro, voir seulement ses clients
    if (req.user.role === 'telepro') {
      conditions.push('assigned_to = ?');
      params.push(req.user.id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY updated_at DESC';
    const clients = db.prepare(query).all(...params);

    // Créer un nouveau classeur Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Clients');

    // Définir les colonnes avec formatage - NOUVELLE STRUCTURE
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Société', key: 'societe', width: 25 },
      { header: 'Adresse', key: 'adresse', width: 30 },
      { header: 'Code Postal', key: 'code_postal', width: 12 },
      { header: 'Téléphone', key: 'telephone', width: 15 },
      { header: 'SIRET', key: 'siret', width: 18 },
      { header: 'Nom Site', key: 'nom_site', width: 25 },
      { header: 'Adresse Travaux', key: 'adresse_travaux', width: 30 },
      { header: 'CP Travaux', key: 'code_postal_travaux', width: 12 },
      { header: 'Signataire', key: 'nom_signataire', width: 20 },
      { header: 'Fonction', key: 'fonction', width: 15 },
      { header: 'Tél Signataire', key: 'telephone_signataire', width: 15 },
      { header: 'Email Signataire', key: 'mail_signataire', width: 25 },
      { header: 'Produit', key: 'type_produit', width: 18 },
      { header: 'Code NAF', key: 'code_naf', width: 12 },
      { header: 'Statut', key: 'statut', width: 18 },
      { header: 'Assigné à', key: 'assigned_username', width: 20 },
      { header: 'Date création', key: 'created_at', width: 20 }
    ];

    // Styler la ligne d'en-tête
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 25;

    // Ajouter les données avec formatage conditionnel
    clients.forEach((client, index) => {
      const row = worksheet.addRow({
        ...client,
        created_at: client.created_at ? new Date(client.created_at).toLocaleString('fr-FR') : '',
        assigned_username: client.assigned_username || 'Non assigné'
      });

      // Alternance de couleurs pour les lignes
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
      }

      // Bordures pour toutes les cellules
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
        };
      });
    });

    // Ajouter les filtres automatiques
    worksheet.autoFilter = {
      from: 'A1',
      to: `R1`
    };

    // Générer le nom du fichier avec la date
    const filename = `clients_export_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Envoyer le fichier
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Erreur export Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

// Attribuer un client à un télépro (admin only)
router.patch('/:id/assign', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    // Vérifier que le user existe et est un télépro ou admin
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier que le client existe
    const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(id);
    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Mettre à jour l'attribution
    db.prepare('UPDATE clients SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(userId, id);

    const updatedClient = db.prepare(`
      SELECT c.*, u.username as assigned_username
      FROM clients c
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE c.id = ?
    `).get(id);

    res.json({
      message: 'Client attribué avec succès',
      client: updatedClient
    });

  } catch (error) {
    console.error('Erreur attribution client:', error);
    res.status(500).json({ error: error.message });
  }
});

// Attribution en masse de clients (admin only)
router.post('/bulk-assign', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { clientIds, userId } = req.body;

    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({ error: 'clientIds requis (array non vide)' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    // Vérifier que le user existe
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Préparer la requête d'update avec placeholders
    const placeholders = clientIds.map(() => '?').join(',');
    const updateQuery = `
      UPDATE clients
      SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `;

    const result = db.prepare(updateQuery).run(userId, ...clientIds);

    res.json({
      message: `${result.changes} client(s) attribué(s) avec succès`,
      assignedTo: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      count: result.changes
    });

  } catch (error) {
    console.error('Erreur attribution en masse:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
