const axios = require('axios');

async function testAPI() {
  console.log('\n🧪 Test direct de l\'API Recherche Entreprises');
  console.log('===============================================\n');

  const tests = [
    { q: '*', naf: '43.22B', desc: 'Wildcard * avec NAF 43.22B' },
    { q: 'chauffage', naf: '43.22B', desc: 'Query "chauffage" avec NAF 43.22B' },
    { q: 'sas', naf: null, desc: 'Query "sas" sans NAF (baseline)' }
  ];

  for (const test of tests) {
    console.log(`📋 Test: ${test.desc}`);

    const params = { q: test.q, per_page: 5 };
    if (test.naf) params.activite_principale = test.naf;

    try {
      const response = await axios.get('https://recherche-entreprises.api.gouv.fr/search', { params });
      console.log(`   ✅ HTTP ${response.status}`);
      const count = response.data.results ? response.data.results.length : 0;
      console.log(`   📦 Résultats: ${count}`);

      if (count > 0) {
        const first = response.data.results[0];
        console.log(`   🏢 Premier: ${first.nom_complet} (${first.activite_principale})`);
      }
    } catch (error) {
      const msg = error.response && error.response.data ? error.response.data.erreur : error.message;
      const status = error.response ? error.response.status : 'N/A';
      console.log(`   ❌ Erreur: ${status} - ${msg}`);
    }
    console.log('');
  }
}

testAPI().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
