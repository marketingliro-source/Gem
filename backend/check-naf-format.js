const nafService = require('./src/services/naf.service');

console.log('\n🔍 Recherche de codes NAF commençant par 52.10:');
const allCodes = nafService.getAllCodes();
const codes52 = allCodes.filter(c => c.code.startsWith('52'));
console.log(`\nTotal codes section 52: ${codes52.length}`);
console.log('\n📋 Codes 52.10:');
codes52.filter(c => c.code.includes('52.10')).forEach(c => {
  console.log(`  - ${c.code}: ${c.libelle}`);
});

console.log('\n📋 Tous les codes 52 (premiers 20):');
codes52.slice(0, 20).forEach(c => {
  console.log(`  - ${c.code}: ${c.libelle}`);
});

console.log('\n🧪 Test expansion avec différents formats:');
['52.10', '5210', '52.10B', '5210B'].forEach(code => {
  const expanded = nafService.expandPartialCode(code);
  console.log(`  ${code} → [${expanded.join(', ')}]`);
});
