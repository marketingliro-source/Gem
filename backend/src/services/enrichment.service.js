const sireneService = require('./external-api/sirene.service');
const rechercheService = require('./external-api/recherche.service');
const banService = require('./external-api/ban.service');
const dpeService = require('./external-api/dpe.service');
const bdnbService = require('./external-api/bdnb.service');
const pappersService = require('./external-api/pappers.service');
const cacheService = require('./cache.service');

/**
 * Service d'enrichissement de données entreprises
 * Orchestre les différentes APIs pour enrichir automatiquement les fiches clients
 */
class EnrichmentService {
  constructor() {
    this.autoEnrichmentEnabled = process.env.AUTO_ENRICHMENT_ENABLED !== 'false';
    this.enabledSources = (process.env.ENRICHMENT_SOURCES || 'sirene,ban,dpe').split(',');
  }

  /**
   * Enrichissement complet par SIRET
   * @param {string} siret - Numéro SIRET
   * @param {string} typeProduit - destratification | pression | matelas_isolants
   * @returns {Promise<Object>}
   */
  async enrichBySiret(siret, typeProduit = null) {
    if (!siret || siret.length !== 14) {
      throw new Error('SIRET invalide (14 chiffres requis)');
    }

    console.log(`🔍 Enrichissement SIRET: ${siret}${typeProduit ? ` (${typeProduit})` : ''}`);

    const enrichedData = {
      siret,
      siren: siret.substring(0, 9),
      dateEnrichissement: new Date().toISOString(),
      sources: [],
      donnees: {},
      donneesTechniques: {},
      recommandations: []
    };

    try {
      // 1. Données SIRENE (base obligatoire)
      if (this.isSourceEnabled('sirene')) {
        console.log('📊 Récupération données SIRENE...');
        try {
          const sireneData = await sireneService.getSiretInfo(siret);
          enrichedData.donnees.sirene = sireneData;
          enrichedData.sources.push('sirene');

          // Extraire données principales
          enrichedData.denomination = sireneData.denomination;
          enrichedData.adresse = sireneData.adresse;
          enrichedData.codeNAF = sireneData.codeNAF;
          enrichedData.actif = sireneData.actif;

        } catch (error) {
          console.warn('⚠️  Erreur SIRENE:', error.message);
          // Fallback: API Recherche Entreprises
          try {
            const rechercheData = await rechercheService.searchBySiret(siret);
            if (rechercheData) {
              enrichedData.donnees.recherche = rechercheData;
              enrichedData.sources.push('recherche-entreprises');
              enrichedData.denomination = rechercheData.denomination;
              enrichedData.adresse = rechercheData.adresse;
              enrichedData.codeNAF = rechercheData.codeNAF;
            }
          } catch (fallbackError) {
            console.warn('⚠️  Fallback recherche échoué:', fallbackError.message);
          }
        }
      }

      // Si pas de données de base, retourner données minimales
      if (!enrichedData.adresse) {
        console.warn('⚠️  Impossible de récupérer l\'adresse - retour données minimales');
        return {
          ...enrichedData,
          enrichmentStatus: 'partial',
          enrichmentWarning: 'Données automatiques non disponibles. APIs externes non configurées ou entreprise non trouvée.',
          message: 'Veuillez remplir manuellement les informations de l\'entreprise.'
        };
      }

      // 2. Géocodage et normalisation BAN (Base Adresse Nationale)
      if (this.isSourceEnabled('ban') && enrichedData.adresse) {
        console.log('📍 Géocodage adresse avec BAN...');
        try {
          const banData = await banService.normalizeAddress(enrichedData.adresse);

          if (banData && banData.normalized) {
            enrichedData.donnees.ban = banData;
            enrichedData.sources.push('ban');

            // Enrichir l'adresse avec données normalisées
            enrichedData.adresse = {
              ...enrichedData.adresse,
              adresseComplete: banData.adresseComplete,
              codePostal: banData.codePostal || enrichedData.adresse.codePostal,
              commune: banData.commune || enrichedData.adresse.commune,
              codeINSEE: banData.codeINSEE,
              departement: banData.departement,
              region: banData.region
            };

            // Ajouter coordonnées GPS
            if (banData.coordinates) {
              enrichedData.coordinates = banData.coordinates;
            }

            console.log(`✅ BAN: Adresse normalisée - Score: ${banData.score.toFixed(2)}`);
          } else {
            console.warn('⚠️  BAN: Normalisation impossible, utilisation adresse SIRENE brute');
          }

        } catch (error) {
          console.warn('⚠️  Erreur BAN:', error.message);
          // Ne pas bloquer l'enrichissement si BAN échoue
        }
      }

      // 3. Données BDNB (bâtiment)
      if (this.isSourceEnabled('bdnb') && enrichedData.adresse) {
        console.log('🏢 Récupération données BDNB...');
        try {
          const bdnbResults = await bdnbService.searchByAddress(enrichedData.adresse);

          if (bdnbResults && bdnbResults.length > 0) {
            const bdnbData = bdnbResults[0]; // Prendre le premier résultat
            enrichedData.donnees.bdnb = bdnbData;
            enrichedData.sources.push('bdnb');

            // Extraire données techniques si type produit spécifié
            if (typeProduit) {
              const technicalData = bdnbService.extractTechnicalData(bdnbData, typeProduit);
              if (technicalData) {
                enrichedData.donneesTechniques = {
                  ...enrichedData.donneesTechniques,
                  ...technicalData
                };
              }

              // Obtenir recommandations
              const reco = bdnbService.recommendProducts(bdnbData);
              if (reco && reco.length > 0) {
                enrichedData.recommandations.push(...reco);
              }
            }
          }
        } catch (error) {
          console.warn('⚠️  Erreur BDNB:', error.message);
          // Ne pas bloquer l'enrichissement si BDNB échoue (service optionnel)
        }
      }

      // 4. Données DPE (performance énergétique)
      if (this.isSourceEnabled('dpe') && enrichedData.adresse) {
        console.log('⚡ Récupération données DPE...');
        try {
          // Essayer d'abord par SIRET pour tertiaire
          let dpeResults = await dpeService.searchBySiret(siret);

          // Si pas de résultats, rechercher par adresse
          if (!dpeResults || dpeResults.length === 0) {
            dpeResults = await dpeService.searchByAddress(enrichedData.adresse, 'tertiaire');
          }

          if (dpeResults && dpeResults.length > 0) {
            enrichedData.donnees.dpe = dpeResults;
            enrichedData.sources.push('dpe');

            // Déduire données techniques si type produit spécifié
            if (typeProduit) {
              const dpeTechnical = dpeService.deduceTechnicalData(dpeResults, typeProduit);
              if (dpeTechnical) {
                enrichedData.donneesTechniques = {
                  ...enrichedData.donneesTechniques,
                  ...dpeTechnical
                };
              }
            }
          }
        } catch (error) {
          console.warn('⚠️  Erreur DPE:', error.message);
        }
      }

      // 5. Données Pappers (optionnel - contacts)
      if (pappersService.isEnabled() && this.isSourceEnabled('pappers')) {
        console.log('📞 Récupération données Pappers...');
        try {
          const pappersData = await pappersService.getEntreprise(enrichedData.siren);

          if (pappersData) {
            enrichedData.donnees.pappers = pappersData;
            enrichedData.sources.push('pappers');

            // Enrichir avec téléphone/email si disponibles
            if (pappersData.telephone) {
              enrichedData.telephone = pappersData.telephone;
            }
            if (pappersData.email) {
              enrichedData.email = pappersData.email;
            }
          }
        } catch (error) {
          console.warn('⚠️  Erreur Pappers:', error.message);
        }
      }

      // Calculer score de complétude
      enrichedData.scoreCompletude = this.calculateCompletenessScore(enrichedData);

      console.log(`✅ Enrichissement terminé - Sources: ${enrichedData.sources.join(', ')}`);

      return enrichedData;

    } catch (error) {
      console.error('❌ Erreur enrichissement:', error.message);
      throw error;
    }
  }

  /**
   * Suggestions pour autocomplete (recherche partielle)
   * @param {string} query - Requête partielle (nom, SIRET, etc.)
   * @param {number} limit - Nombre max de suggestions
   * @returns {Promise<Array>}
   */
  async suggest(query, limit = 10) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    console.log(`🔍 Suggestions pour: "${query}"`);

    try {
      // Utiliser l'API Recherche Entreprises (plus rapide)
      const suggestions = await rechercheService.suggest(query, limit);

      console.log(`✅ ${suggestions.length} suggestions trouvées`);

      return suggestions;

    } catch (error) {
      console.error('Erreur suggestions:', error.message);
      return [];
    }
  }

  /**
   * Enrichissement par recherche textuelle
   * @param {Object} criteria - Critères de recherche
   * @returns {Promise<Array>}
   */
  async searchAndEnrich(criteria) {
    try {
      // Rechercher avec l'API Recherche Entreprises
      const results = await rechercheService.search(criteria.q, {
        codePostal: criteria.codePostal,
        departement: criteria.departement,
        codeNAF: criteria.codeNAF,
        limit: criteria.limit || 20
      });

      // Enrichir chaque résultat si demandé
      if (criteria.enrich && results.length > 0) {
        const enrichedResults = [];

        for (const result of results.slice(0, 5)) { // Limiter à 5 pour éviter trop d'appels
          try {
            const enriched = await this.enrichBySiret(result.siret, criteria.typeProduit);
            enrichedResults.push(enriched);
          } catch (error) {
            console.warn(`Erreur enrichissement ${result.siret}:`, error.message);
            enrichedResults.push(result);
          }
        }

        return enrichedResults;
      }

      return results;

    } catch (error) {
      console.error('Erreur searchAndEnrich:', error.message);
      return [];
    }
  }

  /**
   * Vérifie si une source est activée
   * @param {string} source - Nom de la source
   * @returns {boolean}
   */
  isSourceEnabled(source) {
    return this.enabledSources.includes(source);
  }

  /**
   * Calcule un score de complétude des données (0-100)
   * @param {Object} enrichedData - Données enrichies
   * @returns {number}
   */
  calculateCompletenessScore(enrichedData) {
    let score = 0;
    const weights = {
      denomination: 10,
      adresse: 10,
      codeNAF: 10,
      telephone: 15,
      email: 15,
      bdnb: 20,
      dpe: 15,
      donneesTechniques: 5
    };

    if (enrichedData.denomination) score += weights.denomination;
    if (enrichedData.adresse?.adresseComplete) score += weights.adresse;
    if (enrichedData.codeNAF) score += weights.codeNAF;
    if (enrichedData.telephone) score += weights.telephone;
    if (enrichedData.email) score += weights.email;
    if (enrichedData.donnees.bdnb) score += weights.bdnb;
    if (enrichedData.donnees.dpe && enrichedData.donnees.dpe.length > 0) score += weights.dpe;
    if (Object.keys(enrichedData.donneesTechniques).length > 0) score += weights.donneesTechniques;

    return score;
  }

  /**
   * Formatte les données enrichies pour insertion en BDD
   * @param {Object} enrichedData - Données enrichies
   * @returns {Object}
   */
  formatForDatabase(enrichedData) {
    return {
      // Champs directs
      societe: enrichedData.denomination,
      siret: enrichedData.siret,
      telephone: enrichedData.telephone || enrichedData.adresse?.numeroVoie || null,
      code_naf: enrichedData.codeNAF,

      // Adresse bénéficiaire
      adresse: enrichedData.adresse?.adresseComplete || '',
      code_postal: enrichedData.adresse?.codePostal || '',

      // Données techniques (JSON)
      donnees_techniques: enrichedData.donneesTechniques,

      // Stocker toutes les données brutes pour référence
      donnees_enrichies: {
        sources: enrichedData.sources,
        dateEnrichissement: enrichedData.dateEnrichissement,
        scoreCompletude: enrichedData.scoreCompletude,
        donnees: enrichedData.donnees,
        recommandations: enrichedData.recommandations
      }
    };
  }

  /**
   * Nettoie le cache d'enrichissement
   * @param {string} pattern - Pattern optionnel (ex: 'sirene:*')
   */
  async clearCache(pattern = '*') {
    await cacheService.deletePattern(pattern);
    console.log(`🗑️  Cache enrichissement nettoyé: ${pattern}`);
  }
}

module.exports = new EnrichmentService();
