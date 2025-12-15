const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database.db'));

console.log('🔄 Migration: Ajout de la colonne ville_travaux...');

try {
  // Vérifier si la colonne existe déjà
  const columns = db.prepare("PRAGMA table_info(client_base)").all();
  const villeTrExists = columns.some(col => col.name === 'ville_travaux');

  if (!villeTrExists) {
    // Ajouter la colonne ville_travaux
    db.exec(`ALTER TABLE client_base ADD COLUMN ville_travaux TEXT;`);
    console.log('✅ Colonne "ville_travaux" ajoutée à client_base');
  } else {
    console.log('ℹ️  Colonne "ville_travaux" existe déjà');
  }

  console.log('✅ Migration terminée avec succès');
} catch (error) {
  console.error('❌ Erreur migration:', error);
  process.exit(1);
}

db.close();
