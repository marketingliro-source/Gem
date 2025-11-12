const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, '../database.db'));

// Créer les tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'agent')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'nouveau' CHECK(status IN ('nouveau', 'nrp', 'a_rappeler', 'pas_interesse', 'trash')),
    assigned_to INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    assigned_to INTEGER,
    converted_from_lead_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (converted_from_lead_id) REFERENCES leads(id) ON DELETE SET NULL
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

  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_comments_lead ON comments(lead_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
  CREATE INDEX IF NOT EXISTS idx_clients_assigned ON clients(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_client_comments_client ON client_comments(client_id);
  CREATE INDEX IF NOT EXISTS idx_client_appointments_client ON client_appointments(client_id);
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

// Migration - Ajouter client_id à appointments
try {
  db.prepare('ALTER TABLE appointments ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE').run();
  console.log('✓ Colonne client_id ajoutée à la table appointments');
} catch (e) {
  // Colonne existe déjà
}

// Migration - Permettre lead_id NULL dans appointments
try {
  // SQLite ne permet pas de modifier directement une colonne, donc on vérifie juste
  const appointment = db.prepare('SELECT * FROM appointments LIMIT 1').get();
  console.log('✓ Table appointments vérifiée');
} catch (e) {
  // Table OK
}

// Migration - Ajouter colonnes de tracking aux clients
const trackingColumns = [
  { name: 'mail_sent', type: 'INTEGER DEFAULT 0' },
  { name: 'mail_sent_date', type: 'TEXT' },
  { name: 'document_received', type: 'INTEGER DEFAULT 0' },
  { name: 'document_received_date', type: 'TEXT' },
  { name: 'cancelled', type: 'INTEGER DEFAULT 0' },
  { name: 'cancelled_date', type: 'TEXT' },
  { name: 'landline_phone', type: 'TEXT' },
  { name: 'mobile_phone', type: 'TEXT' }
];

trackingColumns.forEach(col => {
  try {
    db.prepare(`ALTER TABLE clients ADD COLUMN ${col.name} ${col.type}`).run();
    console.log(`✓ Colonne ${col.name} ajoutée à la table clients`);
  } catch (e) {
    // Colonne existe déjà
  }
});

// Créer un utilisateur admin par défaut si aucun utilisateur n'existe
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
  console.log('✓ Utilisateur admin créé (username: admin, password: admin123)');
}

// Tables pour le dimensionnement de pompes à chaleur
db.exec(`
  CREATE TABLE IF NOT EXISTS temperature_base_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone TEXT NOT NULL,
    altitude_min INTEGER NOT NULL,
    altitude_max INTEGER NOT NULL,
    temperature REAL NOT NULL,
    UNIQUE(zone, altitude_min, altitude_max)
  );

  CREATE TABLE IF NOT EXISTS coefficient_g_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    typologie TEXT UNIQUE NOT NULL,
    coefficient REAL NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS dimensioning_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,

    -- Données logement
    surface_chauffee REAL NOT NULL,
    hauteur_plafond REAL NOT NULL,
    zone_climatique TEXT NOT NULL,
    altitude INTEGER NOT NULL,
    typologie TEXT NOT NULL,
    temperature_confort REAL NOT NULL,

    -- Données pompe à chaleur
    marque TEXT NOT NULL,
    reference_exterieur TEXT,
    reference_hydraulique TEXT,
    modele TEXT NOT NULL,
    puissance_nominale REAL NOT NULL,
    efficacite_saisonniere REAL,
    puissance_tbase REAL NOT NULL,
    temperature_arret REAL,
    compatibilite_emetteurs TEXT,
    regime_fonctionnement TEXT,

    -- Résultats calculs
    volume REAL NOT NULL,
    temperature_base REAL NOT NULL,
    coefficient_g REAL NOT NULL,
    delta_t REAL NOT NULL,
    deperditions REAL NOT NULL,
    taux_couverture REAL NOT NULL,

    -- PDF
    pdf_path TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_dimensioning_client ON dimensioning_notes(client_id);
  CREATE INDEX IF NOT EXISTS idx_temperature_zone ON temperature_base_data(zone, altitude_min);
  CREATE INDEX IF NOT EXISTS idx_coefficient_typologie ON coefficient_g_data(typologie);
`);

console.log('✓ Tables de dimensionnement créées');

module.exports = db;
