const axios = require('axios');

async function testQueryOptions() {
  console.log('\n🧪 Test: Différentes options de query avec NAF');
  console.log('==============================================\n');

  const tests = [
    { q: '*', desc: 'Wildcard *' },
    { q: '', desc: 'String vide' },
    { q: ' ', desc: 'Espace' },
    { q: 'a', desc: 'Lettre a' },
    { q: 'sas', desc: 'Mot sas' }
  ];

  const naf = '43.22B';

  for (const test of tests) {
    console.log(`📋 Query: "${test.q}" (${test.desc}) + NAF ${naf}`);

    const params = { q: test.q, activite_principale: naf, per_page: 5 };

    try {
      const response = await axios.get('https://recherche-entreprises.api.gouv.fr/search', { params });
      const count = response.data.results ? response.data.results.length : 0;
      console.log(`   ✅ HTTP 200 - ${count} résultats`);

      if (count > 0) {
        const first = response.data.results[0];
        console.log(`   🏢 ${first.nom_complet.substring(0, 50)}...`);
      }
    } catch (error) {
      const msg = error.response && error.response.data ? error.response.data.erreur : error.message;
      const status = error.response ? error.response.status : 'N/A';
      console.log(`   ❌ ${status} - ${msg.substring(0, 100)}`);
    }
    console.log('');
  }
}

testQueryOptions().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
