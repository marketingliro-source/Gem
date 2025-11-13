const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, '../database.db'));

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✓ Dossier uploads créé');
}

// Créer les tables
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

    -- Produit et Données Techniques (stockées en JSON)
    type_produit TEXT NOT NULL CHECK(type_produit IN ('destratification', 'pression', 'matelas_isolants')),
    donnees_techniques TEXT, -- JSON field

    -- Code NAF
    code_naf TEXT,

    -- Statut (11 étapes)
    statut TEXT NOT NULL DEFAULT 'nouveau' CHECK(statut IN (
      'nouveau', 'nrp', 'a_rappeler', 'mail_infos_envoye', 'infos_recues',
      'devis_envoye', 'devis_signe', 'pose_prevue', 'pose_terminee', 'coffrac', 'termine'
    )),

    -- Assignation
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

  CREATE INDEX IF NOT EXISTS idx_clients_statut ON clients(statut);
  CREATE INDEX IF NOT EXISTS idx_clients_assigned ON clients(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_clients_produit ON clients(type_produit);
  CREATE INDEX IF NOT EXISTS idx_clients_naf ON clients(code_naf);
  CREATE INDEX IF NOT EXISTS idx_client_comments_client ON client_comments(client_id);
  CREATE INDEX IF NOT EXISTS idx_client_appointments_client ON client_appointments(client_id);
  CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id);
`);

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

// Migration - Ajouter colonne donnees_enrichies pour stockage des données API externes
try {
  db.prepare('ALTER TABLE clients ADD COLUMN donnees_enrichies TEXT').run();
  console.log('✓ Colonne donnees_enrichies ajoutée à la table clients');
} catch (e) {
  // Colonne existe déjà
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
