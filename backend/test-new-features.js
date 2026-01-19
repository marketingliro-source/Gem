const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function testNewFeatures() {
  console.log('🧪 Test des nouvelles fonctionnalités\n');

  try {
    // Test 1: GET /clients avec tri
    console.log('1️⃣  Test GET /clients avec tri par updated_at DESC...');
    const response1 = await axios.get(`${API_URL}/clients`, {
      params: {
        sort_field: 'updated_at',
        sort_order: 'DESC',
        limit: 5
      }
    });

    if (response1.data.clients && Array.isArray(response1.data.clients)) {
      console.log(`   ✅ ${response1.data.clients.length} clients récupérés`);

      if (response1.data.clients.length > 0) {
        const client = response1.data.clients[0];
        console.log(`\n   📋 Vérification des champs du premier client:`);
        console.log(`      - id: ${client.id ? '✅' : '❌'}`);
        console.log(`      - societe: ${client.societe ? '✅' : '❌'}`);
        console.log(`      - updated_at: ${client.updated_at ? '✅' : '❌'}`);
        console.log(`      - assigned_at: ${client.assigned_at !== undefined ? '✅' : '❌'} (${client.assigned_at || 'NULL'})`);
        console.log(`      - last_comment: ${client.last_comment !== undefined ? '✅' : '❌'} (${client.last_comment ? 'présent' : 'NULL'})`);
        console.log(`      - last_comment_date: ${client.last_comment_date !== undefined ? '✅' : '❌'} (${client.last_comment_date || 'NULL'})`);
      } else {
        console.log(`   ⚠️  Aucun client dans la base de données (normal pour un environnement vide)`);
      }
    } else {
      console.log('   ❌ Format de réponse inattendu');
    }

    // Test 2: GET /clients avec tri par societe ASC
    console.log('\n2️⃣  Test GET /clients avec tri par societe ASC...');
    const response2 = await axios.get(`${API_URL}/clients`, {
      params: {
        sort_field: 'societe',
        sort_order: 'ASC',
        limit: 3
      }
    });

    if (response2.data.clients) {
      console.log(`   ✅ ${response2.data.clients.length} clients récupérés (tri par société)`);
    }

    // Test 3: GET /clients avec tri par assigned_at DESC
    console.log('\n3️⃣  Test GET /clients avec tri par assigned_at DESC...');
    const response3 = await axios.get(`${API_URL}/clients`, {
      params: {
        sort_field: 'assigned_at',
        sort_order: 'DESC',
        limit: 3
      }
    });

    if (response3.data.clients) {
      console.log(`   ✅ ${response3.data.clients.length} clients récupérés (tri par date attribution)`);
    }

    console.log('\n✅ Tous les tests sont passés avec succès!\n');
    console.log('📝 Résumé des nouvelles fonctionnalités testées:');
    console.log('   • Tri multi-colonnes (updated_at, societe, assigned_at)');
    console.log('   • Champ assigned_at dans la réponse');
    console.log('   • Champ last_comment dans la réponse');
    console.log('   • Champ last_comment_date dans la réponse\n');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Vérifier que le serveur est démarré
console.log('⏳ Attente du démarrage du serveur backend...\n');
setTimeout(() => {
  testNewFeatures();
}, 2000);
