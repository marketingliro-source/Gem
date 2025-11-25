/**
 * Service de scoring intelligent multi-sources
 * Évalue la pertinence d'un prospect pour chaque produit (0-100)
 * Croise données: SIRENE, BDNB, BD TOPO, Géorisques, DPE
 */
class ScoringService {
  constructor() {
    // Seuils de qualification minimale par produit
    // 0 = retourner tous les résultats, triés par score
    this.seuilsMinimaux = {
      destratification: 0, // Tous les résultats
      pression: 0,         // Tous les résultats
      matelas_isolants: 0  // Tous les résultats
    };

    // Codes NAF prioritaires par produit
    this.nafPertinents = {
      destratification: [
        '47.11', // Supermarchés
        '47.19', // Grands magasins
        '52.10', // Entreposage
        '52.24', // Manutention
        '56.10', // Restaurants
        '93.11', // Gestion installations sportives
        '10.', // Industries alimentaires
        '28.', // Fabrication machines
        '01.', // Agriculture
      ],
      pression: [
        '86.10', // Activités hospitalières
        '87.', // Hébergement médico-social
        '55.', // Hébergement
        '85.', // Enseignement
        '91.04', // Jardins botaniques/zoologiques
        '93.', // Activités sportives
      ],
      matelas_isolants: [
        '24.', // Métallurgie
        '25.', // Fabrication produits métalliques
        '20.', // Industrie chimique
        '23.', // Fabrication autres produits minéraux
        '10.', // Industries alimentaires
        '28.', // Fabrication machines
        '29.', // Industrie automobile
        '30.', // Autres industries manufacturières
      ]
    };
  }

  /**
   * Score global pour DESTRATIFICATION (0-100)
   * Critères: Hauteur >4m, Surface, Chauffage aérien, Type activité
   * @param {Object} data - Données enrichies multi-sources
   * @returns {Object} { score, details, eligible, raisons }
   */
  scoreDestratification(data) {
    let score = 0;
    const details = {};
    const raisons = [];

    // === CRITÈRE 1: HAUTEUR BÂTIMENT (40 pts max) ===
    const hauteur =
      data.bdtopo?.hauteur ||
      data.bdtopo?.hauteurEstimee ||
      data.bdnb?.hauteur ||
      null;

    if (hauteur) {
      if (hauteur >= 8) {
        score += 40;
        details.hauteur = { valeur: hauteur, points: 40, niveau: 'excellent' };
        raisons.push(`Hauteur exceptionnelle (${hauteur}m) - Fort potentiel destratification`);
      } else if (hauteur >= 6) {
        score += 30;
        details.hauteur = { valeur: hauteur, points: 30, niveau: 'tres_bon' };
        raisons.push(`Hauteur élevée (${hauteur}m) - Bon potentiel destratification`);
      } else if (hauteur >= 4) {
        score += 20;
        details.hauteur = { valeur: hauteur, points: 20, niveau: 'minimum' };
        raisons.push(`Hauteur suffisante (${hauteur}m) - Minimum requis atteint`);
      } else {
        details.hauteur = { valeur: hauteur, points: 0, niveau: 'insuffisant' };
        raisons.push(`Hauteur insuffisante (${hauteur}m < 4m)`);
      }
    } else if (data.bdtopo?.nombreEtages || data.bdnb?.nombreNiveaux) {
      // Fallback: estimation par nombre d'étages
      const etages = data.bdtopo?.nombreEtages || data.bdnb?.nombreNiveaux;
      if (etages >= 3) {
        score += 25;
        details.hauteur = { valeur: `${etages} étages (estimé ${etages * 3}m)`, points: 25, niveau: 'estime_bon' };
        raisons.push(`${etages} étages détectés (hauteur estimée suffisante)`);
      } else if (etages >= 2) {
        score += 15;
        details.hauteur = { valeur: `${etages} étages (estimé ${etages * 3}m)`, points: 15, niveau: 'estime_moyen' };
        raisons.push(`${etages} étages - Hauteur estimée moyenne`);
      }
    }

    // === CRITÈRE 2: SURFACE (20 pts max) ===
    const surface =
      data.bdnb?.surfacePlancher ||
      data.bdtopo?.surfaceEmpriseAuSol ||
      data.dpe?.[0]?.surface ||
      null;

    if (surface) {
      if (surface >= 2000) {
        score += 20;
        details.surface = { valeur: surface, points: 20, niveau: 'tres_grande' };
        raisons.push(`Surface très importante (${surface}m²) - Fort volume à traiter`);
      } else if (surface >= 1000) {
        score += 15;
        details.surface = { valeur: surface, points: 15, niveau: 'grande' };
        raisons.push(`Grande surface (${surface}m²)`);
      } else if (surface >= 500) {
        score += 10;
        details.surface = { valeur: surface, points: 10, niveau: 'moyenne' };
        raisons.push(`Surface moyenne (${surface}m²)`);
      } else {
        details.surface = { valeur: surface, points: 5, niveau: 'petite' };
        score += 5;
      }
    }

    // === CRITÈRE 3: TYPE CHAUFFAGE (20 pts max) ===
    const typeChauffage =
      data.bdnb?.typeChauffage ||
      data.dpe?.[0]?.typeEnergieChauffage ||
      null;

    const typeInstallation =
      data.bdnb?.typeInstallation ||
      data.dpe?.[0]?.typeInstallationChauffage ||
      null;

    if (typeChauffage || typeInstallation) {
      const chauffageStr = `${typeChauffage} ${typeInstallation}`.toLowerCase();

      if (chauffageStr.includes('air') || chauffageStr.includes('aérien') ||
          chauffageStr.includes('aérotherme') || chauffageStr.includes('pulsion')) {
        score += 20;
        details.chauffage = { type: typeChauffage, installation: typeInstallation, points: 20, niveau: 'ideal' };
        raisons.push(`Chauffage aérien/air pulsé - Idéal pour destratification`);
      } else if (chauffageStr.includes('radiant') || chauffageStr.includes('rayonnant')) {
        score += 15;
        details.chauffage = { type: typeChauffage, installation: typeInstallation, points: 15, niveau: 'tres_bon' };
        raisons.push(`Chauffage radiant - Compatible destratification`);
      } else {
        score += 5;
        details.chauffage = { type: typeChauffage, installation: typeInstallation, points: 5, niveau: 'autre' };
      }
    }

    // === CRITÈRE 4: TYPE ACTIVITÉ / NAF (15 pts max) ===
    const codeNAF = data.sirene?.codeNAF || data.bdnb?.codeNAF;
    const nature = data.bdtopo?.nature?.toLowerCase() || '';
    const usage = data.bdtopo?.usage?.toLowerCase() || '';

    if (codeNAF) {
      const pertinence = this.checkNafPertinence(codeNAF, 'destratification');
      if (pertinence) {
        score += 15;
        details.activite = { codeNAF, pertinence, points: 15, niveau: 'pertinent' };
        raisons.push(`Activité pertinente (NAF ${codeNAF})`);
      } else {
        score += 5;
        details.activite = { codeNAF, pertinence: false, points: 5, niveau: 'autre' };
      }
    }

    if (nature.includes('industriel') || nature.includes('commercial') ||
        usage.includes('entrepôt') || usage.includes('commerce')) {
      score += 5;
      details.typeBatiment = { nature, usage, points: 5 };
      raisons.push(`Type bâtiment favorable (${nature || usage})`);
    }

    // === CRITÈRE 5: PERFORMANCE ÉNERGÉTIQUE (5 pts bonus) ===
    const classeDPE = data.bdnb?.classeDPE || data.dpe?.[0]?.etiquetteDPE;
    if (classeDPE && ['D', 'E', 'F', 'G'].includes(classeDPE)) {
      score += 5;
      details.dpe = { classe: classeDPE, points: 5 };
      raisons.push(`DPE ${classeDPE} - Potentiel économies d'énergie`);
    }

    const eligible = score >= this.seuilsMinimaux.destratification;

    return {
      score: Math.min(score, 100),
      eligible,
      seuilMinimum: this.seuilsMinimaux.destratification,
      details,
      raisons,
      criteresCles: {
        hauteurOk: (hauteur && hauteur >= 4) || false,
        surfaceOk: (surface && surface >= 500) || false
      }
    };
  }

  /**
   * Score global pour PRESSION (0-100)
   * Critères: Chauffage collectif, Chaudière, Surface, Multi-logements
   * @param {Object} data - Données enrichies multi-sources
   * @returns {Object} { score, details, eligible, raisons }
   */
  scorePression(data) {
    let score = 0;
    const details = {};
    const raisons = [];

    // === CRITÈRE 1: CHAUFFAGE COLLECTIF (40 pts max) ===
    const typeInstallation =
      data.bdnb?.typeInstallation ||
      data.dpe?.[0]?.typeInstallationChauffage ||
      '';

    const installationStr = typeInstallation.toLowerCase();

    if (installationStr.includes('collectif') || installationStr.includes('chaufferie')) {
      score += 40;
      details.installation = { type: typeInstallation, points: 40, niveau: 'ideal' };
      raisons.push(`Chauffage collectif détecté - Idéal pour solution pression`);
    } else if (installationStr.includes('chaudière') || installationStr.includes('chaudiere')) {
      score += 30;
      details.installation = { type: typeInstallation, points: 30, niveau: 'tres_bon' };
      raisons.push(`Chaudière détectée - Compatible solution pression`);
    } else if (data.bdnb?.raccordeReseauChaleur) {
      score += 35;
      details.installation = { type: 'Réseau de chaleur', points: 35, niveau: 'tres_bon' };
      raisons.push(`Raccordé réseau de chaleur - Excellent candidat`);
    } else if (installationStr.includes('central')) {
      score += 20;
      details.installation = { type: typeInstallation, points: 20, niveau: 'bon' };
      raisons.push(`Chauffage central - Potentiel solution pression`);
    }

    // === CRITÈRE 2: SURFACE (20 pts max) ===
    const surface =
      data.bdnb?.surfacePlancher ||
      data.bdtopo?.surfaceEmpriseAuSol ||
      null;

    if (surface) {
      if (surface >= 1500) {
        score += 20;
        details.surface = { valeur: surface, points: 20, niveau: 'tres_grande' };
        raisons.push(`Surface très importante (${surface}m²) - Grand réseau à gérer`);
      } else if (surface >= 800) {
        score += 15;
        details.surface = { valeur: surface, points: 15, niveau: 'grande' };
        raisons.push(`Grande surface (${surface}m²)`);
      } else if (surface >= 500) {
        score += 10;
        details.surface = { valeur: surface, points: 10, niveau: 'moyenne' };
      } else {
        score += 5;
        details.surface = { valeur: surface, points: 5, niveau: 'petite' };
      }
    }

    // === CRITÈRE 3: TYPE ÉNERGIE (15 pts max) ===
    const typeEnergie =
      data.bdnb?.typeChauffage ||
      data.dpe?.[0]?.typeEnergieChauffage ||
      null;

    if (typeEnergie) {
      const energieStr = typeEnergie.toLowerCase();

      if (energieStr.includes('gaz') || energieStr.includes('fioul')) {
        score += 15;
        details.energie = { type: typeEnergie, points: 15, niveau: 'ideal' };
        raisons.push(`Énergie ${typeEnergie} - Système pression applicable`);
      } else if (energieStr.includes('bois') || energieStr.includes('biomasse')) {
        score += 10;
        details.energie = { type: typeEnergie, points: 10, niveau: 'bon' };
        raisons.push(`Énergie ${typeEnergie} - Compatible`);
      }
    }

    // === CRITÈRE 4: NOMBRE LOGEMENTS / BÂTIMENTS (10 pts max) ===
    const nombreLogements = data.bdnb?.nombreLogements;
    if (nombreLogements && nombreLogements > 1) {
      if (nombreLogements >= 20) {
        score += 10;
        details.logements = { nombre: nombreLogements, points: 10, niveau: 'collectif_important' };
        raisons.push(`${nombreLogements} logements - Collectif important`);
      } else if (nombreLogements >= 10) {
        score += 7;
        details.logements = { nombre: nombreLogements, points: 7, niveau: 'collectif' };
        raisons.push(`${nombreLogements} logements - Collectif moyen`);
      } else {
        score += 5;
        details.logements = { nombre: nombreLogements, points: 5, niveau: 'petit_collectif' };
      }
    }

    // === CRITÈRE 5: TYPE ACTIVITÉ (10 pts max) ===
    const codeNAF = data.sirene?.codeNAF;
    if (codeNAF) {
      const pertinence = this.checkNafPertinence(codeNAF, 'pression');
      if (pertinence) {
        score += 10;
        details.activite = { codeNAF, pertinence, points: 10 };
        raisons.push(`Activité pertinente pour solution pression (NAF ${codeNAF})`);
      }
    }

    // === CRITÈRE 6: CONSOMMATION ÉLEVÉE (5 pts bonus) ===
    const consommation =
      data.bdnb?.consommationEstimee ||
      data.dpe?.[0]?.consommation ||
      null;

    if (consommation && consommation > 200) {
      score += 5;
      details.consommation = { valeur: consommation, points: 5 };
      raisons.push(`Consommation élevée (${consommation} kWh/m²/an) - Économies potentielles`);
    }

    const eligible = score >= this.seuilsMinimaux.pression;

    return {
      score: Math.min(score, 100),
      eligible,
      seuilMinimum: this.seuilsMinimaux.pression,
      details,
      raisons,
      criteresCles: {
        chauffageCollectifOk: installationStr.includes('collectif') || installationStr.includes('chaufferie'),
        surfaceOk: (surface && surface >= 500) || false
      }
    };
  }

  /**
   * Score global pour MATELAS ISOLANTS (0-100)
   * Critères: Site industriel ICPE, Mauvaise isolation, Surface, Type industrie
   * @param {Object} data - Données enrichies multi-sources
   * @returns {Object} { score, details, eligible, raisons }
   */
  scoreMatelasIsolants(data) {
    let score = 0;
    const details = {};
    const raisons = [];

    // === CRITÈRE 1: SITE INDUSTRIEL ICPE (40 pts max) ===
    if (data.georisques && data.georisques.length > 0) {
      const icpe = data.georisques[0];

      // Utiliser le score Géorisques déjà calculé
      const scoreGeorisques = icpe.pertinenceMatelasIsolants || 0;

      if (scoreGeorisques >= 80) {
        score += 40;
        details.icpe = {
          present: true,
          type: icpe.typeIndustrie,
          regime: icpe.regime,
          points: 40,
          niveau: 'tres_pertinent'
        };
        raisons.push(`Site ICPE ${icpe.typeIndustrie} très pertinent (score ${scoreGeorisques}/100)`);
      } else if (scoreGeorisques >= 60) {
        score += 30;
        details.icpe = { present: true, type: icpe.typeIndustrie, points: 30, niveau: 'pertinent' };
        raisons.push(`Site ICPE ${icpe.typeIndustrie} pertinent`);
      } else {
        score += 20;
        details.icpe = { present: true, type: icpe.typeIndustrie, points: 20, niveau: 'moyen' };
        raisons.push(`Site industriel classé détecté`);
      }

      // Bonus si en activité
      if (icpe.enActivite) {
        score += 5;
        raisons.push(`Site en activité - Besoin immédiat potentiel`);
      }
    } else {
      // Fallback: détecter industrie par NAF
      const codeNAF = data.sirene?.codeNAF;
      if (codeNAF) {
        const pertinence = this.checkNafPertinence(codeNAF, 'matelas_isolants');
        if (pertinence) {
          score += 25;
          details.icpe = { present: false, nafIndustriel: true, codeNAF, points: 25 };
          raisons.push(`Activité industrielle détectée (NAF ${codeNAF})`);
        }
      }
    }

    // === CRITÈRE 2: ISOLATION DÉFAILLANTE (30 pts max) ===
    const classeDPE = data.bdnb?.classeDPE || data.dpe?.[0]?.etiquetteDPE;
    const isolationMurs = data.bdnb?.isolationMurs;
    const isolationToiture = data.bdnb?.isolationToiture;

    if (classeDPE && ['E', 'F', 'G'].includes(classeDPE)) {
      score += 30;
      details.isolation = { dpe: classeDPE, niveau: 'mauvais', points: 30 };
      raisons.push(`DPE ${classeDPE} - Isolation très insuffisante, fort potentiel amélioration`);
    } else if (classeDPE === 'D') {
      score += 20;
      details.isolation = { dpe: classeDPE, niveau: 'moyen', points: 20 };
      raisons.push(`DPE D - Isolation moyenne, potentiel amélioration`);
    } else if (!isolationMurs || isolationMurs < 5) {
      score += 15;
      details.isolation = { murs: isolationMurs || 0, niveau: 'faible', points: 15 };
      raisons.push(`Isolation murs faible ou absente`);
    }

    // Bonus si toiture aussi mal isolée
    if (!isolationToiture || isolationToiture < 10) {
      score += 5;
      details.isolation = {
        ...details.isolation,
        toiture: isolationToiture || 0,
        bonus: 5
      };
      raisons.push(`Isolation toiture également défaillante`);
    }

    // === CRITÈRE 3: SURFACE (15 pts max) ===
    const surface =
      data.bdnb?.surfacePlancher ||
      data.bdtopo?.surfaceEmpriseAuSol ||
      null;

    if (surface) {
      if (surface >= 2000) {
        score += 15;
        details.surface = { valeur: surface, points: 15, niveau: 'tres_grande' };
        raisons.push(`Surface très importante (${surface}m²) - Volume matelas important`);
      } else if (surface >= 1000) {
        score += 10;
        details.surface = { valeur: surface, points: 10, niveau: 'grande' };
        raisons.push(`Grande surface (${surface}m²)`);
      } else if (surface >= 500) {
        score += 5;
        details.surface = { valeur: surface, points: 5, niveau: 'moyenne' };
      }
    }

    // === CRITÈRE 4: TYPE INDUSTRIE (10 pts max) ===
    if (data.georisques && data.georisques[0]) {
      const type = data.georisques[0].typeIndustrie;

      if (type.includes('Chaufferie') || type.includes('Combustion')) {
        score += 10;
        details.typeIndustrie = { type, pertinence: 'haute', points: 10 };
        raisons.push(`Type industrie très pertinent: ${type}`);
      } else if (type.includes('Métallurgie') || type.includes('Chimie') || type.includes('Production')) {
        score += 7;
        details.typeIndustrie = { type, pertinence: 'moyenne', points: 7 };
        raisons.push(`Type industrie pertinent: ${type}`);
      }
    }

    // === CRITÈRE 5: CONSOMMATION / POTENTIEL ÉCONOMIES (5 pts bonus) ===
    const consommation = data.bdnb?.consommationEstimee || data.dpe?.[0]?.consommation;
    const potentielReno = data.bdnb?.potentielRenovation;

    if ((consommation && consommation > 250) || potentielReno === 'élevé') {
      score += 5;
      details.economiesPotentielles = {
        consommation,
        potentiel: potentielReno,
        points: 5
      };
      raisons.push(`Fort potentiel d'économies d'énergie`);
    }

    const eligible = score >= this.seuilsMinimaux.matelas_isolants;

    return {
      score: Math.min(score, 100),
      eligible,
      seuilMinimum: this.seuilsMinimaux.matelas_isolants,
      details,
      raisons,
      criteresCles: {
        siteIndustrielOk: (data.georisques && data.georisques.length > 0) || false,
        isolationDefaillante: (classeDPE && ['D', 'E', 'F', 'G'].includes(classeDPE)) || false
      }
    };
  }

  /**
   * Calcule tous les scores pour tous les produits
   * @param {Object} data - Données enrichies multi-sources
   * @returns {Object} { destratification, pression, matelas_isolants, meilleurProduit }
   */
  scoreAll(data) {
    const scores = {
      destratification: this.scoreDestratification(data),
      pression: this.scorePression(data),
      matelas_isolants: this.scoreMatelasIsolants(data)
    };

    // Déterminer le meilleur produit
    let meilleurProduit = null;
    let meilleurScore = 0;

    Object.entries(scores).forEach(([produit, result]) => {
      if (result.eligible && result.score > meilleurScore) {
        meilleurScore = result.score;
        meilleurProduit = produit;
      }
    });

    return {
      ...scores,
      meilleurProduit,
      meilleurScore,
      nombreProduitsEligibles: Object.values(scores).filter(s => s.eligible).length
    };
  }

  /**
   * Score pour un produit spécifique (méthode wrapper)
   * @param {Object} data - Données enrichies multi-sources
   * @param {string} produit - destratification, pression, matelas_isolants
   * @returns {number} Score 0-100
   */
  scoreForProduct(data, produit) {
    let result;

    switch(produit) {
      case 'destratification':
        result = this.scoreDestratification(data);
        break;
      case 'pression':
        result = this.scorePression(data);
        break;
      case 'matelas_isolants':
        result = this.scoreMatelasIsolants(data);
        break;
      default:
        // Par défaut: destratification
        result = this.scoreDestratification(data);
    }

    return result.score || 0;
  }

  /**
   * Vérifie si un code NAF est pertinent pour un produit
   * @param {string} codeNAF - Code NAF complet (ex: "47.11Z")
   * @param {string} produit - destratification, pression, matelas_isolants
   * @returns {boolean}
   */
  checkNafPertinence(codeNAF, produit) {
    if (!codeNAF || !this.nafPertinents[produit]) return false;

    const nafList = this.nafPertinents[produit];

    // Vérifier si le NAF commence par un des codes pertinents
    return nafList.some(nafPertinent => codeNAF.startsWith(nafPertinent));
  }

  /**
   * Estime le potentiel CUMAC (Certificats d'Économies d'Énergie)
   * @param {Object} data - Données enrichies
   * @param {string} produit - Type de produit
   * @returns {Object|null} { estimationBasse, estimationHaute, unite }
   */
  estimateCUMAC(data, produit) {
    const surface = data.bdnb?.surfacePlancher || data.bdtopo?.surfaceEmpriseAuSol;
    const classeDPE = data.bdnb?.classeDPE || data.dpe?.[0]?.etiquetteDPE;

    if (!surface) return null;

    let cumacParM2Min = 0;
    let cumacParM2Max = 0;

    switch (produit) {
      case 'destratification':
        // Destratification: 50-150 kWh cumac/m²
        cumacParM2Min = 50;
        cumacParM2Max = 150;
        if (classeDPE && ['E', 'F', 'G'].includes(classeDPE)) {
          cumacParM2Max = 200; // Bonus passoire énergétique
        }
        break;

      case 'pression':
        // Optimisation pression: 30-80 kWh cumac/m²
        cumacParM2Min = 30;
        cumacParM2Max = 80;
        break;

      case 'matelas_isolants':
        // Isolation industrielle: 100-300 kWh cumac/m²
        cumacParM2Min = 100;
        cumacParM2Max = 300;
        if (classeDPE && ['E', 'F', 'G'].includes(classeDPE)) {
          cumacParM2Max = 400;
        }
        break;
    }

    return {
      estimationBasse: Math.round(surface * cumacParM2Min),
      estimationHaute: Math.round(surface * cumacParM2Max),
      unite: 'kWh cumac',
      surface: surface,
      cumacParM2: `${cumacParM2Min}-${cumacParM2Max}`
    };
  }
}

module.exports = new ScoringService();
