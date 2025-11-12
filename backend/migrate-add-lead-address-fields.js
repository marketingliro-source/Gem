const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

console.log('🚀 Migration: Ajout des champs d\'adresse détaillée aux leads\n');

try {
  // Ajouter les 3 colonnes d'adresse
  const fields = [
    { name: 'country', label: 'pays' },
    { name: 'city', label: 'ville' },
    { name: 'postal_code', label: 'code postal' }
  ];

  fields.forEach((field, index) => {
    console.log(`${index + 1}️⃣  Ajout de la colonne ${field.name} (${field.label})...`);

    try {
      db.exec(`
        ALTER TABLE leads
        ADD COLUMN ${field.name} TEXT
      `);
      console.log(`   ✅ Colonne ${field.name} ajoutée`);
    } catch (e) {
      if (e.message.includes('duplicate column name')) {
        console.log(`   ⚠️  Colonne ${field.name} existe déjà`);
      } else {
        throw e;
      }
    }
  });

  // Statistiques
  console.log('\n4️⃣  Statistiques:\n');

  const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const leadsWithAddress = db.prepare('SELECT COUNT(*) as count FROM leads WHERE address IS NOT NULL AND address != ""').get().count;

  console.log(`      Total leads: ${totalLeads}`);
  console.log(`      Leads avec adresse: ${leadsWithAddress}`);

  if (totalLeads > 0) {
    const percentage = ((leadsWithAddress / totalLeads) * 100).toFixed(1);
    console.log(`      Pourcentage: ${percentage}%`);
  }

  console.log('\n✅ Migration terminée avec succès!\n');
  console.log('ℹ️  Les nouveaux champs (pays, ville, code postal) sont maintenant disponibles.\n');
  console.log('ℹ️  Vous pouvez maintenant les remplir depuis la fiche lead.\n');

} catch (error) {
  console.error('\n❌ Erreur lors de la migration:', error.message);
  process.exit(1);
} finally {
  db.close();
}
