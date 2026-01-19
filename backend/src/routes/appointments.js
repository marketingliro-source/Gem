const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Récupérer tous les RDV (vue calendrier globale)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { date, start_date, end_date } = req.query;

    let query = `
      SELECT
        client_appointments.id,
        client_appointments.client_base_id,
        client_appointments.produit_id,
        client_appointments.title,
        client_appointments.date,
        client_appointments.time,
        client_appointments.location,
        client_appointments.notes,
        client_appointments.created_at,
        client_base.societe,
        client_base.nom_signataire,
        users.username,
        cp.type_produit,
        cp.statut
      FROM client_appointments
      JOIN client_base ON client_appointments.client_base_id = client_base.id
      JOIN users ON client_appointments.user_id = users.id
      LEFT JOIN clients_produits cp ON client_appointments.produit_id = cp.id
      WHERE 1=1
    `;
    let params = [];

    // Si télépro, voir seulement ses RDV
    if (req.user.role === 'telepro') {
      query += ' AND client_appointments.user_id = ?';
      params.push(req.user.id);
    }

    // Filtrer par date exacte
    if (date) {
      query += ' AND client_appointments.date = ?';
      params.push(date);
    }

    // Filtrer par plage de dates
    if (start_date && end_date) {
      query += ' AND client_appointments.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += ' ORDER BY client_appointments.date, client_appointments.time';

    const appointments = db.prepare(query).all(...params);
    res.json(appointments);
  } catch (error) {
    console.error('Erreur GET appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Créer un nouveau RDV
router.post('/', authenticateToken, (req, res) => {
  try {
    const { client_base_id, produit_id, title, date, time, location, notes } = req.body;

    // Validation des champs requis
    if (!client_base_id || !title || !date || !time) {
      return res.status(400).json({
        error: 'Champs manquants (client_base_id, title, date, time requis)'
      });
    }

    // Vérifier que le client existe
    const client = db.prepare('SELECT id FROM client_base WHERE id = ?').get(client_base_id);
    if (!client) {
      return res.status(404).json({ error: 'Client introuvable' });
    }

    // Vérifier que le produit existe et appartient bien au client (si fourni)
    if (produit_id) {
      const produit = db.prepare('SELECT id FROM clients_produits WHERE id = ? AND client_base_id = ?').get(produit_id, client_base_id);
      if (!produit) {
        return res.status(400).json({ error: 'Produit invalide ou n\'appartient pas à ce client' });
      }
    }

    // Créer le rendez-vous
    const result = db.prepare(`
      INSERT INTO client_appointments (client_base_id, user_id, produit_id, title, date, time, location, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      client_base_id,
      req.user.id, // L'utilisateur connecté est assigné au RDV
      produit_id || null,
      title,
      date,
      time,
      location || null,
      notes || null
    );

    // Retourner le RDV créé avec les infos complètes
    const newAppointment = db.prepare(`
      SELECT
        client_appointments.id,
        client_appointments.client_base_id,
        client_appointments.produit_id,
        client_appointments.title,
        client_appointments.date,
        client_appointments.time,
        client_appointments.location,
        client_appointments.notes,
        client_appointments.created_at,
        client_base.societe,
        client_base.nom_signataire,
        users.username,
        cp.type_produit,
        cp.statut
      FROM client_appointments
      JOIN client_base ON client_appointments.client_base_id = client_base.id
      JOIN users ON client_appointments.user_id = users.id
      LEFT JOIN clients_produits cp ON client_appointments.produit_id = cp.id
      WHERE client_appointments.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newAppointment);
  } catch (error) {
    console.error('Erreur POST appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour un RDV (drag & drop dans le calendrier)
router.patch('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { date, time, title, location, notes } = req.body;

    // Vérifier que le RDV existe et appartient à l'utilisateur (ou admin)
    const appointment = db.prepare('SELECT * FROM client_appointments WHERE id = ?').get(parseInt(id));

    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }

    // Vérifier les permissions (télépro ne peut modifier que ses RDV)
    if (req.user.role === 'telepro' && appointment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // Construire la requête UPDATE dynamiquement
    const updates = [];
    const params = [];

    if (date !== undefined) {
      updates.push('date = ?');
      params.push(date);
    }
    if (time !== undefined) {
      updates.push('time = ?');
      params.push(time);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (location !== undefined) {
      updates.push('location = ?');
      params.push(location);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    params.push(parseInt(id));
    const query = `UPDATE client_appointments SET ${updates.join(', ')} WHERE id = ?`;

    db.prepare(query).run(...params);

    // Retourner le RDV mis à jour
    const updatedAppointment = db.prepare('SELECT * FROM client_appointments WHERE id = ?').get(parseInt(id));
    res.json(updatedAppointment);
  } catch (error) {
    console.error('Erreur PATCH appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un RDV
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le RDV existe
    const appointment = db.prepare('SELECT * FROM client_appointments WHERE id = ?').get(parseInt(id));

    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }

    // Vérifier les permissions (télépro ne peut supprimer que ses RDV)
    if (req.user.role === 'telepro' && appointment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    db.prepare('DELETE FROM client_appointments WHERE id = ?').run(parseInt(id));

    res.json({ message: 'Rendez-vous supprimé avec succès' });
  } catch (error) {
    console.error('Erreur DELETE appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
