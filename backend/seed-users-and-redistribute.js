const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

console.log('🔄 Création des utilisateurs télépros et redistribution des clients...\n');

// 1. Créer les utilisateurs télépros
const telepros = [
  { username: 'telepro1', password: 'telepro123', name: 'Sophie Martin' },
  { username: 'telepro2', password: 'telepro123', name: 'Lucas Dubois' },
  { username: 'telepro3', password: 'telepro123', name: 'Emma Lefebvre' }
];

const createdUsers = [];

telepros.forEach((telepro) => {
  try {
    // Vérifier si l'utilisateur existe déjà
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(telepro.username);

    if (existing) {
      console.log(`⚠️  ${telepro.username} existe déjà (ID: ${existing.id})`);
      createdUsers.push({ id: existing.id, username: telepro.username });
    } else {
      const hashedPassword = bcrypt.hashSync(telepro.password, 10);
      const result = db.prepare(`
        INSERT INTO users (username, password, role)
        VALUES (?, ?, 'telepro')
      `).run(telepro.username, hashedPassword);

      createdUsers.push({ id: result.lastInsertRowid, username: telepro.username });
      console.log(`✅ ${telepro.username} créé (ID: ${result.lastInsertRowid}, password: ${telepro.password})`);
    }
  } catch (error) {
    console.error(`❌ Erreur création ${telepro.username}:`, error.message);
  }
});

// 2. Récupérer tous les utilisateurs télépros (y compris ddfd)
const allTelepros = db.prepare(`
  SELECT id, username FROM users WHERE role = 'telepro' ORDER BY id
`).all();

console.log(`\n📊 ${allTelepros.length} télépros disponibles:`);
allTelepros.forEach(t => console.log(`   - ${t.username} (ID: ${t.id})`));

// 3. Récupérer tous les clients
const allClients = db.prepare('SELECT id, societe, statut FROM clients ORDER BY id').all();

console.log(`\n📊 ${allClients.length} clients à redistribuer\n`);

// 4. Redistribuer les clients de manière équitable
let teleproIndex = 0;
let redistributed = 0;

allClients.forEach((client) => {
  const assignedTelepro = allTelepros[teleproIndex];

  try {
    db.prepare(`
      UPDATE clients SET assigned_to = ? WHERE id = ?
    `).run(assignedTelepro.id, client.id);

    console.log(`✅ [${client.id}] ${client.societe} → ${assignedTelepro.username}`);
    redistributed++;

    // Passer au télépro suivant (round-robin)
    teleproIndex = (teleproIndex + 1) % allTelepros.length;
  } catch (error) {
    console.error(`❌ Erreur redistribution client ${client.id}:`, error.message);
  }
});

// 5. Afficher la répartition finale
console.log(`\n📊 Répartition finale:\n`);
allTelepros.forEach(telepro => {
  const count = db.prepare('SELECT COUNT(*) as count FROM clients WHERE assigned_to = ?').get(telepro.id);
  const byStatus = db.prepare(`
    SELECT statut, COUNT(*) as count
    FROM clients
    WHERE assigned_to = ?
    GROUP BY statut
  `).all(telepro.id);

  console.log(`${telepro.username} (ID ${telepro.id}): ${count.count} clients`);
  byStatus.forEach(s => {
    console.log(`  - ${s.statut}: ${s.count}`);
  });
  console.log('');
});

console.log(`✅ ${createdUsers.length} télépros créés`);
console.log(`✅ ${redistributed} clients redistribués`);
console.log(`\n🎉 Terminé !`);

db.close();
