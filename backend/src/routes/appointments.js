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
        client_appointments.title,
        client_appointments.date,
        client_appointments.time,
        client_appointments.location,
        client_appointments.notes,
        client_appointments.created_at,
        client_base.societe,
        client_base.nom_signataire,
        users.username
      FROM client_appointments
      JOIN client_base ON client_appointments.client_base_id = client_base.id
      JOIN users ON client_appointments.user_id = users.id
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
