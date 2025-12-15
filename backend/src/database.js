const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, '../database.db'));

// Activer les contraintes de clés étrangères SQLite
db.pragma('foreign_keys = ON');
console.log('✓ Clés étrangères SQLite activées');

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✓ Dossier uploads créé');
}

// Vérifier si la migration multi-produits a été effectuée
const checkTableExists = (tableName) => {
  const result = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name=?
  `).get(tableName);
  return !!result;
};

const isMigrated = checkTableExists('client_base') && checkTableExists('clients_produits');

if (isMigrated) {
  console.log('✓ Base de données migrée détectée (architecture multi-produits)');

  // Vérifier que les tables nécessaires existent
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'telepro')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS client_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      societe TEXT,
      adresse TEXT,
      ville TEXT,
      code_postal TEXT,
      telephone TEXT,
      siret TEXT,
      nom_site TEXT,
      adresse_travaux TEXT,
      code_postal_travaux TEXT,
      nom_signataire TEXT,
      fonction TEXT,
      telephone_signataire TEXT,
      mail_signataire TEXT,
      nom_contact_site TEXT,
      prenom_contact_site TEXT,
      fonction_contact_site TEXT,
      mail_contact_site TEXT,
      telephone_contact_site TEXT,
      code_naf TEXT,
      donnees_enrichies TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
      UNIQUE(client_base_id, type_produit)
    );

    CREATE TABLE IF NOT EXISTS client_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_base_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_base_id) REFERENCES client_base(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS client_appointments (
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
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS client_documents (
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

    CREATE TABLE IF NOT EXISTS statuts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      ordre INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_client_base_siret ON client_base(siret);
    CREATE INDEX IF NOT EXISTS idx_client_base_naf ON client_base(code_naf);
    CREATE INDEX IF NOT EXISTS idx_clients_produits_base ON clients_produits(client_base_id);
    CREATE INDEX IF NOT EXISTS idx_clients_produits_statut ON clients_produits(statut);
    CREATE INDEX IF NOT EXISTS idx_clients_produits_assigned ON clients_produits(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_clients_produits_type ON clients_produits(type_produit);
    CREATE INDEX IF NOT EXISTS idx_client_comments_base ON client_comments(client_base_id);
    CREATE INDEX IF NOT EXISTS idx_client_appointments_base ON client_appointments(client_base_id);
    CREATE INDEX IF NOT EXISTS idx_client_documents_base ON client_documents(client_base_id);
    CREATE INDEX IF NOT EXISTS idx_statuts_active ON statuts(active);
    CREATE INDEX IF NOT EXISTS idx_statuts_ordre ON statuts(ordre);
  `);
} else {
  console.log('✓ Base de données non migrée (architecture mono-produit)');

  // Ancien schéma pour compatibilité
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'telepro')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      societe TEXT,
      adresse TEXT,
      code_postal TEXT,
      telephone TEXT,
      siret TEXT,
      nom_site TEXT,
      adresse_travaux TEXT,
      code_postal_travaux TEXT,
      nom_signataire TEXT,
      fonction TEXT,
      telephone_signataire TEXT,
      mail_signataire TEXT,
      type_produit TEXT NOT NULL CHECK(type_produit IN ('destratification', 'pression', 'matelas_isolants')),
      donnees_techniques TEXT,
      code_naf TEXT,
      statut TEXT NOT NULL DEFAULT 'nouveau',
      assigned_to INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS client_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS client_appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS client_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER,
      uploaded_by INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS statuts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      ordre INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_clients_statut ON clients(statut);
    CREATE INDEX IF NOT EXISTS idx_clients_assigned ON clients(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_clients_produit ON clients(type_produit);
    CREATE INDEX IF NOT EXISTS idx_clients_naf ON clients(code_naf);
    CREATE INDEX IF NOT EXISTS idx_client_comments_client ON client_comments(client_id);
    CREATE INDEX IF NOT EXISTS idx_client_appointments_client ON client_appointments(client_id);
    CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id);
    CREATE INDEX IF NOT EXISTS idx_statuts_active ON statuts(active);
    CREATE INDEX IF NOT EXISTS idx_statuts_ordre ON statuts(ordre);
  `);
}

// Migrations - Ajouter colonnes IP si elles n'existent pas
try {
  db.prepare('ALTER TABLE users ADD COLUMN allowed_ip TEXT').run();
  console.log('✓ Colonne allowed_ip ajoutée à la table users');
} catch (e) {
  // Colonne existe déjà
}

try {
  db.prepare('ALTER TABLE users ADD COLUMN ip_restriction_enabled INTEGER DEFAULT 0').run();
  console.log('✓ Colonne ip_restriction_enabled ajoutée à la table users');
} catch (e) {
  // Colonne existe déjà
}

// Migrations pour l'ancienne table clients (uniquement si non migré)
if (!isMigrated) {
  try {
    db.prepare('ALTER TABLE clients ADD COLUMN donnees_enrichies TEXT').run();
    console.log('✓ Colonne donnees_enrichies ajoutée à la table clients');
  } catch (e) {
    // Colonne existe déjà
  }

  try {
    db.prepare('ALTER TABLE clients ADD COLUMN nom_contact_site TEXT').run();
    console.log('✓ Colonne nom_contact_site ajoutée');
  } catch (e) {}

  try {
    db.prepare('ALTER TABLE clients ADD COLUMN prenom_contact_site TEXT').run();
    console.log('✓ Colonne prenom_contact_site ajoutée');
  } catch (e) {}

  try {
    db.prepare('ALTER TABLE clients ADD COLUMN fonction_contact_site TEXT').run();
    console.log('✓ Colonne fonction_contact_site ajoutée');
  } catch (e) {}

  try {
    db.prepare('ALTER TABLE clients ADD COLUMN mail_contact_site TEXT').run();
    console.log('✓ Colonne mail_contact_site ajoutée');
  } catch (e) {}

  try {
    db.prepare('ALTER TABLE clients ADD COLUMN telephone_contact_site TEXT').run();
    console.log('✓ Colonne telephone_contact_site ajoutée');
  } catch (e) {}
}

// Migration - Insérer les statuts par défaut
const statutCount = db.prepare('SELECT COUNT(*) as count FROM statuts').get();
if (statutCount.count === 0) {
  const defaultStatuts = [
    { key: 'nouveau', label: 'Nouveau', color: '#3b82f6', ordre: 1 },
    { key: 'a_rappeler', label: 'À rappeler', color: '#f59e0b', ordre: 2 },
    { key: 'mail_infos_envoye', label: 'Mail infos envoyé', color: '#8b5cf6', ordre: 3 },
    { key: 'infos_recues', label: 'Infos reçues', color: '#06b6d4', ordre: 4 },
    { key: 'devis_envoye', label: 'Devis envoyé', color: '#10b981', ordre: 5 },
    { key: 'devis_signe', label: 'Devis signé', color: '#14b8a6', ordre: 6 },
    { key: 'pose_prevue', label: 'Pose prévue', color: '#6366f1', ordre: 7 },
    { key: 'pose_terminee', label: 'Pose terminée', color: '#8b5cf6', ordre: 8 },
    { key: 'coffrac', label: 'Coffrac', color: '#84cc16', ordre: 9 },
    { key: 'termine', label: 'Terminé', color: '#059669', ordre: 10 }
  ];

  const insertStatut = db.prepare(`
    INSERT INTO statuts (key, label, color, ordre, active)
    VALUES (?, ?, ?, ?, 1)
  `);

  for (const statut of defaultStatuts) {
    insertStatut.run(statut.key, statut.label, statut.color, statut.ordre);
  }

  console.log('✓ Statuts par défaut insérés (10 statuts)');
}

// Créer un utilisateur admin par défaut si aucun utilisateur n'existe
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
  console.log('✓ Utilisateur admin créé (username: admin, password: admin123)');
}

console.log('✓ Base de données Gem Isolation initialisée');

module.exports = db;
