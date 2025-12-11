const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

console.log('🧹 Nettoyage de la base de données...\n');

// Activer les clés étrangères
db.pragma('foreign_keys = ON');

try {
  // 1. Compter les données avant nettoyage
  const countClients = db.prepare('SELECT COUNT(*) as count FROM client_base').get();
  const countProduits = db.prepare('SELECT COUNT(*) as count FROM clients_produits').get();
  const countComments = db.prepare('SELECT COUNT(*) as count FROM client_comments').get();
  const countAppointments = db.prepare('SELECT COUNT(*) as count FROM client_appointments').get();
  const countDocuments = db.prepare('SELECT COUNT(*) as count FROM client_documents').get();
  const countUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE role != ?').get('admin');

  console.log('📊 État actuel de la base :');
  console.log(`   - Clients (base): ${countClients.count}`);
  console.log(`   - Produits: ${countProduits.count}`);
  console.log(`   - Commentaires: ${countComments.count}`);
  console.log(`   - Rendez-vous: ${countAppointments.count}`);
  console.log(`   - Documents: ${countDocuments.count}`);
  console.log(`   - Utilisateurs (non-admin): ${countUsers.count}\n`);

  // 2. Supprimer tous les documents
  console.log('🗑️  Suppression des documents...');
  const deleteDocuments = db.prepare('DELETE FROM client_documents');
  const resultDocs = deleteDocuments.run();
  console.log(`   ✓ ${resultDocs.changes} documents supprimés\n`);

  // 3. Supprimer tous les commentaires
  console.log('🗑️  Suppression des commentaires...');
  const deleteComments = db.prepare('DELETE FROM client_comments');
  const resultComments = deleteComments.run();
  console.log(`   ✓ ${resultComments.changes} commentaires supprimés\n`);

  // 4. Supprimer tous les rendez-vous
  console.log('🗑️  Suppression des rendez-vous...');
  const deleteAppointments = db.prepare('DELETE FROM client_appointments');
  const resultAppointments = deleteAppointments.run();
  console.log(`   ✓ ${resultAppointments.changes} rendez-vous supprimés\n`);

  // 5. Supprimer tous les clients_produits
  console.log('🗑️  Suppression des produits clients...');
  const deleteProduits = db.prepare('DELETE FROM clients_produits');
  const resultProduits = deleteProduits.run();
  console.log(`   ✓ ${resultProduits.changes} produits supprimés\n`);

  // 6. Supprimer tous les client_base
  console.log('🗑️  Suppression des clients (base)...');
  const deleteClients = db.prepare('DELETE FROM client_base');
  const resultClients = deleteClients.run();
  console.log(`   ✓ ${resultClients.changes} clients supprimés\n`);

  // 7. Supprimer tous les utilisateurs sauf admin
  console.log('🗑️  Suppression des utilisateurs (sauf admin)...');
  const deleteUsers = db.prepare('DELETE FROM users WHERE role != ?');
  const resultUsers = deleteUsers.run('admin');
  console.log(`   ✓ ${resultUsers.changes} utilisateurs supprimés\n`);

  // 8. Réinitialiser les séquences auto-increment
  console.log('🔄 Réinitialisation des auto-increment...');
  db.prepare('DELETE FROM sqlite_sequence WHERE name IN (?, ?, ?, ?, ?, ?)').run(
    'client_base',
    'clients_produits',
    'client_comments',
    'client_appointments',
    'client_documents',
    'users'
  );
  console.log('   ✓ Séquences réinitialisées\n');

  // 9. Vérifier l'état final
  const finalClients = db.prepare('SELECT COUNT(*) as count FROM client_base').get();
  const finalProduits = db.prepare('SELECT COUNT(*) as count FROM clients_produits').get();
  const finalComments = db.prepare('SELECT COUNT(*) as count FROM client_comments').get();
  const finalAppointments = db.prepare('SELECT COUNT(*) as count FROM client_appointments').get();
  const finalDocuments = db.prepare('SELECT COUNT(*) as count FROM client_documents').get();
  const finalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const adminUser = db.prepare('SELECT username FROM users WHERE role = ?').get('admin');

  console.log('✅ Nettoyage terminé!\n');
  console.log('📊 État final de la base :');
  console.log(`   - Clients: ${finalClients.count}`);
  console.log(`   - Produits: ${finalProduits.count}`);
  console.log(`   - Commentaires: ${finalComments.count}`);
  console.log(`   - Rendez-vous: ${finalAppointments.count}`);
  console.log(`   - Documents: ${finalDocuments.count}`);
  console.log(`   - Utilisateurs: ${finalUsers.count} (admin: ${adminUser ? adminUser.username : 'N/A'})\n`);

  console.log('🎉 Base de données prête pour la production!');

} catch (error) {
  console.error('❌ Erreur lors du nettoyage:', error.message);
  process.exit(1);
} finally {
  db.close();
}
