const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

// Données de test
const testClients = [
  // DESTRATIFICATION - Divers statuts
  {
    societe: 'Entrepôt Logistique Nord',
    adresse: '45 Rue de l\'Industrie',
    code_postal: '59000',
    telephone: '0320567890',
    siret: '85234567800012',
    nom_site: 'Entrepôt Logistique Nord',
    adresse_travaux: '45 Rue de l\'Industrie',
    code_postal_travaux: '59000',
    nom_signataire: 'Jean Dupont',
    fonction: 'Directeur',
    telephone_signataire: '0620345678',
    mail_signataire: 'j.dupont@logistique-nord.fr',
    type_produit: 'destratification',
    code_naf: '5210A',
    statut: 'nouveau',
    donnees_techniques: JSON.stringify({
      hauteur_max: 8,
      m2_hors_bureau: 2500,
      type_chauffage: 'Gaz',
      nb_niveaux: 1,
      annee_construction: 2010
    })
  },
  {
    societe: 'Gymnase Municipal de Lyon',
    adresse: '12 Avenue du Sport',
    code_postal: '69003',
    telephone: '0478123456',
    siret: '26930123400018',
    nom_site: 'Gymnase Municipal',
    adresse_travaux: '12 Avenue du Sport',
    code_postal_travaux: '69003',
    nom_signataire: 'Marie Lambert',
    fonction: 'Responsable Équipements',
    telephone_signataire: '0645123456',
    mail_signataire: 'm.lambert@lyon.fr',
    type_produit: 'destratification',
    code_naf: '9311Z',
    statut: 'mail_infos_envoye',
    donnees_techniques: JSON.stringify({
      hauteur_max: 12,
      m2_hors_bureau: 1800,
      type_chauffage: 'Électrique',
      nb_niveaux: 1,
      annee_construction: 2005
    })
  },
  {
    societe: 'Atelier Mécanique Precision',
    adresse: '78 Zone Industrielle',
    code_postal: '31000',
    telephone: '0561234567',
    siret: '42156789000023',
    nom_site: 'Atelier Principal',
    adresse_travaux: '78 Zone Industrielle',
    code_postal_travaux: '31000',
    nom_signataire: 'Pierre Martin',
    fonction: 'Gérant',
    telephone_signataire: '0634567890',
    mail_signataire: 'p.martin@precision.fr',
    type_produit: 'destratification',
    code_naf: '2562B',
    statut: 'devis_envoye',
    donnees_techniques: JSON.stringify({
      hauteur_max: 6,
      m2_hors_bureau: 1200,
      type_chauffage: 'Gaz',
      nb_niveaux: 1,
      annee_construction: 2015
    })
  },
  {
    societe: 'Centre Commercial Les Arcades',
    adresse: '5 Boulevard du Commerce',
    code_postal: '33000',
    telephone: '0556789012',
    siret: '51234567800034',
    nom_site: 'Centre Commercial',
    adresse_travaux: '5 Boulevard du Commerce',
    code_postal_travaux: '33000',
    nom_signataire: 'Sophie Durand',
    fonction: 'Directrice',
    telephone_signataire: '0678901234',
    mail_signataire: 's.durand@arcades.fr',
    type_produit: 'destratification',
    code_naf: '6820B',
    statut: 'devis_signe',
    donnees_techniques: JSON.stringify({
      hauteur_max: 10,
      m2_hors_bureau: 5000,
      type_chauffage: 'Électrique',
      nb_niveaux: 2,
      annee_construction: 2008
    })
  },
  {
    societe: 'Usine Textile du Sud',
    adresse: '156 Route Nationale',
    code_postal: '13000',
    telephone: '0491234567',
    siret: '38912345600045',
    nom_site: 'Site de Production',
    adresse_travaux: '156 Route Nationale',
    code_postal_travaux: '13000',
    nom_signataire: 'Luc Moreau',
    fonction: 'Directeur de Production',
    telephone_signataire: '0612345678',
    mail_signataire: 'l.moreau@textile-sud.fr',
    type_produit: 'destratification',
    code_naf: '1392Z',
    statut: 'pose_terminee',
    donnees_techniques: JSON.stringify({
      hauteur_max: 7,
      m2_hors_bureau: 3000,
      type_chauffage: 'Gaz',
      nb_niveaux: 1,
      annee_construction: 2012
    })
  },

  // PRESSION - Divers statuts
  {
    societe: 'Hôpital Privé Saint-Antoine',
    adresse: '25 Rue de la Santé',
    code_postal: '75014',
    telephone: '0145678901',
    siret: '77812345600056',
    nom_site: 'Hôpital Saint-Antoine',
    adresse_travaux: '25 Rue de la Santé',
    code_postal_travaux: '75014',
    nom_signataire: 'Dr. Alain Bernard',
    fonction: 'Directeur Technique',
    telephone_signataire: '0654321098',
    mail_signataire: 'a.bernard@hopital-sa.fr',
    type_produit: 'pression',
    code_naf: '8610Z',
    statut: 'nouveau',
    donnees_techniques: JSON.stringify({
      surface: 8000,
      type_chauffage: 'Gaz',
      type_installation: 'Collectif',
      consommation_actuelle: 450
    })
  },
  {
    societe: 'Résidence Seniors Les Lilas',
    adresse: '89 Avenue des Fleurs',
    code_postal: '92000',
    telephone: '0147890123',
    siret: '82345678900067',
    nom_site: 'Résidence Les Lilas',
    adresse_travaux: '89 Avenue des Fleurs',
    code_postal_travaux: '92000',
    nom_signataire: 'Christine Petit',
    fonction: 'Directrice',
    telephone_signataire: '0698765432',
    mail_signataire: 'c.petit@residence-lilas.fr',
    type_produit: 'pression',
    code_naf: '8730A',
    statut: 'a_rappeler',
    donnees_techniques: JSON.stringify({
      surface: 3500,
      type_chauffage: 'Gaz',
      type_installation: 'Collectif',
      consommation_actuelle: 280
    })
  },
  {
    societe: 'Copropriété Le Parc',
    adresse: '12 Allée des Érables',
    code_postal: '69006',
    telephone: '0478456789',
    siret: '51987654300078',
    nom_site: 'Résidence Le Parc',
    adresse_travaux: '12 Allée des Érables',
    code_postal_travaux: '69006',
    nom_signataire: 'Michel Dubois',
    fonction: 'Syndic',
    telephone_signataire: '0623456789',
    mail_signataire: 'm.dubois@syndic-parc.fr',
    type_produit: 'pression',
    code_naf: '6832A',
    statut: 'infos_recues',
    donnees_techniques: JSON.stringify({
      surface: 4200,
      type_chauffage: 'Gaz',
      type_installation: 'Collectif',
      consommation_actuelle: 320
    })
  },
  {
    societe: 'Immeuble de Bureaux Tour Horizons',
    adresse: '34 Cours Victor Hugo',
    code_postal: '33000',
    telephone: '0556123456',
    siret: '44556677800089',
    nom_site: 'Tour Horizons',
    adresse_travaux: '34 Cours Victor Hugo',
    code_postal_travaux: '33000',
    nom_signataire: 'Laurent Rousseau',
    fonction: 'Gestionnaire',
    telephone_signataire: '0687654321',
    mail_signataire: 'l.rousseau@horizons.fr',
    type_produit: 'pression',
    code_naf: '6820B',
    statut: 'pose_prevue',
    donnees_techniques: JSON.stringify({
      surface: 6500,
      type_chauffage: 'Électrique',
      type_installation: 'Collectif',
      consommation_actuelle: 380
    })
  },
  {
    societe: 'Groupe Scolaire Jean Moulin',
    adresse: '67 Rue de l\'École',
    code_postal: '44000',
    telephone: '0240567890',
    siret: '26940123400090',
    nom_site: 'Groupe Scolaire',
    adresse_travaux: '67 Rue de l\'École',
    code_postal_travaux: '44000',
    nom_signataire: 'Françoise Leroy',
    fonction: 'Directrice',
    telephone_signataire: '0645678901',
    mail_signataire: 'f.leroy@jeanmoulin.fr',
    type_produit: 'pression',
    code_naf: '8510Z',
    statut: 'termine',
    donnees_techniques: JSON.stringify({
      surface: 2800,
      type_chauffage: 'Gaz',
      type_installation: 'Collectif',
      consommation_actuelle: 250
    })
  },

  // MATELAS ISOLANTS - Divers statuts
  {
    societe: 'Restaurant Le Gourmet',
    adresse: '23 Place du Marché',
    code_postal: '06000',
    telephone: '0493123456',
    siret: '48712345600011',
    nom_site: 'Restaurant Le Gourmet',
    adresse_travaux: '23 Place du Marché',
    code_postal_travaux: '06000',
    nom_signataire: 'Jacques Fontaine',
    fonction: 'Propriétaire',
    telephone_signataire: '0612345679',
    mail_signataire: 'j.fontaine@legourmet.fr',
    type_produit: 'matelas_isolants',
    code_naf: '5610A',
    statut: 'nouveau',
    donnees_techniques: JSON.stringify({
      surface: 450,
      type_chauffage: 'Gaz',
      isolation_actuelle: {
        murs: 'Faible',
        toiture: 'Moyenne'
      },
      potentiel_economie: 35
    })
  },
  {
    societe: 'Boulangerie Artisanale Dupain',
    adresse: '89 Rue Principale',
    code_postal: '35000',
    telephone: '0299234567',
    siret: '39845678900022',
    nom_site: 'Boulangerie Dupain',
    adresse_travaux: '89 Rue Principale',
    code_postal_travaux: '35000',
    nom_signataire: 'Bernard Dupain',
    fonction: 'Gérant',
    telephone_signataire: '0656789012',
    mail_signataire: 'b.dupain@dupain.fr',
    type_produit: 'matelas_isolants',
    code_naf: '1071C',
    statut: 'nrp',
    donnees_techniques: JSON.stringify({
      surface: 280,
      type_chauffage: 'Électrique',
      isolation_actuelle: {
        murs: 'Faible',
        toiture: 'Faible'
      },
      potentiel_economie: 45
    })
  },
  {
    societe: 'Pharmacie Centrale',
    adresse: '15 Avenue de la République',
    code_postal: '67000',
    telephone: '0388345678',
    siret: '52987654300033',
    nom_site: 'Pharmacie Centrale',
    adresse_travaux: '15 Avenue de la République',
    code_postal_travaux: '67000',
    nom_signataire: 'Isabelle Mercier',
    fonction: 'Pharmacienne',
    telephone_signataire: '0698123456',
    mail_signataire: 'i.mercier@pharma-centrale.fr',
    type_produit: 'matelas_isolants',
    code_naf: '4773Z',
    statut: 'mail_infos_envoye',
    donnees_techniques: JSON.stringify({
      surface: 180,
      type_chauffage: 'Gaz',
      isolation_actuelle: {
        murs: 'Moyenne',
        toiture: 'Faible'
      },
      potentiel_economie: 30
    })
  },
  {
    societe: 'Cabinet Vétérinaire Les Animaux',
    adresse: '42 Rue des Lilas',
    code_postal: '31000',
    telephone: '0561456789',
    siret: '44123987600044',
    nom_site: 'Cabinet Vétérinaire',
    adresse_travaux: '42 Rue des Lilas',
    code_postal_travaux: '31000',
    nom_signataire: 'Dr. Vincent Leblanc',
    fonction: 'Vétérinaire',
    telephone_signataire: '0634567891',
    mail_signataire: 'v.leblanc@veterinaire-animaux.fr',
    type_produit: 'matelas_isolants',
    code_naf: '7500Z',
    statut: 'infos_recues',
    donnees_techniques: JSON.stringify({
      surface: 320,
      type_chauffage: 'Électrique',
      isolation_actuelle: {
        murs: 'Moyenne',
        toiture: 'Moyenne'
      },
      potentiel_economie: 25
    })
  },
  {
    societe: 'Garage Automobile Martin',
    adresse: '78 Route Nationale',
    code_postal: '13000',
    telephone: '0491567890',
    siret: '38845612300055',
    nom_site: 'Garage Martin',
    adresse_travaux: '78 Route Nationale',
    code_postal_travaux: '13000',
    nom_signataire: 'Thomas Martin',
    fonction: 'Gérant',
    telephone_signataire: '0678901235',
    mail_signataire: 't.martin@garage-martin.fr',
    type_produit: 'matelas_isolants',
    code_naf: '4520A',
    statut: 'devis_envoye',
    donnees_techniques: JSON.stringify({
      surface: 550,
      type_chauffage: 'Gaz',
      isolation_actuelle: {
        murs: 'Faible',
        toiture: 'Faible'
      },
      potentiel_economie: 40
    })
  },
  {
    societe: 'Salon de Coiffure Élégance',
    adresse: '34 Place de la Mairie',
    code_postal: '59000',
    telephone: '0320789012',
    siret: '51723456700066',
    nom_site: 'Salon Élégance',
    adresse_travaux: '34 Place de la Mairie',
    code_postal_travaux: '59000',
    nom_signataire: 'Émilie Bonnet',
    fonction: 'Gérante',
    telephone_signataire: '0623789012',
    mail_signataire: 'e.bonnet@elegance.fr',
    type_produit: 'matelas_isolants',
    code_naf: '9602A',
    statut: 'coffrac',
    donnees_techniques: JSON.stringify({
      surface: 120,
      type_chauffage: 'Électrique',
      isolation_actuelle: {
        murs: 'Moyenne',
        toiture: 'Bonne'
      },
      potentiel_economie: 20
    })
  }
];

console.log('🔄 Injection des données de test...\n');

let inserted = 0;
let errors = 0;

testClients.forEach((client, index) => {
  try {
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
      client.adresse,
      client.code_postal,
      client.telephone,
      client.siret,
      client.nom_site,
      client.adresse_travaux,
      client.code_postal_travaux,
      client.nom_signataire,
      client.fonction,
      client.telephone_signataire,
      client.mail_signataire,
      client.type_produit,
      client.code_naf,
      client.statut,
      client.donnees_techniques,
      1 // assigned to admin
    );

    inserted++;
    console.log(`✅ [${index + 1}/${testClients.length}] ${client.societe} (${client.type_produit} - ${client.statut})`);
  } catch (error) {
    errors++;
    console.error(`❌ Erreur pour ${client.societe}:`, error.message);
  }
});

console.log(`\n📊 Résumé:`);
console.log(`   ✅ ${inserted} clients insérés`);
console.log(`   ❌ ${errors} erreurs`);
console.log(`\n🎉 Injection terminée !`);

db.close();
