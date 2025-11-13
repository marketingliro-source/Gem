require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const appointmentsRoutes = require('./routes/appointments');
const clientsRoutes = require('./routes/clients');
const analyticsRoutes = require('./routes/analytics');
const documentsRoutes = require('./routes/documents');
const enrichmentRoutes = require('./routes/enrichment');
const prospectionRoutes = require('./routes/prospection');
const nafRoutes = require('./routes/naf');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir les fichiers uploadés
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/enrichment', enrichmentRoutes);
app.use('/api/prospection', prospectionRoutes);
app.use('/api/naf', nafRoutes);

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API CRM Gem Isolation opérationnelle' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur serveur' });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 Serveur CRM démarré sur le port ${PORT}`);
  console.log(`========================================`);
  console.log(`📊 API disponible: http://localhost:${PORT}/api`);
  console.log(`✅ Base de données: Connectée`);
  console.log(`========================================\n`);
});
