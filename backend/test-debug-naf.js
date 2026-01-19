/**
 * Test pour voir les valeurs exactes de codeNAF après enrichissement
 */

require('dotenv').config();
const prospectionService = require('./src/services/prospection.service');

async function debugNAF() {
  console.log('\n🔍 Debug: Valeurs codeNAF après enrichissement');
  console.log('===============================================\n');

  try {
    const results = await prospectionService.searchEnriched({
      codeNAF: '25.11Z',
      produit: 'matelas_isolants',
      limit: 10
    });

    console.log(`\n✅ ${results.length} résultats obtenus\n`);

    results.forEach((p, i) => {
      console.log(`${i+1}. ${p.denomination || p.siret}`);
      console.log(`   SIRET: ${p.siret}`);
      console.log(`   p.sirene existe ? ${!!p.sirene}`);
      console.log(`   p.sirene.codeNAF = "${p.sirene?.codeNAF}"`);
      console.log(`   Type: ${typeof p.sirene?.codeNAF}`);
      console.log(`   Truthy ? ${!!p.sirene?.codeNAF}`);
      console.log(`   p.codeNAF = "${p.codeNAF}"`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugNAF();
