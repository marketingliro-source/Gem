const axios = require('axios');

async function countNAF2511Z() {
  console.log('\n🔍 Test: Combien d\'entreprises avec NAF 25.11Z en France?');
  console.log('=======================================================\n');

  try {
    // Test 1: Première page
    const response1 = await axios.get('https://recherche-entreprises.api.gouv.fr/search', {
      params: {
        q: '',
        activite_principale: '25.11Z',
        per_page: 25,
        page: 1
      }
    });

    console.log(`📋 Page 1:`);
    console.log(`   - Résultats: ${response1.data.results?.length || 0}`);
    console.log(`   - Total disponible: ${response1.data.total_results || 'N/A'}`);
    console.log(`   - Total pages: ${response1.data.total_pages || 'N/A'}`);

    // Test 2: Deuxième page pour voir s'il y en a plus
    const response2 = await axios.get('https://recherche-entreprises.api.gouv.fr/search', {
      params: {
        q: '',
        activite_principale: '25.11Z',
        per_page: 25,
        page: 2
      }
    });

    console.log(`\n📋 Page 2:`);
    console.log(`   - Résultats: ${response2.data.results?.length || 0}`);

    // Test 3: Page 3
    const response3 = await axios.get('https://recherche-entreprises.api.gouv.fr/search', {
      params: {
        q: '',
        activite_principale: '25.11Z',
        per_page: 25,
        page: 3
      }
    });

    console.log(`\n📋 Page 3:`);
    console.log(`   - Résultats: ${response3.data.results?.length || 0}`);

    console.log(`\n📊 TOTAL ESTIMÉ: ${response1.data.total_results || (response1.data.results?.length || 0) + (response2.data.results?.length || 0) + (response3.data.results?.length || 0)}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

countNAF2511Z();
