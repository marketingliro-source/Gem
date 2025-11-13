const express = require('express');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Récupérer les clients (filtrage selon le rôle)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { page = 1, limit = 20, search, statut, type_produit, code_naf } = req.query;
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
        type_produit, donnees_techniques, code_naf,
        assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      societe, adresse, code_postal, telephone, siret,
      nom_site, adresse_travaux, code_postal_travaux,
      nom_signataire, fonction, telephone_signataire, mail_signataire,
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
    const comments = db.prepare(`
      SELECT client_comments.*, users.username
      FROM client_comments
      LEFT JOIN users ON client_comments.user_id = users.id
      WHERE client_id = ?
      ORDER BY created_at DESC
    `).all(id);

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/comments', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Le contenu est requis' });
    }

    const result = db.prepare(
      'INSERT INTO client_comments (client_id, user_id, content) VALUES (?, ?, ?)'
    ).run(id, req.user.id, content);

    res.status(201).json({
      id: result.lastInsertRowid,
      client_id: id,
      user_id: req.user.id,
      content
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/comments/:commentId', authenticateToken, (req, res) => {
  try {
    const { commentId } = req.params;
    db.prepare('DELETE FROM client_comments WHERE id = ?').run(commentId);
    res.json({ message: 'Commentaire supprimé' });
  } catch (error) {
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

// Exporter les clients en Excel
router.get('/export/excel', authenticateToken, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');

    let query = 'SELECT clients.*, users.username as assigned_username FROM clients LEFT JOIN users ON clients.assigned_to = users.id';
    let params = [];
    let conditions = [];

    // Si agent, voir seulement ses clients
    if (req.user.role === 'agent') {
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

    // Définir les colonnes avec formatage
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Prénom', key: 'first_name', width: 15 },
      { header: 'Nom', key: 'last_name', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Téléphone', key: 'phone', width: 15 },
      { header: 'Téléphone fixe', key: 'landline_phone', width: 15 },
      { header: 'Mobile', key: 'mobile_phone', width: 15 },
      { header: 'Adresse', key: 'address', width: 30 },
      { header: 'Ville', key: 'city', width: 20 },
      { header: 'Code postal', key: 'postal_code', width: 12 },
      { header: 'Courrier envoyé', key: 'mail_sent', width: 15 },
      { header: 'Date courrier', key: 'mail_sent_date', width: 18 },
      { header: 'Document reçu', key: 'document_received', width: 15 },
      { header: 'Date document', key: 'document_received_date', width: 18 },
      { header: 'Annulé', key: 'cancelled', width: 10 },
      { header: 'Date annulation', key: 'cancelled_date', width: 18 },
      { header: 'Assigné à', key: 'assigned_username', width: 20 },
      { header: 'Date de création', key: 'created_at', width: 20 }
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
        mail_sent: client.mail_sent ? 'Oui' : 'Non',
        document_received: client.document_received ? 'Oui' : 'Non',
        cancelled: client.cancelled ? 'Oui' : 'Non',
        mail_sent_date: client.mail_sent_date ? new Date(client.mail_sent_date).toLocaleString('fr-FR') : '',
        document_received_date: client.document_received_date ? new Date(client.document_received_date).toLocaleString('fr-FR') : '',
        cancelled_date: client.cancelled_date ? new Date(client.cancelled_date).toLocaleString('fr-FR') : '',
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

      // Colorier les colonnes de tracking
      if (client.mail_sent) {
        row.getCell('mail_sent').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF10B981' }
        };
        row.getCell('mail_sent').font = { color: { argb: 'FFFFFFFF' }, bold: true };
        row.getCell('mail_sent').alignment = { horizontal: 'center', vertical: 'middle' };
      }

      if (client.document_received) {
        row.getCell('document_received').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF3B82F6' }
        };
        row.getCell('document_received').font = { color: { argb: 'FFFFFFFF' }, bold: true };
        row.getCell('document_received').alignment = { horizontal: 'center', vertical: 'middle' };
      }

      if (client.cancelled) {
        row.getCell('cancelled').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF4444' }
        };
        row.getCell('cancelled').font = { color: { argb: 'FFFFFFFF' }, bold: true };
        row.getCell('cancelled').alignment = { horizontal: 'center', vertical: 'middle' };
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

module.exports = router;
