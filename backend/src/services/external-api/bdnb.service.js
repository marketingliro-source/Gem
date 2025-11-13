const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const cacheService = require('../cache.service');

/**
 * Service pour l'API BDNB (Base de Données Nationale des Bâtiments)
 * Documentation: https://bdnb.io/services/services_api/
 * API Open gratuite avec inscription
 */
class BDNBService {
  constructor() {
    this.baseURL = process.env.BDNB_API_URL || 'https://bdnb.io/api/v2';
    this.apiKey = process.env.BDNB_API_KEY;

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

    this.rateLimiter = cacheService.getRateLimiter('bdnb', 10, 1);
  }

  /**
   * Obtient les headers d'authentification
   * @returns {Object}
   */
  getAuthHeaders() {
    if (!this.apiKey) {
      console.warn('⚠️  BDNB_API_KEY non configurée - données limitées');
      return {};
    }
    return {
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  /**
   * Recherche bâtiment par adresse
   * @param {Object} adresse - { adresse, codePostal, commune }
   * @returns {Promise<Array>}
   */
  async searchByAddress(adresse) {
    if (!adresse.adresse && !adresse.codePostal) {
      return [];
    }

    const cacheKey = `bdnb:address:${JSON.stringify(adresse)}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('bdnb');

      try {
        const params = {
          limit: 10
        };

        // Construire l'adresse complète
        const adresseComplete = [
          adresse.adresse,
          adresse.codePostal,
          adresse.commune
        ].filter(Boolean).join(', ');

        params.address = adresseComplete;

        const response = await this.client.get('/buildings', {
          params,
          headers: this.getAuthHeaders()
        });

        const results = response.data.results || response.data || [];
        return Array.isArray(results) ? results.map(r => this.formatBuilding(r)) : [];

      } catch (error) {
        if (error.response?.status === 401) {
          console.warn('⚠️  BDNB: Authentification requise - vérifier BDNB_API_KEY');
        } else {
          console.error('Erreur API BDNB:', error.message);
        }
        return [];
      }
    }, 7200); // Cache 2h
  }

  /**
   * Recherche par coordonnées géographiques
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} radius - Rayon en mètres (défaut: 100m)
   * @returns {Promise<Array>}
   */
  async searchByCoordinates(lat, lng, radius = 100) {
    const cacheKey = `bdnb:coords:${lat},${lng},${radius}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('bdnb');

      try {
        const params = {
          lat,
          lng,
          radius,
          limit: 10
        };

        const response = await this.client.get('/buildings', {
          params,
          headers: this.getAuthHeaders()
        });

        const results = response.data.results || response.data || [];
        return Array.isArray(results) ? results.map(r => this.formatBuilding(r)) : [];

      } catch (error) {
        console.error('Erreur recherche BDNB par coordonnées:', error.message);
        return [];
      }
    }, 7200);
  }

  /**
   * Récupère les informations détaillées d'un bâtiment
   * @param {string} buildingId - ID du bâtiment BDNB
   * @returns {Promise<Object|null>}
   */
  async getBuildingDetails(buildingId) {
    const cacheKey = `bdnb:building:${buildingId}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('bdnb');

      try {
        const response = await this.client.get(`/buildings/${buildingId}`, {
          headers: this.getAuthHeaders()
        });

        return this.formatBuilding(response.data);

      } catch (error) {
        if (error.response?.status === 404) {
          return null;
        }
        console.error('Erreur détails BDNB:', error.message);
        return null;
      }
    }, 86400); // Cache 24h
  }

  /**
   * Formate les données bâtiment BDNB
   * @param {Object} data - Données brutes
   * @returns {Object}
   */
  formatBuilding(data) {
    return {
      id: data.batiment_groupe_id || data.id,

      // Localisation
      adresse: data.adresse_principale || data.adresse,
      codePostal: data.code_postal,
      commune: data.nom_commune || data.commune,
      departement: data.code_departement,
      region: data.nom_region,

      // Coordonnées géographiques
      latitude: data.latitude || data.lat,
      longitude: data.longitude || data.lng,

      // Caractéristiques générales
      anneeConstruction: data.annee_construction,
      nombreNiveaux: data.nb_niveau || data.nombre_niveaux,
      hauteur: data.hauteur,
      surfacePlancher: data.surface_plancher,
      surfaceEmprise: data.surface_emprise_sol,

      // Usage
      typeUsage: data.type_usage || data.usage_principal,
      usageDetail: data.libelle_usage,

      // Données énergétiques
      classeDPE: data.classe_dpe_median || data.etiquette_dpe,
      classeGES: data.classe_ges_median,
      consommationEstimee: data.conso_energie_finale_estimee,
      potentielSolaire: data.potentiel_solaire,

      // Chauffage
      typeChauffage: data.type_energie_chauffage,
      typeInstallation: data.type_installation_chauffage,
      modeProduction: data.mode_production_eau_chaude,

      // Réseau de chaleur
      raccordeReseauChaleur: data.est_raccorde_reseau_chaleur === 'oui',
      distanceReseauChaleur: data.distance_reseau_chaleur,

      // Indicateurs thermiques
      isolationMurs: data.epaisseur_isolation_murs_exterieurs,
      isolationToiture: data.epaisseur_isolation_toiture,
      typeVitrage: data.type_vitrage,
      permeabilite: data.permeabilite_air,

      // Données complémentaires
      nombreLogements: data.nb_logement,
      surfaceMoyenneLogement: data.surface_moyenne_logement,

      // Rénovation
      anneeDerniereRenovation: data.annee_renovation_dpe,
      potentielRenovation: data.potentiel_gain_renovation,

      // Données administratives
      siret: data.siret,
      codeNAF: data.code_naf,

      // Indicateurs qualité données
      fiabilite: data.fiabilite_donnees,
      sourceDonnees: data.source_principale,

      // Données brutes
      _raw: data,
      _source: 'bdnb'
    };
  }

  /**
   * Extrait les données techniques pertinentes pour un type de produit
   * @param {Object} building - Bâtiment formaté
   * @param {string} typeProduit - destratification, pression, matelas_isolants
   * @returns {Object}
   */
  extractTechnicalData(building, typeProduit) {
    if (!building) return null;

    const technical = {};

    switch (typeProduit) {
      case 'destratification':
        technical.hauteur_max = building.hauteur || null;
        technical.m2_hors_bureau = building.surfacePlancher || null;
        technical.type_chauffage = building.typeChauffage || null;
        technical.nb_niveaux = building.nombreNiveaux || null;
        technical.annee_construction = building.anneeConstruction || null;
        technical.puissance_estimee = this.estimatePuissance(building);
        break;

      case 'pression':
        technical.surface = building.surfacePlancher || null;
        technical.type_chauffage = building.typeChauffage || null;
        technical.type_installation = building.typeInstallation || null;
        technical.consommation_actuelle = building.consommationEstimee || null;
        break;

      case 'matelas_isolants':
        technical.surface = building.surfacePlancher || null;
        technical.type_chauffage = building.typeChauffage || null;
        technical.isolation_actuelle = {
          murs: building.isolationMurs,
          toiture: building.isolationToiture
        };
        technical.potentiel_economie = building.potentielRenovation || null;
        break;
    }

    return Object.keys(technical).length > 0 ? technical : null;
  }

  /**
   * Estime la puissance de chauffage nécessaire
   * @param {Object} building - Données bâtiment
   * @returns {number|null}
   */
  estimatePuissance(building) {
    if (!building.surfacePlancher) return null;

    // Estimation simplifiée: 50W/m² pour bâtiment tertiaire
    const puissanceUnitaire = 50; // W/m²
    const puissanceKW = (building.surfacePlancher * puissanceUnitaire) / 1000;

    return Math.round(puissanceKW);
  }

  /**
   * Recommande un produit en fonction des caractéristiques du bâtiment
   * @param {Object} building - Données bâtiment
   * @returns {Array<string>}
   */
  recommendProducts(building) {
    const recommendations = [];

    if (!building) return recommendations;

    // Destratification: bâtiments avec grande hauteur
    if (building.hauteur && building.hauteur > 4) {
      recommendations.push({
        produit: 'destratification',
        pertinence: 'haute',
        raison: `Hauteur importante (${building.hauteur}m) favorable à la stratification thermique`
      });
    }

    // Pression: grands bâtiments
    if (building.surfacePlancher && building.surfacePlancher > 500) {
      recommendations.push({
        produit: 'pression',
        pertinence: 'moyenne',
        raison: `Grande surface (${building.surfacePlancher}m²) nécessite gestion pression`
      });
    }

    // Matelas isolants: mauvaise isolation
    if (building.classeDPE && ['E', 'F', 'G'].includes(building.classeDPE)) {
      recommendations.push({
        produit: 'matelas_isolants',
        pertinence: 'haute',
        raison: `Mauvaise performance énergétique (DPE ${building.classeDPE})`
      });
    }

    return recommendations;
  }
}

module.exports = new BDNBService();
