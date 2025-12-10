const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database.db'));

console.log('🔄 Migration: Ajout des colonnes location et notes à client_appointments');

try {
  // Vérifier si les colonnes existent déjà
  const tableInfo = db.prepare('PRAGMA table_info(client_appointments)').all();
  const hasLocation = tableInfo.some(col => col.name === 'location');
  const hasNotes = tableInfo.some(col => col.name === 'notes');

  console.log('\n📋 Colonnes actuelles:', tableInfo.map(c => c.name).join(', '));

  if (!hasLocation) {
    db.exec('ALTER TABLE client_appointments ADD COLUMN location TEXT');
    console.log('✅ Colonne "location" ajoutée avec succès');
  } else {
    console.log('ℹ️  Colonne "location" déjà présente - skip');
  }

  if (!hasNotes) {
    db.exec('ALTER TABLE client_appointments ADD COLUMN notes TEXT');
    console.log('✅ Colonne "notes" ajoutée avec succès');
  } else {
    console.log('ℹ️  Colonne "notes" déjà présente - skip');
  }

  // Vérifier le résultat final
  const updatedTableInfo = db.prepare('PRAGMA table_info(client_appointments)').all();
  console.log('\n📋 Colonnes après migration:', updatedTableInfo.map(c => c.name).join(', '));

  console.log('\n✅ Migration terminée avec succès!');
  console.log('   La table client_appointments dispose maintenant des colonnes location et notes.');

} catch (error) {
  console.error('\n❌ Erreur lors de la migration:', error.message);
  console.error(error);
  process.exit(1);
}

db.close();
