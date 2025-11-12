const express = require('express');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Récupérer les clients (filtrage selon le rôle)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT clients.*, users.username as assigned_username FROM clients LEFT JOIN users ON clients.assigned_to = users.id';
    let countQuery = 'SELECT COUNT(*) as total FROM clients';
    let params = [];
    let conditions = [];

    // Si agent, voir seulement ses clients
    if (req.user.role === 'agent') {
      conditions.push('assigned_to = ?');
      params.push(req.user.id);
    }

    // Filtrer par statut
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    // Recherche par nom, téléphone, email, ville
    if (search) {
      conditions.push('(first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ?)');
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

    // Si c'est une recherche, retourner directement le tableau
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

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un client
router.post('/', authenticateToken, (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, postal_code } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'Nom et prénom requis' });
    }

    const result = db.prepare(
      'INSERT INTO clients (first_name, last_name, email, phone, address, city, postal_code, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(first_name, last_name, email, phone, address, city, postal_code, req.user.id);

    res.status(201).json({
      id: result.lastInsertRowid,
      first_name,
      last_name,
      email,
      phone,
      address,
      city,
      postal_code
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
      first_name, last_name, email, phone, address, city, postal_code,
      mail_sent, mail_sent_date, document_received, document_received_date,
      cancelled, cancelled_date, landline_phone, mobile_phone
    } = req.body;

    const updates = [];
    const params = [];

    if (first_name) { updates.push('first_name = ?'); params.push(first_name); }
    if (last_name) { updates.push('last_name = ?'); params.push(last_name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (city !== undefined) { updates.push('city = ?'); params.push(city); }
    if (postal_code !== undefined) { updates.push('postal_code = ?'); params.push(postal_code); }

    // Tracking fields
    if (mail_sent !== undefined) {
      updates.push('mail_sent = ?');
      params.push(mail_sent ? 1 : 0);
      if (mail_sent) {
        updates.push('mail_sent_date = ?');
        params.push(mail_sent_date || new Date().toISOString().split('T')[0]);
      }
    }
    if (document_received !== undefined) {
      updates.push('document_received = ?');
      params.push(document_received ? 1 : 0);
      if (document_received) {
        updates.push('document_received_date = ?');
        params.push(document_received_date || new Date().toISOString().split('T')[0]);
      }
    }
    if (cancelled !== undefined) {
      updates.push('cancelled = ?');
      params.push(cancelled ? 1 : 0);
      if (cancelled) {
        updates.push('cancelled_date = ?');
        params.push(cancelled_date || new Date().toISOString().split('T')[0]);
      }
    }
    if (landline_phone !== undefined) { updates.push('landline_phone = ?'); params.push(landline_phone); }
    if (mobile_phone !== undefined) { updates.push('mobile_phone = ?'); params.push(mobile_phone); }

    // Auto-update status based on tracking checkboxes
    if (cancelled !== undefined || document_received !== undefined || mail_sent !== undefined) {
      // Récupérer l'état actuel du client pour déterminer le nouveau statut
      const currentClient = db.prepare('SELECT mail_sent, document_received, cancelled FROM clients WHERE id = ?').get(id);

      const finalCancelled = cancelled !== undefined ? cancelled : currentClient.cancelled;
      const finalDocumentReceived = document_received !== undefined ? document_received : currentClient.document_received;
      const finalMailSent = mail_sent !== undefined ? mail_sent : currentClient.mail_sent;

      let newStatus = 'nouveau';
      if (finalCancelled) {
        newStatus = 'annule';
      } else if (finalDocumentReceived) {
        newStatus = 'documents_recus';
      } else if (finalMailSent) {
        newStatus = 'mail_envoye';
      }

      updates.push('status = ?');
      params.push(newStatus);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
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

// Convertir un lead en client
router.post('/convert-from-lead/:leadId', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;

    // Récupérer le lead
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead non trouvé' });
    }

    // Créer le client avec mapping des champs téléphone
    const result = db.prepare(
      'INSERT INTO clients (first_name, last_name, email, landline_phone, mobile_phone, address, assigned_to, converted_from_lead_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(lead.first_name, lead.last_name, lead.email, lead.phone, lead.mobile_phone, lead.address, lead.assigned_to, leadId);

    const clientId = result.lastInsertRowid;

    // Copier les commentaires
    const comments = db.prepare('SELECT * FROM comments WHERE lead_id = ?').all(leadId);
    for (const comment of comments) {
      db.prepare('INSERT INTO client_comments (client_id, user_id, content, created_at) VALUES (?, ?, ?, ?)').run(
        clientId, comment.user_id, comment.content, comment.created_at
      );
    }

    // Copier les rendez-vous
    const appointments = db.prepare('SELECT * FROM appointments WHERE lead_id = ?').all(leadId);
    for (const appointment of appointments) {
      db.prepare('INSERT INTO client_appointments (client_id, user_id, title, date, time, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        clientId, appointment.user_id, appointment.title, appointment.date, appointment.time, appointment.created_at
      );
    }

    // Supprimer le lead
    db.prepare('DELETE FROM leads WHERE id = ?').run(leadId);

    res.json({ message: 'Lead converti en client', clientId });
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
