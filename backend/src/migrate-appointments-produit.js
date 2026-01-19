const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database.db'));

console.log('🔄 Migration: Ajout produit_id à client_appointments...\n');

// Vérifier si la colonne existe déjà
const checkColumn = db.prepare(`
  SELECT COUNT(*) as count
  FROM pragma_table_info('client_appointments')
  WHERE name = 'produit_id'
`).get();

if (checkColumn.count > 0) {
  console.log('⚠️  La colonne produit_id existe déjà dans client_appointments');
  console.log('✅ Migration déjà appliquée, aucune action nécessaire');
  process.exit(0);
}

try {
  console.log('📊 Statistiques AVANT migration:');
  const statsBefore = db.prepare(`
    SELECT
      COUNT(*) as total_rdv,
      COUNT(DISTINCT client_base_id) as clients_avec_rdv
    FROM client_appointments
  `).get();
  console.log(`   - Total RDV: ${statsBefore.total_rdv}`);
  console.log(`   - Clients avec RDV: ${statsBefore.clients_avec_rdv}\n`);

  // 1. Ajouter la colonne produit_id
  console.log('1️⃣  Ajout de la colonne produit_id...');
  db.prepare('ALTER TABLE client_appointments ADD COLUMN produit_id INTEGER').run();
  console.log('   ✅ Colonne produit_id ajoutée\n');

  // 2. Lier les RDV existants au premier produit du client
  console.log('2️⃣  Liaison des RDV existants aux produits...');
  const updateResult = db.prepare(`
    UPDATE client_appointments
    SET produit_id = (
      SELECT cp.id
      FROM clients_produits cp
      WHERE cp.client_base_id = client_appointments.client_base_id
      ORDER BY cp.created_at ASC
      LIMIT 1
    )
    WHERE produit_id IS NULL
  `).run();
  console.log(`   ✅ ${updateResult.changes} RDV liés à des produits\n`);

  // 3. Ajouter la contrainte de clé étrangère (optionnel, pour l'intégrité)
  console.log('3️⃣  Création de l\'index sur produit_id...');
  db.prepare('CREATE INDEX IF NOT EXISTS idx_client_appointments_produit ON client_appointments(produit_id)').run();
  console.log('   ✅ Index créé\n');

  // 4. Statistiques après migration
  console.log('📊 Statistiques APRÈS migration:');
  const statsAfter = db.prepare(`
    SELECT
      COUNT(*) as total_rdv,
      COUNT(produit_id) as rdv_lies_produit,
      COUNT(*) - COUNT(produit_id) as rdv_sans_produit
    FROM client_appointments
  `).get();
  console.log(`   - Total RDV: ${statsAfter.total_rdv}`);
  console.log(`   - RDV liés à un produit: ${statsAfter.rdv_lies_produit}`);
  console.log(`   - RDV sans produit: ${statsAfter.rdv_sans_produit}`);

  if (statsAfter.rdv_sans_produit > 0) {
    console.log('\n⚠️  Attention: Certains RDV n\'ont pas pu être liés à un produit');
    console.log('   (probablement des clients sans produits dans la base)');

    const orphanRdv = db.prepare(`
      SELECT ca.id, ca.client_base_id, cb.societe
      FROM client_appointments ca
      JOIN client_base cb ON ca.client_base_id = cb.id
      WHERE ca.produit_id IS NULL
      LIMIT 5
    `).all();

    if (orphanRdv.length > 0) {
      console.log('\n   Exemples de RDV orphelins:');
      orphanRdv.forEach(rdv => {
        console.log(`   - RDV #${rdv.id} pour client #${rdv.client_base_id} (${rdv.societe || 'Sans nom'})`);
      });
    }
  }

  // 5. Vérifier l'intégrité des données
  console.log('\n5️⃣  Vérification de l\'intégrité...');
  const integrityCheck = db.prepare(`
    SELECT
      ca.id as rdv_id,
      ca.client_base_id,
      ca.produit_id,
      cp.type_produit,
      cp.statut
    FROM client_appointments ca
    LEFT JOIN clients_produits cp ON ca.produit_id = cp.id
    WHERE ca.produit_id IS NOT NULL
    LIMIT 5
  `).all();

  if (integrityCheck.length > 0) {
    console.log('   ✅ Exemples de RDV correctement liés:');
    integrityCheck.forEach(rdv => {
      console.log(`   - RDV #${rdv.rdv_id} → Produit: ${rdv.type_produit} (statut: ${rdv.statut})`);
    });
  }

  console.log('\n✅ Migration terminée avec succès!');
  console.log('\n📝 Résumé:');
  console.log('   ✓ Colonne produit_id ajoutée');
  console.log('   ✓ Index créé pour les performances');
  console.log(`   ✓ ${updateResult.changes} RDV liés automatiquement`);
  console.log('\n💡 Les nouveaux RDV seront automatiquement liés au produit sélectionné');

} catch (error) {
  console.error('❌ Erreur lors de la migration:', error.message);
  console.error('\n🔄 Rollback: Suppression de la colonne produit_id...');

  try {
    // SQLite ne supporte pas DROP COLUMN directement, on doit recréer la table
    console.log('⚠️  Impossible de faire un rollback automatique avec SQLite');
    console.log('   Si besoin, restaurez le backup: database.db.backup_avant_rdv_produit_*');
  } catch (rollbackError) {
    console.error('❌ Erreur lors du rollback:', rollbackError.message);
  }

  process.exit(1);
}

db.close();
