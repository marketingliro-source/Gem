/**
 * Script de test complet des filtres de prospection
 * Teste tous les filtres pour les 3 produits avec vérification des APIs
 */

require('dotenv').config();
const prospectionService = require('./src/services/prospection.service');

// Codes NAF de test (diversifiés pour chaque produit)
const TESTS = {
  destratification: {
    produit: 'destratification',
    nafCode: '52.10', // Entreposage - bâtiments hauts
    region: 'Normandie',
    tests: [
      {
        nom: '🏗️  Test Hauteur 4m minimum',
        criteres: {
          codeNAF: '52.10',
          produit: 'destratification',
          region: 'Normandie',
          hauteurMin: 4,
          limit: 20
        }
      },
      {
        nom: '🏗️  Test Hauteur 6m minimum',
        criteres: {
          codeNAF: '52.10',
          produit: 'destratification',
          region: 'Normandie',
          hauteurMin: 6,
          limit: 20
        }
      },
      {
        nom: '🏗️  Test Hauteur 8m minimum',
        criteres: {
          codeNAF: '52.10',
          produit: 'destratification',
          region: 'Normandie',
          hauteurMin: 8,
          limit: 20
        }
      },
      {
        nom: '📐 Test Surface 500m² minimum',
        criteres: {
          codeNAF: '52.10',
          produit: 'destratification',
          region: 'Normandie',
          surfaceMin: 500,
          limit: 20
        }
      },
      {
        nom: '📐 Test Surface 1000m² minimum',
        criteres: {
          codeNAF: '52.10',
          produit: 'destratification',
          region: 'Normandie',
          surfaceMin: 1000,
          limit: 20
        }
      },
      {
        nom: '🔥 Test Type chauffage (aérien)',
        criteres: {
          codeNAF: '52.10',
          produit: 'destratification',
          region: 'Normandie',
          typesChauffage: ['air', 'aérien'],
          limit: 20
        }
      },
      {
        nom: '⚡ Test DPE (E, F, G)',
        criteres: {
          codeNAF: '52.10',
          produit: 'destratification',
          region: 'Normandie',
          classesDPE: ['E', 'F', 'G'],
          limit: 20
        }
      },
      {
        nom: '🎯 Test COMBINÉ (hauteur 4m + surface 500m² + DPE E/F/G)',
        criteres: {
          codeNAF: '52.10',
          produit: 'destratification',
          region: 'Normandie',
          hauteurMin: 4,
          surfaceMin: 500,
          classesDPE: ['E', 'F', 'G'],
          limit: 20
        }
      }
    ]
  },

  pression: {
    produit: 'pression',
    nafCode: '86.10', // Activités hospitalières
    region: 'Île-de-France',
    tests: [
      {
        nom: '📐 Test Surface 500m² minimum',
        criteres: {
          codeNAF: '86.10',
          produit: 'pression',
          region: 'Île-de-France',
          surfaceMin: 500,
          limit: 20
        }
      },
      {
        nom: '📐 Test Surface 800m² minimum',
        criteres: {
          codeNAF: '86.10',
          produit: 'pression',
          region: 'Île-de-France',
          surfaceMin: 800,
          limit: 20
        }
      },
      {
        nom: '📐 Test Surface 1500m² minimum',
        criteres: {
          codeNAF: '86.10',
          produit: 'pression',
          region: 'Île-de-France',
          surfaceMin: 1500,
          limit: 20
        }
      },
      {
        nom: '🔥 Test Type chauffage (collectif, chaudière)',
        criteres: {
          codeNAF: '86.10',
          produit: 'pression',
          region: 'Île-de-France',
          typesChauffage: ['collectif', 'chaudière'],
          limit: 20
        }
      },
      {
        nom: '🔥 Test Type chauffage (gaz, fioul)',
        criteres: {
          codeNAF: '86.10',
          produit: 'pression',
          region: 'Île-de-France',
          typesChauffage: ['gaz', 'fioul'],
          limit: 20
        }
      },
      {
        nom: '⚡ Test DPE (D, E, F)',
        criteres: {
          codeNAF: '86.10',
          produit: 'pression',
          region: 'Île-de-France',
          classesDPE: ['D', 'E', 'F'],
          limit: 20
        }
      },
      {
        nom: '🎯 Test COMBINÉ (surface 500m² + chauffage collectif + DPE D/E/F)',
        criteres: {
          codeNAF: '86.10',
          produit: 'pression',
          region: 'Île-de-France',
          surfaceMin: 500,
          typesChauffage: ['collectif'],
          classesDPE: ['D', 'E', 'F'],
          limit: 20
        }
      }
    ]
  },

  matelas_isolants: {
    produit: 'matelas_isolants',
    nafCode: '25.11', // Fabrication structures métalliques (industrie)
    region: 'Auvergne-Rhône-Alpes',
    tests: [
      {
        nom: '📐 Test Surface 500m² minimum',
        criteres: {
          codeNAF: '25.11',
          produit: 'matelas_isolants',
          region: 'Auvergne-Rhône-Alpes',
          surfaceMin: 500,
          limit: 20
        }
      },
      {
        nom: '📐 Test Surface 1000m² minimum',
        criteres: {
          codeNAF: '25.11',
          produit: 'matelas_isolants',
          region: 'Auvergne-Rhône-Alpes',
          surfaceMin: 1000,
          limit: 20
        }
      },
      {
        nom: '📐 Test Surface 2000m² minimum',
        criteres: {
          codeNAF: '25.11',
          produit: 'matelas_isolants',
          region: 'Auvergne-Rhône-Alpes',
          surfaceMin: 2000,
          limit: 20
        }
      },
      {
        nom: '⚡ Test DPE mauvais (E, F, G)',
        criteres: {
          codeNAF: '25.11',
          produit: 'matelas_isolants',
          region: 'Auvergne-Rhône-Alpes',
          classesDPE: ['E', 'F', 'G'],
          limit: 20
        }
      },
      {
        nom: '⚡ Test DPE moyen (D)',
        criteres: {
          codeNAF: '25.11',
          produit: 'matelas_isolants',
          region: 'Auvergne-Rhône-Alpes',
          classesDPE: ['D'],
          limit: 20
        }
      },
      {
        nom: '🎯 Test COMBINÉ (surface 500m² + DPE E/F/G)',
        criteres: {
          codeNAF: '25.11',
          produit: 'matelas_isolants',
          region: 'Auvergne-Rhône-Alpes',
          surfaceMin: 500,
          classesDPE: ['E', 'F', 'G'],
          limit: 20
        }
      }
    ]
  }
};

// Fonction pour analyser les données enrichies d'un prospect
function analyserEnrichissement(prospect) {
  const apis = {
    sirene: !!prospect.sirene?.denomination,
    bdnb: !!prospect.bdnb,
    bdtopo: !!prospect.bdtopo,
    dpe: !!prospect.dpe && prospect.dpe.length > 0,
    georisques: !!prospect.georisques && prospect.georisques.length > 0,
    rnb: !!prospect.rnb
  };

  const techniques = {
    hauteur: prospect.bdtopo?.hauteur || prospect.bdnb?.hauteur || prospect.rnb?.hauteur || null,
    surface: prospect.bdnb?.surfacePlancher || prospect.rnb?.surface || null,
    chauffage: prospect.bdnb?.typeChauffage || null,
    dpe: prospect.bdnb?.classeDPE || prospect.dpe?.[0]?.etiquetteDPE || null
  };

  return { apis, techniques };
}

// Fonction pour afficher un résumé détaillé
function afficherResultat(test, resultats) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(test.nom);
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 Critères de recherche:`);
  console.log(JSON.stringify(test.criteres, null, 2));
  console.log(`\n✅ Résultats: ${resultats.length} prospects retournés`);

  if (resultats.length === 0) {
    console.log(`\n⚠️  AUCUN RÉSULTAT - Vérifier si le filtre fonctionne correctement`);
    return;
  }

  // Analyser l'enrichissement
  const statsAPIs = {
    sirene: 0,
    bdnb: 0,
    bdtopo: 0,
    dpe: 0,
    georisques: 0,
    rnb: 0
  };

  const statsTechniques = {
    avecHauteur: 0,
    avecSurface: 0,
    avecChauffage: 0,
    avecDPE: 0
  };

  resultats.forEach(p => {
    const analyse = analyserEnrichissement(p);

    if (analyse.apis.sirene) statsAPIs.sirene++;
    if (analyse.apis.bdnb) statsAPIs.bdnb++;
    if (analyse.apis.bdtopo) statsAPIs.bdtopo++;
    if (analyse.apis.dpe) statsAPIs.dpe++;
    if (analyse.apis.georisques) statsAPIs.georisques++;
    if (analyse.apis.rnb) statsAPIs.rnb++;

    if (analyse.techniques.hauteur) statsTechniques.avecHauteur++;
    if (analyse.techniques.surface) statsTechniques.avecSurface++;
    if (analyse.techniques.chauffage) statsTechniques.avecChauffage++;
    if (analyse.techniques.dpe) statsTechniques.avecDPE++;
  });

  console.log(`\n📡 Enrichissement APIs (sur ${resultats.length} prospects):`);
  console.log(`   SIRENE:      ${statsAPIs.sirene}/${resultats.length} (${Math.round(statsAPIs.sirene/resultats.length*100)}%)`);
  console.log(`   BDNB:        ${statsAPIs.bdnb}/${resultats.length} (${Math.round(statsAPIs.bdnb/resultats.length*100)}%)`);
  console.log(`   BD TOPO:     ${statsAPIs.bdtopo}/${resultats.length} (${Math.round(statsAPIs.bdtopo/resultats.length*100)}%)`);
  console.log(`   DPE:         ${statsAPIs.dpe}/${resultats.length} (${Math.round(statsAPIs.dpe/resultats.length*100)}%)`);
  console.log(`   Géorisques:  ${statsAPIs.georisques}/${resultats.length} (${Math.round(statsAPIs.georisques/resultats.length*100)}%)`);
  console.log(`   RNB:         ${statsAPIs.rnb}/${resultats.length} (${Math.round(statsAPIs.rnb/resultats.length*100)}%)`);

  console.log(`\n🔧 Données techniques disponibles:`);
  console.log(`   Hauteur:     ${statsTechniques.avecHauteur}/${resultats.length} (${Math.round(statsTechniques.avecHauteur/resultats.length*100)}%)`);
  console.log(`   Surface:     ${statsTechniques.avecSurface}/${resultats.length} (${Math.round(statsTechniques.avecSurface/resultats.length*100)}%)`);
  console.log(`   Chauffage:   ${statsTechniques.avecChauffage}/${resultats.length} (${Math.round(statsTechniques.avecChauffage/resultats.length*100)}%)`);
  console.log(`   DPE:         ${statsTechniques.avecDPE}/${resultats.length} (${Math.round(statsTechniques.avecDPE/resultats.length*100)}%)`);

  // Afficher 3 exemples avec leurs valeurs techniques
  console.log(`\n🔍 Échantillon de 3 prospects:`);
  resultats.slice(0, 3).forEach((p, i) => {
    const analyse = analyserEnrichissement(p);
    console.log(`\n   ${i+1}. ${p.denomination || p.siret}`);
    console.log(`      SIRET: ${p.siret}`);
    console.log(`      Score: ${Math.round(p.scorePertinence)}/100`);

    if (test.criteres.hauteurMin !== undefined) {
      console.log(`      Hauteur: ${analyse.techniques.hauteur ? analyse.techniques.hauteur + 'm' : '❌ NON DISPONIBLE'} ${test.criteres.hauteurMin ? `(min requis: ${test.criteres.hauteurMin}m)` : ''}`);
      if (analyse.techniques.hauteur && test.criteres.hauteurMin) {
        const respecte = parseFloat(analyse.techniques.hauteur) >= parseFloat(test.criteres.hauteurMin);
        console.log(`         ${respecte ? '✅ Respecte le minimum' : '❌ NE RESPECTE PAS LE MINIMUM - PROBLÈME FILTRE!'}`);
      }
    }

    if (test.criteres.surfaceMin !== undefined) {
      console.log(`      Surface: ${analyse.techniques.surface ? analyse.techniques.surface + 'm²' : '❌ NON DISPONIBLE'} ${test.criteres.surfaceMin ? `(min requis: ${test.criteres.surfaceMin}m²)` : ''}`);
      if (analyse.techniques.surface && test.criteres.surfaceMin) {
        const respecte = parseFloat(analyse.techniques.surface) >= parseFloat(test.criteres.surfaceMin);
        console.log(`         ${respecte ? '✅ Respecte le minimum' : '❌ NE RESPECTE PAS LE MINIMUM - PROBLÈME FILTRE!'}`);
      }
    }

    if (test.criteres.typesChauffage && test.criteres.typesChauffage.length > 0) {
      console.log(`      Chauffage: ${analyse.techniques.chauffage || '❌ NON DISPONIBLE'} (requis: ${test.criteres.typesChauffage.join(' ou ')})`);
    }

    if (test.criteres.classesDPE && test.criteres.classesDPE.length > 0) {
      console.log(`      DPE: ${analyse.techniques.dpe || '❌ NON DISPONIBLE'} (requis: ${test.criteres.classesDPE.join(', ')})`);
      if (analyse.techniques.dpe && test.criteres.classesDPE) {
        const respecte = test.criteres.classesDPE.includes(analyse.techniques.dpe.toUpperCase());
        console.log(`         ${respecte ? '✅ Respecte le filtre' : '❌ NE RESPECTE PAS LE FILTRE - PROBLÈME FILTRE!'}`);
      }
    }
  });

  // Vérifier si des prospects ne respectent PAS les filtres (= bug)
  let bugs = [];

  if (test.criteres.hauteurMin !== undefined) {
    const prospectsSansHauteur = resultats.filter(p => {
      const analyse = analyserEnrichissement(p);
      return !analyse.techniques.hauteur;
    });
    const prospectsTropBas = resultats.filter(p => {
      const analyse = analyserEnrichissement(p);
      return analyse.techniques.hauteur && parseFloat(analyse.techniques.hauteur) < parseFloat(test.criteres.hauteurMin);
    });

    if (prospectsSansHauteur.length > 0) {
      bugs.push(`❌ ${prospectsSansHauteur.length} prospects sans donnée de hauteur (devrait être exclu si hauteurMin requis)`);
    }
    if (prospectsTropBas.length > 0) {
      bugs.push(`❌ ${prospectsTropBas.length} prospects avec hauteur < ${test.criteres.hauteurMin}m (FILTRE NE FONCTIONNE PAS!)`);
    }
  }

  if (test.criteres.surfaceMin !== undefined) {
    const prospectsSansSurface = resultats.filter(p => {
      const analyse = analyserEnrichissement(p);
      return !analyse.techniques.surface;
    });
    const prospectsTropPetits = resultats.filter(p => {
      const analyse = analyserEnrichissement(p);
      return analyse.techniques.surface && parseFloat(analyse.techniques.surface) < parseFloat(test.criteres.surfaceMin);
    });

    if (prospectsSansSurface.length > 0) {
      bugs.push(`❌ ${prospectsSansSurface.length} prospects sans donnée de surface (devrait être exclu si surfaceMin requis)`);
    }
    if (prospectsTropPetits.length > 0) {
      bugs.push(`❌ ${prospectsTropPetits.length} prospects avec surface < ${test.criteres.surfaceMin}m² (FILTRE NE FONCTIONNE PAS!)`);
    }
  }

  if (test.criteres.classesDPE && test.criteres.classesDPE.length > 0) {
    const prospectsAvecMauvaisDPE = resultats.filter(p => {
      const analyse = analyserEnrichissement(p);
      return analyse.techniques.dpe && !test.criteres.classesDPE.includes(analyse.techniques.dpe.toUpperCase());
    });

    if (prospectsAvecMauvaisDPE.length > 0) {
      bugs.push(`❌ ${prospectsAvecMauvaisDPE.length} prospects avec DPE hors critères (FILTRE NE FONCTIONNE PAS!)`);
    }
  }

  if (bugs.length > 0) {
    console.log(`\n🚨 PROBLÈMES DÉTECTÉS:`);
    bugs.forEach(bug => console.log(`   ${bug}`));
  } else {
    console.log(`\n✅ Tous les résultats respectent les filtres demandés`);
  }
}

// Fonction principale
async function executerTests() {
  console.log('\n' + '🎯'.repeat(40));
  console.log('TEST COMPLET DES FILTRES DE PROSPECTION');
  console.log('🎯'.repeat(40) + '\n');

  const produits = ['destratification', 'pression', 'matelas_isolants'];

  for (const produit of produits) {
    const config = TESTS[produit];

    console.log('\n\n' + '█'.repeat(80));
    console.log(`█  PRODUIT: ${produit.toUpperCase()}`);
    console.log('█'.repeat(80));

    for (const test of config.tests) {
      try {
        const resultats = await prospectionService.searchEnriched(test.criteres);
        afficherResultat(test, resultats);

        // Pause entre tests pour éviter rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.log(`\n❌ ERREUR lors du test: ${error.message}`);
        console.error(error);
      }
    }
  }

  console.log('\n\n' + '🏁'.repeat(40));
  console.log('TESTS TERMINÉS');
  console.log('🏁'.repeat(40) + '\n');
}

// Lancer les tests
executerTests()
  .then(() => {
    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
