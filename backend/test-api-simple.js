const axios = require('axios');

async function testSimple() {
  const tests = [
    {
      desc: 'Recherche textuelle simple: "carrefour"',
      params: { q: 'carrefour', per_page: 5 }
    },
    {
      desc: 'Recherche avec NAF 47.11F (hypermarchés)',
      params: { q: 'carrefour', activite_principale: '47.11F', per_page: 5 }
    },
    {
      desc: 'Recherche département 75',
      params: { q: 'restaurant', departement: '75', per_page: 5 }
    },
    {
      desc: 'Recherche région 11 (Île-de-France)',
      params: { q: 'hotel', region: '11', per_page: 5 }
    }
  ];

  for (const test of tests) {
    console.log('\n' + '='.repeat(70));
    console.log('TEST: ' + test.desc);
    console.log('='.repeat(70));
    try {
      const response = await axios.get('https://recherche-entreprises.api.gouv.fr/search', {
        params: test.params,
        timeout: 10000
      });
      console.log('SUCCESS - ' + (response.data.results?.length || 0) + ' résultats');
      if (response.data.results?.[0]) {
        const r = response.data.results[0];
        console.log('   ' + r.nom_complet + ' - ' + r.siege?.code_postal + ' ' + r.siege?.libelle_commune);
      }
    } catch (error) {
      console.error('ERREUR: ' + error.message);
      if (error.response?.data) {
        console.error('   ' + JSON.stringify(error.response.data));
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

testSimple();
