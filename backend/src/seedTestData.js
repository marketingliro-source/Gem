const db = require('./database');
const bcrypt = require('bcryptjs');

// Données françaises réalistes
const firstNames = [
  'Jean', 'Marie', 'Pierre', 'Sophie', 'Luc', 'Anne', 'Michel', 'Isabelle',
  'François', 'Catherine', 'Philippe', 'Nathalie', 'Jacques', 'Sylvie', 'Bernard',
  'Christine', 'Alain', 'Martine', 'André', 'Monique', 'Pascal', 'Nicole', 'René',
  'Françoise', 'Claude', 'Dominique', 'Laurent', 'Véronique', 'Daniel', 'Patricia'
];

const lastNames = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand',
  'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David',
  'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Lefevre',
  'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez'
];

const cities = [
  { name: 'Paris', postalCode: '75001', dept: '75' },
  { name: 'Lyon', postalCode: '69001', dept: '69' },
  { name: 'Marseille', postalCode: '13001', dept: '13' },
  { name: 'Toulouse', postalCode: '31000', dept: '31' },
  { name: 'Nice', postalCode: '06000', dept: '06' },
  { name: 'Nantes', postalCode: '44000', dept: '44' },
  { name: 'Strasbourg', postalCode: '67000', dept: '67' },
  { name: 'Montpellier', postalCode: '34000', dept: '34' },
  { name: 'Bordeaux', postalCode: '33000', dept: '33' },
  { name: 'Lille', postalCode: '59000', dept: '59' },
  { name: 'Rennes', postalCode: '35000', dept: '35' },
  { name: 'Reims', postalCode: '51100', dept: '51' },
  { name: 'Le Havre', postalCode: '76600', dept: '76' },
  { name: 'Saint-Étienne', postalCode: '42000', dept: '42' },
  { name: 'Toulon', postalCode: '83000', dept: '83' },
  { name: 'Grenoble', postalCode: '38000', dept: '38' },
  { name: 'Dijon', postalCode: '21000', dept: '21' },
  { name: 'Angers', postalCode: '49000', dept: '49' },
  { name: 'Nîmes', postalCode: '30000', dept: '30' },
  { name: 'Villeurbanne', postalCode: '69100', dept: '69' }
];

const streets = [
  'Rue de la République', 'Avenue des Champs', 'Boulevard Victor Hugo',
  'Rue Jean Jaurès', 'Avenue de la Liberté', 'Rue du Commerce',
  'Boulevard de la Paix', 'Rue Nationale', 'Avenue Foch', 'Rue Gambetta'
];

const leadStatuses = ['nouveau', 'nrp', 'a_rappeler', 'pas_interesse', 'trash'];

// Utilitaires
const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = (array) => array[random(0, array.length - 1)];
const randomDate = (start, end) => {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  // Préférer les jours de semaine (lundi-vendredi)
  if (date.getDay() === 0) date.setDate(date.getDate() + 1); // Dimanche -> Lundi
  if (date.getDay() === 6) date.setDate(date.getDate() + 2); // Samedi -> Lundi
  return date.toISOString();
};

const generatePhone = (type = 'mobile') => {
  const prefix = type === 'mobile' ? '06' : '01';
  return `${prefix}${random(10, 99)}${random(10, 99)}${random(10, 99)}${random(10, 99)}`;
};

const generateEmail = (firstName, lastName) => {
  const domains = ['gmail.com', 'yahoo.fr', 'hotmail.fr', 'orange.fr', 'free.fr', 'wanadoo.fr'];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${randomChoice(domains)}`;
};

async function seedTestData() {
  console.log('🌱 Début de la génération des données de test...\n');

  try {
    // 1. Créer des agents de test
    console.log('👥 Création des agents...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    const agents = [
      { username: 'Sophie Durand', password: hashedPassword, role: 'agent' },
      { username: 'Marc Lefebvre', password: hashedPassword, role: 'agent' },
      { username: 'Julie Martin', password: hashedPassword, role: 'agent' },
    ];

    const agentIds = [];
    for (const agent of agents) {
      try {
        const result = db.prepare(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)'
        ).run(agent.username, agent.password, agent.role);
        agentIds.push(result.lastInsertRowid);
        console.log(`  ✓ Agent créé: ${agent.username} (ID: ${result.lastInsertRowid})`);
      } catch (e) {
        if (e.message.includes('UNIQUE')) {
          const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(agent.username);
          agentIds.push(existing.id);
          console.log(`  ↻ Agent existant: ${agent.username} (ID: ${existing.id})`);
        } else {
          throw e;
        }
      }
    }

    // Date range: 3 derniers mois
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    // 2. Créer des leads
    console.log('\n📝 Création de 100 leads...');
    const leadIds = [];
    for (let i = 0; i < 100; i++) {
      const firstName = randomChoice(firstNames);
      const lastName = randomChoice(lastNames);
      const city = randomChoice(cities);
      const assignedTo = randomChoice(agentIds);
      const status = randomChoice(leadStatuses);
      const createdAt = randomDate(startDate, endDate);

      const result = db.prepare(`
        INSERT INTO leads (first_name, last_name, email, phone, status, assigned_to, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        firstName,
        lastName,
        generateEmail(firstName, lastName),
        generatePhone('mobile'),
        status,
        assignedTo,
        createdAt,
        createdAt
      );

      leadIds.push(result.lastInsertRowid);
      if ((i + 1) % 20 === 0) {
        console.log(`  ✓ ${i + 1}/100 leads créés...`);
      }
    }

    // 3. Créer des clients
    console.log('\n👤 Création de 50 clients...');
    for (let i = 0; i < 50; i++) {
      const firstName = randomChoice(firstNames);
      const lastName = randomChoice(lastNames);
      const city = randomChoice(cities);
      const assignedTo = randomChoice(agentIds);
      const createdAt = randomDate(startDate, endDate);

      // Progression du funnel (réaliste)
      const mailSent = Math.random() < 0.7 ? 1 : 0;
      const documentReceived = mailSent && Math.random() < 0.7 ? 1 : 0;
      const cancelled = documentReceived && Math.random() < 0.15 ? 1 : 0;

      // Dates cohérentes
      let mailSentDate = null;
      let documentReceivedDate = null;
      let cancelledDate = null;

      if (mailSent) {
        const mailDate = new Date(createdAt);
        mailDate.setDate(mailDate.getDate() + random(2, 10));
        mailSentDate = mailDate.toISOString();

        if (documentReceived) {
          const docDate = new Date(mailSentDate);
          docDate.setDate(docDate.getDate() + random(5, 20));
          documentReceivedDate = docDate.toISOString();

          if (cancelled) {
            const cancelDate = new Date(documentReceivedDate);
            cancelDate.setDate(cancelDate.getDate() + random(1, 7));
            cancelledDate = cancelDate.toISOString();
          }
        }
      }

      // Convertir un lead au hasard (30% des clients)
      const convertedFromLeadId = Math.random() < 0.3 && leadIds.length > 0
        ? randomChoice(leadIds)
        : null;

      db.prepare(`
        INSERT INTO clients (
          first_name, last_name, email, phone, landline_phone, mobile_phone,
          address, city, postal_code, assigned_to, converted_from_lead_id,
          mail_sent, mail_sent_date, document_received, document_received_date,
          cancelled, cancelled_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        firstName,
        lastName,
        generateEmail(firstName, lastName),
        generatePhone('landline'),
        generatePhone('landline'),
        generatePhone('mobile'),
        `${random(1, 200)} ${randomChoice(streets)}`,
        city.name,
        city.postalCode,
        assignedTo,
        convertedFromLeadId,
        mailSent,
        mailSentDate,
        documentReceived,
        documentReceivedDate,
        cancelled,
        cancelledDate,
        createdAt,
        createdAt
      );

      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ ${i + 1}/50 clients créés...`);
      }
    }

    // 4. Statistiques finales
    console.log('\n📊 Statistiques générées:');

    const stats = {
      agents: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = "agent"').get().count,
      leads: db.prepare('SELECT COUNT(*) as count FROM leads').get().count,
      clients: db.prepare('SELECT COUNT(*) as count FROM clients').get().count,
      mailSent: db.prepare('SELECT COUNT(*) as count FROM clients WHERE mail_sent = 1').get().count,
      docsReceived: db.prepare('SELECT COUNT(*) as count FROM clients WHERE document_received = 1').get().count,
      cancelled: db.prepare('SELECT COUNT(*) as count FROM clients WHERE cancelled = 1').get().count,
    };

    console.log(`  👥 Agents: ${stats.agents}`);
    console.log(`  📝 Leads: ${stats.leads}`);
    console.log(`  👤 Clients: ${stats.clients}`);
    console.log(`  ✉️  Courriers envoyés: ${stats.mailSent} (${(stats.mailSent / stats.clients * 100).toFixed(1)}%)`);
    console.log(`  📄 Documents reçus: ${stats.docsReceived} (${(stats.docsReceived / stats.clients * 100).toFixed(1)}%)`);
    console.log(`  ❌ Annulés: ${stats.cancelled} (${(stats.cancelled / stats.clients * 100).toFixed(1)}%)`);

    // Répartition par agent
    console.log('\n📈 Répartition par agent:');
    const agentStats = db.prepare(`
      SELECT u.username, COUNT(c.id) as clients
      FROM users u
      LEFT JOIN clients c ON u.id = c.assigned_to
      WHERE u.role = 'agent'
      GROUP BY u.id, u.username
      ORDER BY clients DESC
    `).all();

    agentStats.forEach(a => {
      console.log(`  ${a.username}: ${a.clients} clients`);
    });

    console.log('\n✅ Génération terminée avec succès!');

  } catch (error) {
    console.error('\n❌ Erreur lors de la génération:', error);
    throw error;
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedTestData };
