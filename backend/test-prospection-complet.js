/**
 * Script de test complet pour la prospection enrichie
 * Teste les 3 produits avec enrichissement multi-sources
 */

const prospectionService = require('./src/services/prospection.service');

// Configuration des tests par produit
const TEST_SCENARIOS = [
  // DESTRATIFICATION - Hypermarchés et entrepôts
  {
    produit: 'destratification',
    description: 'Hypermarchés en Île-de-France',
    criteria: {
      produit: 'destratification',
      codesNAF: ['47.11F'],
      region: '11',
      limit: 5,
      enrichAll: true
    },
    expected: 'Grandes surfaces avec hauteur >8m'
  },
  {
    produit: 'destratification',
    description: 'Entrepôts frigorifiques en Auvergne-Rhône-Alpes',
    criteria: {
      produit: 'destratification',
      codesNAF: ['52.10A'],
      region: '84',
      limit: 5,
      enrichAll: true,
      hauteurMin: 10
    },
    expected: 'Entrepôts >10m avec données bâtiment'
  },
  {
    produit: 'destratification',
    description: 'Salles de sport à Paris',
    criteria: {
      produit: 'destratification',
      codesNAF: ['93.11Z'],
      departement: '75',
      limit: 5,
      enrichAll: true,
      hauteurMin: 8
    },
    expected: 'Salles de sport >8m'
  },

  // PRESSION - Hôpitaux et hôtels
  {
    produit: 'pression',
    description: 'Hôpitaux en Île-de-France',
    criteria: {
      produit: 'pression',
      codesNAF: ['86.10Z'],
      region: '11',
      limit: 5,
      enrichAll: true
    },
    expected: 'Hôpitaux avec chauffage collectif'
  },
  {
    produit: 'pression',
    description: 'EHPAD en Provence-Alpes-Côte d\'Azur',
    criteria: {
      produit: 'pression',
      codesNAF: ['87.10A'],
      region: '93',
      limit: 5,
      enrichAll: true
    },
    expected: 'EHPAD avec chauffage central'
  },
  {
    produit: 'pression',
    description: 'Hôtels en Nouvelle-Aquitaine',
    criteria: {
      produit: 'pression',
      codesNAF: ['55.10Z'],
      region: '75',
      limit: 5,
      enrichAll: true,
      surfaceMin: 500
    },
    expected: 'Hôtels >500m² avec chauffage'
  },

  // MATELAS ISOLANTS - Sites industriels ICPE
  {
    produit: 'matelas_isolants',
    description: 'Sidérurgie en Grand Est',
    criteria: {
      produit: 'matelas_isolants',
      codesNAF: ['24.10Z'],
      region: '44',
      limit: 5,
      enrichAll: true
    },
    expected: 'Sites ICPE avec fours industriels'
  },
  {
    produit: 'matelas_isolants',
    description: 'Fonderies en Auvergne-Rhône-Alpes',
    criteria: {
      produit: 'matelas_isolants',
      codesNAF: ['24.51Z'],
      region: '84',
      limit: 5,
      enrichAll: true
    },
    expected: 'Fonderies avec fours >1000°C'
  },
  {
    produit: 'matelas_isolants',
    description: 'Agroalimentaire (viande) en Bretagne',
    criteria: {
      produit: 'matelas_isolants',
      codesNAF: ['10.11Z'],
      region: '53',
      limit: 5,
      enrichAll: true
    },
    expected: 'Usines agroalimentaires avec chambres froides'
  }
];

/**
 * Affiche un résultat de recherche enrichi
 */
function displayResult(result, index) {
  console.log(`\n   ┌─ Prospect #${index + 1}`);
  console.log(`   │ 🏢 ${result.sirene?.denomination || 'N/A'}`);
  console.log(`   │ 📍 ${result.sirene?.adresse?.codePostal || 'N/A'} ${result.sirene?.adresse?.commune || 'N/A'}`);
  console.log(`   │ 🏷️  NAF: ${result.sirene?.codeNAF || 'N/A'}`);
  console.log(`   │ 🎯 Score: ${result.scoreProduiCible || 0}/100 ${result.eligibleProduitCible ? '✅' : '❌'}`);

  // Données d'enrichissement
  const sources = result.sources || [];
  console.log(`   │ 📦 Sources enrichies: ${sources.length} (${sources.join(', ')})`);

  if (result.coordinates) {
    console.log(`   │ 🌍 GPS: ${result.coordinates.latitude.toFixed(4)}, ${result.coordinates.longitude.toFixed(4)}`);
  }

  if (result.bdtopo?.hauteur || result.bdnb?.hauteur || result.rnb?.hauteur) {
    const hauteur = result.bdtopo?.hauteur || result.bdnb?.hauteur || result.rnb?.hauteur;
    console.log(`   │ 📏 Hauteur: ${hauteur}m`);
  }

  if (result.bdnb?.surfacePlancher || result.rnb?.surface) {
    const surface = result.bdnb?.surfacePlancher || result.rnb?.surface;
    console.log(`   │ 📐 Surface: ${surface}m²`);
  }

  if (result.bdnb?.classeDPE || result.dpe?.[0]?.etiquetteDPE) {
    const dpe = result.bdnb?.classeDPE || result.dpe?.[0]?.etiquetteDPE;
    console.log(`   │ ⚡ DPE: ${dpe}`);
  }

  if (result.bdnb?.typeChauffage) {
    console.log(`   │ 🔥 Chauffage: ${result.bdnb.typeChauffage}`);
  }

  if (result.georisques && result.georisques.length > 0) {
    console.log(`   │ 🏭 ICPE: ${result.georisques.length} installation(s)`);
  }

  if (result.estimationCUMAC) {
    console.log(`   │ 💰 CUMAC estimé: ${result.estimationCUMAC.estimationBasse} - ${result.estimationCUMAC.estimationHaute}`);
  }

  console.log(`   └─`);
}

/**
 * Exécute un scénario de test
 */
async function runScenario(scenario, index) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`TEST ${index + 1}/${TEST_SCENARIOS.length}: ${scenario.description}`);
  console.log(`Produit: ${scenario.produit.toUpperCase()}`);
  console.log(`Attendu: ${scenario.expected}`);
  console.log(`${'═'.repeat(80)}`);

  const startTime = Date.now();

  try {
    const results = await prospectionService.searchEnriched(scenario.criteria);
    const duration = Date.now() - startTime;

    console.log(`\n✅ Recherche terminée en ${(duration / 1000).toFixed(1)}s`);
    console.log(`📊 Résultats: ${results.length} prospects qualifiés`);

    if (results.length === 0) {
      console.log(`⚠️  Aucun résultat trouvé pour ce scénario`);
      return {
        success: true,
        count: 0,
        duration
      };
    }

    // Afficher les résultats
    console.log(`\n📋 Détails des prospects:`);
    results.slice(0, 3).forEach((result, idx) => displayResult(result, idx));

    if (results.length > 3) {
      console.log(`\n   ... et ${results.length - 3} autres prospects`);
    }

    // Statistiques d'enrichissement
    const avgSources = results.reduce((sum, r) => sum + (r.sources?.length || 0), 0) / results.length;
    const withCoords = results.filter(r => r.coordinates).length;
    const withHeight = results.filter(r => r.bdtopo?.hauteur || r.bdnb?.hauteur || r.rnb?.hauteur).length;
    const withDPE = results.filter(r => r.bdnb?.classeDPE || r.dpe?.length > 0).length;
    const withICPE = results.filter(r => r.georisques && r.georisques.length > 0).length;

    console.log(`\n📈 Statistiques d'enrichissement:`);
    console.log(`   • Moyenne sources/prospect: ${avgSources.toFixed(1)}`);
    console.log(`   • Avec coordonnées GPS: ${withCoords}/${results.length} (${Math.round(withCoords / results.length * 100)}%)`);
    console.log(`   • Avec hauteur bâtiment: ${withHeight}/${results.length} (${Math.round(withHeight / results.length * 100)}%)`);
    console.log(`   • Avec DPE: ${withDPE}/${results.length} (${Math.round(withDPE / results.length * 100)}%)`);
    if (scenario.produit === 'matelas_isolants') {
      console.log(`   • Avec données ICPE: ${withICPE}/${results.length} (${Math.round(withICPE / results.length * 100)}%)`);
    }

    // Validation du scénario
    let validation = '✅ Scénario validé';
    if (results.length === 0) {
      validation = '⚠️  Aucun résultat';
    } else if (avgSources < 2) {
      validation = '⚠️  Enrichissement faible (<2 sources en moyenne)';
    } else if (withCoords < results.length * 0.5) {
      validation = '⚠️  Peu de géolocalisations (<50%)';
    }

    console.log(`\n${validation}`);

    return {
      success: true,
      count: results.length,
      duration,
      avgSources,
      enrichmentRate: withCoords / results.length
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ ERREUR: ${error.message}`);
    console.error(`Stack: ${error.stack}`);

    return {
      success: false,
      error: error.message,
      duration
    };
  }
}

/**
 * Exécute tous les tests
 */
async function runAllTests() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║          TESTS COMPLETS PROSPECTION ENRICHIE MULTI-SOURCES                ║
║          ${TEST_SCENARIOS.length} scénarios × 3 produits                                     ║
╚═══════════════════════════════════════════════════════════════════════════╝
`);

  const results = [];

  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    const result = await runScenario(TEST_SCENARIOS[i], i);
    results.push(result);

    // Pause entre les tests pour respecter les rate limits
    if (i < TEST_SCENARIOS.length - 1) {
      console.log(`\n⏳ Pause 2s avant le prochain test...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // RÉSUMÉ GLOBAL
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log(`📊 RÉSUMÉ GLOBAL DES TESTS`);
  console.log(`${'═'.repeat(80)}\n`);

  const successful = results.filter(r => r.success && r.count > 0);
  const withoutResults = results.filter(r => r.success && r.count === 0);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Tests avec résultats: ${successful.length}/${results.length}`);
  console.log(`⚠️  Tests sans résultats: ${withoutResults.length}/${results.length}`);
  console.log(`❌ Tests en erreur: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    const totalResults = successful.reduce((sum, r) => sum + r.count, 0);
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    const avgSources = successful.reduce((sum, r) => sum + (r.avgSources || 0), 0) / successful.length;
    const avgEnrichment = successful.reduce((sum, r) => sum + (r.enrichmentRate || 0), 0) / successful.length;

    console.log(`\n📈 Statistiques globales:`);
    console.log(`   • Total prospects trouvés: ${totalResults}`);
    console.log(`   • Temps moyen par recherche: ${(avgDuration / 1000).toFixed(1)}s`);
    console.log(`   • Sources moyennes/prospect: ${avgSources.toFixed(1)}`);
    console.log(`   • Taux d'enrichissement GPS: ${Math.round(avgEnrichment * 100)}%`);
  }

  console.log(`\n${'═'.repeat(80)}`);

  // Grouper par produit
  const byProduct = {
    destratification: results.slice(0, 3),
    pression: results.slice(3, 6),
    matelas_isolants: results.slice(6, 9)
  };

  console.log(`\n📊 Résultats par produit:\n`);
  for (const [produit, prodResults] of Object.entries(byProduct)) {
    const successCount = prodResults.filter(r => r.success && r.count > 0).length;
    const totalCount = prodResults.reduce((sum, r) => sum + (r.count || 0), 0);
    console.log(`   ${produit.toUpperCase()}: ${successCount}/3 tests réussis, ${totalCount} prospects`);
  }

  console.log(`\n${'═'.repeat(80)}`);

  if (successful.length === results.length) {
    console.log(`\n🎉 SUCCÈS TOTAL ! Tous les tests ont retourné des résultats enrichis.`);
  } else if (successful.length > results.length / 2) {
    console.log(`\n✅ Tests majoritairement réussis (${Math.round(successful.length / results.length * 100)}%)`);
  } else {
    console.log(`\n⚠️  De nombreux tests n'ont pas retourné de résultats ou sont en erreur.`);
    console.log(`   Vérifiez la configuration des API et les critères de recherche.`);
  }

  return results;
}

// Exécuter les tests
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log(`\n✅ Tous les tests terminés\n`);
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ Erreur fatale:`, error);
      process.exit(1);
    });
}

module.exports = { runAllTests, runScenario };
