const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Récupérer tous les utilisateurs (admin seulement)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    console.log('GET /users - User:', req.user?.username, 'Role:', req.user?.role);

    // Vérifier que la base de données est accessible
    if (!db) {
      console.error('Database connection is undefined');
      return res.status(500).json({ error: 'Database not available' });
    }

    const users = db.prepare('SELECT id, username, role, allowed_ip, ip_restriction_enabled, created_at FROM users').all();
    console.log(`GET /users - Found ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error('Error in GET /users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Créer un utilisateur (admin seulement)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { username, password, role, allowed_ip, ip_restriction_enabled } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    if (!['admin', 'telepro'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    // Inclure les paramètres de restriction IP
    const result = db.prepare(
      'INSERT INTO users (username, password, role, allowed_ip, ip_restriction_enabled) VALUES (?, ?, ?, ?, ?)'
    ).run(
      username,
      hashedPassword,
      role,
      allowed_ip || null,
      ip_restriction_enabled ? 1 : 0
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      username,
      role,
      allowed_ip: allowed_ip || null,
      ip_restriction_enabled: ip_restriction_enabled ? 1 : 0
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Nom d\'utilisateur déjà utilisé' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Mettre à jour un utilisateur (admin seulement)
router.patch('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, allowed_ip, ip_restriction_enabled } = req.body;

    const updates = [];
    const params = [];

    if (username) {
      updates.push('username = ?');
      params.push(username);
    }

    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (role && ['admin', 'telepro'].includes(role)) {
      updates.push('role = ?');
      params.push(role);
    }

    if (allowed_ip !== undefined) {
      updates.push('allowed_ip = ?');
      params.push(allowed_ip || null);
    }

    if (ip_restriction_enabled !== undefined) {
      updates.push('ip_restriction_enabled = ?');
      params.push(ip_restriction_enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    params.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = db.prepare('SELECT id, username, role, allowed_ip, ip_restriction_enabled, created_at FROM users WHERE id = ?').get(id);
    res.json(user);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Nom d\'utilisateur déjà utilisé' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Supprimer un utilisateur (admin seulement)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les télépros pour attribution
router.get('/telepros', authenticateToken, (req, res) => {
  try {
    const telepros = db.prepare('SELECT id, username FROM users WHERE role = ?').all('telepro');
    res.json(telepros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Alias pour compatibilité avec Calendar.jsx
router.get('/agents', authenticateToken, (req, res) => {
  try {
    const agents = db.prepare('SELECT id, username FROM users WHERE role = ?').all('telepro');
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
