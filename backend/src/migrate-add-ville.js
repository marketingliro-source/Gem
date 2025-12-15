const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database.db'));

console.log('🔄 Migration: Ajout de la colonne ville...');

try {
  // Vérifier si la colonne existe déjà
  const columns = db.prepare("PRAGMA table_info(client_base)").all();
  const villeExists = columns.some(col => col.name === 'ville');

  if (!villeExists) {
    // Ajouter la colonne ville
    db.exec(`ALTER TABLE client_base ADD COLUMN ville TEXT;`);
    console.log('✅ Colonne "ville" ajoutée à client_base');
  } else {
    console.log('ℹ️  Colonne "ville" existe déjà');
  }

  // Optionnel: Extraire la ville depuis l'adresse (parsing simple)
  // Pour l'instant, on laisse vide, à remplir ultérieurement via enrichissement

  console.log('✅ Migration terminée avec succès');
} catch (error) {
  console.error('❌ Erreur migration:', error);
  process.exit(1);
}

db.close();
