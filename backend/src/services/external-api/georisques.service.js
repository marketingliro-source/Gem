const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const cacheService = require('../cache.service');

/**
 * Service pour l'API Géorisques - ICPE (Installations Classées)
 * Documentation: https://www.georisques.gouv.fr/doc-api
 * API 100% gratuite sans clé requise (v1)
 * Identifie sites industriels et installations classées (crucial pour matelas isolants)
 */
class GeorisquesService {
  constructor() {
    this.baseURL = process.env.GEORISQUES_API_URL || 'https://www.georisques.gouv.fr/api/v1';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        'Accept': 'application/json'
      }
    });

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
    });

    // Rate limiter (1000 req/min = ~16 req/s)
    const rateLimit = parseInt(process.env.GEORISQUES_RATE_LIMIT) || 16;
    this.rateLimiter = cacheService.getRateLimiter('georisques', rateLimit, 1);
  }

  /**
   * Recherche installations classées par code INSEE commune
   * @param {string} codeINSEE - Code INSEE commune (5 chiffres)
   * @returns {Promise<Array>}
   */
  async searchByCommune(codeINSEE) {
    if (!codeINSEE || codeINSEE.length !== 5) {
      throw new Error('Code INSEE invalide (5 chiffres requis)');
    }

    const cacheKey = `georisques:commune:${codeINSEE}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('georisques');

      try {
        const params = {
          code_insee: codeINSEE
        };

        const response = await this.client.get('/installations_classees', { params });

        const installations = response.data.data || response.data || [];

        console.log(`✅ Géorisques: ${installations.length} installation(s) classée(s) trouvée(s) dans commune ${codeINSEE}`);

        return installations.map(i => this.formatInstallation(i));

      } catch (error) {
        console.error('❌ Erreur API Géorisques commune:', error.message);
        return [];
      }
    }, 2592000); // Cache 30 jours
  }

  /**
   * Recherche installations classées par localisation GPS
   * @param {number} latitude - Latitude WGS84
   * @param {number} longitude - Longitude WGS84
   * @param {number} radius - Rayon recherche en mètres (défaut: 1000m)
   * @returns {Promise<Array>}
   */
  async searchByCoordinates(latitude, longitude, radius = 1000) {
    if (!latitude || !longitude) {
      throw new Error('Latitude et longitude requises');
    }

    const cacheKey = `georisques:coords:${latitude},${longitude}:${radius}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('georisques');

      try {
        const params = {
          latlon: `${latitude},${longitude}`,
          rayon: radius
        };

        const response = await this.client.get('/installations_classees', { params });

        const installations = response.data.data || response.data || [];

        console.log(`✅ Géorisques: ${installations.length} installation(s) trouvée(s) dans rayon ${radius}m`);

        return installations.map(i => this.formatInstallation(i));

      } catch (error) {
        console.error('❌ Erreur API Géorisques coordinates:', error.message);
        return [];
      }
    }, 2592000); // Cache 30 jours
  }

  /**
   * Recherche installation par nom d'exploitant
   * @param {string} nom - Nom exploitant (partiel ou complet)
   * @param {string} codeINSEE - Optionnel: filtrer par commune
   * @returns {Promise<Array>}
   */
  async searchByExploitant(nom, codeINSEE = null) {
    if (!nom || nom.trim().length < 3) {
      throw new Error('Nom exploitant trop court (minimum 3 caractères)');
    }

    const cacheKey = `georisques:exploitant:${nom}${codeINSEE ? `:${codeINSEE}` : ''}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('georisques');

      try {
        const params = {
          nom_ets: nom
        };

        if (codeINSEE) {
          params.code_insee = codeINSEE;
        }

        const response = await this.client.get('/installations_classees', { params });

        const installations = response.data.data || response.data || [];

        console.log(`✅ Géorisques: ${installations.length} installation(s) trouvée(s) pour "${nom}"`);

        return installations.map(i => this.formatInstallation(i));

      } catch (error) {
        console.error('❌ Erreur API Géorisques exploitant:', error.message);
        return [];
      }
    }, 2592000); // Cache 30 jours
  }

  /**
   * Formate les données ICPE
   * @param {Object} data - Données brutes API
   * @returns {Object}
   */
  formatInstallation(data) {
    return {
      // Identification
      codeS3IC: data.code_s3ic || data.codeS3IC,
      nom: data.nom_ets || data.nomEts,
      exploitant: data.nom_ets || data.nomEts,

      // Localisation
      adresse: data.adresse1 || data.adresse,
      commune: data.commune,
      codeINSEE: data.code_insee || data.codeINSEE,
      codePostal: data.code_postal || data.codePostal,
      departement: data.departement,
      region: data.region,

      // Coordonnées GPS
      coordinates: data.latitude && data.longitude ? {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude)
      } : null,

      // Type d'installation
      regime: data.regime, // Déclaration, Enregistrement, Autorisation
      etatActivite: data.etat_activite || data.etatActivite, // En activité, Cessé
      seveso: data.seveso, // Seuil haut, Seuil bas, Non Seveso
      prioriteNationale: data.priorite_nationale,

      // Rubriques ICPE (activités)
      rubriques: data.rubriques || [],
      nombreRubriques: data.rubriques ? data.rubriques.length : 0,

      // Activités principales (pour scoring)
      activitesPrincipales: this.extractMainActivities(data.rubriques || []),

      // Statut
      enActivite: (data.etat_activite || data.etatActivite) === 'En activité',

      // Classification pour prospection
      typeIndustrie: this.classifyIndustry(data),
      pertinenceMatelasIsolants: this.scoreMatelasIsolants(data),

      // Dates
      dateDerniereMaj: data.date_derniere_maj,

      // Données brutes
      _raw: data,
      _source: 'georisques-icpe'
    };
  }

  /**
   * Extrait les activités principales des rubriques ICPE
   * @param {Array} rubriques - Liste des rubriques
   * @returns {Array}
   */
  extractMainActivities(rubriques) {
    if (!rubriques || rubriques.length === 0) return [];

    return rubriques
      .filter(r => r.rubrique && r.libelle)
      .map(r => ({
        code: r.rubrique,
        libelle: r.libelle,
        regime: r.regime,
        alinea: r.alinea
      }))
      .slice(0, 5); // Top 5 rubriques
  }

  /**
   * Classifie le type d'industrie (pour ciblage)
   * @param {Object} data - Données installation
   * @returns {string}
   */
  classifyIndustry(data) {
    const rubriques = data.rubriques || [];
    const rubriquesStr = JSON.stringify(rubriques).toLowerCase();

    // Identification par mots-clés dans rubriques
    if (rubriquesStr.includes('combustion') || rubriquesStr.includes('chaufferie') || rubriquesStr.includes('chaudière')) {
      return 'Chaufferie/Combustion';
    }
    if (rubriquesStr.includes('stockage') || rubriquesStr.includes('entrepôt')) {
      return 'Stockage/Logistique';
    }
    if (rubriquesStr.includes('fabrication') || rubriquesStr.includes('production')) {
      return 'Production/Fabrication';
    }
    if (rubriquesStr.includes('traitement') || rubriquesStr.includes('transformation')) {
      return 'Traitement/Transformation';
    }
    if (rubriquesStr.includes('chimie') || rubriquesStr.includes('chimique')) {
      return 'Chimie';
    }
    if (rubriquesStr.includes('métallurgie') || rubriquesStr.includes('métaux')) {
      return 'Métallurgie';
    }

    return 'Industrie générale';
  }

  /**
   * Score de pertinence pour produit Matelas Isolants (0-100)
   * @param {Object} data - Données installation
   * @returns {number}
   */
  scoreMatelasIsolants(data) {
    let score = 0;

    // 1. Site industriel ICPE = +40 pts (obligatoire)
    score += 40;

    // 2. Type d'activité pertinent
    const type = this.classifyIndustry(data);
    if (type === 'Chaufferie/Combustion') score += 30; // Très pertinent
    else if (type === 'Production/Fabrication') score += 20;
    else if (type === 'Traitement/Transformation') score += 15;
    else if (type === 'Métallurgie') score += 25;
    else if (type === 'Chimie') score += 20;
    else score += 10;

    // 3. En activité = +10 pts
    if ((data.etat_activite || data.etatActivite) === 'En activité') {
      score += 10;
    }

    // 4. Régime autorisation (sites plus importants) = +5 pts
    if (data.regime === 'Autorisation') {
      score += 5;
    }

    // 5. Seveso (sites à risques = grosses installations) = +5 pts
    if (data.seveso && data.seveso !== 'Non Seveso') {
      score += 5;
    }

    return Math.min(score, 100);
  }

  /**
   * Vérifie si une adresse correspond à un site industriel ICPE
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} radius - Rayon (défaut: 500m)
   * @returns {Promise<boolean>}
   */
  async isIndustrialSite(latitude, longitude, radius = 500) {
    const installations = await this.searchByCoordinates(latitude, longitude, radius);
    return installations && installations.length > 0 && installations[0].enActivite;
  }

  /**
   * Obtient la meilleure installation ICPE pour une localisation
   * (la plus proche en activité)
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} radius - Rayon (défaut: 1000m)
   * @returns {Promise<Object|null>}
   */
  async getBestInstallation(latitude, longitude, radius = 1000) {
    const installations = await this.searchByCoordinates(latitude, longitude, radius);

    if (!installations || installations.length === 0) {
      return null;
    }

    // Filtrer installations en activité
    const actives = installations.filter(i => i.enActivite);

    if (actives.length === 0) {
      return null;
    }

    // Trier par pertinence matelas isolants (score)
    actives.sort((a, b) => b.pertinenceMatelasIsolants - a.pertinenceMatelasIsolants);

    return actives[0];
  }
}

module.exports = new GeorisquesService();
