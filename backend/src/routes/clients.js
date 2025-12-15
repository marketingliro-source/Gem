const express = require('express');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * ARCHITECTURE MULTI-PRODUITS
 *
 * Un client peut avoir 1, 2 ou 3 produits (destratification, pression, matelas_isolants)
 *
 * Tables:
 * - client_base: Données communes (société, contacts, SIRET...)
 * - clients_produits: Données spécifiques par produit (type, données techniques, statut, assignation)
 * - client_comments, client_appointments, client_documents: Liés à client_base_id (partagés)
 */

// ============================================
// ROUTES PRINCIPALES - LISTE ET DÉTAIL
// ============================================

// GET /clients - Liste des clients avec leurs produits
router.get('/', authenticateToken, (req, res) => {
  try {
    const { page = 1, limit = 20, search, statut, type_produit, code_naf, code_postal, assigned_to } = req.query;
    const offset = (page - 1) * limit;

    // Requête avec JOIN entre client_base et clients_produits
    let query = `
      SELECT
        cb.id as client_base_id,
        cb.societe, cb.adresse, cb.ville, cb.code_postal, cb.telephone, cb.siret,
        cb.nom_site, cb.adresse_travaux, cb.ville_travaux, cb.code_postal_travaux,
        cb.nom_signataire, cb.fonction, cb.telephone_signataire, cb.mail_signataire,
        cb.nom_contact_site, cb.prenom_contact_site, cb.fonction_contact_site,
        cb.mail_contact_site, cb.telephone_contact_site,
        cb.code_naf, cb.donnees_enrichies,
        cb.created_at, cb.updated_at,
        cp.id as produit_id,
        cp.type_produit,
        cp.donnees_techniques,
        cp.statut,
        cp.assigned_to,
        u.username as assigned_username
      FROM client_base cb
      INNER JOIN clients_produits cp ON cb.id = cp.client_base_id
      LEFT JOIN users u ON cp.assigned_to = u.id
    `;

    let countQuery = `
      SELECT COUNT(DISTINCT cb.id) as total
      FROM client_base cb
      INNER JOIN clients_produits cp ON cb.id = cp.client_base_id
    `;

    let params = [];
    let conditions = [];

    // Si télépro, voir seulement ses produits
    if (req.user.role === 'telepro') {
      conditions.push('cp.assigned_to = ?');
      params.push(req.user.id);
    }

    // Filtrer par statut (au niveau produit)
    if (statut) {
      conditions.push('cp.statut = ?');
      params.push(statut);
    }

    // Filtrer par type de produit
    if (type_produit) {
      conditions.push('cp.type_produit = ?');
      params.push(type_produit);
    }

    // Filtrer par code NAF (au niveau client_base)
    if (code_naf) {
      conditions.push('cb.code_naf LIKE ?');
      params.push(`%${code_naf}%`);
    }

    // Filtrer par code postal (au niveau client_base)
    if (code_postal) {
      conditions.push('cb.code_postal LIKE ?');
      params.push(`%${code_postal}%`);
    }

    // Filtrer par agent assigné (admin uniquement)
    if (assigned_to && req.user.role === 'admin') {
      conditions.push('cp.assigned_to = ?');
      params.push(parseInt(assigned_to));
    }

    // Recherche globale
    if (search) {
      conditions.push('(cb.societe LIKE ? OR cb.telephone LIKE ? OR cb.adresse LIKE ? OR cb.nom_signataire LIKE ? OR cb.siret LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Ajouter WHERE si conditions
    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    // Tri et pagination
    query += ' ORDER BY cb.updated_at DESC, cp.type_produit ASC LIMIT ? OFFSET ?';

    const results = db.prepare(query).all(...params, parseInt(limit), offset);
    const total = db.prepare(countQuery).get(...params).total;

    // Parser les données JSON
    const clients = results.map(row => ({
      id: row.client_base_id,
      produit_id: row.produit_id,
      societe: row.societe,
      adresse: row.adresse,
      ville: row.ville,
      code_postal: row.code_postal,
      telephone: row.telephone,
      siret: row.siret,
      nom_site: row.nom_site,
      adresse_travaux: row.adresse_travaux,
      ville_travaux: row.ville_travaux,
      code_postal_travaux: row.code_postal_travaux,
      nom_signataire: row.nom_signataire,
      fonction: row.fonction,
      telephone_signataire: row.telephone_signataire,
      mail_signataire: row.mail_signataire,
      nom_contact_site: row.nom_contact_site,
      prenom_contact_site: row.prenom_contact_site,
      fonction_contact_site: row.fonction_contact_site,
      mail_contact_site: row.mail_contact_site,
      telephone_contact_site: row.telephone_contact_site,
      code_naf: row.code_naf,
      type_produit: row.type_produit,
      statut: row.statut,
      assigned_to: row.assigned_to,
      assigned_username: row.assigned_username,
      donnees_techniques: row.donnees_techniques ? JSON.parse(row.donnees_techniques) : null,
      donnees_enrichies: row.donnees_enrichies ? JSON.parse(row.donnees_enrichies) : null,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    // Si recherche, retourner directement le tableau
    if (search) {
      return res.json(clients);
    }

    res.json({
      clients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur GET /clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /clients/:id - Détail d'un client avec TOUS ses produits
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer client_base
    const clientBase = db.prepare('SELECT * FROM client_base WHERE id = ?').get(id);
    if (!clientBase) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Récupérer tous les produits
    const produits = db.prepare(`
      SELECT cp.*, u.username as assigned_username
      FROM clients_produits cp
      LEFT JOIN users u ON cp.assigned_to = u.id
      WHERE cp.client_base_id = ?
      ORDER BY cp.type_produit ASC
    `).all(id);

    // Parser JSON
    produits.forEach(p => {
      if (p.donnees_techniques) {
        p.donnees_techniques = JSON.parse(p.donnees_techniques);
      }
    });

    res.json({
      ...clientBase,
      donnees_enrichies: clientBase.donnees_enrichies ? JSON.parse(clientBase.donnees_enrichies) : null,
      produits // Array de produits
    });
  } catch (error) {
    console.error('Erreur GET /clients/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CRÉATION ET MODIFICATION
// ============================================

// POST /clients - Créer un client avec un ou plusieurs produits
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      // Données communes
      societe, adresse, ville, code_postal, telephone, siret,
      nom_site, adresse_travaux, ville_travaux, code_postal_travaux,
      nom_signataire, fonction, telephone_signataire, mail_signataire,
      nom_contact_site, prenom_contact_site, fonction_contact_site,
      mail_contact_site, telephone_contact_site,
      code_naf,
      // Produits (array ou objet unique pour rétrocompatibilité)
      produits,
      type_produit, // Ancienne API (single product)
      donnees_techniques // Ancienne API
    } = req.body;

    // Support ancien format (single product) ET nouveau format (multi-products)
    let produitsArray;
    if (produits && Array.isArray(produits) && produits.length > 0) {
      // Nouveau format multi-produits
      produitsArray = produits;
    } else if (type_produit) {
      // Ancien format (rétrocompatibilité)
      produitsArray = [{
        type_produit,
        donnees_techniques: donnees_techniques || {}
      }];
    } else {
      return res.status(400).json({ error: 'Au moins un produit requis (produits[] ou type_produit)' });
    }

    // Créer client_base
    const baseResult = db.prepare(`
      INSERT INTO client_base (
        societe, adresse, ville, code_postal, telephone, siret,
        nom_site, adresse_travaux, ville_travaux, code_postal_travaux,
        nom_signataire, fonction, telephone_signataire, mail_signataire,
        nom_contact_site, prenom_contact_site, fonction_contact_site,
        mail_contact_site, telephone_contact_site,
        code_naf
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      societe, adresse, ville, code_postal, telephone, siret,
      nom_site, adresse_travaux, ville_travaux, code_postal_travaux,
      nom_signataire, fonction, telephone_signataire, mail_signataire,
      nom_contact_site, prenom_contact_site, fonction_contact_site,
      mail_contact_site, telephone_contact_site,
      code_naf
    );

    const clientBaseId = baseResult.lastInsertRowid;

    // Créer chaque produit
    const insertProduit = db.prepare(`
      INSERT INTO clients_produits (
        client_base_id, type_produit, donnees_techniques, statut, assigned_to
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const produitsInserted = [];
    for (const produit of produitsArray) {
      const result = insertProduit.run(
        clientBaseId,
        produit.type_produit,
        produit.donnees_techniques ? JSON.stringify(produit.donnees_techniques) : null,
        produit.statut || 'nouveau',
        produit.assigned_to || req.user.id
      );

      produitsInserted.push({
        id: result.lastInsertRowid,
        type_produit: produit.type_produit
      });
    }

    res.status(201).json({
      id: clientBaseId,
      client_base_id: clientBaseId,
      societe,
      produits: produitsInserted
    });
  } catch (error) {
    console.error('Erreur POST /clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /clients/:id - Modifier données COMMUNES d'un client
router.patch('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const {
      // Données communes
      societe, adresse, ville, code_postal, telephone, siret,
      nom_site, adresse_travaux, ville_travaux, code_postal_travaux,
      nom_signataire, fonction, telephone_signataire, mail_signataire,
      nom_contact_site, prenom_contact_site, fonction_contact_site,
      mail_contact_site, telephone_contact_site,
      code_naf
    } = req.body;

    const updates = [];
    const params = [];

    // Construire UPDATE dynamique
    if (societe !== undefined) { updates.push('societe = ?'); params.push(societe); }
    if (adresse !== undefined) { updates.push('adresse = ?'); params.push(adresse); }
    if (ville !== undefined) { updates.push('ville = ?'); params.push(ville); }
    if (code_postal !== undefined) { updates.push('code_postal = ?'); params.push(code_postal); }
    if (telephone !== undefined) { updates.push('telephone = ?'); params.push(telephone); }
    if (siret !== undefined) { updates.push('siret = ?'); params.push(siret); }
    if (nom_site !== undefined) { updates.push('nom_site = ?'); params.push(nom_site); }
    if (adresse_travaux !== undefined) { updates.push('adresse_travaux = ?'); params.push(adresse_travaux); }
    if (ville_travaux !== undefined) { updates.push('ville_travaux = ?'); params.push(ville_travaux); }
    if (code_postal_travaux !== undefined) { updates.push('code_postal_travaux = ?'); params.push(code_postal_travaux); }
    if (nom_signataire !== undefined) { updates.push('nom_signataire = ?'); params.push(nom_signataire); }
    if (fonction !== undefined) { updates.push('fonction = ?'); params.push(fonction); }
    if (telephone_signataire !== undefined) { updates.push('telephone_signataire = ?'); params.push(telephone_signataire); }
    if (mail_signataire !== undefined) { updates.push('mail_signataire = ?'); params.push(mail_signataire); }
    if (nom_contact_site !== undefined) { updates.push('nom_contact_site = ?'); params.push(nom_contact_site); }
    if (prenom_contact_site !== undefined) { updates.push('prenom_contact_site = ?'); params.push(prenom_contact_site); }
    if (fonction_contact_site !== undefined) { updates.push('fonction_contact_site = ?'); params.push(fonction_contact_site); }
    if (mail_contact_site !== undefined) { updates.push('mail_contact_site = ?'); params.push(mail_contact_site); }
    if (telephone_contact_site !== undefined) { updates.push('telephone_contact_site = ?'); params.push(telephone_contact_site); }
    if (code_naf !== undefined) { updates.push('code_naf = ?'); params.push(code_naf); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée commune à mettre à jour' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE client_base SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Retourner le client mis à jour
    const client = db.prepare('SELECT * FROM client_base WHERE id = ?').get(id);
    if (client.donnees_enrichies) {
      client.donnees_enrichies = JSON.parse(client.donnees_enrichies);
    }

    res.json(client);
  } catch (error) {
    console.error('Erreur PATCH /clients/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /clients/produits/:produitId - Modifier données SPÉCIFIQUES d'un produit
router.patch('/produits/:produitId', authenticateToken, (req, res) => {
  try {
    const { produitId } = req.params;
    const { donnees_techniques, statut, assigned_to, type_produit } = req.body;

    const updates = [];
    const params = [];

    // Valider et gérer changement de type_produit
    if (type_produit !== undefined) {
      const validTypes = ['destratification', 'pression', 'matelas_isolants'];
      if (!validTypes.includes(type_produit)) {
        return res.status(400).json({ error: 'type_produit invalide' });
      }

      // Récupérer le produit actuel pour vérifier le client_base_id
      const currentProduit = db.prepare('SELECT client_base_id, type_produit FROM clients_produits WHERE id = ?').get(produitId);
      if (!currentProduit) {
        return res.status(404).json({ error: 'Produit introuvable' });
      }

      // Vérifier que le client n'a pas déjà ce type de produit
      if (type_produit !== currentProduit.type_produit) {
        const existingProduit = db.prepare(
          'SELECT id FROM clients_produits WHERE client_base_id = ? AND type_produit = ? AND id != ?'
        ).get(currentProduit.client_base_id, type_produit, produitId);

        if (existingProduit) {
          return res.status(400).json({
            error: `Ce client possède déjà un produit "${type_produit}". Impossible de modifier le type.`
          });
        }

        console.log(`Changement type_produit: ${currentProduit.type_produit} → ${type_produit} (produit ${produitId})`);
      }

      updates.push('type_produit = ?');
      params.push(type_produit);
    }

    if (donnees_techniques !== undefined) {
      updates.push('donnees_techniques = ?');
      params.push(JSON.stringify(donnees_techniques));
    }
    if (statut !== undefined) {
      updates.push('statut = ?');
      params.push(statut);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(produitId);

    db.prepare(`UPDATE clients_produits SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const produit = db.prepare('SELECT * FROM clients_produits WHERE id = ?').get(produitId);
    if (produit.donnees_techniques) {
      produit.donnees_techniques = JSON.parse(produit.donnees_techniques);
    }

    res.json(produit);
  } catch (error) {
    console.error('Erreur PATCH /produits/:produitId:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /clients/:id/produits - Ajouter un produit à un client existant
router.post('/:id/produits', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { type_produit, donnees_techniques } = req.body;

    if (!type_produit) {
      return res.status(400).json({ error: 'type_produit requis' });
    }

    // Vérifier que le client existe
    const clientBase = db.prepare('SELECT id FROM client_base WHERE id = ?').get(id);
    if (!clientBase) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Vérifier que ce produit n'existe pas déjà
    const existing = db.prepare(`
      SELECT id FROM clients_produits
      WHERE client_base_id = ? AND type_produit = ?
    `).get(id, type_produit);

    if (existing) {
      return res.status(400).json({
        error: 'Ce client possède déjà ce produit'
      });
    }

    // Insérer le nouveau produit
    const result = db.prepare(`
      INSERT INTO clients_produits (
        client_base_id, type_produit, donnees_techniques, statut, assigned_to
      ) VALUES (?, ?, ?, 'nouveau', ?)
    `).run(
      id,
      type_produit,
      donnees_techniques ? JSON.stringify(donnees_techniques) : null,
      req.user.id
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      client_base_id: id,
      type_produit,
      message: 'Produit ajouté avec succès'
    });
  } catch (error) {
    console.error('Erreur POST /produits:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SUPPRESSION
// ============================================

// DELETE /clients/produits/:produitId - Supprimer UN produit (pas le client)
router.delete('/produits/:produitId', authenticateToken, (req, res) => {
  try {
    const { produitId } = req.params;

    // Vérifier combien de produits le client possède
    const produit = db.prepare(`
      SELECT client_base_id FROM clients_produits WHERE id = ?
    `).get(produitId);

    if (!produit) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    const count = db.prepare(`
      SELECT COUNT(*) as count FROM clients_produits
      WHERE client_base_id = ?
    `).get(produit.client_base_id);

    if (count.count === 1) {
      return res.status(400).json({
        error: 'Impossible de supprimer le dernier produit. Supprimez le client entier.'
      });
    }

    db.prepare('DELETE FROM clients_produits WHERE id = ?').run(produitId);

    res.json({ message: 'Produit supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /produits/:produitId:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /clients/:id - Supprimer client ET tous ses produits (CASCADE)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // CASCADE DELETE supprimera automatiquement:
    // - clients_produits (FK client_base_id)
    // - client_comments (FK client_base_id)
    // - client_appointments (FK client_base_id)
    // - client_documents (FK client_base_id)

    db.prepare('DELETE FROM client_base WHERE id = ?').run(id);

    res.json({ message: 'Client et tous ses produits supprimés' });
  } catch (error) {
    console.error('Erreur DELETE /clients/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// COMMENTAIRES (partagés entre produits)
// ============================================

router.get('/:id/comments', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Validate client exists
    const clientExists = db.prepare('SELECT id FROM client_base WHERE id = ?').get(parseInt(id));
    if (!clientExists) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    const comments = db.prepare(`
      SELECT cc.*, u.username
      FROM client_comments cc
      LEFT JOIN users u ON cc.user_id = u.id
      WHERE cc.client_base_id = ?
      ORDER BY cc.created_at DESC
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
      'INSERT INTO client_comments (client_base_id, user_id, content) VALUES (?, ?, ?)'
    ).run(parseInt(id), req.user.id, content.trim());

    res.status(201).json({
      id: result.lastInsertRowid,
      client_base_id: parseInt(id),
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

// ============================================
// RENDEZ-VOUS (partagés entre produits)
// ============================================

router.get('/:id/appointments', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const appointments = db.prepare(`
      SELECT ca.*, u.username
      FROM client_appointments ca
      LEFT JOIN users u ON ca.user_id = u.id
      WHERE ca.client_base_id = ?
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
      'INSERT INTO client_appointments (client_base_id, user_id, title, date, time) VALUES (?, ?, ?, ?, ?)'
    ).run(id, req.user.id, title, date, time);

    res.status(201).json({
      id: result.lastInsertRowid,
      client_base_id: id,
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

// ============================================
// IMPORT/EXPORT
// ============================================

// Import CSV avec type_produit fourni par l'utilisateur
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

      // Récupérer type_produit depuis le body (envoyé par FormData)
      const type_produit = req.body.type_produit;

      // Validation du type_produit
      const validTypes = ['destratification', 'pression', 'matelas_isolants'];
      if (!type_produit || !validTypes.includes(type_produit)) {
        // Supprimer le fichier uploadé avant de retourner l'erreur
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: `Type de produit invalide. Valeurs acceptées: ${validTypes.join(', ')}`
        });
      }

      console.log(`📥 Import CSV démarré - Produit: ${type_produit} - Utilisateur: ${req.user.username}`);

      const results = [];
      const filePath = req.file.path;

      fs.createReadStream(filePath, { encoding: 'utf8' })
        .pipe(csv({ separator: ';', skipLines: 0, mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          let imported = 0;
          let errors = [];

          for (let i = 0; i < results.length; i++) {
            const row = results[i];
            try {
              // Validation basique
              if (!row.societe || !row.societe.trim()) {
                errors.push(`Ligne ${i + 2}: Société manquante`);
                continue;
              }

              // Créer client_base
              const baseResult = db.prepare(`
                INSERT INTO client_base (
                  societe, adresse, ville, code_postal, telephone, siret,
                  nom_site, adresse_travaux, ville_travaux, code_postal_travaux,
                  nom_signataire, fonction, telephone_signataire, mail_signataire,
                  code_naf
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                row.societe?.trim() || null,
                row.adresse?.trim() || null,
                row.ville?.trim() || null,
                row.code_postal?.trim() || null,
                row.telephone?.trim() || null,
                row.siret?.trim() || null,
                row.nom_site?.trim() || null,
                row.adresse_travaux?.trim() || null,
                row.ville_travaux?.trim() || null,
                row.code_postal_travaux?.trim() || null,
                row.nom_signataire?.trim() || null,
                row.fonction?.trim() || null,
                row.telephone_signataire?.trim() || null,
                row.mail_signataire?.trim() || null,
                row.code_naf?.trim() || null
              );

              const clientBaseId = baseResult.lastInsertRowid;

              // Utiliser le type_produit fourni par l'utilisateur (ignorer celui du CSV)
              db.prepare(`
                INSERT INTO clients_produits (
                  client_base_id, type_produit, statut, assigned_to
                ) VALUES (?, ?, ?, ?)
              `).run(
                clientBaseId,
                type_produit, // Type sélectionné par l'utilisateur
                row.statut?.trim() || 'nouveau',
                req.user.id
              );

              imported++;
              console.log(`✓ Ligne ${i + 2}: ${row.societe} importé (${type_produit})`);
            } catch (error) {
              console.error(`✗ Ligne ${i + 2}: ${error.message}`);
              errors.push(`Ligne ${i + 2} (${row.societe || 'N/A'}): ${error.message}`);
            }
          }

          fs.unlinkSync(filePath);

          // Réponse avec détails
          if (imported === 0 && errors.length > 0) {
            return res.status(400).json({
              error: 'Aucun client importé. Erreurs:\n' + errors.slice(0, 5).join('\n')
            });
          }

          console.log(`✅ Import terminé: ${imported}/${results.length} clients importés (${type_produit})`);

          res.json({
            message: 'Import réussi',
            imported,
            type_produit,
            total: results.length,
            errors: errors.length > 0 ? errors : undefined
          });
        });
    });
  } catch (error) {
    console.error('Erreur import CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export Excel (1 ligne par produit)
router.get('/export/excel', authenticateToken, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');

    let query = `
      SELECT
        cb.*, cp.type_produit, cp.statut, cp.assigned_to, u.username as assigned_username
      FROM client_base cb
      INNER JOIN clients_produits cp ON cb.id = cp.client_base_id
      LEFT JOIN users u ON cp.assigned_to = u.id
    `;
    let params = [];
    let conditions = [];

    // Si télépro, voir seulement ses produits
    if (req.user.role === 'telepro') {
      conditions.push('cp.assigned_to = ?');
      params.push(req.user.id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY cb.updated_at DESC, cp.type_produit ASC';
    const clients = db.prepare(query).all(...params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Clients');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Société', key: 'societe', width: 25 },
      { header: 'Adresse', key: 'adresse', width: 30 },
      { header: 'Code Postal', key: 'code_postal', width: 12 },
      { header: 'Téléphone', key: 'telephone', width: 15 },
      { header: 'SIRET', key: 'siret', width: 18 },
      { header: 'Produit', key: 'type_produit', width: 18 },
      { header: 'Statut', key: 'statut', width: 18 },
      { header: 'Assigné à', key: 'assigned_username', width: 20 },
      { header: 'Date création', key: 'created_at', width: 20 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' }
    };

    clients.forEach((client, index) => {
      const row = worksheet.addRow({
        ...client,
        created_at: client.created_at ? new Date(client.created_at).toLocaleString('fr-FR') : '',
        assigned_username: client.assigned_username || 'Non assigné'
      });

      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
      }
    });

    const filename = `clients_export_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Erreur export Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ATTRIBUTION
// ============================================

// Attribution d'un produit (admin only)
router.patch('/:id/assign', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params; // produit_id
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const produit = db.prepare('SELECT id FROM clients_produits WHERE id = ?').get(id);
    if (!produit) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    db.prepare('UPDATE clients_produits SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(userId, id);

    res.json({ message: 'Produit attribué avec succès' });

  } catch (error) {
    console.error('Erreur attribution:', error);
    res.status(500).json({ error: error.message });
  }
});

// Attribution en masse de produits (admin only)
router.post('/bulk-assign', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { clientIds, userId } = req.body; // clientIds = produit_ids maintenant

    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({ error: 'clientIds requis (array non vide)' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Update clients_produits (pas client_base)
    const placeholders = clientIds.map(() => '?').join(',');
    const updateQuery = `
      UPDATE clients_produits
      SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `;

    const result = db.prepare(updateQuery).run(userId, ...clientIds);

    res.json({
      message: `${result.changes} produit(s) attribué(s) avec succès`,
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

// Suppression en masse de produits (garde client si a d'autres produits)
router.post('/produits/bulk-delete', authenticateToken, (req, res) => {
  try {
    const { produitIds } = req.body;

    if (!produitIds || !Array.isArray(produitIds) || produitIds.length === 0) {
      return res.status(400).json({ error: 'produitIds requis (array non vide)' });
    }

    console.log(`Suppression en masse: ${produitIds.length} produit(s)`);

    // Récupérer les client_base_id concernés avant suppression
    const placeholders = produitIds.map(() => '?').join(',');
    const affectedClients = db.prepare(`
      SELECT DISTINCT client_base_id FROM clients_produits WHERE id IN (${placeholders})
    `).all(...produitIds);

    // Supprimer les produits
    const deleteResult = db.prepare(`
      DELETE FROM clients_produits WHERE id IN (${placeholders})
    `).run(...produitIds);

    console.log(`${deleteResult.changes} produit(s) supprimé(s)`);

    // Supprimer les client_base orphelins (qui n'ont plus aucun produit)
    let orphansDeleted = 0;
    for (const { client_base_id } of affectedClients) {
      const remainingProducts = db.prepare(
        'SELECT COUNT(*) as count FROM clients_produits WHERE client_base_id = ?'
      ).get(client_base_id);

      if (remainingProducts.count === 0) {
        db.prepare('DELETE FROM client_base WHERE id = ?').run(client_base_id);
        orphansDeleted++;
        console.log(`Client base ${client_base_id} supprimé (plus de produits)`);
      }
    }

    res.json({
      message: `${deleteResult.changes} produit(s) supprimé(s)`,
      produitsDeleted: deleteResult.changes,
      clientsDeleted: orphansDeleted
    });

  } catch (error) {
    console.error('Erreur suppression en masse:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DUPLICATION
// ============================================

// Dupliquer un PRODUIT spécifique avec choix du type_produit cible
router.post('/produits/:produitId/duplicate', authenticateToken, (req, res) => {
  const { produitId } = req.params;
  const { type_produit } = req.body;

  if (!type_produit) {
    return res.status(400).json({ error: 'type_produit requis dans le body' });
  }

  // Valider type_produit
  const validTypes = ['destratification', 'pression', 'matelas_isolants'];
  if (!validTypes.includes(type_produit)) {
    return res.status(400).json({ error: 'type_produit invalide' });
  }

  // Récupérer le produit source (avant la transaction)
  const sourceProduit = db.prepare(`
    SELECT cp.*, cb.*
    FROM clients_produits cp
    INNER JOIN client_base cb ON cp.client_base_id = cb.id
    WHERE cp.id = ?
  `).get(produitId);

  if (!sourceProduit) {
    return res.status(404).json({ error: 'Produit source non trouvé' });
  }

  console.log(`Duplication produit ${produitId}: ${sourceProduit.societe} → ${type_produit}`);

  // Transaction atomique: tout ou rien
  const duplicateTransaction = db.transaction(() => {
    // Créer nouveau client_base (copie)
    const newBaseResult = db.prepare(`
      INSERT INTO client_base (
        societe, adresse, code_postal, telephone, siret,
        nom_site, adresse_travaux, code_postal_travaux,
        nom_signataire, fonction, telephone_signataire, mail_signataire,
        nom_contact_site, prenom_contact_site, fonction_contact_site,
        mail_contact_site, telephone_contact_site,
        code_naf, donnees_enrichies
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `${sourceProduit.societe} (copie)`,
      sourceProduit.adresse,
      sourceProduit.code_postal,
      sourceProduit.telephone,
      sourceProduit.siret,
      sourceProduit.nom_site,
      sourceProduit.adresse_travaux,
      sourceProduit.code_postal_travaux,
      sourceProduit.nom_signataire,
      sourceProduit.fonction,
      sourceProduit.telephone_signataire,
      sourceProduit.mail_signataire,
      sourceProduit.nom_contact_site,
      sourceProduit.prenom_contact_site,
      sourceProduit.fonction_contact_site,
      sourceProduit.mail_contact_site,
      sourceProduit.telephone_contact_site,
      sourceProduit.code_naf,
      sourceProduit.donnees_enrichies
    );

    const newClientBaseId = newBaseResult.lastInsertRowid;

    // Créer le produit avec le type choisi (données techniques réinitialisées)
    const newProduitResult = db.prepare(`
      INSERT INTO clients_produits (
        client_base_id, type_produit, donnees_techniques, statut, assigned_to
      ) VALUES (?, ?, '{}', 'nouveau', ?)
    `).run(
      newClientBaseId,
      type_produit,
      req.user.id
    );

    // Copier commentaires
    const commentsResult = db.prepare(`
      INSERT INTO client_comments (client_base_id, user_id, content, created_at)
      SELECT ?, user_id, content, CURRENT_TIMESTAMP
      FROM client_comments WHERE client_base_id = ?
    `).run(newClientBaseId, sourceProduit.client_base_id);

    // Copier rendez-vous futurs
    const appointmentsResult = db.prepare(`
      INSERT INTO client_appointments (client_base_id, user_id, title, date, time, location, notes, created_at)
      SELECT ?, user_id, title, date, time, location, notes, CURRENT_TIMESTAMP
      FROM client_appointments
      WHERE client_base_id = ? AND datetime(date || ' ' || COALESCE(time, '00:00')) >= datetime('now')
    `).run(newClientBaseId, sourceProduit.client_base_id);

    // Copier documents (fichiers physiques non copiés, seulement les références)
    const documentsResult = db.prepare(`
      INSERT INTO client_documents (client_base_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at)
      SELECT ?, file_name, file_path, file_type, file_size, uploaded_by, CURRENT_TIMESTAMP
      FROM client_documents WHERE client_base_id = ?
    `).run(newClientBaseId, sourceProduit.client_base_id);

    console.log(`✅ Duplication réussie: ${commentsResult.changes} commentaires, ${appointmentsResult.changes} RDV, ${documentsResult.changes} docs`);

    return {
      message: 'Client dupliqué avec succès',
      id: newClientBaseId,
      client_base_id: newClientBaseId,
      produit_id: newProduitResult.lastInsertRowid,
      type_produit,
      copied: {
        comments: commentsResult.changes,
        appointments: appointmentsResult.changes,
        documents: documentsResult.changes
      }
    };
  });

  // Exécuter la transaction
  try {
    const result = duplicateTransaction();
    res.status(201).json(result);
  } catch (error) {
    console.error('Erreur duplication produit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dupliquer un client (ancienne méthode - conservée pour rétrocompat)
// RECOMMANDÉ: Utiliser POST /clients/produits/:produitId/duplicate
router.post('/:id/duplicate', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le client_base
    const sourceClient = db.prepare('SELECT * FROM client_base WHERE id = ?').get(id);
    if (!sourceClient) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Récupérer le premier produit pour copier son type
    const sourceProduit = db.prepare('SELECT * FROM clients_produits WHERE client_base_id = ? LIMIT 1').get(id);

    // Créer nouveau client_base (copie)
    const newBaseResult = db.prepare(`
      INSERT INTO client_base (
        societe, adresse, code_postal, telephone, siret,
        nom_site, adresse_travaux, code_postal_travaux,
        nom_signataire, fonction, telephone_signataire, mail_signataire,
        nom_contact_site, prenom_contact_site, fonction_contact_site,
        mail_contact_site, telephone_contact_site,
        code_naf, donnees_enrichies
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `${sourceClient.societe} (copie)`,
      sourceClient.adresse,
      sourceClient.code_postal,
      sourceClient.telephone,
      sourceClient.siret,
      sourceClient.nom_site,
      sourceClient.adresse_travaux,
      sourceClient.code_postal_travaux,
      sourceClient.nom_signataire,
      sourceClient.fonction,
      sourceClient.telephone_signataire,
      sourceClient.mail_signataire,
      sourceClient.nom_contact_site,
      sourceClient.prenom_contact_site,
      sourceClient.fonction_contact_site,
      sourceClient.mail_contact_site,
      sourceClient.telephone_contact_site,
      sourceClient.code_naf,
      sourceClient.donnees_enrichies
    );

    const newClientBaseId = newBaseResult.lastInsertRowid;

    // Créer 1 produit identique
    if (sourceProduit) {
      db.prepare(`
        INSERT INTO clients_produits (
          client_base_id, type_produit, donnees_techniques, statut, assigned_to
        ) VALUES (?, ?, ?, 'nouveau', ?)
      `).run(
        newClientBaseId,
        sourceProduit.type_produit,
        sourceProduit.donnees_techniques,
        req.user.id
      );
    }

    res.status(201).json({
      message: 'Client dupliqué avec succès',
      id: newClientBaseId,
      client_base_id: newClientBaseId
    });

  } catch (error) {
    console.error('Erreur duplication client:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
