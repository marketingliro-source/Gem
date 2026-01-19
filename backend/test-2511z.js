/**
 * Test spécifique: Code NAF 25.11Z sans critères
 */

require('dotenv').config();
const prospectionService = require('./src/services/prospection.service');

async function test2511Z() {
  console.log('\n🧪 Test: Code NAF 25.11Z SANS critères');
  console.log('=====================================\n');

  try {
    const results = await prospectionService.searchEnriched({
      codeNAF: '25.11Z',
      produit: 'matelas_isolants',
      limit: 10
    });

    console.log(`\n✅ Résultats: ${results.length} prospects trouvés`);

    if (results.length > 0) {
      console.log('\n📊 Premiers résultats:');
      results.slice(0, 3).forEach((p, i) => {
        console.log(`\n${i+1}. ${p.denomination || p.siret}`);
        console.log(`   SIRET: ${p.siret}`);
        console.log(`   NAF: ${p.codeNAF || p.sirene?.codeNAF || 'N/A'}`);
        console.log(`   Commune: ${p.adresse?.commune || 'N/A'}`);
      });
    } else {
      console.log('\n⚠️  AUCUN résultat - Testons directement l\'API...\n');

      // Test direct de l'API
      const axios = require('axios');
      console.log('📋 Test API direct avec 25.11Z:');

      try {
        const response = await axios.get('https://recherche-entreprises.api.gouv.fr/search', {
          params: { q: '', activite_principale: '25.11Z', per_page: 5 }
        });
        console.log(`   ✅ HTTP ${response.status}`);
        console.log(`   📦 Résultats API: ${response.data.results?.length || 0}`);

        if (response.data.results?.length > 0) {
          const first = response.data.results[0];
          console.log(`   🏢 Premier: ${first.nom_complet} (${first.activite_principale})`);
        }
      } catch (error) {
        console.log(`   ❌ Erreur API: ${error.response?.status} - ${error.message}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test2511Z();
