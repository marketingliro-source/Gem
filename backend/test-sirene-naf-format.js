/**
 * Test du format NAF retourné par SIRENE
 */

require('dotenv').config();
const sireneService = require('./src/services/external-api/sirene.service');

async function testSireneNAFFormat() {
  console.log('\n🔍 Test du format NAF retourné par SIRENE');
  console.log('==========================================\n');

  // SIRET d'une entreprise avec NAF 25.11Z
  const siret = '08578053400013'; // BAUDIN CHATEAUNEUF

  try {
    const data = await sireneService.getSiretInfo(siret);

    console.log(`SIRET testé: ${siret}`);
    console.log(`\nCode NAF retourné par SIRENE:`);
    console.log(`  - data.codeNAF = "${data.codeNAF}"`);
    console.log(`  - Type: ${typeof data.codeNAF}`);
    console.log(`  - Longueur: ${data.codeNAF?.length}`);
    console.log(`  - Avec point ? ${data.codeNAF?.includes('.')}`);

    console.log(`\nTest de matching:`);
    const searchCode = '25.11Z';
    const prospectCode = data.codeNAF;

    // Test actuel (avec normalisation)
    const prospectNormalized = prospectCode?.replace(/\./g, '') || '';
    const searchNormalized = searchCode.replace(/\./g, '');
    const match1 = prospectNormalized.startsWith(searchNormalized);

    console.log(`  Code recherché: "${searchCode}" → normalized: "${searchNormalized}"`);
    console.log(`  Code prospect: "${prospectCode}" → normalized: "${prospectNormalized}"`);
    console.log(`  Match: ${match1} ${match1 ? '✅' : '❌'}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

testSireneNAFFormat();
