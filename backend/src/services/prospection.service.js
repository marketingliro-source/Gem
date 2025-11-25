const rechercheService = require('./external-api/recherche.service');
const sireneService = require('./external-api/sirene.service');
const banService = require('./external-api/ban.service');
const rnbService = require('./external-api/rnb.service');
const bdnbService = require('./external-api/bdnb.service');
const bdtopoService = require('./external-api/bdtopo.service');
const georisquesService = require('./external-api/georisques.service');
const dpeService = require('./external-api/dpe.service');
const scoringService = require('./scoring.service');

/**
 * Service de prospection enrichie multi-sources
 * Recherche et qualifie automatiquement les prospects par produit
 * Croise 8 sources de données publiques gratuites
 */
class ProspectionService {
  constructor() {
    // Limite par défaut de résultats enrichis (coûteux en API calls)
    this.defaultLimit = 20;
    this.defaultEnrichLimit = 10; // Enrichir seulement top 10 par défaut
  }

  /**
   * Recherche enrichie multi-sources avec scoring
   * @param {Object} criteria - Critères de recherche
   * @param {string} criteria.codeNAF - Code NAF (ex: "47.11")
   * @param {Array} criteria.codesNAF - Codes NAF multiples (ex: ["47.11", "52.10A"])
   * @param {string} criteria.departement - Code département (ex: "75")
   * @param {string} criteria.region - Nom région (ex: "Île-de-France")
   * @param {string} criteria.codePostal - Code postal (ex: "75001")
   * @param {string} criteria.commune - Nom commune
   * @param {string} criteria.produit - destratification | pression | matelas_isolants
   * @param {number} criteria.scoreMinimum - Score minimum (0-100, défaut: seuil produit)
   * @param {number} criteria.limit - Nombre max résultats (défaut: 20)
   * @param {boolean} criteria.enrichAll - Enrichir tous les résultats (défaut: false)
   * @param {number} criteria.hauteurMin - Hauteur minimale du bâtiment (m)
   * @param {number} criteria.surfaceMin - Surface minimale (m²)
   * @param {Array} criteria.typesChauffage - Types de chauffage (ex: ["collectif", "air"])
   * @param {Array} criteria.classesDPE - Classes DPE (ex: ["E", "F", "G"])
   * @returns {Promise<Array>}
   */
  async searchEnriched(criteria) {
    console.log('🔍 Prospection enrichie multi-sources:', criteria);

    const {
      codeNAF,
      codesNAF,
      departement,
      region,
      codePostal,
      commune,
      produit,
      scoreMinimum = null,
      limit = this.defaultLimit,
      enrichAll = false,
      // Critères techniques
      hauteurMin,
      surfaceMin,
      typesChauffage,
      classesDPE
    } = criteria;

    if (!produit) {
      throw new Error('Produit requis (destratification, pression, matelas_isolants)');
    }

    // === ÉTAPE 1: RECHERCHE ENTREPRISES (API Recherche Entreprises) ===
    console.log('📊📊📊 Étape 1/5: Recherche entreprises...');
    console.log('📋 [PROSPECTION] Critères reçus:', { codeNAF, codesNAF, departement, region, codePostal, commune, produit, limit });

    const searchParams = {};

    // Gérer multi-NAF : utiliser le premier code pour la recherche (l'API n'accepte qu'un seul NAF)
    const nafToUse = codesNAF && codesNAF.length > 0 ? codesNAF[0] : codeNAF;
    if (nafToUse) {
      // L'API attend le format AVEC le point : 47.11F (pas 4711F)
      // Normaliser : s'assurer qu'il y a un point si le code fait 5+ caractères
      let normalizedNAF = nafToUse;
      if (nafToUse.length >= 5 && !nafToUse.includes('.')) {
        // Format sans point (4711F) → avec point (47.11F)
        normalizedNAF = nafToUse.substring(0, 2) + '.' + nafToUse.substring(2);
      }
      searchParams.codeNAF = normalizedNAF;
      console.log(`🔧 Code NAF utilisé: ${nafToUse} → ${searchParams.codeNAF}`);
    }

    if (departement) searchParams.departement = departement;

    // L'API attend les CODES région (11, 84, etc.), pas les noms
    if (region) {
      searchParams.region = region;
      console.log(`🔧 Région utilisée: ${region}`);
    }

    if (codePostal) searchParams.codePostal = codePostal;
    if (commune) searchParams.commune = commune;

    if (codesNAF && codesNAF.length > 1) {
      console.log(`⚠️  Multi-NAF détecté: ${codesNAF.length} codes. Recherche avec le premier (${nafToUse}), filtrage post-enrichissement pour les autres.`);
    }

    console.log('🔧 [PROSPECTION] Paramètres construits pour rechercheService.search():', searchParams);

    let entreprises = [];

    try {
      // L'API Recherche Entreprises ne supporte PAS le wildcard "*"
      // On doit utiliser une query textuelle réelle (min 3 caractères)
      // Stratégie : utiliser un terme générique basé sur le contexte
      let queryText = 'entreprise'; // Fallback par défaut

      // Si on a un code NAF, utiliser le premier mot du libellé comme query
      const NAF_TO_KEYWORD = {
        '47.11F': 'hypermarche',
        '47.11D': 'supermarche',
        '52.10A': 'entrepot',
        '52.10B': 'entrepot',
        '56.10A': 'restaurant',
        '56.10C': 'restaurant',
        '56.29A': 'restauration',
        '93.11Z': 'sport',
        '10.11Z': 'viande',
        '10.71A': 'boulangerie',
        '86.10Z': 'hopital',
        '87.10A': 'ehpad',
        '55.10Z': 'hotel',
        '85.31Z': 'college',
        '85.32Z': 'lycee',
        '24.10Z': 'acier',
        '24.51Z': 'fonderie',
        '20.11Z': 'chimie',
        '10.51A': 'laiterie'
      };

      if (searchParams.codeNAF && NAF_TO_KEYWORD[searchParams.codeNAF]) {
        queryText = NAF_TO_KEYWORD[searchParams.codeNAF];
        console.log(`🔍 Utilisation query basée sur NAF: "${queryText}"`);
      }

      // Rechercher avec l'API Recherche Entreprises
      console.log('🚀 [PROSPECTION] Appel rechercheService.search() avec query:', {
        query: queryText,
        ...searchParams,
        limit: limit
      });

      const results = await rechercheService.search(queryText, {
        ...searchParams,
        limit: limit
      });

      console.log(`📦 [PROSPECTION] Résultats reçus de rechercheService.search(): ${results ? results.length : 'null'} entreprises`);

      if (results && results.length > 0) {
        console.log('👉 [PROSPECTION] Premier résultat:', JSON.stringify(results[0], null, 2));
      }

      entreprises = results.slice(0, limit);
      console.log(`✅✅✅ ${entreprises.length} entreprises trouvées APRÈS slice`);

    } catch (error) {
      console.error('❌❌❌ Erreur recherche entreprises:', error.message);
      console.error('❌ Stack:', error.stack);
      return [];
    }

    if (entreprises.length === 0) {
      console.warn('⚠️  Aucune entreprise trouvée pour ces critères');
      return [];
    }

    // === ÉTAPE 2: ENRICHISSEMENT MULTI-SOURCES ===
    console.log('🔄 Étape 2/5: Enrichissement multi-sources...');

    const enrichLimit = enrichAll ? limit : Math.min(this.defaultEnrichLimit, limit);
    const entreprisesAEnrichir = entreprises.slice(0, enrichLimit);

    const enrichedProspects = [];

    for (const [index, entreprise] of entreprisesAEnrichir.entries()) {
      console.log(`\n📍 Enrichissement ${index + 1}/${enrichLimit}: ${entreprise.nom_complet || entreprise.denomination} (${entreprise.siret})`);

      try {
        const enrichedData = await this.enrichSingleProspect(entreprise, produit);

        if (enrichedData) {
          enrichedProspects.push(enrichedData);
        }

      } catch (error) {
        console.warn(`⚠️  Erreur enrichissement ${entreprise.siret}:`, error.message);
        // Continuer avec les autres
      }

      // Petite pause pour éviter rate limiting
      if (index < enrichLimit - 1) {
        await this.sleep(100);
      }
    }

    console.log(`\n✅ ${enrichedProspects.length} prospects enrichis`);

    // === ÉTAPE 3: SCORING PAR PRODUIT ===
    console.log('🎯 Étape 3/5: Scoring par produit...');

    const scoredProspects = enrichedProspects.map(prospect => {
      const scores = scoringService.scoreAll(prospect);

      return {
        ...prospect,
        scoring: scores,
        scoreProduiCible: scores[produit]?.score || 0,
        eligibleProduitCible: scores[produit]?.eligible || false,
        raisonsProduitCible: scores[produit]?.raisons || [],
        detailsProduitCible: scores[produit]?.details || {},
        estimationCUMAC: scoringService.estimateCUMAC(prospect, produit)
      };
    });

    console.log(`✅ ${scoredProspects.length} prospects scorés`);

    // === ÉTAPE 4: FILTRAGE PAR SCORE MINIMUM ===
    console.log('⚡ Étape 4/5: Filtrage par score...');

    const seuilMinimum = scoreMinimum !== null
      ? scoreMinimum
      : scoringService.seuilsMinimaux[produit];

    const prospectsQualifies = scoredProspects.filter(p =>
      p.scoreProduiCible >= seuilMinimum
    );

    console.log(`✅ ${prospectsQualifies.length} prospects qualifiés (score >= ${seuilMinimum})`);

    // === ÉTAPE 4.5: FILTRAGE PAR CRITÈRES TECHNIQUES ===
    let prospectsFiltres = prospectsQualifies;

    if (hauteurMin || surfaceMin || (typesChauffage && typesChauffage.length > 0) || (classesDPE && classesDPE.length > 0) || (codesNAF && codesNAF.length > 1)) {
      console.log('🔧 Étape 4.5/5: Filtrage par critères techniques...');

      prospectsFiltres = prospectsQualifies.filter(p => {
        let match = true;

        // Filtrage multi-NAF (si plus d'un code NAF spécifié)
        if (codesNAF && codesNAF.length > 1) {
          const prospectNAF = p.sirene?.codeNAF;
          if (prospectNAF) {
            // Vérifier si le code NAF du prospect commence par l'un des codes NAF recherchés
            const nafMatch = codesNAF.some(code => prospectNAF.startsWith(code.replace('.', '')));
            if (!nafMatch) match = false;
          }
        }

        // Filtrage par hauteur minimale
        if (match && hauteurMin) {
          const hauteur = p.bdtopo?.hauteur || p.bdnb?.hauteur || p.rnb?.hauteur;
          if (!hauteur || parseFloat(hauteur) < parseFloat(hauteurMin)) {
            match = false;
          }
        }

        // Filtrage par surface minimale
        if (match && surfaceMin) {
          const surface = p.bdnb?.surfacePlancher || p.rnb?.surface;
          if (!surface || parseFloat(surface) < parseFloat(surfaceMin)) {
            match = false;
          }
        }

        // Filtrage par type de chauffage
        if (match && typesChauffage && typesChauffage.length > 0) {
          const typeChauffage = p.bdnb?.typeChauffage?.toLowerCase() || '';
          const energieChauffage = p.bdnb?.energieChauffage?.toLowerCase() || '';

          const chauffageMatch = typesChauffage.some(type => {
            type = type.toLowerCase();
            return typeChauffage.includes(type) || energieChauffage.includes(type);
          });

          if (!chauffageMatch) {
            match = false;
          }
        }

        // Filtrage par classe DPE
        if (match && classesDPE && classesDPE.length > 0) {
          const classeDPE = p.bdnb?.classeDPE || p.dpe?.[0]?.etiquetteDPE;
          if (!classeDPE || !classesDPE.includes(classeDPE.toUpperCase())) {
            match = false;
          }
        }

        return match;
      });

      console.log(`✅ ${prospectsFiltres.length} prospects après filtrage technique`);
      if (hauteurMin) console.log(`   - Hauteur >= ${hauteurMin}m`);
      if (surfaceMin) console.log(`   - Surface >= ${surfaceMin}m²`);
      if (typesChauffage && typesChauffage.length > 0) console.log(`   - Types chauffage: ${typesChauffage.join(', ')}`);
      if (classesDPE && classesDPE.length > 0) console.log(`   - Classes DPE: ${classesDPE.join(', ')}`);
      if (codesNAF && codesNAF.length > 1) console.log(`   - Codes NAF: ${codesNAF.join(', ')}`);
    }

    // === ÉTAPE 5: TRI PAR SCORE DÉCROISSANT ===
    console.log('📈 Étape 5/5: Tri par pertinence...');

    prospectsFiltres.sort((a, b) => b.scoreProduiCible - a.scoreProduiCible);

    console.log('\n🎉 Prospection terminée!');
    console.log(`📊 Résultats: ${prospectsFiltres.length} prospects qualifiés sur ${entreprises.length} recherchés`);

    if (prospectsFiltres.length > 0) {
      console.log(`🏆 Top prospect: ${prospectsFiltres[0].sirene?.denomination} (score ${prospectsFiltres[0].scoreProduiCible}/100)`);
    }

    return prospectsFiltres;
  }

  /**
   * Enrichit un prospect avec toutes les sources de données
   * @param {Object} entreprise - Données entreprise de base
   * @param {string} produit - Type produit (pour optimiser les appels)
   * @returns {Promise<Object>}
   */
  async enrichSingleProspect(entreprise, produit) {
    const siret = entreprise.siret || entreprise.siege?.siret;

    if (!siret) {
      console.warn('⚠️  SIRET manquant');
      return null;
    }

    const enrichedData = {
      siret,
      siren: siret.substring(0, 9),
      dateEnrichissement: new Date().toISOString(),
      produitCible: produit,
      sources: [],
      sirene: null,
      ban: null,
      rnb: null,
      bdnb: null,
      bdtopo: null,
      georisques: null,
      dpe: null
    };

    try {
      // 1. SIRENE (données entreprise de base)
      console.log('  📊 SIRENE...');
      try {
        const sireneData = await sireneService.getSiretInfo(siret);
        enrichedData.sirene = sireneData;
        enrichedData.sources.push('sirene');
      } catch (error) {
        // Utiliser données recherche si SIRENE échoue
        enrichedData.sirene = {
          denomination: entreprise.nom_complet || entreprise.denomination,
          adresse: entreprise.siege || {},
          codeNAF: entreprise.activite_principale,
          actif: entreprise.etat_administratif === 'A'
        };
        enrichedData.sources.push('recherche-fallback');
      }

      const adresse = enrichedData.sirene.adresse;

      if (!adresse) {
        console.warn('  ⚠️  Adresse manquante - enrichissement limité');
        return enrichedData;
      }

      // 2. BAN (géocodage + normalisation adresse)
      console.log('  📍 BAN (géocodage)...');
      try {
        const banData = await banService.normalizeAddress(adresse);

        if (banData && banData.coordinates) {
          enrichedData.ban = banData;
          enrichedData.coordinates = banData.coordinates;
          enrichedData.sources.push('ban');
          console.log(`    ✓ GPS: ${banData.coordinates.latitude}, ${banData.coordinates.longitude}`);
        }
      } catch (error) {
        console.warn('  ⚠️  BAN échoué:', error.message);
      }

      // Si pas de coordonnées, impossible de continuer l'enrichissement géographique
      if (!enrichedData.coordinates) {
        console.warn('  ⚠️  Pas de coordonnées GPS - enrichissement géographique impossible');
        return enrichedData;
      }

      const { latitude, longitude } = enrichedData.coordinates;

      // 3. RNB (identifiant bâtiment national - PIVOT)
      console.log('  🏢 RNB (bâtiment)...');
      try {
        const rnbData = await rnbService.getNearestBuildingWithHeight(latitude, longitude, 100);

        if (rnbData) {
          enrichedData.rnb = rnbData;
          enrichedData.idRNB = rnbData.idRNB;
          enrichedData.sources.push('rnb');
          console.log(`    ✓ ID-RNB: ${rnbData.idRNB}`);
        }
      } catch (error) {
        console.warn('  ⚠️  RNB échoué:', error.message);
      }

      // 4. BDNB (données techniques bâtiment) - via ID-RNB ou coordonnées
      console.log('  🏗️  BDNB (données techniques)...');
      try {
        const bdnbCriteria = {
          idRNB: enrichedData.idRNB,
          coordinates: enrichedData.coordinates,
          adresse: adresse
        };

        const bdnbData = await bdnbService.searchSmart(bdnbCriteria);

        if (bdnbData) {
          enrichedData.bdnb = bdnbData;
          enrichedData.sources.push('bdnb');
          console.log(`    ✓ BDNB trouvé - DPE: ${bdnbData.classeDPE || 'N/A'}, Surface: ${bdnbData.surfacePlancher || 'N/A'}m²`);
        }
      } catch (error) {
        console.warn('  ⚠️  BDNB échoué:', error.message);
      }

      // 5. BD TOPO (hauteur bâtiment précise) - CRITIQUE pour destratification
      if (produit === 'destratification') {
        console.log('  📏 BD TOPO (hauteur)...');
        try {
          const bdtopoData = await bdtopoService.getNearestBuildingWithHeight(latitude, longitude, 100);

          if (bdtopoData) {
            enrichedData.bdtopo = bdtopoData;
            enrichedData.sources.push('bdtopo');
            console.log(`    ✓ Hauteur: ${bdtopoData.hauteur || bdtopoData.hauteurEstimee}m`);
          }
        } catch (error) {
          console.warn('  ⚠️  BD TOPO échoué:', error.message);
        }
      }

      // 6. Géorisques ICPE (sites industriels) - CRITIQUE pour matelas isolants
      if (produit === 'matelas_isolants') {
        console.log('  🏭 Géorisques (ICPE)...');
        try {
          const georisquesData = await georisquesService.searchByCoordinates(latitude, longitude, 500);

          if (georisquesData && georisquesData.length > 0) {
            enrichedData.georisques = georisquesData;
            enrichedData.sources.push('georisques');
            console.log(`    ✓ ${georisquesData.length} installation(s) ICPE trouvée(s)`);
          }
        } catch (error) {
          console.warn('  ⚠️  Géorisques échoué:', error.message);
        }
      }

      // 7. DPE (performance énergétique)
      console.log('  ⚡ DPE (performance)...');
      try {
        // Essayer par SIRET d'abord (tertiaire)
        let dpeData = await dpeService.searchBySiret(siret);

        // Fallback: par adresse
        if (!dpeData || dpeData.length === 0) {
          dpeData = await dpeService.searchByAddress(adresse, 'tertiaire');
        }

        if (dpeData && dpeData.length > 0) {
          enrichedData.dpe = dpeData;
          enrichedData.sources.push('dpe');
          console.log(`    ✓ ${dpeData.length} DPE trouvé(s) - Étiquette: ${dpeData[0].etiquetteDPE || 'N/A'}`);
        }
      } catch (error) {
        console.warn('  ⚠️  DPE échoué:', error.message);
      }

      console.log(`  ✅ Enrichissement terminé - ${enrichedData.sources.length} sources`);

      return enrichedData;

    } catch (error) {
      console.error('❌ Erreur enrichissement:', error.message);
      return enrichedData; // Retourner données partielles
    }
  }

  /**
   * Recherche prospects par code NAF uniquement (simplifié)
   * @param {string} codeNAF - Code NAF
   * @param {string} produit - Type produit
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<Array>}
   */
  async searchByNAF(codeNAF, produit, options = {}) {
    return await this.searchEnriched({
      codeNAF,
      produit,
      ...options
    });
  }

  /**
   * Recherche prospects par département
   * @param {string} departement - Code département
   * @param {string} produit - Type produit
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<Array>}
   */
  async searchByDepartement(departement, produit, options = {}) {
    return await this.searchEnriched({
      departement,
      produit,
      ...options
    });
  }

  /**
   * Recherche prospects par région
   * @param {string} region - Nom région
   * @param {string} produit - Type produit
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<Array>}
   */
  async searchByRegion(region, produit, options = {}) {
    return await this.searchEnriched({
      region,
      produit,
      ...options
    });
  }

  /**
   * Exporte les résultats au format CSV
   * @param {Array} prospects - Liste de prospects
   * @param {string} produit - Type produit
   * @returns {string} CSV
   */
  exportToCSV(prospects, produit) {
    const headers = [
      'SIRET',
      'Dénomination',
      'Adresse',
      'Code Postal',
      'Commune',
      'Code NAF',
      'Score',
      'Eligible',
      'Raisons',
      'Estimation CUMAC Min',
      'Estimation CUMAC Max',
      'Sources'
    ];

    const rows = prospects.map(p => [
      p.siret,
      p.sirene?.denomination || '',
      p.sirene?.adresse?.adresseComplete || '',
      p.sirene?.adresse?.codePostal || '',
      p.sirene?.adresse?.commune || '',
      p.sirene?.codeNAF || '',
      p.scoreProduiCible,
      p.eligibleProduitCible ? 'OUI' : 'NON',
      p.raisonsProduitCible.join(' | '),
      p.estimationCUMAC?.estimationBasse || '',
      p.estimationCUMAC?.estimationHaute || '',
      p.sources.join(', ')
    ]);

    const csvLines = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ];

    return csvLines.join('\n');
  }

  /**
   * Méthode de compatibilité avec l'ancien endpoint /search
   * Mappe l'ancien format vers searchEnriched()
   * @param {Object} criteria - Critères anciens format
   * @returns {Promise<Object>}
   */
  async search(criteria) {
    console.log('⚠️  Utilisation ancienne méthode search() - redirection vers searchEnriched()');

    const {
      codeNAF,
      codesNAF,
      departement,
      region,
      codePostal,
      typeProduit,
      limit
    } = criteria;

    // Si typeProduit non spécifié, utiliser "destratification" par défaut
    const produit = typeProduit || 'destratification';

    // Gérer codesNAF (ancien format multi-NAF)
    const nafToUse = codeNAF || (codesNAF && codesNAF[0]) || null;

    try {
      const results = await this.searchEnriched({
        codeNAF: nafToUse,
        departement,
        region,
        codePostal,
        produit,
        limit: limit || 100,
        enrichAll: false // Par défaut, enrichir seulement top 10
      });

      // Retourner dans l'ancien format attendu par le frontend
      return {
        total: results.length,
        criteria: criteria,
        results: results.map(r => ({
          ...r,
          scorePertinence: r.scoreProduiCible,
          bdnbData: r.bdnb,
          recommandations: r.raisonsProduitCible.map(raison => ({
            produit: produit,
            pertinence: r.eligibleProduitCible ? 'haute' : 'moyenne',
            raison
          }))
        })),
        metadata: {
          date: new Date().toISOString(),
          sources: ['recherche-entreprises', 'sirene', 'ban', 'rnb', 'bdnb', 'bdtopo', 'georisques', 'dpe']
        }
      };

    } catch (error) {
      console.error('❌ Erreur dans search() de compatibilité:', error.message);
      throw error;
    }
  }

  /**
   * Formate les prospects pour l'export Excel/CSV
   * @param {Array} prospects - Liste de prospects enrichis
   * @returns {Array} Prospects formatés pour export
   */
  formatForExport(prospects) {
    return prospects.map(p => ({
      siret: p.siret || '',
      siren: p.siren || '',
      denomination: p.sirene?.denomination || '',
      adresse: p.sirene?.adresse?.adresseComplete || '',
      codePostal: p.sirene?.adresse?.codePostal || '',
      commune: p.sirene?.adresse?.commune || '',
      departement: p.sirene?.adresse?.departement || '',
      region: p.ban?.region || '',
      codeNAF: p.sirene?.codeNAF || '',
      libelleNAF: p.sirene?.libelleNAF || '',
      telephone: p.sirene?.telephone || '',
      email: p.sirene?.email || '',
      actif: p.sirene?.actif ? 'OUI' : 'NON',
      scorePertinence: Math.round(p.scoreProduiCible || 0),
      eligible: p.eligibleProduitCible ? 'OUI' : 'NON',
      // Données techniques
      hauteur: p.bdtopo?.hauteur || p.bdnb?.hauteur || p.rnb?.hauteur || '',
      surface: p.bdnb?.surfacePlancher || p.rnb?.surface || '',
      nbEtages: p.bdtopo?.etages || p.rnb?.nbEtages || '',
      classeDPE: p.bdnb?.classeDPE || (p.dpe?.[0]?.etiquetteDPE) || '',
      typeChauffage: p.bdnb?.typeChauffage || '',
      energieChauffage: p.bdnb?.energieChauffage || '',
      // Isolation
      isolationToiture: p.bdnb?.isolationToiture || '',
      isolationMurs: p.bdnb?.isolationMurs || '',
      isolationFenetres: p.bdnb?.isolationFenetres || '',
      // ICPE (pour matelas isolants)
      siteICPE: p.georisques?.length > 0 ? 'OUI' : 'NON',
      typeICPE: p.georisques?.[0]?.typeIndustrie || '',
      // Recommandations
      produitsRecommandes: p.raisonsProduitCible?.join(' | ') || '',
      // Estimation CUMAC
      cumacMin: p.estimationCUMAC?.estimationBasse || '',
      cumacMax: p.estimationCUMAC?.estimationHaute || '',
      // Métadonnées
      nbSourcesEnrichies: p.sources?.length || 0,
      sourcesUtilisees: p.sources?.join(', ') || '',
      dateEnrichissement: p.dateEnrichissement || ''
    }));
  }

  /**
   * Retourne les codes NAF pertinents pour un type de produit
   * @param {string} typeProduit - destratification | pression | matelas_isolants
   * @returns {Array} Liste de codes NAF avec pertinence
   */
  getRelevantNAFForProduct(typeProduit) {
    const NAF_BY_PRODUCT = {
      destratification: [
        { code: '47.11F', label: 'Hypermarchés', pertinence: 'très haute', raison: 'Grands volumes avec hauteur >8m' },
        { code: '47.11D', label: 'Supermarchés', pertinence: 'très haute', raison: 'Surfaces importantes avec hauteur' },
        { code: '52.10A', label: 'Entreposage et stockage frigorifique', pertinence: 'très haute', raison: 'Entrepôts >10m de hauteur' },
        { code: '52.10B', label: 'Entreposage et stockage non frigorifique', pertinence: 'très haute', raison: 'Entrepôts >10m de hauteur' },
        { code: '56.10A', label: 'Restauration traditionnelle', pertinence: 'haute', raison: 'Cuisines avec hauteur et zones chaudes' },
        { code: '56.10C', label: 'Restauration de type rapide', pertinence: 'haute', raison: 'Cuisines avec zones chaudes' },
        { code: '56.29A', label: 'Restauration collective sous contrat', pertinence: 'haute', raison: 'Cuisines collectives' },
        { code: '93.11Z', label: 'Gestion d\'installations sportives', pertinence: 'très haute', raison: 'Salles de sport >8m' },
        { code: '10.11Z', label: 'Transformation et conservation de la viande de boucherie', pertinence: 'haute', raison: 'Usines agroalimentaires' },
        { code: '10.13A', label: 'Préparation industrielle de produits à base de viande', pertinence: 'haute', raison: 'Usines agroalimentaires' },
        { code: '10.71A', label: 'Fabrication industrielle de pain et de pâtisserie fraîche', pertinence: 'haute', raison: 'Fours industriels avec hauteur' },
        { code: '41.20A', label: 'Construction de maisons individuelles', pertinence: 'moyenne', raison: 'Hangars de chantier' },
        { code: '41.20B', label: 'Construction d\'autres bâtiments', pertinence: 'moyenne', raison: 'Hangars de chantier' }
      ],
      pression: [
        { code: '86.10Z', label: 'Activités hospitalières', pertinence: 'très haute', raison: 'Hôpitaux avec chauffage collectif' },
        { code: '87.10A', label: 'Hébergement médicalisé pour personnes âgées', pertinence: 'très haute', raison: 'EHPAD avec chauffage central' },
        { code: '87.20A', label: 'Hébergement social pour handicapés mentaux', pertinence: 'haute', raison: 'Établissements avec chauffage collectif' },
        { code: '87.30A', label: 'Hébergement social pour personnes âgées', pertinence: 'haute', raison: 'Résidences avec chauffage collectif' },
        { code: '55.10Z', label: 'Hôtels et hébergement similaire', pertinence: 'très haute', raison: 'Hôtels avec chauffage central' },
        { code: '55.20Z', label: 'Hébergement touristique et autre hébergement de courte durée', pertinence: 'haute', raison: 'Résidences avec chauffage' },
        { code: '85.31Z', label: 'Enseignement secondaire général', pertinence: 'haute', raison: 'Collèges/Lycées avec chauffage collectif' },
        { code: '85.32Z', label: 'Enseignement secondaire technique ou professionnel', pertinence: 'haute', raison: 'Établissements avec chauffage collectif' },
        { code: '85.42Z', label: 'Enseignement supérieur', pertinence: 'haute', raison: 'Universités avec chauffage collectif' },
        { code: '93.13Z', label: 'Activités de centres de culture physique', pertinence: 'moyenne', raison: 'Centres sportifs avec chauffage' },
        { code: '68.20A', label: 'Location de logements', pertinence: 'haute', raison: 'Bailleurs sociaux avec chauffage collectif' },
        { code: '68.20B', label: 'Location de terrains et d\'autres biens immobiliers', pertinence: 'moyenne', raison: 'Gestionnaires immobiliers' }
      ],
      matelas_isolants: [
        { code: '24.10Z', label: 'Sidérurgie', pertinence: 'très haute', raison: 'Sites ICPE avec fours industriels' },
        { code: '24.51Z', label: 'Fonderie de métaux ferreux', pertinence: 'très haute', raison: 'Sites ICPE avec fours >1000°C' },
        { code: '24.52Z', label: 'Fonderie de métaux légers', pertinence: 'très haute', raison: 'Sites ICPE avec fours industriels' },
        { code: '24.53Z', label: 'Fonderie d\'autres métaux non ferreux', pertinence: 'très haute', raison: 'Sites ICPE avec fours' },
        { code: '25.11Z', label: 'Fabrication de structures métalliques', pertinence: 'haute', raison: 'Ateliers ICPE avec soudage' },
        { code: '20.11Z', label: 'Fabrication de gaz industriels', pertinence: 'très haute', raison: 'Sites ICPE avec installations cryogéniques' },
        { code: '20.13A', label: 'Enrichissement et retraitement de matières nucléaires', pertinence: 'très haute', raison: 'Sites ICPE sensibles' },
        { code: '20.14Z', label: 'Fabrication d\'autres produits chimiques organiques de base', pertinence: 'très haute', raison: 'Sites ICPE chimie' },
        { code: '20.15Z', label: 'Fabrication de produits azotés et d\'engrais', pertinence: 'haute', raison: 'Sites ICPE avec process thermiques' },
        { code: '10.11Z', label: 'Transformation et conservation de la viande de boucherie', pertinence: 'haute', raison: 'Chambres froides industrielles' },
        { code: '10.13A', label: 'Préparation industrielle de produits à base de viande', pertinence: 'haute', raison: 'Installations frigorifiques' },
        { code: '10.20Z', label: 'Transformation et conservation de poisson', pertinence: 'haute', raison: 'Chambres froides' },
        { code: '10.51A', label: 'Exploitation de laiteries et fabrication de fromage', pertinence: 'haute', raison: 'Process thermiques et froids' },
        { code: '23.51Z', label: 'Fabrication de ciment', pertinence: 'très haute', raison: 'Sites ICPE avec fours rotatifs' },
        { code: '23.52Z', label: 'Fabrication de chaux et plâtre', pertinence: 'haute', raison: 'Sites ICPE avec fours' },
        { code: '29.10Z', label: 'Construction de véhicules automobiles', pertinence: 'haute', raison: 'Usines avec cabines de peinture' }
      ]
    };

    const result = NAF_BY_PRODUCT[typeProduit] || [];

    // Trier par pertinence (très haute > haute > moyenne)
    const pertinenceOrder = { 'très haute': 3, 'haute': 2, 'moyenne': 1 };
    result.sort((a, b) => pertinenceOrder[b.pertinence] - pertinenceOrder[a.pertinence]);

    return result;
  }

  /**
   * Pause async
   * @param {number} ms - Millisecondes
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new ProspectionService();
