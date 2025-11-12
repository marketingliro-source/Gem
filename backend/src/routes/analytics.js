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

    // Build WHERE clause for agent filtering
    const agentFilter = isAdmin ? '' : 'WHERE assigned_to = ?';
    const agentParams = isAdmin ? [] : [userId];

    // Calculate date condition FIRST
    let dateCondition = '';
    let dateConditionForJoin = '';
    let dateParams = [];

    if (start_date && end_date) {
      dateCondition = agentFilter ? 'AND created_at BETWEEN ? AND ?' : 'WHERE created_at BETWEEN ? AND ?';
      dateConditionForJoin = 'AND clients.created_at BETWEEN ? AND ?';
      dateParams = [start_date, end_date];
    } else if (period) {
      // Calculate date range based on period
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

      dateCondition = agentFilter ? 'AND created_at >= ?' : 'WHERE created_at >= ?';
      dateConditionForJoin = 'AND clients.created_at >= ?';
      dateParams = [startDate.toISOString()];
    }

    // Combine agent and date params for all queries
    const params = [...agentParams, ...dateParams];

    // Build WHERE clause combining agent and date filters
    const whereClause = agentFilter && dateCondition ? `${agentFilter} ${dateCondition}` : (agentFilter || dateCondition || '');

    // Get total counts with date filtering
    const totalClients = db.prepare(`SELECT COUNT(*) as count FROM clients ${whereClause}`).get(...params).count;
    const totalLeads = db.prepare(`SELECT COUNT(*) as count FROM leads ${whereClause}`).get(...params).count;

    // Tracking statistics with date filtering
    const mailSentFilter = whereClause ? `${whereClause} AND mail_sent = 1` : 'WHERE mail_sent = 1';
    const docReceivedFilter = whereClause ? `${whereClause} AND document_received = 1` : 'WHERE document_received = 1';
    const cancelledFilter = whereClause ? `${whereClause} AND cancelled = 1` : 'WHERE cancelled = 1';

    const mailSent = db.prepare(`SELECT COUNT(*) as count FROM clients ${mailSentFilter}`).get(...params).count;
    const documentReceived = db.prepare(`SELECT COUNT(*) as count FROM clients ${docReceivedFilter}`).get(...params).count;
    const cancelled = db.prepare(`SELECT COUNT(*) as count FROM clients ${cancelledFilter}`).get(...params).count;

    // Clients created over time
    const clientsOverTime = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM clients
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(...params);

    // Leads status distribution
    const leadsStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM leads
      ${agentFilter}
      GROUP BY status
    `).all(...agentParams);

    // Tracking progression (funnel)
    const trackingData = [
      { name: 'Total Clients', value: totalClients },
      { name: 'Courrier envoyé', value: mailSent },
      { name: 'Document reçu', value: documentReceived },
      { name: 'Annulés', value: cancelled }
    ];

    // Recent activity
    const recentClients = db.prepare(`
      SELECT id, first_name, last_name, created_at, mail_sent, document_received, cancelled
      FROM clients
      ${agentFilter}
      ORDER BY created_at DESC
      LIMIT 10
    `).all(...agentParams);

    // Agent performance (clients assigned) with trend data - only for admins
    let agentPerformance = [];
    let agentTrendData = {};

    if (isAdmin) {
      agentPerformance = db.prepare(`
        SELECT users.id, users.username, COUNT(clients.id) as client_count
        FROM users
        LEFT JOIN clients ON users.id = clients.assigned_to
        WHERE users.role = 'agent'
        GROUP BY users.id, users.username
        ORDER BY client_count DESC
      `).all();

      // Get agent trend data for line chart (ALWAYS use last 12 months for better readability)
      // Generate all 12 months for continuous line chart
      const today = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push({
          year: month.getFullYear(),
          month: month.getMonth() + 1,
          date: month.toISOString().slice(0, 7) // Format: YYYY-MM
        });
      }

      agentPerformance.forEach(agent => {
        const trendData = months.map(m => {
          const endOfMonth = new Date(m.year, m.month, 0, 23, 59, 59).toISOString();

          // Métrique 1: Nombre total de clients (cumulatif)
          const totalClients = db.prepare(`
            SELECT COUNT(*) as count
            FROM clients
            WHERE assigned_to = ? AND created_at <= ?
          `).get(agent.id, endOfMonth).count;

          // Métrique 2: Leads convertis en clients (cumulatif)
          const leadsConverted = db.prepare(`
            SELECT COUNT(*) as count
            FROM clients
            WHERE assigned_to = ? AND converted_from_lead_id IS NOT NULL AND created_at <= ?
          `).get(agent.id, endOfMonth).count;

          // Métrique 3: Documents reçus (cumulatif)
          const documentsReceived = db.prepare(`
            SELECT COUNT(*) as count
            FROM clients
            WHERE assigned_to = ? AND document_received = 1 AND created_at <= ?
          `).get(agent.id, endOfMonth).count;

          // Métrique 4: Mails envoyés (cumulatif)
          const mailsSent = db.prepare(`
            SELECT COUNT(*) as count
            FROM clients
            WHERE assigned_to = ? AND mail_sent = 1 AND created_at <= ?
          `).get(agent.id, endOfMonth).count;

          return {
            date: m.date,
            totalClients: totalClients,
            leadsConverted: leadsConverted,
            documentsReceived: documentsReceived,
            mailsSent: mailsSent
          };
        });

        agentTrendData[agent.username] = trendData;
      });
    }

    res.json({
      summary: {
        totalClients,
        totalLeads, // Keep for backend but frontend can ignore
        mailSent,
        documentReceived,
        cancelled,
        conversionRate: totalLeads > 0 ? ((totalClients / totalLeads) * 100).toFixed(1) : 0,
        documentRate: totalClients > 0 ? ((documentReceived / totalClients) * 100).toFixed(1) : 0,
        cancellationRate: totalClients > 0 ? ((cancelled / totalClients) * 100).toFixed(1) : 0
      },
      charts: {
        clientsOverTime,
        leadsStatus,
        trackingData,
        agentPerformance
      },
      agentTrendData, // Top level for easy access in frontend
      recentClients
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed performance metrics for all agents
router.get('/agents', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { period = 'month', start_date, end_date } = req.query;

    // Calculate date condition
    let dateCondition = '';
    let params = [];

    if (start_date && end_date) {
      dateCondition = 'AND clients.created_at BETWEEN ? AND ?';
      params = [start_date, end_date];
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

      dateCondition = 'AND clients.created_at >= ?';
      params = [startDate.toISOString()];
    }

    // Get all agents with comprehensive metrics
    const agentsPerformance = db.prepare(`
      SELECT
        users.id,
        users.username,
        COUNT(DISTINCT clients.id) as total_clients,
        COUNT(DISTINCT CASE WHEN clients.mail_sent = 1 THEN clients.id END) as mail_sent,
        COUNT(DISTINCT CASE WHEN clients.document_received = 1 THEN clients.id END) as document_received,
        COUNT(DISTINCT CASE WHEN clients.cancelled = 1 THEN clients.id END) as cancelled,
        MAX(clients.updated_at) as last_activity
      FROM users
      LEFT JOIN clients ON users.id = clients.assigned_to ${dateCondition}
      WHERE users.role = 'agent'
      GROUP BY users.id, users.username
      ORDER BY total_clients DESC
    `).all(...params);

    // Calculate additional metrics for each agent
    const agentsWithMetrics = agentsPerformance.map(agent => {
      // Get leads count for conversion rate
      const leadsCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM leads
        WHERE assigned_to = ?
      `).get(agent.id).count;

      const total = agent.total_clients || 0;
      const mailRate = total > 0 ? ((agent.mail_sent / total) * 100).toFixed(1) : '0.0';
      const documentRate = total > 0 ? ((agent.document_received / total) * 100).toFixed(1) : '0.0';
      const cancellationRate = total > 0 ? ((agent.cancelled / total) * 100).toFixed(1) : '0.0';
      const conversionRate = leadsCount > 0 ? ((total / leadsCount) * 100).toFixed(1) : '0.0';

      return {
        id: agent.id,
        username: agent.username,
        total_clients: total,
        mail_sent: agent.mail_sent || 0,
        mail_sent_rate: parseFloat(mailRate),
        document_received: agent.document_received || 0,
        document_received_rate: parseFloat(documentRate),
        cancelled: agent.cancelled || 0,
        cancellation_rate: parseFloat(cancellationRate),
        conversion_rate: parseFloat(conversionRate),
        last_activity: agent.last_activity
      };
    });

    res.json({
      agents: agentsWithMetrics,
      period: period,
      start_date: start_date || null,
      end_date: end_date || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get performance metrics for a specific agent
router.get('/agent/:agentId', authenticateToken, (req, res) => {
  try {
    const { agentId } = req.params;
    const { period = 'month', start_date, end_date } = req.query;
    const userId = req.user.id;

    // Security check: agents can only see their own data, admins can see any agent
    if (req.user.role !== 'admin' && parseInt(agentId) !== userId) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    // Calculate date condition
    let dateCondition = '';
    let params = [agentId];

    if (start_date && end_date) {
      dateCondition = 'AND clients.created_at BETWEEN ? AND ?';
      params.push(start_date, end_date);
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

      dateCondition = 'AND clients.created_at >= ?';
      params.push(startDate.toISOString());
    }

    // Get agent info and metrics
    const agentData = db.prepare(`
      SELECT
        users.id,
        users.username,
        COUNT(DISTINCT clients.id) as total_clients,
        COUNT(DISTINCT CASE WHEN clients.mail_sent = 1 THEN clients.id END) as mail_sent,
        COUNT(DISTINCT CASE WHEN clients.document_received = 1 THEN clients.id END) as document_received,
        COUNT(DISTINCT CASE WHEN clients.cancelled = 1 THEN clients.id END) as cancelled
      FROM users
      LEFT JOIN clients ON users.id = clients.assigned_to ${dateCondition}
      WHERE users.id = ?
      GROUP BY users.id, users.username
    `).get(...params);

    if (!agentData) {
      return res.status(404).json({ error: 'Agent non trouvé' });
    }

    // Get leads count for conversion rate
    const leadsCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM leads
      WHERE assigned_to = ?
    `).get(agentId).count;

    // Calculate trend data (clients created over time)
    let trendParams = [agentId];
    if (start_date && end_date) {
      trendParams.push(start_date, end_date);
    } else if (period) {
      const today = new Date();
      let startDate;
      switch(period) {
        case 'day': startDate = new Date(today.setHours(0, 0, 0, 0)); break;
        case 'week': startDate = new Date(today); startDate.setDate(startDate.getDate() - 7); break;
        case 'month': startDate = new Date(today); startDate.setMonth(startDate.getMonth() - 1); break;
        case 'year': startDate = new Date(today); startDate.setFullYear(startDate.getFullYear() - 1); break;
        default: startDate = new Date(today); startDate.setMonth(startDate.getMonth() - 1);
      }
      trendParams.push(startDate.toISOString());
    }

    const trendData = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM clients
      WHERE assigned_to = ?
      ${start_date && end_date ? 'AND created_at BETWEEN ? AND ?' : (period ? 'AND created_at >= ?' : '')}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(...trendParams);

    // Get team average for comparison
    const teamAverage = db.prepare(`
      SELECT
        AVG(client_count) as avg_clients,
        AVG(mail_rate) as avg_mail_rate,
        AVG(doc_rate) as avg_doc_rate,
        AVG(cancel_rate) as avg_cancel_rate
      FROM (
        SELECT
          users.id,
          COUNT(DISTINCT clients.id) as client_count,
          CAST(COUNT(DISTINCT CASE WHEN clients.mail_sent = 1 THEN clients.id END) AS FLOAT) / NULLIF(COUNT(DISTINCT clients.id), 0) * 100 as mail_rate,
          CAST(COUNT(DISTINCT CASE WHEN clients.document_received = 1 THEN clients.id END) AS FLOAT) / NULLIF(COUNT(DISTINCT clients.id), 0) * 100 as doc_rate,
          CAST(COUNT(DISTINCT CASE WHEN clients.cancelled = 1 THEN clients.id END) AS FLOAT) / NULLIF(COUNT(DISTINCT clients.id), 0) * 100 as cancel_rate
        FROM users
        LEFT JOIN clients ON users.id = clients.assigned_to ${dateCondition}
        WHERE users.role = 'agent'
        GROUP BY users.id
      )
    `).get(...params.slice(1)); // Remove agentId from params for team average

    const total = agentData.total_clients || 0;
    const mailRate = total > 0 ? ((agentData.mail_sent / total) * 100).toFixed(1) : '0.0';
    const documentRate = total > 0 ? ((agentData.document_received / total) * 100).toFixed(1) : '0.0';
    const cancellationRate = total > 0 ? ((agentData.cancelled / total) * 100).toFixed(1) : '0.0';
    const conversionRate = leadsCount > 0 ? ((total / leadsCount) * 100).toFixed(1) : '0.0';

    res.json({
      agent: {
        id: agentData.id,
        username: agentData.username,
        total_clients: total,
        mail_sent: agentData.mail_sent || 0,
        mail_sent_rate: parseFloat(mailRate),
        document_received: agentData.document_received || 0,
        document_received_rate: parseFloat(documentRate),
        cancelled: agentData.cancelled || 0,
        cancellation_rate: parseFloat(cancellationRate),
        conversion_rate: parseFloat(conversionRate)
      },
      trend: trendData,
      teamAverage: {
        avg_clients: teamAverage?.avg_clients ? parseFloat(teamAverage.avg_clients.toFixed(1)) : 0,
        avg_mail_rate: teamAverage?.avg_mail_rate ? parseFloat(teamAverage.avg_mail_rate.toFixed(1)) : 0,
        avg_doc_rate: teamAverage?.avg_doc_rate ? parseFloat(teamAverage.avg_doc_rate.toFixed(1)) : 0,
        avg_cancel_rate: teamAverage?.avg_cancel_rate ? parseFloat(teamAverage.avg_cancel_rate.toFixed(1)) : 0
      },
      period: period,
      start_date: start_date || null,
      end_date: end_date || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export Excel détaillé du dashboard
router.get('/export/excel', authenticateToken, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { period, start_date, end_date } = req.query;

    // Récupérer toutes les données analytics (réutiliser la logique existante)
    let dateCondition = '';
    let dateConditionWithAlias = '';
    let dateFilterForJoin = '';
    let dateParams = [];
    let agentFilter = req.user.role === 'agent' ? 'WHERE assigned_to = ?' : '';
    let agentFilterWithAlias = req.user.role === 'agent' ? 'WHERE c.assigned_to = ?' : '';
    let agentParams = req.user.role === 'agent' ? [req.user.id] : [];

    if (start_date && end_date) {
      dateCondition = agentFilter ? 'AND created_at BETWEEN ? AND ?' : 'WHERE created_at BETWEEN ? AND ?';
      dateConditionWithAlias = agentFilterWithAlias ? 'AND c.created_at BETWEEN ? AND ?' : 'WHERE c.created_at BETWEEN ? AND ?';
      dateFilterForJoin = 'AND c.created_at BETWEEN ? AND ?';
      dateParams = [start_date, end_date];
    } else if (period) {
      const today = new Date();
      let startDate;

      switch (period) {
        case 'today':
          startDate = new Date(today.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(today.setDate(today.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(today.setMonth(today.getMonth() - 1));
          break;
        case 'year':
          startDate = new Date(today.setFullYear(today.getFullYear() - 1));
          break;
        default:
          startDate = new Date(today.setMonth(today.getMonth() - 1));
      }

      dateCondition = agentFilter ? 'AND created_at >= ?' : 'WHERE created_at >= ?';
      dateConditionWithAlias = agentFilterWithAlias ? 'AND c.created_at >= ?' : 'WHERE c.created_at >= ?';
      dateFilterForJoin = 'AND c.created_at >= ?';
      dateParams = [startDate.toISOString()];
    }

    const params = [...agentParams, ...dateParams];
    const whereClause = agentFilter && dateCondition ? `${agentFilter} ${dateCondition}` : (agentFilter || dateCondition || '');
    const whereClauseWithAlias = agentFilterWithAlias && dateConditionWithAlias ? `${agentFilterWithAlias} ${dateConditionWithAlias}` : (agentFilterWithAlias || dateConditionWithAlias || '');

    console.log('🔍 EXPORT DEBUG whereClause:', whereClause);
    console.log('🔍 EXPORT DEBUG whereClauseWithAlias:', whereClauseWithAlias);
    console.log('🔍 EXPORT DEBUG params:', params);

    // Statistiques générales
    console.log('🔍 Query 1: SELECT COUNT(*) as count FROM clients', whereClause);
    const totalClients = db.prepare(`SELECT COUNT(*) as count FROM clients ${whereClause}`).get(...params).count;
    const mailSent = db.prepare(`SELECT COUNT(*) as count FROM clients ${whereClause} ${dateCondition ? 'AND' : 'WHERE'} mail_sent = 1`).get(...params).count;
    const documentReceived = db.prepare(`SELECT COUNT(*) as count FROM clients ${whereClause} ${dateCondition ? 'AND' : 'WHERE'} document_received = 1`).get(...params).count;
    const cancelled = db.prepare(`SELECT COUNT(*) as count FROM clients ${whereClause} ${dateCondition ? 'AND' : 'WHERE'} cancelled = 1`).get(...params).count;
    const totalLeads = db.prepare(`SELECT COUNT(*) as count FROM leads ${whereClause}`).get(...params).count;

    // Créer le workbook
    const workbook = new ExcelJS.Workbook();

    // === FEUILLE 1: Résumé Général ===
    const summarySheet = workbook.addWorksheet('Résumé');
    summarySheet.columns = [
      { header: 'Métrique', key: 'metric', width: 35 },
      { header: 'Valeur', key: 'value', width: 20 }
    ];

    // Style en-tête
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    summarySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    summarySheet.getRow(1).height = 25;

    const summaryData = [
      { metric: 'STATISTIQUES GÉNÉRALES', value: '' },
      { metric: 'Total Clients', value: totalClients },
      { metric: 'Total Leads', value: totalLeads },
      { metric: 'Courriers Envoyés', value: mailSent },
      { metric: 'Documents Reçus', value: documentReceived },
      { metric: 'Annulés', value: cancelled },
      { metric: '', value: '' },
      { metric: 'TAUX DE PERFORMANCE', value: '' },
      { metric: 'Taux de Conversion (%)', value: totalLeads > 0 ? ((totalClients / totalLeads) * 100).toFixed(1) : 0 },
      { metric: 'Taux Courriers (%)', value: totalClients > 0 ? ((mailSent / totalClients) * 100).toFixed(1) : 0 },
      { metric: 'Taux Documents (%)', value: totalClients > 0 ? ((documentReceived / totalClients) * 100).toFixed(1) : 0 },
      { metric: 'Taux Annulation (%)', value: totalClients > 0 ? ((cancelled / totalClients) * 100).toFixed(1) : 0 }
    ];

    // Bordure pour toutes les cellules
    const borderStyle = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    summaryData.forEach((row, index) => {
      const excelRow = summarySheet.addRow(row);

      // Alterner les couleurs
      if (index % 2 === 1) {
        excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      }

      // Sections en-tête en bleu
      if (row.metric.includes('STATISTIQUES') || row.metric.includes('TAUX')) {
        excelRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
      }

      // Ajouter les bordures
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle' };
      });
    });

    // Bordures sur l'en-tête
    summarySheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = borderStyle;
    });

    // === FEUILLE 2: Liste des Clients ===
    const clientsSheet = workbook.addWorksheet('Clients');
    const clientsQuery = `
      SELECT
        c.id, c.first_name, c.last_name, c.email,
        c.landline_phone, c.mobile_phone, c.address, c.city, c.postal_code,
        c.status, c.mail_sent, c.document_received, c.cancelled,
        c.assigned_to, c.converted_from_lead_id,
        c.created_at, c.updated_at,
        u.username as assigned_username
      FROM clients c
      LEFT JOIN users u ON c.assigned_to = u.id
      ${whereClauseWithAlias}
      ORDER BY c.created_at DESC
    `;
    console.log('📊 DEBUG clientsQuery:', clientsQuery);
    console.log('📊 DEBUG params:', params);
    const clients = db.prepare(clientsQuery).all(...params);

    clientsSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Prénom', key: 'first_name', width: 15 },
      { header: 'Nom', key: 'last_name', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Téléphone', key: 'landline_phone', width: 15 },
      { header: 'Mobile', key: 'mobile_phone', width: 15 },
      { header: 'Ville', key: 'city', width: 20 },
      { header: 'Statut', key: 'status', width: 18 },
      { header: 'Mail Envoyé', key: 'mail_sent', width: 12 },
      { header: 'Doc. Reçus', key: 'document_received', width: 12 },
      { header: 'Annulé', key: 'cancelled', width: 10 },
      { header: 'Assigné à', key: 'assigned_username', width: 15 },
      { header: 'Date Création', key: 'created_at', width: 18 }
    ];

    // Style en-tête
    clientsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    clientsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    clientsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    clientsSheet.getRow(1).height = 25;

    clients.forEach((client, index) => {
      const statusLabels = {
        nouveau: 'Nouveau',
        mail_envoye: 'Mail envoyé',
        documents_recus: 'Documents reçus',
        annule: 'Annulé'
      };

      const row = clientsSheet.addRow({
        ...client,
        status: statusLabels[client.status] || client.status,
        mail_sent: client.mail_sent ? 'Oui' : 'Non',
        document_received: client.document_received ? 'Oui' : 'Non',
        cancelled: client.cancelled ? 'Oui' : 'Non',
        landline_phone: client.landline_phone || client.phone,
        created_at: client.created_at ? new Date(client.created_at).toLocaleString('fr-FR') : ''
      });

      // Alterner les couleurs (lignes paires en gris clair)
      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      }

      // Colorier selon le statut
      const statusCell = row.getCell('status');
      const statusColors = {
        'Nouveau': 'FF10B981',
        'Mail envoyé': 'FF3B82F6',
        'Documents reçus': 'FFF59E0B',
        'Annulé': 'FFEF4444'
      };
      if (statusColors[statusCell.value]) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors[statusCell.value] } };
        statusCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Ajouter des bordures à toutes les cellules
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = borderStyle;
        cell.alignment = { ...cell.alignment, vertical: 'middle' };
      });
    });

    // Bordures sur l'en-tête clients
    clientsSheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = borderStyle;
    });

    clientsSheet.autoFilter = 'A1:M1';

    // === FEUILLE 3: Performance des Agents (admin only) ===
    if (req.user.role === 'admin') {
      const agentsSheet = workbook.addWorksheet('Performance Agents');
      const agentPerformance = db.prepare(`
        SELECT
          u.id, u.username,
          COUNT(c.id) as total_clients,
          SUM(CASE WHEN c.mail_sent = 1 THEN 1 ELSE 0 END) as mail_sent,
          SUM(CASE WHEN c.document_received = 1 THEN 1 ELSE 0 END) as document_received,
          SUM(CASE WHEN c.cancelled = 1 THEN 1 ELSE 0 END) as cancelled,
          MAX(c.updated_at) as last_activity
        FROM users u
        LEFT JOIN clients c ON u.id = c.assigned_to ${dateFilterForJoin}
        WHERE u.role = 'agent'
        GROUP BY u.id
      `).all(...dateParams);

      agentsSheet.columns = [
        { header: 'Agent', key: 'username', width: 20 },
        { header: 'Total Clients', key: 'total_clients', width: 15 },
        { header: 'Courriers Envoyés', key: 'mail_sent', width: 18 },
        { header: 'Documents Reçus', key: 'document_received', width: 18 },
        { header: 'Annulés', key: 'cancelled', width: 12 },
        { header: 'Taux Courriers (%)', key: 'mail_rate', width: 18 },
        { header: 'Taux Documents (%)', key: 'doc_rate', width: 18 },
        { header: 'Dernière Activité', key: 'last_activity', width: 20 }
      ];

      agentsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      agentsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
      agentsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      agentsSheet.getRow(1).height = 25;

      // Bordures sur l'en-tête agents
      agentsSheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
        cell.border = borderStyle;
      });

      agentPerformance.forEach((agent, index) => {
        const mailRate = agent.total_clients > 0 ? ((agent.mail_sent / agent.total_clients) * 100).toFixed(1) : 0;
        const docRate = agent.total_clients > 0 ? ((agent.document_received / agent.total_clients) * 100).toFixed(1) : 0;

        const row = agentsSheet.addRow({
          username: agent.username,
          total_clients: agent.total_clients,
          mail_sent: agent.mail_sent,
          document_received: agent.document_received,
          cancelled: agent.cancelled,
          mail_rate: mailRate,
          doc_rate: docRate,
          last_activity: agent.last_activity ? new Date(agent.last_activity).toLocaleDateString('fr-FR') : 'N/A'
        });

        // Fonction pour déterminer la couleur selon le taux
        const getPerformanceColor = (rate) => {
          if (rate >= 70) return 'FF10B981'; // Vert (bon)
          if (rate >= 40) return 'FFF59E0B'; // Orange (moyen)
          return 'FFEF4444'; // Rouge (faible)
        };

        // Couleur de fond alternée pour les lignes
        const rowFillColor = index % 2 === 0 ? 'FFF0F0F0' : 'FFFFFFFF';

        // Appliquer le style à chaque cellule
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          // Bordures
          cell.border = borderStyle;

          // Alignement vertical par défaut
          if (!cell.alignment) {
            cell.alignment = { vertical: 'middle' };
          }

          // Appliquer la couleur de fond alternée (sauf pour les colonnes 6 et 7 qui sont les taux)
          if (colNumber !== 6 && colNumber !== 7) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
          }

          // Centrer les colonnes numériques (colonnes 2, 3, 4, 5 = total_clients, mail_sent, document_received, cancelled)
          if (colNumber >= 2 && colNumber <= 5) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });

        // Colorier les cellules de taux selon la performance
        // Colonne 6 = Taux Courriers (%), Colonne 7 = Taux Documents (%)
        const mailRateCell = row.getCell(6);
        if (mailRate > 0) {
          mailRateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: getPerformanceColor(parseFloat(mailRate)) } };
          mailRateCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
          mailRateCell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          // Si le taux est 0, appliquer la couleur alternée
          mailRateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
          mailRateCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        const docRateCell = row.getCell(7);
        if (docRate > 0) {
          docRateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: getPerformanceColor(parseFloat(docRate)) } };
          docRateCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
          docRateCell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          // Si le taux est 0, appliquer la couleur alternée
          docRateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
          docRateCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });

      // Ajouter un filtre automatique
      agentsSheet.autoFilter = 'A1:H1';
    }

    // Générer le fichier
    const filename = `dashboard_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Erreur export dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
