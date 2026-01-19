const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database.db'));

console.log('🔄 Migration: Ajout colonne assigned_at à clients_produits...\n');

// Vérifier si la colonne existe déjà
const checkColumn = db.prepare(`
  SELECT COUNT(*) as count
  FROM pragma_table_info('clients_produits')
  WHERE name = 'assigned_at'
`).get();

if (checkColumn.count > 0) {
  console.log('⚠️  La colonne assigned_at existe déjà dans clients_produits');
  process.exit(0);
}

try {
  // Ajouter la colonne assigned_at
  db.prepare('ALTER TABLE clients_produits ADD COLUMN assigned_at DATETIME').run();
  console.log('✅ Colonne assigned_at ajoutée à la table clients_produits');

  // Mettre à jour les données existantes :
  // Si assigned_to n'est pas NULL, définir assigned_at = updated_at
  const updateResult = db.prepare(`
    UPDATE clients_produits
    SET assigned_at = updated_at
    WHERE assigned_to IS NOT NULL AND assigned_at IS NULL
  `).run();

  console.log(`✅ ${updateResult.changes} lignes mises à jour avec assigned_at = updated_at`);

  // Créer un index sur assigned_at pour optimiser les requêtes
  db.prepare('CREATE INDEX IF NOT EXISTS idx_clients_produits_assigned_at ON clients_produits(assigned_at)').run();
  console.log('✅ Index créé sur assigned_at');

  // Statistiques
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(assigned_to) as assigned_count,
      COUNT(assigned_at) as assigned_at_count
    FROM clients_produits
  `).get();

  console.log('\n📊 Statistiques clients_produits:');
  console.log(`   Total produits: ${stats.total}`);
  console.log(`   Produits assignés: ${stats.assigned_count}`);
  console.log(`   Avec date d'attribution: ${stats.assigned_at_count}`);

  console.log('\n✅ Migration terminée avec succès!');
} catch (error) {
  console.error('❌ Erreur lors de la migration:', error.message);
  process.exit(1);
}

db.close();
