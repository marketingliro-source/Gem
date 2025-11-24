const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const cacheService = require('../cache.service');

/**
 * Service pour l'API BAN (Base Adresse Nationale)
 * Documentation: https://adresse.data.gouv.fr/api-doc/adresse
 * API 100% gratuite sans clé requise
 */
class BANService {
  constructor() {
    this.baseURL = process.env.BAN_API_URL || 'https://api-adresse.data.gouv.fr';

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
    });

    // Rate limiter (50 req/s recommandé)
    const rateLimit = parseInt(process.env.BAN_RATE_LIMIT) || 50;
    this.rateLimiter = cacheService.getRateLimiter('ban', rateLimit, 1);
  }

  /**
   * Géocode une adresse (convertit adresse → coordonnées GPS)
   * @param {Object|string} adresse - Objet adresse ou string
   * @returns {Promise<Object>}
   */
  async geocodeAddress(adresse) {
    // Construire la requête d'adresse
    let queryString;

    if (typeof adresse === 'string') {
      queryString = adresse;
    } else {
      // Construire à partir de l'objet adresse SIRENE
      queryString = [
        adresse.numeroVoie,
        adresse.typeVoie,
        adresse.libelleVoie,
        adresse.codePostal,
        adresse.commune
      ].filter(Boolean).join(' ');
    }

    if (!queryString || queryString.trim().length < 3) {
      throw new Error('Adresse trop courte pour géocodage');
    }

    const cacheKey = `ban:geocode:${queryString}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('ban');

      try {
        const params = {
          q: queryString,
          limit: 5,
          autocomplete: 0
        };

        // Ajouter filtre code postal si disponible
        if (typeof adresse === 'object' && adresse.codePostal) {
          params.postcode = adresse.codePostal;
        }

        const response = await this.client.get('/search/', { params });

        const features = response.data.features || [];

        if (features.length === 0) {
          console.warn('⚠️  BAN: Aucune adresse trouvée pour', queryString);
          return null;
        }

        // Prendre le meilleur résultat (score le plus élevé)
        const bestMatch = features[0];
        const props = bestMatch.properties;
        const coords = bestMatch.geometry.coordinates;

        // Vérifier score de confiance (< 0.4 = peu fiable)
        if (props.score < 0.4) {
          console.warn(`⚠️  BAN: Score faible (${props.score}) pour`, queryString);
        }

        console.log(`✅ BAN: Géocodage réussi - Score: ${props.score.toFixed(2)}`);

        return this.formatBAN(bestMatch);

      } catch (error) {
        console.error('❌ Erreur API BAN:', error.message);
        return null;
      }
    }, 2592000); // Cache 30 jours (adresses quasi-statiques)
  }

  /**
   * Géocodage inverse (coordonnées → adresse)
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<Object>}
   */
  async reverseGeocode(latitude, longitude) {
    if (!latitude || !longitude) {
      throw new Error('Latitude et longitude requises');
    }

    const cacheKey = `ban:reverse:${latitude},${longitude}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('ban');

      try {
        const params = {
          lat: latitude,
          lon: longitude
        };

        const response = await this.client.get('/reverse/', { params });

        const features = response.data.features || [];

        if (features.length === 0) {
          console.warn('⚠️  BAN: Aucune adresse trouvée pour coordonnées', latitude, longitude);
          return null;
        }

        console.log('✅ BAN: Géocodage inverse réussi');

        return this.formatBAN(features[0]);

      } catch (error) {
        console.error('❌ Erreur géocodage inverse BAN:', error.message);
        return null;
      }
    }, 2592000); // Cache 30 jours
  }

  /**
   * Normalise une adresse (nettoie et structure)
   * @param {Object|string} adresse - Adresse à normaliser
   * @returns {Promise<Object>}
   */
  async normalizeAddress(adresse) {
    const geocoded = await this.geocodeAddress(adresse);

    if (!geocoded) {
      // Retourner l'adresse d'origine si géocodage échoue
      if (typeof adresse === 'object') {
        return {
          adresseComplete: [
            adresse.numeroVoie,
            adresse.typeVoie,
            adresse.libelleVoie
          ].filter(Boolean).join(' '),
          codePostal: adresse.codePostal,
          commune: adresse.commune,
          normalized: false
        };
      }

      return {
        adresseComplete: adresse,
        normalized: false
      };
    }

    return {
      ...geocoded,
      normalized: true
    };
  }

  /**
   * Formate les données BAN
   * @param {Object} feature - Feature GeoJSON de l'API BAN
   * @returns {Object}
   */
  formatBAN(feature) {
    const props = feature.properties;
    const coords = feature.geometry.coordinates;

    return {
      // Adresse formatée
      adresseComplete: props.label,
      numeroVoie: props.housenumber || '',
      typeVoie: props.street ? props.street.split(' ')[0] : '',
      libelleVoie: props.name,

      // Localisation
      codePostal: props.postcode,
      commune: props.city,
      codeINSEE: props.citycode,

      // Coordonnées GPS (WGS84)
      coordinates: {
        longitude: coords[0],
        latitude: coords[1]
      },

      // Coordonnées Lambert 93
      coordinatesLambert93: {
        x: props.x,
        y: props.y
      },

      // Contexte géographique
      context: props.context, // Format: "95, Val-d'Oise, Île-de-France"
      departement: props.context ? props.context.split(',')[0].trim() : null,
      region: props.context ? props.context.split(',').pop().trim() : null,

      // Qualité
      score: props.score,
      type: props.type, // housenumber, street, locality, municipality
      importance: props.importance,

      // Identifiants
      banId: props.banId,
      id: props.id,

      // Données brutes
      _raw: feature,
      _source: 'ban'
    };
  }

  /**
   * Recherche d'adresses avec autocomplétion
   * @param {string} query - Requête partielle
   * @param {number} limit - Nombre de résultats
   * @returns {Promise<Array>}
   */
  async autocomplete(query, limit = 10) {
    if (!query || query.trim().length < 3) {
      return [];
    }

    const cacheKey = `ban:autocomplete:${query}:${limit}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('ban');

      try {
        const params = {
          q: query,
          limit: Math.min(limit, 20),
          autocomplete: 1
        };

        const response = await this.client.get('/search/', { params });

        const features = response.data.features || [];

        return features.map(f => this.formatBAN(f));

      } catch (error) {
        console.error('❌ Erreur autocomplete BAN:', error.message);
        return [];
      }
    }, 300); // Cache 5 minutes pour autocomplete
  }

  /**
   * Vérifie si une adresse existe et est valide
   * @param {Object|string} adresse - Adresse à vérifier
   * @returns {Promise<boolean>}
   */
  async isValidAddress(adresse) {
    const result = await this.geocodeAddress(adresse);

    if (!result) return false;

    // Considérer valide si score > 0.5
    return result.score > 0.5;
  }
}

module.exports = new BANService();
