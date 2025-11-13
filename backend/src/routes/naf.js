const express = require('express');
const router = express.Router();
const nafService = require('../services/naf.service');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   GET /api/naf/all
 * @desc    Récupère tous les codes NAF
 * @access  Private
 */
router.get('/all', authenticateToken, (req, res) => {
  try {
    const { section, division, typeProduit, format } = req.query;

    let codes;

    if (format === 'frontend') {
      // Format optimisé pour les select/dropdown frontend
      codes = nafService.exportForFrontend({
        section,
        division,
        typeProduit
      });
    } else {
      // Format complet
      codes = nafService.getAllCodes();

      // Filtrer par section si spécifié
      if (section) {
        codes = codes.filter(c => c.section === section);
      }

      // Filtrer par division si spécifié
      if (division) {
        codes = codes.filter(c => c.division === division);
      }
    }

    res.json({
      total: codes.length,
      codes
    });

  } catch (error) {
    console.error('Erreur récupération codes NAF:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des codes NAF',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/naf/search
 * @desc    Recherche de codes NAF
 * @access  Private
 */
router.get('/search', authenticateToken, (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ total: 0, results: [] });
    }

    const results = nafService.searchCodes(q);

    res.json({
      total: results.length,
      results: results.map(code => ({
        value: code.code,
        label: `${code.code} - ${code.libelle}`,
        division: code.divisionLibelle,
        section: code.sectionLibelle
      }))
    });

  } catch (error) {
    console.error('Erreur recherche NAF:', error);
    res.status(500).json({
      error: 'Erreur lors de la recherche',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/naf/sections
 * @desc    Récupère les sections principales
 * @access  Private
 */
router.get('/sections', authenticateToken, (req, res) => {
  try {
    const sections = nafService.getSections();
    res.json({ total: sections.length, sections });
  } catch (error) {
    console.error('Erreur récupération sections:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des sections',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/naf/divisions/:sectionCode
 * @desc    Récupère les divisions d'une section
 * @access  Private
 */
router.get('/divisions/:sectionCode', authenticateToken, (req, res) => {
  try {
    const { sectionCode } = req.params;
    const divisions = nafService.getDivisionsBySection(sectionCode);

    res.json({
      sectionCode,
      total: divisions.length,
      divisions
    });

  } catch (error) {
    console.error('Erreur récupération divisions:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des divisions',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/naf/product/:typeProduit
 * @desc    Récupère les codes NAF pertinents pour un produit CEE
 * @access  Private
 */
router.get('/product/:typeProduit', authenticateToken, (req, res) => {
  try {
    const { typeProduit } = req.params;

    const codes = nafService.getCodesForProduct(typeProduit);

    res.json({
      typeProduit,
      total: codes.length,
      codes: codes.map(code => ({
        value: code.code,
        label: `${code.code} - ${code.libelle}`,
        division: code.divisionLibelle
      }))
    });

  } catch (error) {
    console.error('Erreur récupération codes produit:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des codes',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/naf/code/:codeNAF
 * @desc    Récupère les infos d'un code NAF spécifique
 * @access  Private
 */
router.get('/code/:codeNAF', authenticateToken, (req, res) => {
  try {
    const { codeNAF } = req.params;
    const codeInfo = nafService.getCodeInfo(codeNAF);

    if (!codeInfo) {
      return res.status(404).json({
        error: 'Code NAF non trouvé'
      });
    }

    res.json(codeInfo);

  } catch (error) {
    console.error('Erreur récupération code NAF:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération du code',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/naf/categories-cee
 * @desc    Récupère les catégories CEE avec leurs codes
 * @access  Private
 */
router.get('/categories-cee', authenticateToken, (req, res) => {
  try {
    const categories = nafService.getCategoriesCEE();

    res.json({
      total: Object.keys(categories).length,
      categories
    });

  } catch (error) {
    console.error('Erreur récupération catégories CEE:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des catégories',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/naf/stats
 * @desc    Statistiques sur la base NAF
 * @access  Private
 */
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const stats = nafService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Erreur stats NAF:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des statistiques',
      message: error.message
    });
  }
});

module.exports = router;
