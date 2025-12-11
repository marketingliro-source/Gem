const Database = require('better-sqlite3');
const path = require('path');

console.log('🔧 Migration des contraintes de clés étrangères...\n');

const db = new Database(path.join(__dirname, '../database.db'));
db.pragma('foreign_keys = OFF'); // Désactiver temporairement pour la migration

try {
  // Vérifier si on est en architecture multi-produits
  const checkTable = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='clients_produits'
  `).get();

  if (!checkTable) {
    console.log('❌ Architecture multi-produits non détectée');
    console.log('ℹ️  Veuillez d\'abord exécuter la migration multi-produits');
    process.exit(1);
  }

  console.log('✓ Architecture multi-produits détectée\n');

  // 1. Recréer clients_produits avec ON DELETE SET NULL pour assigned_to
  console.log('🔄 Migration de clients_produits...');

  db.exec(`
    BEGIN TRANSACTION;

    -- Créer nouvelle table avec contraintes correctes
    CREATE TABLE clients_produits_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_base_id INTEGER NOT NULL,
      type_produit TEXT NOT NULL CHECK(type_produit IN ('destratification', 'pression', 'matelas_isolants')),
      donnees_techniques TEXT,
      statut TEXT NOT NULL DEFAULT 'nouveau',
      assigned_to INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_base_id) REFERENCES client_base(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(client_base_id, type_produit)
    );

    -- Copier toutes les données
    INSERT INTO clients_produits_new
    SELECT * FROM clients_produits;

    -- Supprimer l'ancienne table
    DROP TABLE clients_produits;

    -- Renommer la nouvelle table
    ALTER TABLE clients_produits_new RENAME TO clients_produits;

    -- Recréer les index
    CREATE INDEX idx_clients_produits_base ON clients_produits(client_base_id);
    CREATE INDEX idx_clients_produits_statut ON clients_produits(statut);
    CREATE INDEX idx_clients_produits_assigned ON clients_produits(assigned_to);
    CREATE INDEX idx_clients_produits_type ON clients_produits(type_produit);

    COMMIT;
  `);

  console.log('✓ clients_produits migrée (assigned_to -> ON DELETE SET NULL)\n');

  // 2. Recréer client_comments avec ON DELETE CASCADE
  console.log('🔄 Migration de client_comments...');

  db.exec(`
    BEGIN TRANSACTION;

    CREATE TABLE client_comments_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_base_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_base_id) REFERENCES client_base(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    INSERT INTO client_comments_new
    SELECT * FROM client_comments;

    DROP TABLE client_comments;

    ALTER TABLE client_comments_new RENAME TO client_comments;

    CREATE INDEX idx_client_comments_base ON client_comments(client_base_id);

    COMMIT;
  `);

  console.log('✓ client_comments migrée (user_id -> ON DELETE CASCADE)\n');

  // 3. Recréer client_appointments avec ON DELETE CASCADE
  console.log('🔄 Migration de client_appointments...');

  db.exec(`
    BEGIN TRANSACTION;

    CREATE TABLE client_appointments_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_base_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      location TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_base_id) REFERENCES client_base(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    INSERT INTO client_appointments_new
    SELECT * FROM client_appointments;

    DROP TABLE client_appointments;

    ALTER TABLE client_appointments_new RENAME TO client_appointments;

    CREATE INDEX idx_client_appointments_base ON client_appointments(client_base_id);

    COMMIT;
  `);

  console.log('✓ client_appointments migrée (user_id -> ON DELETE CASCADE)\n');

  // 4. Recréer client_documents avec ON DELETE SET NULL pour uploaded_by
  console.log('🔄 Migration de client_documents...');

  db.exec(`
    BEGIN TRANSACTION;

    CREATE TABLE client_documents_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_base_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER,
      uploaded_by INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_base_id) REFERENCES client_base(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    INSERT INTO client_documents_new
    SELECT * FROM client_documents;

    DROP TABLE client_documents;

    ALTER TABLE client_documents_new RENAME TO client_documents;

    CREATE INDEX idx_client_documents_base ON client_documents(client_base_id);

    COMMIT;
  `);

  console.log('✓ client_documents migrée (uploaded_by -> ON DELETE SET NULL)\n');

  // Réactiver les clés étrangères
  db.pragma('foreign_keys = ON');

  // Vérifier l'intégrité
  console.log('🔍 Vérification de l\'intégrité...');
  const integrity = db.pragma('integrity_check');
  if (integrity[0].integrity_check === 'ok') {
    console.log('✓ Intégrité de la base de données OK\n');
  } else {
    console.log('⚠️  Problèmes d\'intégrité détectés:', integrity);
  }

  // Afficher les statistiques
  console.log('📊 Statistiques:');
  const stats = {
    clients_produits: db.prepare('SELECT COUNT(*) as count FROM clients_produits').get().count,
    client_comments: db.prepare('SELECT COUNT(*) as count FROM client_comments').get().count,
    client_appointments: db.prepare('SELECT COUNT(*) as count FROM client_appointments').get().count,
    client_documents: db.prepare('SELECT COUNT(*) as count FROM client_documents').get().count
  };

  console.log(`  - ${stats.clients_produits} clients_produits migrés`);
  console.log(`  - ${stats.client_comments} commentaires migrés`);
  console.log(`  - ${stats.client_appointments} rendez-vous migrés`);
  console.log(`  - ${stats.client_documents} documents migrés`);

  console.log('\n✅ Migration terminée avec succès!\n');
  console.log('Comportements après migration:');
  console.log('  - Suppression utilisateur → clients désassignés (assigned_to = NULL)');
  console.log('  - Suppression utilisateur → commentaires supprimés');
  console.log('  - Suppression utilisateur → rendez-vous supprimés');
  console.log('  - Suppression utilisateur → documents conservés (uploaded_by = NULL)');

} catch (error) {
  console.error('❌ Erreur lors de la migration:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
