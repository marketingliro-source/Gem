/**
 * Migration Multi-Produits
 *
 * Cette migration transforme la structure pour permettre à un client
 * d'avoir plusieurs produits (destratification, pression, matelas_isolants)
 *
 * AVANT:
 * - Table clients avec type_produit (1 seul produit par client)
 *
 * APRÈS:
 * - Table client_base (données communes)
 * - Table clients_produits (données spécifiques par produit)
 * - Tables liées (comments, appointments, documents) pointent vers client_base_id
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database.db');
const db = new Database(dbPath);

console.log('\n========================================');
console.log('🚀 MIGRATION MULTI-PRODUITS');
console.log('========================================\n');

try {
  // Activer les FK (SQLite les désactive par défaut)
  db.pragma('foreign_keys = OFF'); // Désactiver temporairement pour migration

  console.log('📊 État AVANT migration:');
  const beforeStats = {
    clients: db.prepare('SELECT COUNT(*) as count FROM clients').get().count,
    comments: db.prepare('SELECT COUNT(*) as count FROM client_comments').get().count,
    appointments: db.prepare('SELECT COUNT(*) as count FROM client_appointments').get().count,
    documents: db.prepare('SELECT COUNT(*) as count FROM client_documents').get().count
  };
  console.log(`   - ${beforeStats.clients} clients`);
  console.log(`   - ${beforeStats.comments} commentaires`);
  console.log(`   - ${beforeStats.appointments} rendez-vous`);
  console.log(`   - ${beforeStats.documents} documents\n`);

  // ============================================
  // ÉTAPE 1: Créer table client_base
  // ============================================
  console.log('📝 Étape 1: Création de client_base...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS client_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      -- Informations Bénéficiaire
      societe TEXT,
      adresse TEXT,
      code_postal TEXT,
      telephone TEXT,
      siret TEXT,

      -- Site Travaux
      nom_site TEXT,
      adresse_travaux TEXT,
      code_postal_travaux TEXT,

      -- Contact Signataire
      nom_signataire TEXT,
      fonction TEXT,
      telephone_signataire TEXT,
      mail_signataire TEXT,

      -- Contact sur Site
      nom_contact_site TEXT,
      prenom_contact_site TEXT,
      fonction_contact_site TEXT,
      mail_contact_site TEXT,
      telephone_contact_site TEXT,

      -- Code NAF
      code_naf TEXT,

      -- Données enrichies (APIs externes)
      donnees_enrichies TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('   ✅ Table client_base créée\n');

  // ============================================
  // ÉTAPE 2: Créer table clients_produits
  // ============================================
  console.log('📝 Étape 2: Création de clients_produits...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients_produits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_base_id INTEGER NOT NULL,
      type_produit TEXT NOT NULL CHECK(type_produit IN ('destratification', 'pression', 'matelas_isolants')),
      donnees_techniques TEXT,
      statut TEXT NOT NULL DEFAULT 'nouveau',
      assigned_to INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (client_base_id) REFERENCES client_base(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id),

      -- Un client ne peut avoir le même produit qu'une seule fois
      UNIQUE(client_base_id, type_produit)
    );
  `);
  console.log('   ✅ Table clients_produits créée\n');

  // ============================================
  // ÉTAPE 3: Migrer données de clients vers client_base et clients_produits
  // ============================================
  console.log('📝 Étape 3: Migration des données...');

  const existingClients = db.prepare('SELECT * FROM clients').all();
  console.log(`   → ${existingClients.length} clients à migrer`);

  const insertBase = db.prepare(`
    INSERT INTO client_base (
      id, societe, adresse, code_postal, telephone, siret,
      nom_site, adresse_travaux, code_postal_travaux,
      nom_signataire, fonction, telephone_signataire, mail_signataire,
      nom_contact_site, prenom_contact_site, fonction_contact_site,
      mail_contact_site, telephone_contact_site,
      code_naf, donnees_enrichies, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProduit = db.prepare(`
    INSERT INTO clients_produits (
      client_base_id, type_produit, donnees_techniques,
      statut, assigned_to, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let migratedClients = 0;
  let migratedProduits = 0;

  for (const client of existingClients) {
    try {
      // Insérer dans client_base (données communes)
      insertBase.run(
        client.id,
        client.societe,
        client.adresse,
        client.code_postal,
        client.telephone,
        client.siret,
        client.nom_site,
        client.adresse_travaux,
        client.code_postal_travaux,
        client.nom_signataire,
        client.fonction,
        client.telephone_signataire,
        client.mail_signataire,
        client.nom_contact_site,
        client.prenom_contact_site,
        client.fonction_contact_site,
        client.mail_contact_site,
        client.telephone_contact_site,
        client.code_naf,
        client.donnees_enrichies,
        client.created_at,
        client.updated_at
      );
      migratedClients++;

      // Insérer dans clients_produits (données spécifiques)
      insertProduit.run(
        client.id, // client_base_id = ancien id du client
        client.type_produit,
        client.donnees_techniques,
        client.statut,
        client.assigned_to,
        client.created_at,
        client.updated_at
      );
      migratedProduits++;
    } catch (error) {
      console.error(`   ❌ Erreur migration client ${client.id}:`, error.message);
    }
  }

  console.log(`   ✅ ${migratedClients} clients migrés vers client_base`);
  console.log(`   ✅ ${migratedProduits} produits migrés vers clients_produits\n`);

  // ============================================
  // ÉTAPE 4: Créer index pour performance
  // ============================================
  console.log('📝 Étape 4: Création des index...');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_client_base_siret ON client_base(siret);
    CREATE INDEX IF NOT EXISTS idx_client_base_naf ON client_base(code_naf);
    CREATE INDEX IF NOT EXISTS idx_clients_produits_base ON clients_produits(client_base_id);
    CREATE INDEX IF NOT EXISTS idx_clients_produits_statut ON clients_produits(statut);
    CREATE INDEX IF NOT EXISTS idx_clients_produits_assigned ON clients_produits(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_clients_produits_type ON clients_produits(type_produit);
  `);
  console.log('   ✅ Index créés\n');

  // ============================================
  // ÉTAPE 5: Recréer tables liées avec client_base_id
  // ============================================
  console.log('📝 Étape 5: Migration des tables liées...');

  // 5.1 - client_comments
  console.log('   → Migration client_comments...');
  db.exec(`ALTER TABLE client_comments RENAME TO client_comments_old;`);

  db.exec(`
    CREATE TABLE client_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_base_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_base_id) REFERENCES client_base(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`
    INSERT INTO client_comments (id, client_base_id, user_id, content, created_at)
    SELECT id, client_id, user_id, content, created_at
    FROM client_comments_old;
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_client_comments_base ON client_comments(client_base_id);`);
  db.exec(`DROP TABLE client_comments_old;`);
  console.log('   ✅ client_comments migré');

  // 5.2 - client_appointments
  console.log('   → Migration client_appointments...');
  db.exec(`ALTER TABLE client_appointments RENAME TO client_appointments_old;`);

  db.exec(`
    CREATE TABLE client_appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_base_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_base_id) REFERENCES client_base(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`
    INSERT INTO client_appointments (id, client_base_id, user_id, title, date, time, created_at)
    SELECT id, client_id, user_id, title, date, time, created_at
    FROM client_appointments_old;
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_client_appointments_base ON client_appointments(client_base_id);`);
  db.exec(`DROP TABLE client_appointments_old;`);
  console.log('   ✅ client_appointments migré');

  // 5.3 - client_documents
  console.log('   → Migration client_documents...');
  db.exec(`ALTER TABLE client_documents RENAME TO client_documents_old;`);

  db.exec(`
    CREATE TABLE client_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_base_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER,
      uploaded_by INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_base_id) REFERENCES client_base(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );
  `);

  db.exec(`
    INSERT INTO client_documents (id, client_base_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at)
    SELECT id, client_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at
    FROM client_documents_old;
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_client_documents_base ON client_documents(client_base_id);`);
  db.exec(`DROP TABLE client_documents_old;`);
  console.log('   ✅ client_documents migré\n');

  // ============================================
  // ÉTAPE 6: Supprimer ancienne table clients
  // ============================================
  console.log('📝 Étape 6: Suppression de l\'ancienne table clients...');
  db.exec(`DROP TABLE clients;`);
  console.log('   ✅ Ancienne table clients supprimée\n');

  // ============================================
  // ÉTAPE 7: Vérification intégrité
  // ============================================
  console.log('📊 Vérification de l\'intégrité...');

  const afterStats = {
    client_base: db.prepare('SELECT COUNT(*) as count FROM client_base').get().count,
    clients_produits: db.prepare('SELECT COUNT(*) as count FROM clients_produits').get().count,
    comments: db.prepare('SELECT COUNT(*) as count FROM client_comments').get().count,
    appointments: db.prepare('SELECT COUNT(*) as count FROM client_appointments').get().count,
    documents: db.prepare('SELECT COUNT(*) as count FROM client_documents').get().count
  };

  console.log(`   - ${afterStats.client_base} clients de base (attendu: ${beforeStats.clients})`);
  console.log(`   - ${afterStats.clients_produits} produits (attendu: ${beforeStats.clients})`);
  console.log(`   - ${afterStats.comments} commentaires (attendu: ${beforeStats.comments})`);
  console.log(`   - ${afterStats.appointments} rendez-vous (attendu: ${beforeStats.appointments})`);
  console.log(`   - ${afterStats.documents} documents (attendu: ${beforeStats.documents})`);

  // Vérifier orphelins
  const orphans = db.prepare(`
    SELECT * FROM clients_produits
    WHERE client_base_id NOT IN (SELECT id FROM client_base)
  `).all();

  if (orphans.length > 0) {
    console.error(`\n❌ ${orphans.length} produits orphelins trouvés!`);
    throw new Error('Intégrité référentielle compromise');
  }

  // Vérifications
  const checks = {
    clientsOk: afterStats.client_base === beforeStats.clients,
    produitsOk: afterStats.clients_produits === beforeStats.clients,
    commentsOk: afterStats.comments === beforeStats.comments,
    appointmentsOk: afterStats.appointments === beforeStats.appointments,
    documentsOk: afterStats.documents === beforeStats.documents,
    noOrphans: orphans.length === 0
  };

  if (Object.values(checks).every(check => check)) {
    console.log('\n✅ Toutes les vérifications OK!');
  } else {
    console.error('\n❌ Certaines vérifications ont échoué:');
    Object.entries(checks).forEach(([key, value]) => {
      if (!value) console.error(`   - ${key}: FAIL`);
    });
    throw new Error('Migration incomplète');
  }

  // Réactiver les FK
  db.pragma('foreign_keys = ON');
  console.log('\n✅ Foreign keys réactivées');

  console.log('\n========================================');
  console.log('✅ MIGRATION RÉUSSIE!');
  console.log('========================================\n');

} catch (error) {
  console.error('\n========================================');
  console.error('❌ ERREUR MIGRATION');
  console.error('========================================');
  console.error(error);
  console.error('\n⚠️  Restaurer le backup: cp backend/database.db.backup-* backend/database.db\n');
  process.exit(1);
} finally {
  db.close();
}
