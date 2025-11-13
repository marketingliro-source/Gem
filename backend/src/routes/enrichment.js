const express = require('express');
const router = express.Router();
const enrichmentService = require('../services/enrichment.service');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   GET /api/enrichment/suggest
 * @desc    Suggestions autocomplete pour SIRET/dénomination
 * @access  Private
 */
router.get('/suggest', authenticateToken, async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const suggestions = await enrichmentService.suggest(
      q.trim(),
      parseInt(limit) || 10
    );

    res.json(suggestions);

  } catch (error) {
    console.error('Erreur suggestions:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des suggestions',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/enrichment/siret/:siret
 * @desc    Enrichissement complet par SIRET
 * @access  Private
 */
router.get('/siret/:siret', authenticateToken, async (req, res) => {
  try {
    const { siret } = req.params;
    const { typeProduit } = req.query;

    if (!siret || siret.length !== 14) {
      return res.status(400).json({
        error: 'SIRET invalide (14 chiffres requis)'
      });
    }

    const enrichedData = await enrichmentService.enrichBySiret(
      siret,
      typeProduit || null
    );

    res.json(enrichedData);

  } catch (error) {
    console.error('Erreur enrichissement SIRET:', error);

    if (error.message.includes('non trouvé') || error.message.includes('Impossible de récupérer')) {
      return res.status(404).json({
        error: 'Entreprise non trouvée',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Erreur lors de l\'enrichissement',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/enrichment/search
 * @desc    Recherche et enrichissement d'entreprises
 * @access  Private
 */
router.post('/search', authenticateToken, async (req, res) => {
  try {
    const {
      q,              // Requête texte
      codePostal,
      departement,
      codeNAF,
      typeProduit,
      enrich,         // Booléen pour activer enrichissement complet
      limit
    } = req.body;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Requête trop courte (minimum 2 caractères)'
      });
    }

    const results = await enrichmentService.searchAndEnrich({
      q: q.trim(),
      codePostal,
      departement,
      codeNAF,
      typeProduit,
      enrich: enrich === true,
      limit: parseInt(limit) || 20
    });

    res.json({
      total: results.length,
      results
    });

  } catch (error) {
    console.error('Erreur recherche enrichissement:', error);
    res.status(500).json({
      error: 'Erreur lors de la recherche',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/enrichment/format
 * @desc    Formate données enrichies pour insertion en BDD
 * @access  Private
 */
router.post('/format', authenticateToken, async (req, res) => {
  try {
    const { enrichedData } = req.body;

    if (!enrichedData) {
      return res.status(400).json({
        error: 'enrichedData requis'
      });
    }

    const formatted = enrichmentService.formatForDatabase(enrichedData);

    res.json(formatted);

  } catch (error) {
    console.error('Erreur formatage:', error);
    res.status(500).json({
      error: 'Erreur lors du formatage',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/enrichment/cache
 * @desc    Nettoie le cache d'enrichissement (admin seulement)
 * @access  Private (Admin)
 */
router.delete('/cache', authenticateToken, async (req, res) => {
  try {
    // Vérifier rôle admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Accès refusé - admin requis'
      });
    }

    const { pattern } = req.query;

    await enrichmentService.clearCache(pattern || '*');

    res.json({
      message: 'Cache nettoyé avec succès',
      pattern: pattern || '*'
    });

  } catch (error) {
    console.error('Erreur nettoyage cache:', error);
    res.status(500).json({
      error: 'Erreur lors du nettoyage du cache',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/enrichment/health
 * @desc    Vérifie le statut des APIs externes
 * @access  Private (Admin)
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    // Vérifier rôle admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Accès refusé - admin requis'
      });
    }

    const pappersService = require('../services/external-api/pappers.service');

    const health = {
      apis: {
        sirene: {
          enabled: !!process.env.INSEE_API_KEY,
          configured: !!(process.env.INSEE_API_KEY && process.env.INSEE_API_SECRET)
        },
        recherche: {
          enabled: true,
          configured: true
        },
        dpe: {
          enabled: true,
          configured: true
        },
        bdnb: {
          enabled: !!process.env.BDNB_API_KEY,
          configured: !!process.env.BDNB_API_KEY
        },
        pappers: {
          enabled: pappersService.isEnabled(),
          configured: !!process.env.PAPPERS_API_KEY
        }
      },
      cache: {
        redis: true, // TODO: vérifier connexion Redis
        enabled: true
      },
      enrichment: {
        autoEnabled: process.env.AUTO_ENRICHMENT_ENABLED !== 'false',
        sources: (process.env.ENRICHMENT_SOURCES || 'sirene,dpe,bdnb').split(',')
      }
    };

    res.json(health);

  } catch (error) {
    console.error('Erreur health check:', error);
    res.status(500).json({
      error: 'Erreur lors du health check',
      message: error.message
    });
  }
});

module.exports = router;
