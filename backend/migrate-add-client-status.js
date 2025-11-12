const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

console.log('🚀 Migration: Ajout du champ status aux clients\n');

try {
  // 1. Ajouter la colonne status
  console.log('1️⃣  Ajout de la colonne status...');

  try {
    db.exec(`
      ALTER TABLE clients
      ADD COLUMN status TEXT DEFAULT 'nouveau'
      CHECK(status IN ('nouveau', 'mail_envoye', 'documents_recus', 'annule'))
    `);
    console.log('   ✅ Colonne status ajoutée');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('   ⚠️  Colonne status existe déjà');
    } else {
      throw e;
    }
  }

  // 2. Mettre à jour les statuts existants selon les checkboxes
  console.log('\n2️⃣  Mise à jour des statuts existants...');

  const updateStmt = db.prepare(`
    UPDATE clients
    SET status = CASE
      WHEN cancelled = 1 THEN 'annule'
      WHEN document_received = 1 THEN 'documents_recus'
      WHEN mail_sent = 1 THEN 'mail_envoye'
      ELSE 'nouveau'
    END
    WHERE status IS NULL OR status = 'nouveau'
  `);

  const result = updateStmt.run();
  console.log(`   ✅ ${result.changes} clients mis à jour`);

  // 3. Statistiques
  console.log('\n3️⃣  Statistiques des statuts:\n');

  const stats = db.prepare(`
    SELECT
      status,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM clients), 1) as percentage
    FROM clients
    GROUP BY status
    ORDER BY count DESC
  `).all();

  const statusLabels = {
    'nouveau': 'Nouveaux clients',
    'mail_envoye': 'Mail envoyé',
    'documents_recus': 'Documents reçus',
    'annule': 'Annulés'
  };

  stats.forEach(stat => {
    const label = statusLabels[stat.status] || stat.status;
    console.log(`      ${label}: ${stat.count} (${stat.percentage}%)`);
  });

  const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
  console.log(`\n      Total: ${totalClients} clients`);

  console.log('\n✅ Migration terminée avec succès!\n');
  console.log('ℹ️  Le statut se mettra automatiquement à jour quand vous cochez les checkboxes.\n');

} catch (error) {
  console.error('\n❌ Erreur lors de la migration:', error.message);
  process.exit(1);
} finally {
  db.close();
}
