/**
 * Test: Utilisation automatique des codes NAF depuis categories_cee
 */

require('dotenv').config();
const prospectionService = require('./src/services/prospection.service');

async function testProduitAuto() {
  console.log('\n🧪 Test: DESTRATIFICATION sans codeNAF');
  console.log('Le système doit utiliser automatiquement les codes NAF depuis categories_cee');
  console.log('=====================================\n');

  try {
    const results = await prospectionService.searchEnriched({
      produit: 'destratification',
      region: 'Normandie',
      limit: 3
    });

    console.log(`\n✅ Résultats: ${results.length} prospects trouvés`);

    if (results.length > 0) {
      console.log('\n📊 Premier résultat:');
      const p = results[0];
      console.log(`   Dénomination: ${p.denomination || 'N/A'}`);
      console.log(`   SIRET: ${p.siret}`);
      console.log(`   NAF: ${p.codeNAF || p.sirene?.codeNAF || 'N/A'}`);
      console.log(`   Commune: ${p.adresse?.commune || 'N/A'}`);
      console.log(`   Score: ${Math.round(p.scorePertinence)}/100`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testProduitAuto();
