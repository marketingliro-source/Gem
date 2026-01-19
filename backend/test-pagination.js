/**
 * Test de la pagination
 */

require('dotenv').config();
const prospectionService = require('./src/services/prospection.service');

async function testPagination() {
  console.log('\n🧪 TEST PAGINATION\n');
  console.log('='.repeat(60));

  try {
    // Test Page 1
    console.log('\n📄 Page 1 (20 résultats par page)...');
    const page1 = await prospectionService.searchPaginated({
      codeNAF: '25.11Z',
      produit: 'matelas_isolants'
    }, 1, 20);

    console.log(`\n✅ Page 1 résultats:`);
    console.log(`   - Prospects sur cette page: ${page1.data.length}`);
    console.log(`   - Total disponible: ${page1.pagination.total}`);
    console.log(`   - Total pages: ${page1.pagination.totalPages}`);
    console.log(`   - Page actuelle: ${page1.pagination.page}`);
    console.log(`   - Par page: ${page1.pagination.perPage}`);
    console.log(`   - Page suivante ? ${page1.pagination.hasNextPage}`);

    if (page1.data.length > 0) {
      console.log(`\n🏆 Premier prospect:`);
      console.log(`   - SIRET: ${page1.data[0].siret}`);
      console.log(`   - Dénomination: ${page1.data[0].sirene?.denomination}`);
      console.log(`   - Score: ${page1.data[0].scoreProduiCible}/100`);
    }

    // Test Page 2
    console.log('\n\n📄 Page 2...');
    const page2 = await prospectionService.searchPaginated({
      codeNAF: '25.11Z',
      produit: 'matelas_isolants'
    }, 2, 20);

    console.log(`\n✅ Page 2 résultats:`);
    console.log(`   - Prospects sur cette page: ${page2.data.length}`);
    console.log(`   - Page actuelle: ${page2.pagination.page}`);

    if (page2.data.length > 0) {
      console.log(`\n🏆 Premier prospect page 2:`);
      console.log(`   - SIRET: ${page2.data[0].siret}`);
      console.log(`   - Dénomination: ${page2.data[0].sirene?.denomination}`);
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ TEST PAGINATION RÉUSSI !');
    console.log(`📊 ${page1.pagination.total} entreprises disponibles en ${page1.pagination.totalPages} pages`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testPagination();
