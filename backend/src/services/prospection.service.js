const rechercheService = require('./external-api/recherche.service');
const sireneService = require('./external-api/sirene.service');
const bdnbService = require('./external-api/bdnb.service');
const pappersService = require('./external-api/pappers.service');
const cacheService = require('./cache.service');

/**
 * Service de prospection avancée
 * Permet de rechercher des entreprises selon critères multiples
 * pour générer des fichiers de prospects qualifiés
 */
class ProspectionService {
  constructor() {
    this.maxResults = parseInt(process.env.PROSPECTION_MAX_RESULTS) || 1000;
  }

  /**
   * Recherche avancée d'entreprises pour prospection
   * @param {Object} criteria - Critères de recherche
   * @returns {Promise<Object>}
   */
  async search(criteria) {
    console.log('🔍 Recherche prospection:', JSON.stringify(criteria, null, 2));

    const {
      codeNAF,           // Code NAF/APE (ex: "4120B")
      codesNAF,          // Liste de codes NAF (ex: ["4120B", "4312A"])
      departement,       // Code département (ex: "75")
      region,            // Code région
      codePostal,        // Code postal spécifique
      typeProduit,       // destratification, pression, matelas_isolants
      critereTechnique,  // Critères techniques spécifiques
      limit              // Nombre max de résultats
    } = criteria;

    try {
      const maxLimit = Math.min(limit || 100, this.maxResults);
      let results = [];

      // Stratégie de recherche selon critères
      if (codeNAF || codesNAF) {
        // Recherche par code(s) NAF
        results = await this.searchByNAF(codeNAF || codesNAF, {
          departement,
          region,
          codePostal,
          limit: maxLimit
        });
      } else if (departement || region) {
        // Recherche géographique pure
        results = await this.searchByGeo({
          departement,
          region,
          codePostal
        }, { limit: maxLimit });
      } else {
        throw new Error('Au moins un critère requis (NAF ou géographique)');
      }

      // Filtrage par critères techniques si spécifiés
      if (typeProduit || critereTechnique) {
        console.log(`🔧 Filtrage par critères techniques (${typeProduit})`);
        results = await this.filterByTechnicalCriteria(results, {
          typeProduit,
          critereTechnique
        });
      }

      // Enrichir avec données de contact si possible (téléphone)
      if (criteria.enrichPhone && pappersService.isEnabled()) {
        console.log('📞 Enrichissement numéros de téléphone...');
        results = await this.enrichWithPhones(results.slice(0, 50)); // Limiter à 50 pour quota
      }

      // Calculer score de pertinence
      results = results.map(r => ({
        ...r,
        scorePertinence: this.calculateRelevanceScore(r, criteria)
      }));

      // Trier par pertinence
      results.sort((a, b) => b.scorePertinence - a.scorePertinence);

      console.log(`✅ ${results.length} prospects trouvés`);

      return {
        total: results.length,
        criteria,
        results: results.slice(0, maxLimit),
        metadata: {
          date: new Date().toISOString(),
          sources: this.getUsedSources(results)
        }
      };

    } catch (error) {
      console.error('❌ Erreur recherche prospection:', error.message);
      throw error;
    }
  }

  /**
   * Recherche par code(s) NAF
   * @param {string|Array} nafCodes - Code(s) NAF
   * @param {Object} filters - Filtres additionnels
   * @returns {Promise<Array>}
   */
  async searchByNAF(nafCodes, filters = {}) {
    const codes = Array.isArray(nafCodes) ? nafCodes : [nafCodes];
    const allResults = [];

    for (const code of codes) {
      console.log(`📊 Recherche NAF: ${code}`);

      try {
        // Utiliser API Recherche Entreprises
        const results = await rechercheService.searchByNAF(code, {
          departement: filters.departement,
          region: filters.region,
          codePostal: filters.codePostal,
          limit: Math.ceil(filters.limit / codes.length) // Répartir limite
        });

        allResults.push(...results);

      } catch (error) {
        console.warn(`⚠️  Erreur recherche NAF ${code}:`, error.message);
      }
    }

    return this.deduplicateResults(allResults);
  }

  /**
   * Recherche géographique
   * @param {Object} geo - Filtres géographiques
   * @param {Object} options - Options
   * @returns {Promise<Array>}
   */
  async searchByGeo(geo, options = {}) {
    console.log('🗺️  Recherche géographique:', geo);

    try {
      const results = await rechercheService.searchByGeo(geo, {
        limit: options.limit || 100
      });

      return results;

    } catch (error) {
      console.error('Erreur recherche géographique:', error.message);
      return [];
    }
  }

  /**
   * Filtre les résultats par critères techniques
   * @param {Array} results - Résultats de recherche
   * @param {Object} criteria - Critères techniques
   * @returns {Promise<Array>}
   */
  async filterByTechnicalCriteria(results, criteria) {
    const { typeProduit, critereTechnique } = criteria;

    if (!typeProduit) return results;

    const filteredResults = [];

    // Récupérer codes NAF pertinents pour le produit
    const relevantNAF = this.getRelevantNAFForProduct(typeProduit);

    for (const result of results) {
      try {
        // Vérifier code NAF
        const nafMatch = this.matchesNAFCriteria(result.codeNAF, relevantNAF);

        if (!nafMatch) continue;

        // Si critères techniques spécifiques, enrichir avec BDNB
        if (critereTechnique && result.adresse) {
          const bdnbData = await this.getBuildingDataForFiltering(result.adresse);

          if (bdnbData) {
            const techMatch = this.matchesTechnicalCriteria(bdnbData, critereTechnique, typeProduit);

            if (techMatch) {
              result.bdnbData = bdnbData;
              result.recommandations = bdnbService.recommendProducts(bdnbData);
              filteredResults.push(result);
            }
          }
        } else {
          // Sans critères techniques détaillés, garder tous ceux avec bon NAF
          filteredResults.push(result);
        }

      } catch (error) {
        console.warn(`Erreur filtrage ${result.siret}:`, error.message);
      }
    }

    console.log(`🔧 Filtrage: ${results.length} → ${filteredResults.length} résultats`);

    return filteredResults;
  }

  /**
   * Codes NAF pertinents par type de produit
   * @param {string} typeProduit
   * @returns {Array<string>}
   */
  getRelevantNAFForProduct(typeProduit) {
    const nafMapping = {
      destratification: [
        '4120B', // Construction autres bâtiments
        '4321A', // Travaux d'installation électrique
        '4322A', // Travaux d'installation eau/gaz
        '4322B', // Travaux d'installation équipements thermiques
        '4329A', // Travaux d'isolation
        '4120A', // Construction maisons individuelles
        '4333Z', // Travaux de revêtement des sols et des murs
      ],
      pression: [
        '4322A', // Travaux d'installation eau/gaz
        '4322B', // Travaux d'installation équipements thermiques
        '4329A', // Travaux d'isolation
        '3511Z', // Production d'électricité
        '3530Z', // Production et distribution de vapeur
      ],
      matelas_isolants: [
        '4329A', // Travaux d'isolation
        '4322B', // Travaux d'installation équipements thermiques
        '4120B', // Construction autres bâtiments
        '4391A', // Travaux de charpente
        '4399C', // Travaux de maçonnerie
      ]
    };

    return nafMapping[typeProduit] || [];
  }

  /**
   * Vérifie si le code NAF correspond aux critères
   * @param {string} codeNAF - Code NAF de l'entreprise
   * @param {Array} relevantNAF - Codes NAF pertinents
   * @returns {boolean}
   */
  matchesNAFCriteria(codeNAF, relevantNAF) {
    if (!relevantNAF || relevantNAF.length === 0) return true;
    if (!codeNAF) return false;

    // Match exact ou par préfixe (ex: "4120" match "4120A" et "4120B")
    return relevantNAF.some(naf =>
      codeNAF === naf || codeNAF.startsWith(naf.substring(0, 4))
    );
  }

  /**
   * Récupère les données bâtiment pour filtrage (avec cache)
   * @param {Object} adresse - Adresse de l'établissement
   * @returns {Promise<Object|null>}
   */
  async getBuildingDataForFiltering(adresse) {
    const cacheKey = `prospection:bdnb:${JSON.stringify(adresse)}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      const bdnbResults = await bdnbService.searchByAddress(adresse);
      return bdnbResults && bdnbResults.length > 0 ? bdnbResults[0] : null;
    }, 7200);
  }

  /**
   * Vérifie si un bâtiment correspond aux critères techniques
   * @param {Object} buildingData - Données BDNB
   * @param {Object} criteria - Critères techniques
   * @param {string} typeProduit - Type de produit
   * @returns {boolean}
   */
  matchesTechnicalCriteria(buildingData, criteria, typeProduit) {
    if (!buildingData) return false;

    switch (typeProduit) {
      case 'destratification':
        // Hauteur minimale pour destratification
        if (criteria.hauteurMin && buildingData.hauteur < criteria.hauteurMin) {
          return false;
        }
        // Surface minimale
        if (criteria.surfaceMin && buildingData.surfacePlancher < criteria.surfaceMin) {
          return false;
        }
        return true;

      case 'pression':
        // Surface importante
        if (buildingData.surfacePlancher < 500) return false;
        return true;

      case 'matelas_isolants':
        // Mauvaise performance énergétique
        if (buildingData.classeDPE && ['E', 'F', 'G'].includes(buildingData.classeDPE)) {
          return true;
        }
        return false;

      default:
        return true;
    }
  }

  /**
   * Enrichit les résultats avec numéros de téléphone
   * @param {Array} results - Résultats à enrichir
   * @returns {Promise<Array>}
   */
  async enrichWithPhones(results) {
    const enriched = [];

    for (const result of results) {
      try {
        const contact = await pappersService.getContactInfo(result.siren);

        if (contact && contact.telephone) {
          result.telephone = contact.telephone;
          result.email = contact.email;
          result.enrichiContact = true;
        }

        enriched.push(result);

      } catch (error) {
        console.warn(`Erreur enrichissement contact ${result.siren}:`, error.message);
        enriched.push(result);
      }
    }

    return enriched;
  }

  /**
   * Calcule un score de pertinence pour un prospect
   * @param {Object} result - Résultat
   * @param {Object} criteria - Critères de recherche
   * @returns {number}
   */
  calculateRelevanceScore(result, criteria) {
    let score = 50; // Score de base

    // Bonus si NAF exact
    if (criteria.codeNAF && result.codeNAF === criteria.codeNAF) {
      score += 20;
    }

    // Bonus si données techniques disponibles
    if (result.bdnbData) score += 15;

    // Bonus si recommandations produit
    if (result.recommandations && result.recommandations.length > 0) {
      score += 10;
    }

    // Bonus si contact enrichi
    if (result.telephone) score += 10;
    if (result.email) score += 5;

    // Bonus si entreprise active
    if (result.actif) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Déduplique les résultats par SIRET
   * @param {Array} results - Résultats
   * @returns {Array}
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(r => {
      if (seen.has(r.siret)) return false;
      seen.add(r.siret);
      return true;
    });
  }

  /**
   * Obtient les sources utilisées
   * @param {Array} results - Résultats
   * @returns {Array}
   */
  getUsedSources(results) {
    const sources = new Set();
    results.forEach(r => {
      if (r._source) sources.add(r._source);
      if (r.bdnbData) sources.add('bdnb');
      if (r.enrichiContact) sources.add('pappers');
    });
    return Array.from(sources);
  }

  /**
   * Exporte les résultats au format standard
   * @param {Array} results - Résultats de prospection
   * @returns {Array}
   */
  formatForExport(results) {
    return results.map(r => ({
      // Identification
      siret: r.siret,
      siren: r.siren,
      denomination: r.denomination,

      // Localisation
      adresse: r.adresse?.adresseComplete || '',
      codePostal: r.adresse?.codePostal || '',
      commune: r.adresse?.commune || '',

      // Activité
      codeNAF: r.codeNAF,
      libelleNAF: r.libelleNAF,

      // Contact
      telephone: r.telephone || '',
      email: r.email || '',

      // Statut
      actif: r.actif ? 'Oui' : 'Non',

      // Scoring
      scorePertinence: r.scorePertinence || 0,

      // Données techniques (si disponibles)
      hauteur: r.bdnbData?.hauteur || '',
      surface: r.bdnbData?.surfacePlancher || '',
      classeDPE: r.bdnbData?.classeDPE || '',

      // Recommandations
      produitsRecommandes: r.recommandations?.map(rec => rec.produit).join(', ') || ''
    }));
  }
}

module.exports = new ProspectionService();
