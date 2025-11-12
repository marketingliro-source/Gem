const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Fonction pour obtenir l'IP du client
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress;
};

// Connexion
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Identifiants manquants' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Vérification IP si activée
    if (user.ip_restriction_enabled && user.allowed_ip) {
      const clientIp = getClientIp(req);
      const normalizedClientIp = clientIp.replace('::ffff:', ''); // Normaliser IPv4-mapped IPv6
      const allowedIp = user.allowed_ip;

      if (normalizedClientIp !== allowedIp && clientIp !== allowedIp) {
        return res.status(403).json({
          error: 'Accès refusé : Votre adresse IP n\'est pas autorisée',
          clientIp: normalizedClientIp
        });
      }
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vérifier le token
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Obtenir l'IP du client
router.get('/client-ip', (req, res) => {
  const clientIp = getClientIp(req);
  const normalizedIp = clientIp.replace('::ffff:', '');
  res.json({ ip: normalizedIp });
});

module.exports = router;
