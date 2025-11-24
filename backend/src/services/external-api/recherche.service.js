const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const cacheService = require('../cache.service');

/**
 * Service pour l'API Recherche Entreprises (data.gouv.fr)
 * Documentation: https://recherche-entreprises.api.gouv.fr/docs
 * API GRATUITE sans authentification
 */
class RechercheEntreprisesService {
  constructor() {
    this.baseURL = process.env.RECHERCHE_ENTREPRISES_URL ||
                   'https://recherche-entreprises.api.gouv.fr/search';

    // Configuration axios avec retry
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    });

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.response?.status === 429;
      }
    });

    // Rate limiter (plus conservateur car API publique)
    this.rateLimiter = cacheService.getRateLimiter('recherche', 10, 1);
  }

  /**
   * Recherche textuelle d'entreprises
   * @param {string} query - Requête de recherche (dénomination, SIRET, SIREN, adresse)
   * @param {Object} options - Options de recherche
   * @returns {Promise<Array>}
   */
  async search(query, options = {}) {
    console.log('🔍🔍🔍 [RECHERCHE SERVICE] search() appelé avec:', { query, options });

    if (!query || query.trim().length < 2) {
      console.log('⚠️  [RECHERCHE SERVICE] Query trop courte ou vide, retour []');
      return [];
    }

    const params = {
      q: query.trim(),
      page: options.page || 1,
      per_page: Math.min(options.limit || 20, 25), // Max 25 par page
    };

    // Filtres optionnels
    if (options.codePostal) params.code_postal = options.codePostal;
    if (options.departement) params.departement = options.departement;
    if (options.region) params.region = options.region;
    if (options.codeNAF) params.activite_principale = options.codeNAF;
    if (options.minEmployes) params.min_matching_etablissements = options.minEmployes;

    console.log('📦 [RECHERCHE SERVICE] Paramètres construits pour API:', JSON.stringify(params, null, 2));
    console.log('🌐 [RECHERCHE SERVICE] URL complète:', this.baseURL + '?' + new URLSearchParams(params).toString());

    const cacheKey = `recherche:${JSON.stringify(params)}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('recherche');

      try {
        console.log('🚀 [RECHERCHE SERVICE] Envoi requête HTTP GET...');
        const response = await this.client.get('', { params });

        console.log('✅ [RECHERCHE SERVICE] Réponse reçue - Status:', response.status);
        console.log('📊 [RECHERCHE SERVICE] Données brutes response.data:', JSON.stringify(response.data, null, 2));

        const results = response.data.results || [];
        console.log(`📈 [RECHERCHE SERVICE] Nombre de résultats trouvés: ${results.length}`);

        if (results.length > 0) {
          console.log('👉 [RECHERCHE SERVICE] Premier résultat brut:', JSON.stringify(results[0], null, 2));
        }

        const formatted = results.map(item => this.formatResult(item));
        console.log(`✅ [RECHERCHE SERVICE] Résultats formatés: ${formatted.length} entreprises`);

        if (formatted.length > 0) {
          console.log('👉 [RECHERCHE SERVICE] Premier résultat formaté:', JSON.stringify(formatted[0], null, 2));
        }

        return formatted;

      } catch (error) {
        console.error('❌❌❌ [RECHERCHE SERVICE] Erreur API Recherche Entreprises:', error.message);
        if (error.response) {
          console.error('📛 [RECHERCHE SERVICE] Status HTTP:', error.response.status);
          console.error('📛 [RECHERCHE SERVICE] Données erreur:', JSON.stringify(error.response.data, null, 2));
        }
        console.error('📛 [RECHERCHE SERVICE] Stack trace:', error.stack);
        return [];
      }
    }, 1800); // Cache 30 minutes
  }

  /**
   * Recherche par SIRET
   * @param {string} siret - Numéro SIRET
   * @returns {Promise<Object|null>}
   */
  async searchBySiret(siret) {
    if (!siret || siret.length !== 14) {
      throw new Error('SIRET invalide');
    }

    const results = await this.search(siret);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Suggestions pour autocomplete
   * @param {string} partial - Début du nom ou SIRET
   * @param {number} limit - Nombre max de suggestions
   * @returns {Promise<Array>}
   */
  async suggest(partial, limit = 10) {
    if (!partial || partial.trim().length < 2) {
      return [];
    }

    const results = await this.search(partial, { limit });
    return results.map(r => ({
      siret: r.siret,
      siren: r.siren,
      denomination: r.denomination,
      adresse: r.adresse.adresseComplete,
      codePostal: r.adresse.codePostal,
      commune: r.adresse.commune,
      codeNAF: r.codeNAF,
      label: `${r.denomination} - ${r.siret} - ${r.adresse.commune}`
    }));
  }

  /**
   * Recherche par code NAF (secteur d'activité)
   * @param {string} codeNAF - Code NAF/APE
   * @param {Object} filters - Filtres géographiques
   * @returns {Promise<Array>}
   */
  async searchByNAF(codeNAF, filters = {}) {
    const options = {
      ...filters,
      codeNAF,
      limit: filters.limit || 100
    };

    // Pour rechercher par NAF, on utilise "*" comme query
    return await this.search('*', options);
  }

  /**
   * Recherche par région et département
   * @param {Object} geo - Filtres géographiques { region, departement, codePostal }
   * @param {Object} filters - Autres filtres
   * @returns {Promise<Array>}
   */
  async searchByGeo(geo, filters = {}) {
    const options = {
      ...filters,
      ...geo,
      limit: filters.limit || 100
    };

    return await this.search('*', options);
  }

  /**
   * Formate les résultats de l'API
   * @param {Object} data - Données brutes
   * @returns {Object}
   */
  formatResult(data) {
    // L'API retourne un format légèrement différent de SIRENE
    return {
      siren: data.siren,
      siret: data.siege?.siret || data.siret,

      // Dénomination
      denomination: data.nom_complet || data.nom_raison_sociale || 'Non renseigné',
      sigle: data.sigle || null,

      // Adresse du siège
      adresse: {
        numeroVoie: data.siege?.numero_voie || '',
        typeVoie: data.siege?.type_voie || '',
        libelleVoie: data.siege?.libelle_voie || '',
        codePostal: data.siege?.code_postal || '',
        commune: data.siege?.libelle_commune || '',

        adresseComplete: data.siege?.geo_adresse || data.siege?.adresse || '',
      },

      // Activité
      codeNAF: data.activite_principale || '',
      libelleNAF: data.libelle_activite_principale || '',
      section: data.section_activite_principale || '',

      // Statut
      etatAdministratif: data.etat_administratif,
      actif: data.etat_administratif === 'A',

      // Informations complémentaires
      categorieEntreprise: data.categorie_entreprise || null,
      nombreEtablissements: data.matching_etablissements?.length || 0,
      dateCreation: data.date_creation,
      dateMiseAJour: data.date_mise_a_jour,

      // Dirigeants (si disponible)
      dirigeants: data.dirigeants?.map(d => ({
        nom: d.nom,
        prenoms: d.prenoms,
        fonction: d.qualite,
        dateNaissance: d.date_naissance
      })) || [],

      // Établissements
      etablissements: data.matching_etablissements?.map(e => ({
        siret: e.siret,
        adresse: e.geo_adresse,
        estSiege: e.est_siege
      })) || [],

      // Données brutes
      _raw: data,
      _source: 'recherche-entreprises'
    };
  }
}

module.exports = new RechercheEntreprisesService();
