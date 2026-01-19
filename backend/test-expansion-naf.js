/**
 * Test d'expansion des codes NAF
 */

require('dotenv').config();
const nafService = require('./src/services/naf.service');
const prospectionService = require('./src/services/prospection.service');

async function testExpansion() {
  console.log('\n🧪 Test 1: Expansion d\'un code NAF partiel');
  console.log('=====================================\n');
  
  const partial = '52.10';
  const expanded = nafService.expandPartialCode(partial);
  console.log(`Code partiel: ${partial}`);
  console.log(`Codes expandés: [${expanded.join(', ')}]`);
  
  console.log('\n🧪 Test 2: Recherche avec NAF 52.10 (partiel)');
  console.log('=====================================\n');
  
  try {
    const results = await prospectionService.searchEnriched({
      codeNAF: '52.10',
      region: 'Normandie',
      limit: 5
    });
    
    console.log(`\n✅ Résultats: ${results.length} prospects trouvés`);
    
    if (results.length > 0) {
      console.log('\n📊 Premier résultat:');
      const p = results[0];
      console.log(`   Dénomination: ${p.denomination || 'N/A'}`);
      console.log(`   SIRET: ${p.siret}`);
      console.log(`   NAF: ${p.codeNAF || p.sirene?.codeNAF || 'N/A'}`);
      console.log(`   Commune: ${p.adresse?.commune || 'N/A'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

testExpansion();
