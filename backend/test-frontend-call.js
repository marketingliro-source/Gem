/**
 * Test qui simule exactement ce que le frontend envoie
 */

const axios = require('axios');

async function testFrontendCall() {
  console.log('🧪 Test appel frontend → backend');
  console.log('===============================\n');

  // Simuler exactement ce que le frontend envoie
  const payload = {
    typeProduit: 'destratification',
    codesNAF: ['47.11F'],
    region: '11',
    limit: 5,
    enrichPhone: false
  };

  console.log('📋 Payload envoyé (comme le frontend):');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  try {
    // Test en production sur le VPS
    const url = 'http://159.198.47.216:5000/api/prospection/search';
    console.log(`🌐 URL: ${url}`);
    console.log('');

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
        // Pas de token pour l'instant, juste pour tester
      },
      timeout: 30000
    });

    console.log('✅ Réponse reçue!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📦 Total résultats: ${response.data.total || 0}`);
    console.log(`📋 Nombre résultats: ${response.data.results?.length || 0}`);
    console.log('');

    if (response.data.results && response.data.results.length > 0) {
      console.log('👉 Premier résultat:');
      const first = response.data.results[0];
      console.log(`   - Nom: ${first.sirene?.denomination || first.denomination || 'N/A'}`);
      console.log(`   - SIRET: ${first.siret || 'N/A'}`);
      console.log(`   - Adresse: ${first.sirene?.adresse?.commune || 'N/A'}`);
      console.log(`   - Score: ${first.scoreProduiCible || first.scorePertinence || 'N/A'}`);
      console.log(`   - Sources: ${first.sources?.length || 0}`);
    } else {
      console.log('⚠️  Aucun résultat retourné');
    }

  } catch (error) {
    console.error('❌ Erreur:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   ${error.message}`);
    }
  }
}

testFrontendCall();
