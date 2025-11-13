const express = require('express');
const router = express.Router();
const prospectionService = require('../services/prospection.service');
const { authenticateToken } = require('../middleware/auth');
const ExcelJS = require('exceljs');

/**
 * @route   POST /api/prospection/search
 * @desc    Recherche avancée de prospects
 * @access  Private
 */
router.post('/search', authenticateToken, async (req, res) => {
  try {
    const {
      codeNAF,
      codesNAF,
      departement,
      region,
      codePostal,
      typeProduit,
      critereTechnique,
      enrichPhone,
      limit
    } = req.body;

    // Validation: au moins un critère requis
    if (!codeNAF && !codesNAF && !departement && !region && !codePostal) {
      return res.status(400).json({
        error: 'Au moins un critère de recherche requis (NAF ou géographique)'
      });
    }

    const results = await prospectionService.search({
      codeNAF,
      codesNAF,
      departement,
      region,
      codePostal,
      typeProduit,
      critereTechnique,
      enrichPhone: enrichPhone === true,
      limit: parseInt(limit) || 100
    });

    res.json(results);

  } catch (error) {
    console.error('Erreur recherche prospection:', error);
    res.status(500).json({
      error: 'Erreur lors de la recherche de prospects',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/prospection/export/csv
 * @desc    Exporte les résultats de prospection en CSV
 * @access  Private
 */
router.post('/export/csv', authenticateToken, async (req, res) => {
  try {
    const { results } = req.body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({
        error: 'Résultats de prospection requis'
      });
    }

    // Formater pour export
    const formatted = prospectionService.formatForExport(results);

    // Générer CSV
    const csv = generateCSV(formatted);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="prospects-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv); // BOM UTF-8 pour Excel

  } catch (error) {
    console.error('Erreur export CSV:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'export CSV',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/prospection/export/excel
 * @desc    Exporte les résultats de prospection en Excel
 * @access  Private
 */
router.post('/export/excel', authenticateToken, async (req, res) => {
  try {
    const { results, criteria } = req.body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({
        error: 'Résultats de prospection requis'
      });
    }

    // Formater pour export
    const formatted = prospectionService.formatForExport(results);

    // Créer workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Prospects');

    // Headers
    const headers = [
      { header: 'SIRET', key: 'siret', width: 15 },
      { header: 'SIREN', key: 'siren', width: 12 },
      { header: 'Dénomination', key: 'denomination', width: 35 },
      { header: 'Adresse', key: 'adresse', width: 40 },
      { header: 'Code Postal', key: 'codePostal', width: 12 },
      { header: 'Commune', key: 'commune', width: 25 },
      { header: 'Code NAF', key: 'codeNAF', width: 10 },
      { header: 'Libellé NAF', key: 'libelleNAF', width: 35 },
      { header: 'Téléphone', key: 'telephone', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Actif', key: 'actif', width: 8 },
      { header: 'Score', key: 'scorePertinence', width: 10 },
      { header: 'Hauteur (m)', key: 'hauteur', width: 12 },
      { header: 'Surface (m²)', key: 'surface', width: 12 },
      { header: 'Classe DPE', key: 'classeDPE', width: 12 },
      { header: 'Produits Recommandés', key: 'produitsRecommandes', width: 25 }
    ];

    worksheet.columns = headers;

    // Style header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }
    };

    // Ajouter les données
    formatted.forEach(row => {
      worksheet.addRow(row);
    });

    // Ajouter une feuille avec les critères
    if (criteria) {
      const criteriaSheet = workbook.addWorksheet('Critères de recherche');
      criteriaSheet.columns = [
        { header: 'Critère', key: 'critere', width: 25 },
        { header: 'Valeur', key: 'valeur', width: 40 }
      ];

      criteriaSheet.getRow(1).font = { bold: true };

      Object.entries(criteria).forEach(([key, value]) => {
        if (value) {
          criteriaSheet.addRow({
            critere: key,
            valeur: Array.isArray(value) ? value.join(', ') : value.toString()
          });
        }
      });
    }

    // Générer buffer
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="prospects-${Date.now()}.xlsx"`);
    res.send(buffer);

  } catch (error) {
    console.error('Erreur export Excel:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'export Excel',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/prospection/naf/relevant
 * @desc    Récupère les codes NAF pertinents pour un type de produit
 * @access  Private
 */
router.get('/naf/relevant', authenticateToken, async (req, res) => {
  try {
    const { typeProduit } = req.query;

    if (!typeProduit) {
      return res.status(400).json({
        error: 'typeProduit requis (destratification, pression, matelas_isolants)'
      });
    }

    const nafCodes = prospectionService.getRelevantNAFForProduct(typeProduit);

    res.json({
      typeProduit,
      codes: nafCodes
    });

  } catch (error) {
    console.error('Erreur récupération NAF:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des codes NAF',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/prospection/stats
 * @desc    Statistiques de prospection (admin)
 * @access  Private (Admin)
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Vérifier rôle admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Accès refusé - admin requis'
      });
    }

    const cacheService = require('../services/cache.service');

    // Récupérer quelques stats basiques du cache
    // (dans une version plus avancée, on pourrait logger les recherches en BDD)

    const stats = {
      maxResults: prospectionService.maxResults,
      exportEnabled: process.env.PROSPECTION_EXPORT_ENABLED !== 'false',
      typesProduitsDisponibles: [
        'destratification',
        'pression',
        'matelas_isolants'
      ]
    };

    res.json(stats);

  } catch (error) {
    console.error('Erreur stats prospection:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des stats',
      message: error.message
    });
  }
});

/**
 * Génère un CSV à partir de données formatées
 * @param {Array} data - Données à convertir
 * @returns {string}
 */
function generateCSV(data) {
  if (!data || data.length === 0) return '';

  // Headers
  const headers = Object.keys(data[0]);
  let csv = headers.join(';') + '\n';

  // Rows
  data.forEach(row => {
    const values = headers.map(header => {
      let value = row[header] || '';
      // Échapper les guillemets et encadrer si contient virgule/point-virgule
      value = value.toString().replace(/"/g, '""');
      if (value.includes(';') || value.includes(',') || value.includes('\n')) {
        value = `"${value}"`;
      }
      return value;
    });
    csv += values.join(';') + '\n';
  });

  return csv;
}

module.exports = router;
