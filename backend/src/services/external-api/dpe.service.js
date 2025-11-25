const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const cacheService = require('../cache.service');

/**
 * Service pour l'API DPE de l'ADEME
 * Documentation: https://data.ademe.fr
 * API GRATUITE Open Data
 */
class DPEService {
  constructor() {
    this.baseURL = process.env.DPE_API_URL || 'https://data.ademe.fr/data-fair/api/v1/datasets';

    // IDs des datasets DPE (MISE À JOUR 2025 - nouveaux IDs simplifiés)
    // https://data.ademe.fr/datasets/dpe01tertiaire
    // https://data.ademe.fr/datasets/dpe03existant
    this.datasets = {
      tertiaire: process.env.DPE_DATASET_TERTIAIRE || 'dpe01tertiaire',  // DPE tertiaire (depuis juillet 2021)
      existant: process.env.DPE_DATASET_LOGEMENTS || 'dpe03existant',     // DPE logements existants (depuis juillet 2021)
      neuf: process.env.DPE_DATASET_NEUFS || 'dpe02neufs'                 // DPE logements neufs (depuis juillet 2021)
    };

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

    this.rateLimiter = cacheService.getRateLimiter('dpe', 10, 1);
  }

  /**
   * Recherche DPE par adresse
   * @param {Object} adresse - { adresse, codePostal, commune }
   * @param {string} type - Type de bâtiment (tertiaire, existant, neuf)
   * @returns {Promise<Array>}
   */
  async searchByAddress(adresse, type = 'tertiaire') {
    if (!adresse.codePostal && !adresse.commune) {
      return [];
    }

    const cacheKey = `dpe:address:${type}:${JSON.stringify(adresse)}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('dpe');

      try {
        const dataset = this.datasets[type] || this.datasets.tertiaire;
        const params = {
          size: 20,
          select: [
            'numero_dpe',
            'code_postal_ban',
            'nom_commune_ban',
            'adresse_ban',
            'etiquette_dpe',
            'etiquette_ges',
            'conso_kwhep_m2_an',
            'surface_utile',
            'surface_habitable',
            'surface_shon',
            'periode_construction',
            'annee_construction',
            'type_energie_n1',
            'type_energie_principale_chauffage_n1',
            'type_installation_chauffage_n1',
            'hauteur_sous_plafond',
            'nombre_niveaux',
            'secteur_activite',
            '_geopoint'
          ].join(',')
        };

        // Construire la requête de recherche
        const q = [];
        if (adresse.codePostal) q.push(`code_postal_ban:${adresse.codePostal}`);
        if (adresse.commune) q.push(`nom_commune_ban:${adresse.commune}`);
        if (adresse.adresse) {
          // Nettoyage de l'adresse pour la recherche
          const cleanAddr = adresse.adresse.replace(/[^\w\s]/g, ' ').trim();
          q.push(`adresse_ban:*${cleanAddr}*`);
        }

        if (q.length > 0) {
          params.q = q.join(' AND ');
          params.q_mode = 'simple';
        }

        const response = await this.client.get(`/${dataset}/lines`, { params });

        const results = response.data.results || [];
        return results.map(r => this.formatDPE(r));

      } catch (error) {
        console.error('Erreur API DPE:', error.message);
        return [];
      }
    }, 7200); // Cache 2h
  }

  /**
   * Recherche DPE par SIRET (pour bâtiments tertiaires)
   * @param {string} siret - Numéro SIRET
   * @returns {Promise<Array>}
   */
  async searchBySiret(siret) {
    if (!siret || siret.length !== 14) {
      return [];
    }

    const cacheKey = `dpe:siret:${siret}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('dpe');

      try {
        const params = {
          q: `n_siret:${siret}`,
          q_mode: 'simple',
          size: 20
        };

        const response = await this.client.get(`/${this.datasets.tertiaire}/lines`, { params });

        const results = response.data.results || [];
        return results.map(r => this.formatDPE(r));

      } catch (error) {
        console.error('Erreur recherche DPE par SIRET:', error.message);
        return [];
      }
    }, 7200);
  }

  /**
   * Statistiques DPE par code postal
   * @param {string} codePostal - Code postal
   * @returns {Promise<Object>}
   */
  async getStatsByCodePostal(codePostal) {
    const cacheKey = `dpe:stats:${codePostal}`;

    return await cacheService.getOrSet(cacheKey, async () => {
      await cacheService.waitForRateLimit('dpe');

      try {
        const params = {
          q: `code_postal_ban:${codePostal}`,
          q_mode: 'simple',
          size: 1000 // Récupérer plus de résultats pour les stats
        };

        const response = await this.client.get(`/${this.datasets.tertiaire}/lines`, { params });

        const results = response.data.results || [];

        // Calculer les statistiques
        const stats = {
          total: results.length,
          etiquettes: {},
          consommationMoyenne: 0,
          surfaceMoyenne: 0,
          anneeMoyenne: 0,
          typesChauffage: {}
        };

        let totalConso = 0;
        let totalSurface = 0;
        let totalAnnee = 0;
        let countConso = 0;
        let countSurface = 0;
        let countAnnee = 0;

        results.forEach(dpe => {
          // Étiquettes
          const etiquette = dpe['etiquette_dpe'] || 'Inconnu';
          stats.etiquettes[etiquette] = (stats.etiquettes[etiquette] || 0) + 1;

          // Consommation
          const conso = parseFloat(dpe['conso_kwhep_m2_an'] || dpe['conso_5_usages_par_m2_ef']);
          if (!isNaN(conso)) {
            totalConso += conso;
            countConso++;
          }

          // Surface
          const surface = parseFloat(dpe['surface_habitable'] || dpe['surface_utile']);
          if (!isNaN(surface)) {
            totalSurface += surface;
            countSurface++;
          }

          // Année
          const annee = parseInt(dpe['annee_construction']);
          if (!isNaN(annee)) {
            totalAnnee += annee;
            countAnnee++;
          }

          // Type chauffage
          const typeChauf = dpe['type_energie_n1'] || dpe['type_energie_principale_chauffage_n1'];
          if (typeChauf) {
            stats.typesChauffage[typeChauf] = (stats.typesChauffage[typeChauf] || 0) + 1;
          }
        });

        stats.consommationMoyenne = countConso > 0 ? Math.round(totalConso / countConso) : 0;
        stats.surfaceMoyenne = countSurface > 0 ? Math.round(totalSurface / countSurface) : 0;
        stats.anneeMoyenne = countAnnee > 0 ? Math.round(totalAnnee / countAnnee) : 0;

        return stats;

      } catch (error) {
        console.error('Erreur stats DPE:', error.message);
        return null;
      }
    }, 86400); // Cache 24h pour les stats
  }

  /**
   * Formate les données DPE
   * @param {Object} data - Données brutes
   * @returns {Object}
   */
  formatDPE(data) {
    return {
      numeroDPE: data['numero_dpe'],
      adresse: data['adresse_ban'],
      codePostal: data['code_postal_ban'],
      commune: data['nom_commune_ban'],

      // Performance énergétique
      etiquetteDPE: data['etiquette_dpe'],
      etiquetteGES: data['etiquette_ges'],
      consommation: parseFloat(data['conso_kwhep_m2_an'] || data['conso_5_usages_par_m2_ef']) || null,
      consommationUnit: 'kWh/m²/an',

      // Caractéristiques bâtiment
      typeBatiment: data['type_batiment'],
      secteurActivite: data['secteur_activite'],
      periodeConstruction: data['periode_construction'],
      anneeConstruction: parseInt(data['annee_construction']) || null,
      surface: parseFloat(data['surface_habitable'] || data['surface_utile']) || null,
      surfaceShon: parseFloat(data['surface_shon']) || null,
      hauteurPlafond: parseFloat(data['hauteur_sous_plafond']) || null,
      nombreNiveaux: parseInt(data['nombre_niveaux'] || data['nombre_niveaux_logement']) || null,

      // Chauffage
      typeInstallationChauffage: data['type_installation_chauffage_n1'] || data['type_installation_chauffage'],
      typeEnergieChauffage: data['type_energie_n1'] || data['type_energie_principale_chauffage_n1'],

      // Géolocalisation
      geopoint: data['_geopoint'],
      coordinates: data['_geopoint'] ? {
        latitude: parseFloat(data['_geopoint'].split(',')[0]),
        longitude: parseFloat(data['_geopoint'].split(',')[1])
      } : null,

      // Métadonnées
      dateDPE: data['date_etablissement_dpe'],
      dateFinValidite: data['date_fin_validite_dpe'],
      methodeDPE: data['methode_dpe'],
      version: data['version_dpe'] || '2021',

      _raw: data,
      _source: 'dpe-ademe'
    };
  }

  /**
   * Déduit les données techniques pertinentes pour un produit
   * @param {Array} dpeList - Liste de DPE
   * @param {string} typeProduit - destratification, pression, matelas_isolants
   * @returns {Object}
   */
  deduceTechnicalData(dpeList, typeProduit) {
    if (!dpeList || dpeList.length === 0) return null;

    // Prendre le DPE le plus récent
    const dpe = dpeList[0];

    const technical = {};

    switch (typeProduit) {
      case 'destratification':
        // Pertinent pour la destratification
        technical.hauteur_max = dpe.hauteurPlafond || null;
        technical.m2_hors_bureau = dpe.surface || null;
        technical.type_chauffage = dpe.typeEnergieChauffage || null;
        technical.annee_construction = dpe.anneeConstruction || null;
        break;

      case 'pression':
      case 'matelas_isolants':
        // Données générales utiles
        technical.surface = dpe.surface || null;
        technical.type_energie = dpe.typeEnergieChauffage || null;
        technical.consommation_actuelle = dpe.consommation || null;
        technical.etiquette_energetique = dpe.etiquetteDPE || null;
        break;
    }

    return Object.keys(technical).length > 0 ? technical : null;
  }
}

module.exports = new DPEService();
