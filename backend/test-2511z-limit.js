/**
 * Test avec différentes limites pour 25.11Z
 */

require('dotenv').config();
const prospectionService = require('./src/services/prospection.service');

async function testLimits() {
  const limits = [10, 50, 100, 500, 1000];

  for (const limit of limits) {
    console.log(`\n🧪 Test avec limit=${limit}`);
    console.log('='.repeat(50));

    try {
      const results = await prospectionService.searchEnriched({
        codeNAF: '25.11Z',
        produit: 'matelas_isolants',
        limit: limit
      });

      console.log(`✅ Résultats obtenus: ${results.length}`);
      console.log(`   Attendu: ${limit}`);
      console.log(`   Différence: ${limit - results.length}`);

    } catch (error) {
      console.error(`❌ Erreur:`, error.message);
    }
  }

  process.exit(0);
}

testLimits();
