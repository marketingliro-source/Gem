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
    // NOTE: totalClients compte les CLIENTS UNIQUES (client_base)
    // Pour les produits, on compte les entrées dans clients_produits
    const totalClientsQuery = isAdmin
      ? `SELECT COUNT(DISTINCT cb.id) as count FROM client_base cb`
      : `SELECT COUNT(DISTINCT cp.client_base_id) as count
         FROM clients_produits cp
         WHERE cp.assigned_to = ?`;

    const totalClients = db.prepare(totalClientsQuery).get(...(isAdmin ? [] : [userId])).count;

    // Total produits (peut être > totalClients si multi-produits)
    const totalProduitsQuery = isAdmin
      ? `SELECT COUNT(*) as count FROM clients_produits`
      : `SELECT COUNT(*) as count FROM clients_produits WHERE assigned_to = ?`;

    const totalProduits = db.prepare(totalProduitsQuery).get(...(isAdmin ? [] : [userId])).count;

    // Distribution par statut (au niveau PRODUIT)
    const statutsDistribution = db.prepare(`
      SELECT cp.statut, COUNT(*) as count
      FROM clients_produits cp
      ${teleproFilter.replace('assigned_to', 'cp.assigned_to')}
      GROUP BY cp.statut
    `).all(...teleproParams);

    // Distribution par produit
    const produitsDistribution = db.prepare(`
      SELECT cp.type_produit, COUNT(*) as count
      FROM clients_produits cp
      ${teleproFilter.replace('assigned_to', 'cp.assigned_to')}
      GROUP BY cp.type_produit
    `).all(...teleproParams);

    // Produits créés au fil du temps
    const clientsOverTime = db.prepare(`
      SELECT DATE(cp.created_at) as date, COUNT(*) as count
      FROM clients_produits cp
      ${teleproFilter.replace('assigned_to', 'cp.assigned_to')}
      GROUP BY DATE(cp.created_at)
      ORDER BY date ASC
    `).all(...teleproParams);

    // Recent activity (JOIN avec client_base pour avoir societe + nom_signataire)
    const recentClients = db.prepare(`
      SELECT
        cb.id,
        cb.societe,
        cb.nom_signataire,
        cp.type_produit,
        cp.statut,
        cp.created_at
      FROM clients_produits cp
      INNER JOIN client_base cb ON cp.client_base_id = cb.id
      ${teleproFilter.replace('assigned_to', 'cp.assigned_to')}
      ORDER BY cp.created_at DESC
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
          COUNT(cp.id) as client_count,
          COUNT(CASE WHEN cp.statut = 'termine' THEN 1 END) as termine_count
        FROM users
        LEFT JOIN clients_produits cp ON users.id = cp.assigned_to
        WHERE users.role = 'telepro'
        GROUP BY users.id, users.username
        ORDER BY client_count DESC
      `).all();

      // Stats mensuelles par télépro (12 derniers mois)
      const monthlyData = db.prepare(`
        SELECT
          strftime('%Y-%m', cp.created_at) as month,
          users.username,
          COUNT(*) as count
        FROM clients_produits cp
        LEFT JOIN users ON cp.assigned_to = users.id
        WHERE users.role = 'telepro'
          AND cp.assigned_to IS NOT NULL
          AND cp.created_at >= date('now', '-12 months')
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
          strftime('%Y-%m', cp.created_at) as month,
          users.username,
          COUNT(*) as total,
          COUNT(CASE WHEN cp.statut = 'termine' THEN 1 END) as termine
        FROM clients_produits cp
        LEFT JOIN users ON cp.assigned_to = users.id
        WHERE users.role = 'telepro'
          AND cp.assigned_to IS NOT NULL
          AND cp.created_at >= date('now', '-12 months')
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
        totalClients,      // Nombre de clients uniques (client_base)
        totalProduits,     // Nombre total de produits (peut être >= totalClients)
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
