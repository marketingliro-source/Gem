const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

// Récupérer les télépros
const telepros = db.prepare('SELECT id FROM users WHERE role = ?').all('telepro');
const teleproIds = telepros.map(t => t.id);

console.log(`🔄 Injection de clients supplémentaires pour ${teleproIds.length} télépros...\n`);

// Données de test supplémentaires (30 clients)
const additionalClients = [
  // Plus de DESTRATIFICATION
  { societe: 'Hangar Agricole Durand', produit: 'destratification', statut: 'nouveau', naf: '0161Z' },
  { societe: 'Centre Aquatique Municipal', produit: 'destratification', statut: 'mail_infos_envoye', naf: '9311Z' },
  { societe: 'Usine Agroalimentaire Bretagne', produit: 'destratification', statut: 'infos_recues', naf: '1089Z' },
  { societe: 'Salle de Sport Premium', produit: 'destratification', statut: 'devis_envoye', naf: '9313Z' },
  { societe: 'Atelier Menuiserie Bois', produit: 'destratification', statut: 'devis_signe', naf: '1623Z' },
  { societe: 'Entrepôt Logistique Sud', produit: 'destratification', statut: 'pose_prevue', naf: '5210A' },
  { societe: 'Hangar Stockage Matériaux', produit: 'destratification', statut: 'pose_terminee', naf: '4673A' },
  { societe: 'Usine Métallurgie Moderne', produit: 'destratification', statut: 'coffrac', naf: '2420Z' },
  { societe: 'Centre de Tri Déchets', produit: 'destratification', statut: 'termine', naf: '3821Z' },
  { societe: 'Imprimerie Industrielle', produit: 'destratification', statut: 'a_rappeler', naf: '1812Z' },

  // Plus de PRESSION
  { societe: 'Résidence Étudiante Campus', produit: 'pression', statut: 'nouveau', naf: '5520Z' },
  { societe: 'Hôtel 3 Étoiles Centre Ville', produit: 'pression', statut: 'mail_infos_envoye', naf: '5510Z' },
  { societe: 'EHPAD Les Jardins', produit: 'pression', statut: 'infos_recues', naf: '8730A' },
  { societe: 'Copropriété Les Terrasses', produit: 'pression', statut: 'devis_envoye', naf: '6832A' },
  { societe: 'Immeuble Bureaux Horizon 2', produit: 'pression', statut: 'devis_signe', naf: '6820B' },
  { societe: 'Collège Jean Jaurès', produit: 'pression', statut: 'pose_prevue', naf: '8532Z' },
  { societe: 'Clinique Privée Saint-Michel', produit: 'pression', statut: 'pose_terminee', naf: '8610Z' },
  { societe: 'Résidence Seniors Les Pins', produit: 'pression', statut: 'coffrac', naf: '8730A' },
  { societe: 'Lycée Technique Industriel', produit: 'pression', statut: 'termine', naf: '8532Z' },
  { societe: 'Foyer Jeunes Travailleurs', produit: 'pression', statut: 'a_rappeler', naf: '8730A' },

  // Plus de MATELAS ISOLANTS
  { societe: 'Boucherie Charcuterie Moderne', produit: 'matelas_isolants', statut: 'nouveau', naf: '4722Z' },
  { societe: 'Café Restaurant La Place', produit: 'matelas_isolants', statut: 'mail_infos_envoye', naf: '5610A' },
  { societe: 'Salon Esthétique Beauty', produit: 'matelas_isolants', statut: 'infos_recues', naf: '9602B' },
  { societe: 'Cabinet Dentaire Centre', produit: 'matelas_isolants', statut: 'devis_envoye', naf: '8623Z' },
  { societe: 'Opticien Lunetier Précision', produit: 'matelas_isolants', statut: 'devis_signe', naf: '4778A' },
  { societe: 'Agence Immobilière Prestige', produit: 'matelas_isolants', statut: 'pose_prevue', naf: '6831Z' },
  { societe: 'Pressing Laverie Moderne', produit: 'matelas_isolants', statut: 'pose_terminee', naf: '9601B' },
  { societe: 'Fleuriste Boutique Roses', produit: 'matelas_isolants', statut: 'coffrac', naf: '4776Z' },
  { societe: 'Agence Voyage Évasion', produit: 'matelas_isolants', statut: 'termine', naf: '7911Z' },
  { societe: 'Auto École Conduite Plus', produit: 'matelas_isolants', statut: 'a_rappeler', naf: '8553Z' }
];

let inserted = 0;
let teleproIndex = 0;

additionalClients.forEach((client, index) => {
  try {
    const assignedTo = teleproIds[teleproIndex];

    // Données techniques adaptées au produit
    let donneesTechniques = {};
    if (client.produit === 'destratification') {
      donneesTechniques = {
        hauteur_max: Math.floor(Math.random() * 8) + 4,
        m2_hors_bureau: Math.floor(Math.random() * 3000) + 500,
        type_chauffage: Math.random() > 0.5 ? 'Gaz' : 'Électrique',
        nb_niveaux: Math.floor(Math.random() * 3) + 1
      };
    } else if (client.produit === 'pression') {
      donneesTechniques = {
        surface: Math.floor(Math.random() * 5000) + 1000,
        type_chauffage: 'Gaz',
        type_installation: 'Collectif',
        consommation_actuelle: Math.floor(Math.random() * 400) + 200
      };
    } else {
      donneesTechniques = {
        surface: Math.floor(Math.random() * 400) + 100,
        type_chauffage: Math.random() > 0.5 ? 'Gaz' : 'Électrique',
        isolation_actuelle: { murs: 'Moyenne', toiture: 'Faible' },
        potentiel_economie: Math.floor(Math.random() * 30) + 20
      };
    }

    const stmt = db.prepare(`
      INSERT INTO clients (
        societe, adresse, code_postal, telephone, siret,
        nom_site, adresse_travaux, code_postal_travaux,
        nom_signataire, fonction, telephone_signataire, mail_signataire,
        type_produit, code_naf, statut, donnees_techniques, assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      client.societe,
      `${Math.floor(Math.random() * 200) + 1} Rue ${['de la Gare', 'du Commerce', 'Principale', 'des Artisans', 'de l\'Industrie'][Math.floor(Math.random() * 5)]}`,
      `${Math.floor(Math.random() * 95) + 1}000`.padStart(5, '0'),
      `0${Math.floor(Math.random() * 6) + 1}${Math.floor(Math.random() * 90000000) + 10000000}`,
      `${Math.floor(Math.random() * 900000000) + 100000000}00${Math.floor(Math.random() * 1000)}`.substr(0, 14),
      client.societe,
      `${Math.floor(Math.random() * 200) + 1} Rue ${['de la Gare', 'du Commerce', 'Principale'][Math.floor(Math.random() * 3)]}`,
      `${Math.floor(Math.random() * 95) + 1}000`.padStart(5, '0'),
      `${['Jean', 'Marie', 'Pierre', 'Sophie', 'Luc'][Math.floor(Math.random() * 5)]} ${['Dupont', 'Martin', 'Bernard', 'Thomas', 'Robert'][Math.floor(Math.random() * 5)]}`,
      ['Gérant', 'Directeur', 'Responsable', 'Propriétaire'][Math.floor(Math.random() * 4)],
      `0${Math.floor(Math.random() * 2) + 6}${Math.floor(Math.random() * 90000000) + 10000000}`,
      `contact@${client.societe.toLowerCase().replace(/\s+/g, '-').replace(/[éè]/g, 'e').replace(/[àâ]/g, 'a')}.fr`,
      client.produit,
      client.naf,
      client.statut,
      JSON.stringify(donneesTechniques),
      assignedTo
    );

    inserted++;
    console.log(`✅ [${index + 1}/30] ${client.societe} (${client.produit} - ${client.statut}) → Télépro ID ${assignedTo}`);

    // Round-robin pour répartir équitablement
    teleproIndex = (teleproIndex + 1) % teleproIds.length;
  } catch (error) {
    console.error(`❌ Erreur pour ${client.societe}:`, error.message);
  }
});

// Afficher la répartition finale
console.log(`\n📊 Répartition après ajout:\n`);
const allTelepros = db.prepare('SELECT id, username FROM users WHERE role = ?').all('telepro');
allTelepros.forEach(telepro => {
  const count = db.prepare('SELECT COUNT(*) as count FROM clients WHERE assigned_to = ?').get(telepro.id);
  const byProduct = db.prepare(`
    SELECT type_produit, COUNT(*) as count
    FROM clients
    WHERE assigned_to = ?
    GROUP BY type_produit
  `).all(telepro.id);

  console.log(`${telepro.username}: ${count.count} clients`);
  byProduct.forEach(p => {
    console.log(`  - ${p.type_produit}: ${p.count}`);
  });
});

console.log(`\n✅ ${inserted} clients supplémentaires insérés`);
console.log(`🎉 Total: ${db.prepare('SELECT COUNT(*) as count FROM clients').get().count} clients`);

db.close();
