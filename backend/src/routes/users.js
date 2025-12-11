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

    // Vérifier que l'utilisateur existe
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Empêcher la suppression du dernier administrateur
    if (user.role === 'admin') {
      const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
      if (adminCount.count <= 1) {
        return res.status(400).json({
          error: 'Impossible de supprimer le dernier administrateur'
        });
      }
    }

    // Empêcher un admin de se supprimer lui-même
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        error: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    // Compter les données liées pour informer l'utilisateur
    const stats = {
      clients: 0,
      comments: 0,
      appointments: 0,
      documents: 0
    };

    try {
      stats.clients = db.prepare('SELECT COUNT(*) as count FROM clients_produits WHERE assigned_to = ?').get(id).count;
    } catch (e) {
      // Table clients_produits peut ne pas exister (ancien schéma)
      try {
        stats.clients = db.prepare('SELECT COUNT(*) as count FROM clients WHERE assigned_to = ?').get(id).count;
      } catch (e2) {}
    }

    try {
      stats.comments = db.prepare('SELECT COUNT(*) as count FROM client_comments WHERE user_id = ?').get(id).count;
    } catch (e) {}

    try {
      stats.appointments = db.prepare('SELECT COUNT(*) as count FROM client_appointments WHERE user_id = ?').get(id).count;
    } catch (e) {}

    try {
      stats.documents = db.prepare('SELECT COUNT(*) as count FROM client_documents WHERE uploaded_by = ?').get(id).count;
    } catch (e) {}

    // Construire le message d'impacts
    const impacts = [];
    if (stats.clients > 0) {
      impacts.push(`${stats.clients} client${stats.clients > 1 ? 's' : ''} désassigné${stats.clients > 1 ? 's' : ''}`);
    }
    if (stats.comments > 0) {
      impacts.push(`${stats.comments} commentaire${stats.comments > 1 ? 's' : ''} supprimé${stats.comments > 1 ? 's' : ''}`);
    }
    if (stats.appointments > 0) {
      impacts.push(`${stats.appointments} rendez-vous supprimé${stats.appointments > 1 ? 's' : ''}`);
    }
    if (stats.documents > 0) {
      impacts.push(`${stats.documents} document${stats.documents > 1 ? 's' : ''} conservé${stats.documents > 1 ? 's' : ''}`);
    }

    // Supprimer l'utilisateur (les contraintes CASCADE/SET NULL s'appliquent)
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    console.log(`✓ Utilisateur ${user.username} (ID: ${id}) supprimé par ${req.user.username}`);
    if (impacts.length > 0) {
      console.log(`  Impacts: ${impacts.join(', ')}`);
    }

    res.json({
      message: `Utilisateur "${user.username}" supprimé avec succès`,
      impacts: impacts,
      stats: stats
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
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
