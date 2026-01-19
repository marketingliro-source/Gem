/**
 * Test rapide NAF filtering
 */

require('dotenv').config();
const prospectionService = require('./src/services/prospection.service');

async function testQuickNAF() {
  console.log('\n🔍 Test rapide: NAF 25.11Z (Fabrication structures métalliques)');
  console.log('Region: Auvergne-Rhône-Alpes');
  console.log('Produit: matelas_isolants');
  console.log('Limit: 10\n');

  try {
    const results = await prospectionService.searchEnriched({
      codeNAF: '25.11Z',
      produit: 'matelas_isolants',
      region: 'Auvergne-Rhône-Alpes',
      limit: 10
    });

    console.log(`\n✅ Résultats: ${results.length} prospects trouvés`);

    if (results.length > 0) {
      console.log('\n📊 Échantillon des 3 premiers:');
      results.slice(0, 3).forEach((p, i) => {
        console.log(`\n${i+1}. ${p.denomination || p.siret}`);
        console.log(`   SIRET: ${p.siret}`);
        console.log(`   NAF: ${p.codeNAF || p.sirene?.codeNAF || 'N/A'}`);
        console.log(`   Score: ${Math.round(p.scorePertinence)}/100`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

testQuickNAF();
