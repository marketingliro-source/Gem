const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const cacheService = require('../cache.service');

/**
 * Service pour l'API Pappers (optionnel - freemium)
 * Documentation: https://www.pappers.fr/api/documentation
 * 100 requêtes gratuites par mois
 */
class PappersService {
  constructor() {
    this.baseURL = process.env.PAPPERS_API_URL || 'https://api.pappers.fr/v2';
    this.apiKey = process.env.PAPPERS_API_KEY;
    this.enabled = !!this.apiKey;

    if (!this.enabled) {
      console.log('ℹ️  Pappers API désactivée (PAPPERS_API_KEY non configurée)');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    });

    axiosRetry(this.client, {
      retries: 2,
      retryDelay: axiosRetry.exponentialDelay,
    });

    // Rate limiting très conservateur (2 req/s pour la version gratuite)
    this.rateLimiter = cacheService.getRateLimiter('pappers', 2, 1);
  }

  /**
   * Vérifie si le service est activé
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Récupère les informations d'une entreprise par SIREN
   * @param {string} siren - Numéro SIREN (9 chiffres)
   * @returns {Promise<Object|null>}
   */
  async getEntreprise(siren) {
    if (!this.enabled) return null;

    if (!siren || siren.length !== 9) {
      throw new Error('SIREN invalide');
    }

    const cacheKey = `pappers:siren:${siren}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('pappers');

      try {
        const params = {
          api_token: this.apiKey,
          siren: siren
        };

        const response = await this.client.get('/entreprise', { params });

        return this.formatEntreprise(response.data);

      } catch (error) {
        if (error.response?.status === 404) {
          return null;
        }
        if (error.response?.status === 429) {
          console.warn('⚠️  Quota Pappers API atteint');
          return null;
        }
        console.error('Erreur Pappers API:', error.message);
        return null;
      }
    }, 86400); // Cache 24h
  }

  /**
   * Récupère les informations par SIRET
   * @param {string} siret - Numéro SIRET (14 chiffres)
   * @returns {Promise<Object|null>}
   */
  async getEtablissement(siret) {
    if (!this.enabled) return null;

    const siren = siret.substring(0, 9);
    return await this.getEntreprise(siren);
  }

  /**
   * Recherche d'entreprises
   * @param {string} query - Requête de recherche
   * @param {Object} options - Options de recherche
   * @returns {Promise<Array>}
   */
  async search(query, options = {}) {
    if (!this.enabled) return [];

    if (!query || query.trim().length < 2) {
      return [];
    }

    const cacheKey = `pappers:search:${query}:${JSON.stringify(options)}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('pappers');

      try {
        const params = {
          api_token: this.apiKey,
          q: query.trim(),
          page: options.page || 1,
          par_page: Math.min(options.limit || 20, 20)
        };

        // Filtres optionnels
        if (options.codePostal) params.code_postal = options.codePostal;
        if (options.departement) params.departement = options.departement;
        if (options.codeNAF) params.code_naf = options.codeNAF;
        if (options.region) params.region = options.region;

        const response = await this.client.get('/recherche', { params });

        const results = response.data.resultats || [];
        return results.map(r => this.formatEntreprise(r));

      } catch (error) {
        console.error('Erreur recherche Pappers:', error.message);
        return [];
      }
    }, 1800); // Cache 30min
  }

  /**
   * Formate les données entreprise Pappers
   * @param {Object} data - Données brutes
   * @returns {Object}
   */
  formatEntreprise(data) {
    return {
      siren: data.siren,
      siret: data.siege?.siret || data.siret_siege,

      // Dénomination
      denomination: data.nom_entreprise || data.denomination,
      sigle: data.sigle,

      // Adresse siège
      adresse: {
        adresseComplete: data.siege?.adresse_ligne_1 || data.adresse,
        complement: data.siege?.adresse_ligne_2,
        codePostal: data.siege?.code_postal || data.code_postal,
        commune: data.siege?.ville || data.ville,
        pays: data.siege?.pays || 'France'
      },

      // Activité
      codeNAF: data.code_naf,
      libelleNAF: data.libelle_code_naf,

      // Informations juridiques
      formeJuridique: data.forme_juridique,
      capitalSocial: data.capital,
      dateCreation: data.date_creation || data.date_immatriculation,
      dateRadiation: data.date_radiation,

      // Statut
      actif: data.statut_rcs === 'Inscrit' || data.etat_entreprise === 'Actif',
      etatAdministratif: data.etat_entreprise,

      // Effectifs
      effectif: data.effectif,
      trancheEffectif: data.tranche_effectif,

      // Finances
      chiffreAffaires: data.chiffre_affaires,
      resultat: data.resultat,

      // Dirigeants
      dirigeants: (data.representants || []).map(d => ({
        nom: d.nom,
        prenoms: d.prenom,
        fonction: d.qualite,
        dateNaissance: d.date_naissance,
        actif: !d.date_fin_fonction
      })),

      // Coordonnées (si disponibles)
      telephone: data.telephone,
      email: data.email,
      siteWeb: data.site_internet,

      // Établissements
      nombreEtablissements: data.nombre_etablissements,
      nombreEtablissementsActifs: data.nombre_etablissements_actifs,

      // Indicateurs
      scoreSolvabilite: data.score_solvabilite,
      procedureCollective: data.procedure_collective || false,

      // Données brutes
      _raw: data,
      _source: 'pappers'
    };
  }

  /**
   * Extrait uniquement les données de contact (téléphone, email)
   * @param {string} siren - Numéro SIREN
   * @returns {Promise<Object|null>}
   */
  async getContactInfo(siren) {
    const entreprise = await this.getEntreprise(siren);

    if (!entreprise) return null;

    return {
      telephone: entreprise.telephone || null,
      email: entreprise.email || null,
      siteWeb: entreprise.siteWeb || null,
      dirigeants: entreprise.dirigeants
    };
  }
}

module.exports = new PappersService();
