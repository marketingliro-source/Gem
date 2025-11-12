const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Récupérer les leads (filtrage selon le rôle)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { status, page = 1, limit = 20, search, assigned_to } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT leads.*, users.username as assigned_username FROM leads LEFT JOIN users ON leads.assigned_to = users.id';
    let countQuery = 'SELECT COUNT(*) as total FROM leads';
    let params = [];
    let conditions = [];

    // Si agent, voir seulement ses leads
    if (req.user.role === 'agent') {
      conditions.push('assigned_to = ?');
      params.push(req.user.id);
    }
    // Si admin ET filtre par agent spécifié, filtrer par cet agent
    else if (req.user.role === 'admin' && assigned_to) {
      conditions.push('assigned_to = ?');
      params.push(parseInt(assigned_to));
    }

    // Filtrer par statut
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    // Recherche par nom, téléphone, email, adresse, mobile
    if (search) {
      conditions.push('(first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR mobile_phone LIKE ? OR email LIKE ? OR address LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';

    const leads = db.prepare(query).all(...params, parseInt(limit), offset);
    const total = db.prepare(countQuery).get(...params).total;

    // Si c'est une recherche, retourner directement le tableau
    if (search) {
      return res.json(leads);
    }

    res.json({
      leads,
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

// Récupérer les leads non attribués (admin seulement)
router.get('/unassigned', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const leads = db.prepare('SELECT * FROM leads WHERE assigned_to IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?').all(parseInt(limit), offset);
    const total = db.prepare('SELECT COUNT(*) as total FROM leads WHERE assigned_to IS NULL').get().total;

    res.json({
      leads,
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

// Créer un lead
router.post('/', authenticateToken, (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, mobile_phone } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'Nom et prénom requis' });
    }

    const result = db.prepare('INSERT INTO leads (first_name, last_name, email, phone, address, mobile_phone) VALUES (?, ?, ?, ?, ?, ?)').run(first_name, last_name, email, phone, address, mobile_phone);

    res.status(201).json({
      id: result.lastInsertRowid,
      first_name,
      last_name,
      email,
      phone,
      address,
      mobile_phone,
      status: 'nouveau'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour un lead
router.patch('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, phone, address, mobile_phone, status } = req.body;

    const updates = [];
    const params = [];

    if (first_name) { updates.push('first_name = ?'); params.push(first_name); }
    if (last_name) { updates.push('last_name = ?'); params.push(last_name); }
    if (email) { updates.push('email = ?'); params.push(email); }
    if (phone) { updates.push('phone = ?'); params.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (mobile_phone !== undefined) { updates.push('mobile_phone = ?'); params.push(mobile_phone); }
    if (status) { updates.push('status = ?'); params.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Attribuer des leads (admin seulement)
router.post('/assign', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { lead_ids, user_id } = req.body;

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'IDs de leads manquants' });
    }

    const placeholders = lead_ids.map(() => '?').join(',');
    db.prepare(`UPDATE leads SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(user_id, ...lead_ids);

    res.json({ message: `${lead_ids.length} lead(s) attribué(s)` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recycler des leads
router.post('/recycle', authenticateToken, (req, res) => {
  try {
    const { lead_ids } = req.body;

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'IDs de leads manquants' });
    }

    const placeholders = lead_ids.map(() => '?').join(',');

    // Supprimer commentaires et RDV
    db.prepare(`DELETE FROM comments WHERE lead_id IN (${placeholders})`).run(...lead_ids);
    db.prepare(`DELETE FROM appointments WHERE lead_id IN (${placeholders})`).run(...lead_ids);

    // Réinitialiser le lead
    db.prepare(`UPDATE leads SET status = 'nouveau', assigned_to = NULL, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(...lead_ids);

    res.json({ message: `${lead_ids.length} lead(s) recyclé(s)` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer des leads
router.delete('/bulk', authenticateToken, (req, res) => {
  try {
    const { lead_ids } = req.body;

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'IDs de leads manquants' });
    }

    const placeholders = lead_ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM leads WHERE id IN (${placeholders})`).run(...lead_ids);

    res.json({ message: `${lead_ids.length} lead(s) supprimé(s)` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import CSV
router.post('/import', authenticateToken, requireAdmin, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier manquant' });
    }

    const results = [];
    let errors = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        try {
          // Vérifier que les colonnes requises existent
          if (!data.first_name || !data.last_name) {
            errors.push(`Ligne ignorée: Nom ou prénom manquant`);
            return;
          }

          const result = db.prepare('INSERT INTO leads (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)').run(
            data.first_name,
            data.last_name,
            data.email || null,
            data.phone || null
          );
          results.push(result.lastInsertRowid);
        } catch (error) {
          errors.push(`Erreur ligne: ${error.message}`);
        }
      })
      .on('end', () => {
        // Supprimer le fichier temporaire
        fs.unlinkSync(req.file.path);

        res.json({
          message: `${results.length} lead(s) importé(s)`,
          imported: results.length,
          errors: errors.length > 0 ? errors : undefined
        });
      })
      .on('error', (error) => {
        fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exporter les leads en Excel
router.get('/export/excel', authenticateToken, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');

    let query = 'SELECT leads.*, users.username as assigned_username FROM leads LEFT JOIN users ON leads.assigned_to = users.id';
    let params = [];
    let conditions = [];

    // Si agent, voir seulement ses leads
    if (req.user.role === 'agent') {
      conditions.push('assigned_to = ?');
      params.push(req.user.id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY updated_at DESC';
    const leads = db.prepare(query).all(...params);

    // Créer un nouveau classeur Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads');

    // Définir les colonnes avec formatage
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Prénom', key: 'first_name', width: 15 },
      { header: 'Nom', key: 'last_name', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Téléphone', key: 'phone', width: 15 },
      { header: 'Statut', key: 'status', width: 15 },
      { header: 'Assigné à', key: 'assigned_username', width: 20 },
      { header: 'Date de création', key: 'created_at', width: 20 },
      { header: 'Dernière mise à jour', key: 'updated_at', width: 20 }
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
    leads.forEach((lead, index) => {
      const row = worksheet.addRow({
        ...lead,
        created_at: lead.created_at ? new Date(lead.created_at).toLocaleString('fr-FR') : '',
        updated_at: lead.updated_at ? new Date(lead.updated_at).toLocaleString('fr-FR') : '',
        assigned_username: lead.assigned_username || 'Non assigné'
      });

      // Alternance de couleurs pour les lignes
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
      }

      // Colorier selon le statut
      const statusColors = {
        'nouveau': 'FF10B981',
        'nrp': 'FFF59E0B',
        'a_rappeler': 'FF3B82F6',
        'pas_interesse': 'FFEF4444',
        'trash': 'FF6B7280'
      };

      if (statusColors[lead.status]) {
        row.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: statusColors[lead.status] }
        };
        row.getCell('status').font = { color: { argb: 'FFFFFFFF' }, bold: true };
        row.getCell('status').alignment = { horizontal: 'center', vertical: 'middle' };
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
      to: `I1`
    };

    // Générer le nom du fichier avec la date
    const filename = `leads_export_${new Date().toISOString().split('T')[0]}.xlsx`;

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
