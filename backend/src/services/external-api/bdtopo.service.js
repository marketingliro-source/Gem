const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const cacheService = require('../cache.service');

/**
 * Service pour l'API BD TOPO IGN (Institut Géographique National)
 * Documentation: https://geoservices.ign.fr/documentation/services/services-geoplateforme
 * API gratuite avec clé démo disponible
 * Récupération hauteur bâtiments, nombre d'étages, géométrie
 */
class BDTopoService {
  constructor() {
    // API WFS (Web Feature Service) IGN
    this.baseURL = process.env.BDTOPO_API_URL || 'https://data.geopf.fr/wfs/ows';

    // Clé API IGN (clé "essentiels" gratuite)
    // Si non fournie, utilise clé démo publique
    this.apiKey = process.env.BDTOPO_API_KEY || 'essentiels';

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

    // Rate limiter (10 req/s pour clé gratuite)
    const rateLimit = parseInt(process.env.BDTOPO_RATE_LIMIT) || 10;
    this.rateLimiter = cacheService.getRateLimiter('bdtopo', rateLimit, 1);
  }

  /**
   * Recherche bâtiments par coordonnées GPS
   * @param {number} latitude - Latitude WGS84
   * @param {number} longitude - Longitude WGS84
   * @param {number} radius - Rayon recherche en mètres (défaut: 50m)
   * @returns {Promise<Array>}
   */
  async searchBuildingsByCoordinates(latitude, longitude, radius = 50) {
    if (!latitude || !longitude) {
      throw new Error('Latitude et longitude requises');
    }

    const cacheKey = `bdtopo:coords:${latitude},${longitude}:${radius}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('bdtopo');

      try {
        // WFS GetFeature request pour la couche BDTOPO_V3:batiment
        const params = {
          service: 'WFS',
          version: '2.0.0',
          request: 'GetFeature',
          typeName: 'BDTOPO_V3:batiment',
          outputFormat: 'application/json',
          srsName: 'EPSG:4326', // WGS84
          count: 10,
          // Filtre spatial DWithin (point dans rayon)
          cql_filter: `DWITHIN(geometrie,POINT(${longitude} ${latitude}),${radius / 1000},kilometers)`
        };

        const response = await this.client.get('', {
          params,
          headers: {
            'apikey': this.apiKey
          }
        });

        const features = response.data.features || [];

        if (features.length === 0) {
          console.warn(`⚠️  BD TOPO: Aucun bâtiment trouvé à ${radius}m de ${latitude},${longitude}`);
          return [];
        }

        console.log(`✅ BD TOPO: ${features.length} bâtiment(s) trouvé(s)`);

        return features.map(f => this.formatBuilding(f));

      } catch (error) {
        console.error('❌ Erreur API BD TOPO:', error.message);
        if (error.response?.status === 403) {
          console.error('💡 Astuce: Vérifier la clé API IGN dans BDTOPO_API_KEY');
        }
        return [];
      }
    }, 7776000); // Cache 90 jours (données quasi-statiques)
  }

  /**
   * Obtient le bâtiment le plus proche avec sa hauteur
   * @param {number} latitude - Latitude WGS84
   * @param {number} longitude - Longitude WGS84
   * @param {number} maxRadius - Rayon maximum recherche (défaut: 100m)
   * @returns {Promise<Object|null>}
   */
  async getNearestBuildingWithHeight(latitude, longitude, maxRadius = 100) {
    const buildings = await this.searchBuildingsByCoordinates(latitude, longitude, maxRadius);

    if (!buildings || buildings.length === 0) {
      return null;
    }

    // Trier par distance (si disponible) ou prendre le premier
    // Le WFS DWITHIN retourne déjà triés par distance
    const nearest = buildings[0];

    // Calculer distance approximative
    if (nearest.coordinates) {
      nearest.distance = this.calculateDistance(
        latitude,
        longitude,
        nearest.coordinates.latitude,
        nearest.coordinates.longitude
      );
    }

    return nearest;
  }

  /**
   * Vérifie si un bâtiment dépasse une hauteur minimale
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} minHeight - Hauteur minimale en mètres (ex: 4)
   * @param {number} radius - Rayon recherche (défaut: 50m)
   * @returns {Promise<boolean>}
   */
  async hasMinimumHeight(latitude, longitude, minHeight = 4, radius = 50) {
    const building = await this.getNearestBuildingWithHeight(latitude, longitude, radius);

    if (!building || !building.hauteur) {
      return false; // Hauteur inconnue = conservateur (false)
    }

    return building.hauteur >= minHeight;
  }

  /**
   * Estime la hauteur par nombre d'étages si hauteur non disponible
   * @param {number} nombreEtages - Nombre d'étages
   * @param {number} hauteurMoyenneEtage - Hauteur moyenne par étage (défaut: 3m)
   * @returns {number}
   */
  estimateHeightFromFloors(nombreEtages, hauteurMoyenneEtage = 3) {
    if (!nombreEtages || nombreEtages < 1) return null;
    return nombreEtages * hauteurMoyenneEtage;
  }

  /**
   * Formate les données BD TOPO bâtiment
   * @param {Object} feature - Feature GeoJSON
   * @returns {Object}
   */
  formatBuilding(feature) {
    const props = feature.properties || {};
    const geom = feature.geometry;

    // Extraire coordonnées centroïde du bâtiment
    let coordinates = null;
    if (geom && geom.coordinates) {
      // Géométrie peut être Polygon, MultiPolygon, Point
      if (geom.type === 'Point') {
        coordinates = {
          longitude: geom.coordinates[0],
          latitude: geom.coordinates[1]
        };
      } else if (geom.type === 'Polygon' && geom.coordinates[0]) {
        // Calculer centroïde simple (moyenne des coordonnées)
        const coords = geom.coordinates[0];
        const sumLon = coords.reduce((sum, c) => sum + c[0], 0);
        const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
        coordinates = {
          longitude: sumLon / coords.length,
          latitude: sumLat / coords.length
        };
      }
    }

    // Hauteur bâtiment
    const hauteur = parseFloat(props.hauteur || props.z_max - props.z_min) || null;
    const nombreEtages = parseInt(props.nombre_etages || props.nombre_de_niveaux) || null;

    // Estimation hauteur si manquante mais étages connus
    const hauteurEstimee = hauteur || this.estimateHeightFromFloors(nombreEtages);

    return {
      // Identifiant
      id: props.id || props.cleabs,
      idRNB: props.id_rnb, // Lien vers RNB si disponible

      // Hauteur (donnée critique)
      hauteur: hauteur,
      hauteurEstimee: hauteurEstimee,
      nombreEtages: nombreEtages,

      // Altitudes
      altitudeMin: parseFloat(props.z_min) || null,
      altitudeMax: parseFloat(props.z_max) || null,
      altitudeSol: parseFloat(props.z_min) || null,

      // Caractéristiques
      nature: props.nature, // Indifférencié, Industriel, Commercial, etc.
      usage: props.usage_1 || props.usage,
      etat: props.etat, // En construction, En service, Détruit

      // Surface
      surfaceEmpriseAuSol: parseFloat(props.surface) || null,

      // Géométrie
      geometry: geom,
      coordinates: coordinates,

      // Métadonnées
      source: props.source,
      dateCreation: props.date_creation,
      dateMaj: props.date_modification,

      // Données brutes
      _raw: props,
      _source: 'bdtopo-ign'
    };
  }

  /**
   * Calcule distance entre 2 points GPS (Haversine)
   * @param {number} lat1 - Latitude point 1
   * @param {number} lon1 - Longitude point 1
   * @param {number} lat2 - Latitude point 2
   * @param {number} lon2 - Longitude point 2
   * @returns {number} Distance en mètres
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Rayon terre en mètres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en mètres
  }

  /**
   * Scoring pour destratification basé sur hauteur
   * @param {Object} building - Données bâtiment BD TOPO
   * @returns {number} Score 0-100
   */
  scoreDestratification(building) {
    let score = 0;

    if (!building) return 0;

    const hauteur = building.hauteurEstimee || building.hauteur;

    // Critère principal: hauteur
    if (hauteur) {
      if (hauteur >= 8) score += 40; // Très pertinent (>8m)
      else if (hauteur >= 6) score += 30; // Pertinent (6-8m)
      else if (hauteur >= 4) score += 20; // Minimum requis (4-6m)
      else score += 0; // Pas assez haut (<4m)
    } else {
      // Hauteur inconnue: estimation conservatrice basée sur étages
      if (building.nombreEtages) {
        if (building.nombreEtages >= 3) score += 30;
        else if (building.nombreEtages >= 2) score += 20;
      }
    }

    // Nature bâtiment
    const nature = (building.nature || '').toLowerCase();
    if (nature.includes('industriel')) score += 20;
    else if (nature.includes('commercial')) score += 15;
    else if (nature.includes('agricole')) score += 15;

    // Usage
    const usage = (building.usage || '').toLowerCase();
    if (usage.includes('entrepôt')) score += 15;
    else if (usage.includes('commerce')) score += 10;

    // État
    if (building.etat === 'En service') score += 5;

    // Surface emprise (proxy pour volume)
    if (building.surfaceEmpriseAuSol) {
      if (building.surfaceEmpriseAuSol >= 1000) score += 10; // >1000m²
      else if (building.surfaceEmpriseAuSol >= 500) score += 5; // 500-1000m²
    }

    return Math.min(score, 100);
  }

  /**
   * Récupère données techniques pour destratification
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<Object|null>}
   */
  async getTechnicalDataForDestratification(latitude, longitude) {
    const building = await this.getNearestBuildingWithHeight(latitude, longitude, 100);

    if (!building) {
      return null;
    }

    const hauteur = building.hauteurEstimee || building.hauteur;

    return {
      hauteur_batiment: hauteur,
      nombre_etages: building.nombreEtages,
      surface_emprise: building.surfaceEmpriseAuSol,
      nature_batiment: building.nature,
      usage_batiment: building.usage,
      altitude_sol: building.altitudeSol,

      // Qualification
      eligibleDestratification: hauteur ? hauteur >= 4 : null,
      scoreDestratification: this.scoreDestratification(building),

      // Source
      _source: 'bdtopo-ign',
      _distance: building.distance
    };
  }
}

module.exports = new BDTopoService();
