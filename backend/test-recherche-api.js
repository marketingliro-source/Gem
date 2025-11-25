/**
 * Script de test pour l'API Recherche Entreprises
 * Teste différentes combinaisons de recherche pour valider le fonctionnement
 */

const axios = require('axios');

const API_URL = 'https://recherche-entreprises.api.gouv.fr/search';

// Codes NAF de test pour chaque produit
const CODES_NAF_TEST = {
  destratification: ['4711F', '5210A', '5610A', '9311Z'],
  pression: ['8610Z', '8710A', '5510Z', '8531Z'],
  matelas_isolants: ['2410Z', '2451Z', '1011Z', '2351Z']
};

// Régions à tester
const REGIONS_TEST = [
  'Île-de-France',
  'Auvergne-Rhône-Alpes',
  'Provence-Alpes-Côte d\'Azur',
  'Nouvelle-Aquitaine'
];

// Départements à tester
const DEPARTEMENTS_TEST = ['75', '69', '13', '33'];

/**
 * Teste une requête à l'API
 */
async function testQuery(description, params) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST: ${description}`);
  console.log(`${'='.repeat(80)}`);
  console.log('📋 Paramètres:', JSON.stringify(params, null, 2));

  const url = API_URL + '?' + new URLSearchParams(params).toString();
  console.log('🌐 URL:', url);

  try {
    const startTime = Date.now();
    const response = await axios.get(API_URL, { params, timeout: 10000 });
    const duration = Date.now() - startTime;

    console.log(`✅ Succès - ${duration}ms`);
    console.log('📊 Status:', response.status);
    console.log('📦 Résultats:', response.data.results?.length || 0, 'entreprises trouvées');
    console.log('📈 Total disponible:', response.data.total_results || 'N/A');
    console.log('📄 Page:', response.data.page || 'N/A');

    if (response.data.results && response.data.results.length > 0) {
      const first = response.data.results[0];
      console.log('\n👉 Premier résultat:');
      console.log('   - SIRET:', first.siege?.siret || first.siret);
      console.log('   - Nom:', first.nom_complet || first.nom_raison_sociale);
      console.log('   - Adresse:', first.siege?.geo_adresse || first.siege?.adresse);
      console.log('   - Code NAF:', first.activite_principale);
      console.log('   - Commune:', first.siege?.libelle_commune);
      console.log('   - CP:', first.siege?.code_postal);
    }

    return {
      success: true,
      count: response.data.results?.length || 0,
      total: response.data.total_results || 0,
      duration
    };

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.response) {
      console.error('📛 Status HTTP:', error.response.status);
      console.error('📛 Données:', JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Lance tous les tests
 */
async function runAllTests() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                  TESTS API RECHERCHE ENTREPRISES                          ║
║                     https://recherche-entreprises.api.gouv.fr             ║
╚═══════════════════════════════════════════════════════════════════════════╝
`);

  const results = [];

  // TEST 1: Recherche simple wildcard
  results.push(await testQuery(
    'Recherche wildcard simple (toutes entreprises)',
    { q: '*', per_page: 10 }
  ));

  await sleep(500);

  // TEST 2: Recherche par code NAF seul (destratification)
  for (const naf of CODES_NAF_TEST.destratification.slice(0, 2)) {
    results.push(await testQuery(
      `Recherche par code NAF: ${naf} (destratification)`,
      { q: '*', activite_principale: naf, per_page: 10 }
    ));
    await sleep(500);
  }

  // TEST 3: Recherche par région seule
  for (const region of REGIONS_TEST.slice(0, 2)) {
    results.push(await testQuery(
      `Recherche par région: ${region}`,
      { q: '*', region: region, per_page: 10 }
    ));
    await sleep(500);
  }

  // TEST 4: Recherche par département seul
  for (const dept of DEPARTEMENTS_TEST.slice(0, 2)) {
    results.push(await testQuery(
      `Recherche par département: ${dept}`,
      { q: '*', departement: dept, per_page: 10 }
    ));
    await sleep(500);
  }

  // TEST 5: Recherche combinée (NAF + région)
  results.push(await testQuery(
    'Recherche combinée: NAF 4711F + Île-de-France',
    { q: '*', activite_principale: '4711F', region: 'Île-de-France', per_page: 10 }
  ));

  await sleep(500);

  // TEST 6: Recherche combinée (NAF + département)
  results.push(await testQuery(
    'Recherche combinée: NAF 8610Z + département 75 (hôpitaux Paris)',
    { q: '*', activite_principale: '8610Z', departement: '75', per_page: 10 }
  ));

  await sleep(500);

  // TEST 7: Recherche par code postal
  results.push(await testQuery(
    'Recherche par code postal: 75001',
    { q: '*', code_postal: '75001', per_page: 10 }
  ));

  await sleep(500);

  // TEST 8: Recherche matelas isolants (NAF industriel)
  results.push(await testQuery(
    'Recherche NAF 2410Z (sidérurgie) + région Auvergne-Rhône-Alpes',
    { q: '*', activite_principale: '2410Z', region: 'Auvergne-Rhône-Alpes', per_page: 10 }
  ));

  await sleep(500);

  // TEST 9: Recherche pression (hôtels)
  results.push(await testQuery(
    'Recherche NAF 5510Z (hôtels) + département 06',
    { q: '*', activite_principale: '5510Z', departement: '06', per_page: 10 }
  ));

  // RÉSUMÉ FINAL
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log(`${'='.repeat(80)}\n`);

  const successful = results.filter(r => r.success);
  const withResults = results.filter(r => r.success && r.count > 0);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Tests réussis: ${successful.length}/${results.length}`);
  console.log(`📦 Tests avec résultats: ${withResults.length}/${results.length}`);
  console.log(`❌ Tests échoués: ${failed.length}/${results.length}`);

  if (withResults.length > 0) {
    const avgDuration = withResults.reduce((sum, r) => sum + r.duration, 0) / withResults.length;
    const totalResults = withResults.reduce((sum, r) => sum + r.count, 0);
    console.log(`⏱️  Temps moyen: ${Math.round(avgDuration)}ms`);
    console.log(`📈 Total résultats obtenus: ${totalResults}`);
  }

  console.log('\n' + '='.repeat(80));

  if (withResults.length === 0) {
    console.log('⚠️  PROBLÈME DÉTECTÉ: Aucun test n\'a retourné de résultats!');
    console.log('   Causes possibles:');
    console.log('   1. L\'API nécessite peut-être un token (à vérifier dans la doc)');
    console.log('   2. Le format des paramètres est incorrect');
    console.log('   3. L\'API a changé ou est temporairement indisponible');
  } else {
    console.log('✅ L\'API fonctionne correctement!');
  }

  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exécuter les tests
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n✅ Tests terminés\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { testQuery, runAllTests };
