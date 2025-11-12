const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Récupérer les commentaires d'un lead
router.get('/lead/:leadId', authenticateToken, (req, res) => {
  try {
    const { leadId } = req.params;

    const comments = db.prepare(`
      SELECT comments.*, users.username
      FROM comments
      JOIN users ON comments.user_id = users.id
      WHERE lead_id = ?
      ORDER BY created_at DESC
    `).all(leadId);

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ajouter un commentaire
router.post('/', authenticateToken, (req, res) => {
  try {
    const { lead_id, content } = req.body;

    if (!lead_id || !content) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    const result = db.prepare('INSERT INTO comments (lead_id, user_id, content) VALUES (?, ?, ?)').run(lead_id, req.user.id, content);

    const comment = db.prepare(`
      SELECT comments.*, users.username
      FROM comments
      JOIN users ON comments.user_id = users.id
      WHERE comments.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un commentaire
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);

    if (!comment) {
      return res.status(404).json({ error: 'Commentaire introuvable' });
    }

    // Seul l'auteur ou un admin peut supprimer
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    res.json({ message: 'Commentaire supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
