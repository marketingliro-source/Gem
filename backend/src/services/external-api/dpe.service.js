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

    // IDs des datasets DPE
    this.datasets = {
      tertiaire: 'dpe-v2-logements-existants', // DPE tertiaire/non-résidentiel
      existant: 'dpe-v2-logements-existants',  // DPE logements existants
      neuf: 'dpe-v2-logements-neufs'           // DPE logements neufs
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
            'N°DPE',
            'Code_postal_(BAN)',
            'Nom_commune_(Brut)',
            'Adresse_(BAN)',
            'Etiquette_DPE',
            'Etiquette_GES',
            'Conso_5_usages_é_finale',
            'Surface_habitable_logement',
            'Type_bâtiment',
            'Année_construction',
            'Type_installation_chauffage',
            'Type_énergie_principale_chauffage',
            'Surface_utile',
            'Hauteur_sous-plafond',
            'Nombre_niveaux_logement'
          ].join(',')
        };

        // Construire la requête de recherche
        const q = [];
        if (adresse.codePostal) q.push(`Code_postal_(BAN):${adresse.codePostal}`);
        if (adresse.commune) q.push(`Nom_commune_(Brut):${adresse.commune}`);
        if (adresse.adresse) {
          // Nettoyage de l'adresse pour la recherche
          const cleanAddr = adresse.adresse.replace(/[^\w\s]/g, ' ').trim();
          q.push(`Adresse_(BAN):*${cleanAddr}*`);
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
          q: `N°_SIRET:${siret}`,
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
          q: `Code_postal_(BAN):${codePostal}`,
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
          const etiquette = dpe['Etiquette_DPE'] || 'Inconnu';
          stats.etiquettes[etiquette] = (stats.etiquettes[etiquette] || 0) + 1;

          // Consommation
          const conso = parseFloat(dpe['Conso_5_usages_é_finale']);
          if (!isNaN(conso)) {
            totalConso += conso;
            countConso++;
          }

          // Surface
          const surface = parseFloat(dpe['Surface_habitable_logement'] || dpe['Surface_utile']);
          if (!isNaN(surface)) {
            totalSurface += surface;
            countSurface++;
          }

          // Année
          const annee = parseInt(dpe['Année_construction']);
          if (!isNaN(annee)) {
            totalAnnee += annee;
            countAnnee++;
          }

          // Type chauffage
          const typeChauf = dpe['Type_énergie_principale_chauffage'];
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
      numeroDPE: data['N°DPE'],
      adresse: data['Adresse_(BAN)'],
      codePostal: data['Code_postal_(BAN)'],
      commune: data['Nom_commune_(Brut)'],

      // Performance énergétique
      etiquetteDPE: data['Etiquette_DPE'],
      etiquetteGES: data['Etiquette_GES'],
      consommation: parseFloat(data['Conso_5_usages_é_finale']) || null,
      consommationUnit: 'kWh/m²/an',

      // Caractéristiques bâtiment
      typeBatiment: data['Type_bâtiment'],
      anneeConstruction: parseInt(data['Année_construction']) || null,
      surface: parseFloat(data['Surface_habitable_logement'] || data['Surface_utile']) || null,
      hauteurPlafond: parseFloat(data['Hauteur_sous-plafond']) || null,
      nombreNiveaux: parseInt(data['Nombre_niveaux_logement']) || null,

      // Chauffage
      typeInstallationChauffage: data['Type_installation_chauffage'],
      typeEnergieChauffage: data['Type_énergie_principale_chauffage'],

      // Métadonnées
      dateDPE: data['Date_établissement_DPE'],
      version: data['Version_DPE'] || '2021',

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
