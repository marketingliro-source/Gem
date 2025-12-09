const express = require('express');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Récupérer tous les statuts (filtrés selon rôle)
router.get('/', authenticateToken, (req, res) => {
  try {
    let query = 'SELECT * FROM statuts';

    // Si télépro, afficher seulement les statuts actifs
    if (req.user.role !== 'admin') {
      query += ' WHERE active = 1';
    }

    query += ' ORDER BY ordre ASC';

    const statuts = db.prepare(query).all();
    res.json(statuts);
  } catch (error) {
    console.error('Erreur récupération statuts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Créer un nouveau statut (admin only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { key, label, color, ordre } = req.body;

    if (!key || !label || !color) {
      return res.status(400).json({
        error: 'key, label et color requis'
      });
    }

    // Vérifier l'unicité de la clé
    const existing = db.prepare('SELECT id FROM statuts WHERE key = ?').get(key);
    if (existing) {
      return res.status(400).json({
        error: 'Un statut avec cette clé existe déjà'
      });
    }

    // Si ordre non fourni, prendre le max + 1
    let finalOrdre = ordre;
    if (!finalOrdre) {
      const maxOrdre = db.prepare('SELECT MAX(ordre) as max FROM statuts').get();
      finalOrdre = (maxOrdre.max || 0) + 1;
    }

    const result = db.prepare(`
      INSERT INTO statuts (key, label, color, ordre, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(key, label, color, finalOrdre);

    const newStatut = db.prepare('SELECT * FROM statuts WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(newStatut);
  } catch (error) {
    console.error('Erreur création statut:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modifier un statut (admin only)
router.patch('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { label, color, ordre } = req.body;

    const statut = db.prepare('SELECT * FROM statuts WHERE id = ?').get(id);
    if (!statut) {
      return res.status(404).json({ error: 'Statut non trouvé' });
    }

    const updates = [];
    const params = [];

    if (label !== undefined) {
      updates.push('label = ?');
      params.push(label);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }
    if (ordre !== undefined) {
      updates.push('ordre = ?');
      params.push(ordre);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    params.push(id);
    db.prepare(`UPDATE statuts SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updatedStatut = db.prepare('SELECT * FROM statuts WHERE id = ?').get(id);
    res.json(updatedStatut);
  } catch (error) {
    console.error('Erreur modification statut:', error);
    res.status(500).json({ error: error.message });
  }
});

// Activer/Désactiver un statut (admin only)
router.patch('/:id/toggle', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const statut = db.prepare('SELECT * FROM statuts WHERE id = ?').get(id);
    if (!statut) {
      return res.status(404).json({ error: 'Statut non trouvé' });
    }

    const newActive = statut.active === 1 ? 0 : 1;

    db.prepare('UPDATE statuts SET active = ? WHERE id = ?').run(newActive, id);

    const updatedStatut = db.prepare('SELECT * FROM statuts WHERE id = ?').get(id);

    res.json({
      message: newActive === 1 ? 'Statut activé' : 'Statut désactivé',
      statut: updatedStatut
    });
  } catch (error) {
    console.error('Erreur toggle statut:', error);
    res.status(500).json({ error: error.message });
  }
});

// Réordonner les statuts (admin only)
router.post('/reorder', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { statutIds } = req.body;

    if (!Array.isArray(statutIds) || statutIds.length === 0) {
      return res.status(400).json({ error: 'statutIds requis (array)' });
    }

    const updateOrdre = db.prepare('UPDATE statuts SET ordre = ? WHERE id = ?');

    statutIds.forEach((id, index) => {
      updateOrdre.run(index + 1, id);
    });

    const statuts = db.prepare('SELECT * FROM statuts ORDER BY ordre ASC').all();

    res.json({
      message: 'Statuts réordonnés avec succès',
      statuts
    });
  } catch (error) {
    console.error('Erreur réordonnancement:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
