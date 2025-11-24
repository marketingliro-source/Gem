const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const cacheService = require('../cache.service');

/**
 * Service pour l'API RNB (Référentiel National des Bâtiments)
 * Documentation: https://rnb-fr.gitbook.io/documentation/api-et-outils/api-batiments
 * API 100% gratuite sans clé requise
 * Identifiant unique national des bâtiments (ID-RNB) - PIVOT pour croisement données
 */
class RNBService {
  constructor() {
    this.baseURL = process.env.RNB_API_URL || 'https://rnb-api.beta.gouv.fr/api/alpha';

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

    // Rate limiter (20 req/s)
    const rateLimit = parseInt(process.env.RNB_RATE_LIMIT) || 20;
    this.rateLimiter = cacheService.getRateLimiter('rnb', rateLimit, 1);
  }

  /**
   * Recherche bâtiment le plus proche par coordonnées GPS
   * @param {number} latitude - Latitude WGS84
   * @param {number} longitude - Longitude WGS84
   * @param {number} radius - Rayon recherche en mètres (défaut: 100m)
   * @param {number} limit - Nombre max résultats (défaut: 1)
   * @returns {Promise<Array>}
   */
  async findBuildingByCoordinates(latitude, longitude, radius = 100, limit = 1) {
    if (!latitude || !longitude) {
      throw new Error('Latitude et longitude requises');
    }

    const cacheKey = `rnb:coords:${latitude},${longitude}:${radius}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('rnb');

      try {
        const params = {
          lat: latitude,
          lon: longitude,
          radius: radius,
          from: 'crm-ehc@prospection.fr' // Optionnel mais recommandé
        };

        if (limit) {
          params.limit = limit;
        }

        const response = await this.client.get('/buildings/closest/', { params });

        const buildings = response.data.results || response.data || [];

        if (buildings.length === 0) {
          console.warn(`⚠️  RNB: Aucun bâtiment trouvé à ${radius}m de ${latitude},${longitude}`);
          return [];
        }

        console.log(`✅ RNB: ${buildings.length} bâtiment(s) trouvé(s)`);

        return buildings.map(b => this.formatBuilding(b));

      } catch (error) {
        console.error('❌ Erreur API RNB coordinates:', error.message);
        return [];
      }
    }, 7776000); // Cache 90 jours (données quasi-statiques)
  }

  /**
   * Recherche bâtiment par adresse textuelle
   * @param {string|Object} adresse - Adresse textuelle ou objet adresse
   * @returns {Promise<Array>}
   */
  async findBuildingByAddress(adresse) {
    let queryString;

    if (typeof adresse === 'string') {
      queryString = adresse;
    } else {
      // Construire à partir de l'objet adresse
      queryString = [
        adresse.numeroVoie,
        adresse.typeVoie,
        adresse.libelleVoie,
        adresse.codePostal,
        adresse.commune
      ].filter(Boolean).join(' ');
    }

    if (!queryString || queryString.trim().length < 5) {
      throw new Error('Adresse trop courte pour recherche RNB');
    }

    const cacheKey = `rnb:address:${queryString}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('rnb');

      try {
        const params = {
          q: queryString,
          from: 'crm-ehc@prospection.fr'
        };

        const response = await this.client.get('/buildings/address/', { params });

        const buildings = response.data.results || response.data || [];

        if (buildings.length === 0) {
          console.warn(`⚠️  RNB: Aucun bâtiment trouvé pour "${queryString}"`);
          return [];
        }

        console.log(`✅ RNB: ${buildings.length} bâtiment(s) trouvé(s) pour adresse`);

        return buildings.map(b => this.formatBuilding(b));

      } catch (error) {
        console.error('❌ Erreur API RNB address:', error.message);
        return [];
      }
    }, 7776000); // Cache 90 jours
  }

  /**
   * Récupère détails d'un bâtiment par son ID-RNB
   * @param {string} idRNB - Identifiant RNB (12 caractères alphanumériques)
   * @returns {Promise<Object>}
   */
  async getBuildingById(idRNB) {
    if (!idRNB || idRNB.length !== 12) {
      throw new Error('ID-RNB invalide (doit contenir 12 caractères)');
    }

    const cacheKey = `rnb:id:${idRNB}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('rnb');

      try {
        const response = await this.client.get(`/buildings/${idRNB}/`, {
          params: {
            from: 'crm-ehc@prospection.fr'
          }
        });

        console.log(`✅ RNB: Détails bâtiment ${idRNB} récupérés`);

        return this.formatBuilding(response.data);

      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error(`Bâtiment RNB ${idRNB} non trouvé`);
        }
        console.error('❌ Erreur API RNB details:', error.message);
        throw error;
      }
    }, 7776000); // Cache 90 jours
  }

  /**
   * Recherche bâtiments par parcelle cadastrale
   * @param {string} plotId - Identifiant parcelle (ex: "011230000D0123")
   * @returns {Promise<Array>}
   */
  async findBuildingsByPlot(plotId) {
    if (!plotId || plotId.length < 14) {
      throw new Error('ID parcelle cadastrale invalide');
    }

    const cacheKey = `rnb:plot:${plotId}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('rnb');

      try {
        const response = await this.client.get(`/buildings/plot/${plotId}/`, {
          params: {
            from: 'crm-ehc@prospection.fr'
          }
        });

        const buildings = response.data.results || response.data || [];

        console.log(`✅ RNB: ${buildings.length} bâtiment(s) sur parcelle ${plotId}`);

        return buildings.map(b => this.formatBuilding(b));

      } catch (error) {
        console.error('❌ Erreur API RNB plot:', error.message);
        return [];
      }
    }, 7776000); // Cache 90 jours
  }

  /**
   * Formate les données RNB
   * @param {Object} data - Données brutes API RNB
   * @returns {Object}
   */
  formatBuilding(data) {
    return {
      // Identifiant unique national (PIVOT)
      idRNB: data.rnb_id || data.id,

      // Localisation
      point: data.point ? {
        latitude: data.point.coordinates ? data.point.coordinates[1] : null,
        longitude: data.point.coordinates ? data.point.coordinates[0] : null
      } : null,

      // Adresses (peut y avoir plusieurs adresses par bâtiment)
      adresses: data.addresses || [],
      adressePrincipale: data.addresses && data.addresses.length > 0 ? {
        label: data.addresses[0].label,
        street: data.addresses[0].street,
        city: data.addresses[0].city,
        postcode: data.addresses[0].postcode
      } : null,

      // Parcelles cadastrales
      parcelles: data.plots || [],

      // Statistiques
      stats: {
        nombreAdresses: data.addresses ? data.addresses.length : 0,
        nombreParcelles: data.plots ? data.plots.length : 0
      },

      // Dates
      dateCreation: data.created_at,
      dateMiseAJour: data.updated_at,

      // Statut
      status: data.status,

      // Données brutes pour référence
      _raw: data,
      _source: 'rnb'
    };
  }

  /**
   * Recherche intelligente : essaie plusieurs méthodes
   * 1. Par adresse
   * 2. Si échec, géocode avec BAN puis cherche par coordonnées
   * @param {Object|string} adresse - Adresse ou objet adresse
   * @param {Object} banService - Service BAN pour géocodage fallback
   * @returns {Promise<Object|null>}
   */
  async findBuildingSmart(adresse, banService = null) {
    // 1. Essayer d'abord par adresse
    const buildingsByAddress = await this.findBuildingByAddress(adresse);

    if (buildingsByAddress && buildingsByAddress.length > 0) {
      return buildingsByAddress[0]; // Retourner le plus pertinent
    }

    // 2. Fallback : géocoder avec BAN puis chercher par coordonnées
    if (banService) {
      try {
        const banData = await banService.geocodeAddress(adresse);

        if (banData && banData.coordinates) {
          const buildingsByCoords = await this.findBuildingByCoordinates(
            banData.coordinates.latitude,
            banData.coordinates.longitude,
            100, // 100m de rayon
            1
          );

          if (buildingsByCoords && buildingsByCoords.length > 0) {
            console.log('✅ RNB: Bâtiment trouvé via fallback BAN → RNB');
            return buildingsByCoords[0];
          }
        }
      } catch (error) {
        console.warn('⚠️  RNB: Fallback BAN échoué:', error.message);
      }
    }

    console.warn('⚠️  RNB: Aucun bâtiment trouvé après toutes les tentatives');
    return null;
  }

  /**
   * Vérifie si un bâtiment existe dans RNB
   * @param {string|Object} adresse - Adresse à vérifier
   * @returns {Promise<boolean>}
   */
  async buildingExists(adresse) {
    const buildings = await this.findBuildingByAddress(adresse);
    return buildings && buildings.length > 0;
  }
}

module.exports = new RNBService();
