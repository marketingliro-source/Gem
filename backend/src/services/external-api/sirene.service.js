const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const cacheService = require('../cache.service');

/**
 * Service pour l'API SIRENE de l'INSEE
 * Documentation: https://portail-api.insee.fr/
 */
class SireneService {
  constructor() {
    this.baseURL = process.env.INSEE_BASE_URL || 'https://api.insee.fr/entreprises/sirene/V3.11';
    this.apiKey = process.env.INSEE_API_KEY;
    this.apiSecret = process.env.INSEE_API_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;

    // Configuration axios avec retry
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.response?.status === 429; // Rate limit
      }
    });

    // Rate limiter (30 req/s pour INSEE)
    const rateLimit = parseInt(process.env.SIRENE_RATE_LIMIT) || 30;
    this.rateLimiter = cacheService.getRateLimiter('sirene', rateLimit, 1);
  }

  /**
   * Obtient un token d'accès OAuth2
   * @returns {Promise<string>}
   */
  async getAccessToken() {
    // Vérifier si le token est encore valide
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('INSEE_API_KEY et INSEE_API_SECRET requis dans .env');
    }

    try {
      const authString = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');

      const response = await axios.post(
        'https://api.insee.fr/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Token expire dans expires_in secondes (généralement 604800 = 7 jours)
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      console.log('✅ Token INSEE obtenu');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Erreur authentification INSEE:', error.message);
      throw new Error('Impossible d\'obtenir le token INSEE');
    }
  }

  /**
   * Recherche une entreprise par SIRET
   * @param {string} siret - Numéro SIRET (14 chiffres)
   * @returns {Promise<Object>}
   */
  async getSiretInfo(siret) {
    if (!siret || siret.length !== 14) {
      throw new Error('SIRET invalide (doit contenir 14 chiffres)');
    }

    const cacheKey = `sirene:siret:${siret}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('sirene');

      const token = await this.getAccessToken();

      try {
        const response = await this.client.get(`/siret/${siret}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        return this.formatSiretData(response.data);

      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error('SIRET non trouvé');
        }
        console.error('Erreur API SIRENE:', error.message);
        throw new Error('Erreur lors de la récupération des données SIRENE');
      }
    }, 86400); // Cache 24h
  }

  /**
   * Recherche une entreprise par SIREN
   * @param {string} siren - Numéro SIREN (9 chiffres)
   * @returns {Promise<Object>}
   */
  async getSirenInfo(siren) {
    if (!siren || siren.length !== 9) {
      throw new Error('SIREN invalide (doit contenir 9 chiffres)');
    }

    const cacheKey = `sirene:siren:${siren}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('sirene');

      const token = await this.getAccessToken();

      try {
        const response = await this.client.get(`/siren/${siren}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        return this.formatSirenData(response.data);

      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error('SIREN non trouvé');
        }
        console.error('Erreur API SIRENE:', error.message);
        throw new Error('Erreur lors de la récupération des données SIRENE');
      }
    }, 86400); // Cache 24h
  }

  /**
   * Recherche multi-critères
   * @param {Object} criteria - Critères de recherche
   * @param {number} limit - Nombre max de résultats
   * @returns {Promise<Array>}
   */
  async search(criteria = {}, limit = 20) {
    const params = new URLSearchParams();

    if (criteria.q) params.append('q', criteria.q);
    if (criteria.codePostal) params.append('codePostal', criteria.codePostal);
    if (criteria.codeNAF) params.append('activitePrincipale', criteria.codeNAF);
    if (criteria.departement) params.append('departement', criteria.departement);
    params.append('nombre', Math.min(limit, 100));

    const cacheKey = `sirene:search:${params.toString()}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('sirene');

      const token = await this.getAccessToken();

      try {
        const response = await this.client.get('/siret', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          params: Object.fromEntries(params)
        });

        const etablissements = response.data.etablissements || [];
        return etablissements.map(etab => this.formatSiretData({ etablissement: etab }));

      } catch (error) {
        console.error('Erreur recherche SIRENE:', error.message);
        return [];
      }
    }, 3600); // Cache 1h pour les recherches
  }

  /**
   * Formate les données SIRET reçues de l'API
   * @param {Object} data - Données brutes de l'API
   * @returns {Object}
   */
  formatSiretData(data) {
    const etab = data.etablissement || data;
    const uniteLegale = etab.uniteLegale || {};

    return {
      siret: etab.siret,
      siren: etab.siren,
      nic: etab.nic,

      // Informations entreprise
      denomination: uniteLegale.denominationUniteLegale ||
                    `${uniteLegale.prenom1UniteLegale || ''} ${uniteLegale.nomUniteLegale || ''}`.trim() ||
                    etab.denominationUsuelleEtablissement ||
                    'Non renseigné',

      sigle: uniteLegale.sigleUniteLegale || null,

      // Adresse
      adresse: {
        numeroVoie: etab.adresseEtablissement?.numeroVoieEtablissement || '',
        typeVoie: etab.adresseEtablissement?.typeVoieEtablissement || '',
        libelleVoie: etab.adresseEtablissement?.libelleVoieEtablissement || '',
        codePostal: etab.adresseEtablissement?.codePostalEtablissement || '',
        commune: etab.adresseEtablissement?.libelleCommuneEtablissement || '',

        adresseComplete: [
          etab.adresseEtablissement?.numeroVoieEtablissement,
          etab.adresseEtablissement?.typeVoieEtablissement,
          etab.adresseEtablissement?.libelleVoieEtablissement
        ].filter(Boolean).join(' ') || '',
      },

      // Activité
      codeNAF: etab.periodesEtablissement?.[0]?.activitePrincipaleEtablissement ||
               uniteLegale.activitePrincipaleUniteLegale || '',
      libelleNAF: etab.periodesEtablissement?.[0]?.activitePrincipaleEtablissement || '',

      // Statut
      etatAdministratif: etab.etatAdministratifEtablissement,
      actif: etab.etatAdministratifEtablissement === 'A',

      // Dates
      dateCreation: etab.dateCreationEtablissement,
      dateDernierTraitement: etab.dateDernierTraitementEtablissement,

      // Type
      etablissementSiege: etab.etablissementSiege || false,
      categorieEntreprise: uniteLegale.categorieEntreprise || null,

      // Données brutes pour référence
      _raw: etab
    };
  }

  /**
   * Formate les données SIREN (unité légale)
   */
  formatSirenData(data) {
    const unite = data.uniteLegale || data;

    return {
      siren: unite.siren,
      denomination: unite.denominationUniteLegale ||
                    `${unite.prenom1UniteLegale || ''} ${unite.nomUniteLegale || ''}`.trim(),
      sigle: unite.sigleUniteLegale,
      codeNAF: unite.activitePrincipaleUniteLegale,
      categorieEntreprise: unite.categorieEntreprise,
      etatAdministratif: unite.etatAdministratifUniteLegale,
      actif: unite.etatAdministratifUniteLegale === 'A',
      dateCreation: unite.dateCreationUniteLegale,
      _raw: unite
    };
  }
}

module.exports = new SireneService();
