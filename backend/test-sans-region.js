/**
 * Test sans filtre région pour vérifier qu'on trouve des résultats
 */

require('dotenv').config();
const prospectionService = require('./src/services/prospection.service');

async function testSansRegion() {
  console.log('\n🧪 Test: DESTRATIFICATION SANS filtre région');
  console.log('Pour vérifier que les codes NAF fonctionnent');
  console.log('=====================================\n');

  try {
    const results = await prospectionService.searchEnriched({
      produit: 'destratification',
      limit: 5
    });

    console.log(`\n✅ Résultats: ${results.length} prospects trouvés`);

    if (results.length > 0) {
      console.log('\n📊 Premiers résultats:');
      results.slice(0, 3).forEach((p, i) => {
        console.log(`\n${i+1}. ${p.denomination || 'N/A'}`);
        console.log(`   SIRET: ${p.siret}`);
        console.log(`   NAF: ${p.codeNAF || p.sirene?.codeNAF || 'N/A'}`);
        console.log(`   Commune: ${p.adresse?.commune || 'N/A'} (${p.adresse?.codePostal || 'N/A'})`);
        console.log(`   Score: ${Math.round(p.scorePertinence)}/100`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testSansRegion();
