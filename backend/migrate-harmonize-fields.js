const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

console.log('🚀 Début de la migration - Harmonisation des champs leads/clients\n');

try {
  // 1. Ajouter les colonnes address et mobile_phone à la table leads
  console.log('1️⃣  Ajout de address et mobile_phone à la table leads...');

  try {
    db.exec(`ALTER TABLE leads ADD COLUMN address TEXT;`);
    console.log('   ✅ Colonne address ajoutée');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('   ⚠️  Colonne address existe déjà');
    } else {
      throw e;
    }
  }

  try {
    db.exec(`ALTER TABLE leads ADD COLUMN mobile_phone TEXT;`);
    console.log('   ✅ Colonne mobile_phone ajoutée');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('   ⚠️  Colonne mobile_phone existe déjà');
    } else {
      throw e;
    }
  }

  // 2. Migrer les données de phone vers landline_phone pour les clients
  console.log('\n2️⃣  Migration des données phone → landline_phone pour clients...');

  const clientsWithPhone = db.prepare(`
    SELECT id, phone, landline_phone
    FROM clients
    WHERE phone IS NOT NULL AND phone != '' AND (landline_phone IS NULL OR landline_phone = '')
  `).all();

  if (clientsWithPhone.length > 0) {
    const updateStmt = db.prepare(`UPDATE clients SET landline_phone = ? WHERE id = ?`);
    const updateMany = db.transaction((clients) => {
      for (const client of clients) {
        updateStmt.run(client.phone, client.id);
      }
    });

    updateMany(clientsWithPhone);
    console.log(`   ✅ ${clientsWithPhone.length} client(s) migrés`);
  } else {
    console.log('   ✅ Aucune migration nécessaire (déjà fait ou pas de données)');
  }

  // 3. Vérifier et afficher un résumé
  console.log('\n3️⃣  Résumé de la migration:\n');

  const leadsSchema = db.prepare("PRAGMA table_info(leads)").all();
  const clientsSchema = db.prepare("PRAGMA table_info(clients)").all();

  console.log('   📋 Colonnes de la table LEADS:');
  leadsSchema.forEach(col => {
    if (['first_name', 'last_name', 'email', 'phone', 'address', 'mobile_phone'].includes(col.name)) {
      console.log(`      - ${col.name}: ${col.type}`);
    }
  });

  console.log('\n   📋 Colonnes de la table CLIENTS:');
  clientsSchema.forEach(col => {
    if (['first_name', 'last_name', 'email', 'phone', 'landline_phone', 'mobile_phone', 'address', 'city', 'postal_code'].includes(col.name)) {
      console.log(`      - ${col.name}: ${col.type}`);
    }
  });

  // 4. Statistiques
  const leadsCount = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const clientsCount = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
  const leadsWithAddress = db.prepare('SELECT COUNT(*) as count FROM leads WHERE address IS NOT NULL AND address != ""').get().count;
  const leadsWithMobile = db.prepare('SELECT COUNT(*) as count FROM leads WHERE mobile_phone IS NOT NULL AND mobile_phone != ""').get().count;
  const clientsWithLandline = db.prepare('SELECT COUNT(*) as count FROM clients WHERE landline_phone IS NOT NULL AND landline_phone != ""').get().count;
  const clientsWithMobile = db.prepare('SELECT COUNT(*) as count FROM clients WHERE mobile_phone IS NOT NULL AND mobile_phone != ""').get().count;

  console.log('\n   📊 Statistiques:');
  console.log(`      - Leads total: ${leadsCount}`);
  console.log(`      - Leads avec adresse: ${leadsWithAddress}`);
  console.log(`      - Leads avec mobile: ${leadsWithMobile}`);
  console.log(`      - Clients total: ${clientsCount}`);
  console.log(`      - Clients avec fixe: ${clientsWithLandline}`);
  console.log(`      - Clients avec mobile: ${clientsWithMobile}`);

  console.log('\n✅ Migration terminée avec succès!\n');

} catch (error) {
  console.error('\n❌ Erreur lors de la migration:', error.message);
  process.exit(1);
} finally {
  db.close();
}
