const express = require('express');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get analytics data
router.get('/', authenticateToken, (req, res) => {
  try {
    const { period = 'month', start_date, end_date } = req.query;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Build WHERE clause for telepro filtering
    const teleproFilter = isAdmin ? '' : 'WHERE assigned_to = ?';
    const teleproParams = isAdmin ? [] : [userId];

    // Calculate date condition
    let dateCondition = '';
    let dateParams = [];

    if (start_date && end_date) {
      dateCondition = teleproFilter ? 'AND created_at BETWEEN ? AND ?' : 'WHERE created_at BETWEEN ? AND ?';
      dateParams = [start_date, end_date];
    } else if (period) {
      const today = new Date();
      let startDate;

      switch(period) {
        case 'day':
          startDate = new Date(today.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(today);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date(today);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date(today);
          startDate.setMonth(startDate.getMonth() - 1);
      }

      dateCondition = teleproFilter ? 'AND created_at >= ?' : 'WHERE created_at >= ?';
      dateParams = [startDate.toISOString()];
    }

    const params = [...teleproParams, ...dateParams];
    const whereClause = teleproFilter && dateCondition ? `${teleproFilter} ${dateCondition}` : (teleproFilter || dateCondition || '');

    // Get total counts with date filtering
    const totalClients = db.prepare(`SELECT COUNT(*) as count FROM clients ${whereClause}`).get(...params).count;

    // Distribution par statut
    const statutsDistribution = db.prepare(`
      SELECT statut, COUNT(*) as count
      FROM clients
      ${whereClause}
      GROUP BY statut
    `).all(...params);

    // Distribution par produit
    const produitsDistribution = db.prepare(`
      SELECT type_produit, COUNT(*) as count
      FROM clients
      ${whereClause}
      GROUP BY type_produit
    `).all(...params);

    // Clients created over time
    const clientsOverTime = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM clients
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(...params);

    // Recent activity
    const recentClients = db.prepare(`
      SELECT id, societe, nom_signataire, type_produit, statut, created_at
      FROM clients
      ${teleproFilter}
      ORDER BY created_at DESC
      LIMIT 10
    `).all(...teleproParams);

    // Telepro performance (clients assigned) - only for admins
    let teleproPerformance = [];
    let teleproMonthlyStats = [];
    let teleproConversionStats = [];

    if (isAdmin) {
      teleproPerformance = db.prepare(`
        SELECT
          users.id,
          users.username,
          COUNT(clients.id) as client_count,
          COUNT(CASE WHEN clients.statut = 'termine' THEN 1 END) as termine_count
        FROM users
        LEFT JOIN clients ON users.id = clients.assigned_to
        WHERE users.role = 'telepro'
        GROUP BY users.id, users.username
        ORDER BY client_count DESC
      `).all();

      // Stats mensuelles par télépro (12 derniers mois)
      const monthlyData = db.prepare(`
        SELECT
          strftime('%Y-%m', clients.created_at) as month,
          users.username,
          COUNT(*) as count
        FROM clients
        LEFT JOIN users ON clients.assigned_to = users.id
        WHERE users.role = 'telepro'
          AND clients.assigned_to IS NOT NULL
          AND clients.created_at >= date('now', '-12 months')
        GROUP BY month, users.id, users.username
        ORDER BY month ASC
      `).all();

      // Transformer les données en format pour recharts
      try {
        const monthlyByTelepro = {};
        if (monthlyData && Array.isArray(monthlyData)) {
          monthlyData.forEach(row => {
            if (row && row.month && row.username) {
              if (!monthlyByTelepro[row.month]) {
                monthlyByTelepro[row.month] = { month: row.month };
              }
              monthlyByTelepro[row.month][row.username] = row.count || 0;
            }
          });
        }
        teleproMonthlyStats = Object.values(monthlyByTelepro);
      } catch (err) {
        console.error('Erreur transformation monthlyData:', err);
        teleproMonthlyStats = [];
      }

      // Taux de conversion par télépro par mois
      const conversionData = db.prepare(`
        SELECT
          strftime('%Y-%m', clients.created_at) as month,
          users.username,
          COUNT(*) as total,
          COUNT(CASE WHEN clients.statut = 'termine' THEN 1 END) as termine
        FROM clients
        LEFT JOIN users ON clients.assigned_to = users.id
        WHERE users.role = 'telepro'
          AND clients.assigned_to IS NOT NULL
          AND clients.created_at >= date('now', '-12 months')
        GROUP BY month, users.id, users.username
        ORDER BY month ASC
      `).all();

      // Calculer le taux de conversion en %
      try {
        const conversionByTelepro = {};
        if (conversionData && Array.isArray(conversionData)) {
          conversionData.forEach(row => {
            if (row && row.month && row.username) {
              if (!conversionByTelepro[row.month]) {
                conversionByTelepro[row.month] = { month: row.month };
              }
              conversionByTelepro[row.month][row.username] = row.total > 0
                ? Math.round((row.termine / row.total) * 100)
                : 0;
            }
          });
        }
        teleproConversionStats = Object.values(conversionByTelepro);
      } catch (err) {
        console.error('Erreur transformation conversionData:', err);
        teleproConversionStats = [];
      }
    }

    res.json({
      summary: {
        totalClients,
        par_statut: statutsDistribution,
        par_produit: produitsDistribution
      },
      charts: {
        clientsOverTime,
        statutsDistribution,
        produitsDistribution,
        teleproPerformance,
        teleproMonthlyStats,
        teleproConversionStats
      },
      recentClients
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
