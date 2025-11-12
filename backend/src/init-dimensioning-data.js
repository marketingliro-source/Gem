const db = require('./database');

console.log('📊 Initialisation des données de dimensionnement...\n');

// Vérifier si les données existent déjà
const tempCount = db.prepare('SELECT COUNT(*) as count FROM temperature_base_data').get();
const coefCount = db.prepare('SELECT COUNT(*) as count FROM coefficient_g_data').get();

if (tempCount.count > 0 && coefCount.count > 0) {
  console.log('✓ Données déjà initialisées');
  process.exit(0);
}

// 1. Températures de base par zone et altitude
const temperaturesData = [
  // Zone A
  { zone: 'A', altitude_min: 0, altitude_max: 200, temperature: -2 },
  { zone: 'A', altitude_min: 201, altitude_max: 400, temperature: -4 },
  { zone: 'A', altitude_min: 401, altitude_max: 500, temperature: -5 },
  { zone: 'A', altitude_min: 501, altitude_max: 600, temperature: -6 },
  { zone: 'A', altitude_min: 601, altitude_max: 700, temperature: -7 },
  { zone: 'A', altitude_min: 701, altitude_max: 800, temperature: -8 },
  { zone: 'A', altitude_min: 801, altitude_max: 900, temperature: -9 },
  { zone: 'A', altitude_min: 901, altitude_max: 1000, temperature: -10 },
  { zone: 'A', altitude_min: 1001, altitude_max: 1200, temperature: -12 },
  { zone: 'A', altitude_min: 1201, altitude_max: 1400, temperature: -14 },
  { zone: 'A', altitude_min: 1401, altitude_max: 9999, temperature: -16 },

  // Zone B
  { zone: 'B', altitude_min: 0, altitude_max: 200, temperature: -4 },
  { zone: 'B', altitude_min: 201, altitude_max: 400, temperature: -5 },
  { zone: 'B', altitude_min: 401, altitude_max: 500, temperature: -6 },
  { zone: 'B', altitude_min: 501, altitude_max: 600, temperature: -7 },
  { zone: 'B', altitude_min: 601, altitude_max: 700, temperature: -8 },
  { zone: 'B', altitude_min: 701, altitude_max: 800, temperature: -9 },
  { zone: 'B', altitude_min: 801, altitude_max: 900, temperature: -10 },
  { zone: 'B', altitude_min: 901, altitude_max: 1000, temperature: -11 },
  { zone: 'B', altitude_min: 1001, altitude_max: 1200, temperature: -13 },
  { zone: 'B', altitude_min: 1201, altitude_max: 1400, temperature: -15 },
  { zone: 'B', altitude_min: 1401, altitude_max: 9999, temperature: -17 },

  // Zone C
  { zone: 'C', altitude_min: 0, altitude_max: 200, temperature: -5 },
  { zone: 'C', altitude_min: 201, altitude_max: 400, temperature: -6 },
  { zone: 'C', altitude_min: 401, altitude_max: 500, temperature: -7 },
  { zone: 'C', altitude_min: 501, altitude_max: 600, temperature: -8 },
  { zone: 'C', altitude_min: 601, altitude_max: 700, temperature: -9 },
  { zone: 'C', altitude_min: 701, altitude_max: 800, temperature: -10 },
  { zone: 'C', altitude_min: 801, altitude_max: 900, temperature: -11 },
  { zone: 'C', altitude_min: 901, altitude_max: 1000, temperature: -12 },
  { zone: 'C', altitude_min: 1001, altitude_max: 1200, temperature: -14 },
  { zone: 'C', altitude_min: 1201, altitude_max: 1400, temperature: -16 },
  { zone: 'C', altitude_min: 1401, altitude_max: 9999, temperature: -18 },

  // Zone D
  { zone: 'D', altitude_min: 0, altitude_max: 200, temperature: -7 },
  { zone: 'D', altitude_min: 201, altitude_max: 400, temperature: -8 },
  { zone: 'D', altitude_min: 401, altitude_max: 500, temperature: -9 },
  { zone: 'D', altitude_min: 501, altitude_max: 600, temperature: -10 },
  { zone: 'D', altitude_min: 601, altitude_max: 700, temperature: -11 },
  { zone: 'D', altitude_min: 701, altitude_max: 800, temperature: -12 },
  { zone: 'D', altitude_min: 801, altitude_max: 900, temperature: -13 },
  { zone: 'D', altitude_min: 901, altitude_max: 1000, temperature: -14 },
  { zone: 'D', altitude_min: 1001, altitude_max: 1200, temperature: -16 },
  { zone: 'D', altitude_min: 1201, altitude_max: 1400, temperature: -18 },
  { zone: 'D', altitude_min: 1401, altitude_max: 9999, temperature: -20 },

  // Zone E
  { zone: 'E', altitude_min: 0, altitude_max: 200, temperature: -9 },
  { zone: 'E', altitude_min: 201, altitude_max: 400, temperature: -10 },
  { zone: 'E', altitude_min: 401, altitude_max: 500, temperature: -11 },
  { zone: 'E', altitude_min: 501, altitude_max: 600, temperature: -12 },
  { zone: 'E', altitude_min: 601, altitude_max: 700, temperature: -13 },
  { zone: 'E', altitude_min: 701, altitude_max: 800, temperature: -14 },
  { zone: 'E', altitude_min: 801, altitude_max: 900, temperature: -15 },
  { zone: 'E', altitude_min: 901, altitude_max: 1000, temperature: -16 },
  { zone: 'E', altitude_min: 1001, altitude_max: 1200, temperature: -18 },
  { zone: 'E', altitude_min: 1201, altitude_max: 1400, temperature: -20 },
  { zone: 'E', altitude_min: 1401, altitude_max: 9999, temperature: -22 },

  // Zone F
  { zone: 'F', altitude_min: 0, altitude_max: 200, temperature: -10 },
  { zone: 'F', altitude_min: 201, altitude_max: 400, temperature: -11 },
  { zone: 'F', altitude_min: 401, altitude_max: 500, temperature: -12 },
  { zone: 'F', altitude_min: 501, altitude_max: 600, temperature: -13 },
  { zone: 'F', altitude_min: 601, altitude_max: 700, temperature: -14 },
  { zone: 'F', altitude_min: 701, altitude_max: 800, temperature: -15 },
  { zone: 'F', altitude_min: 801, altitude_max: 900, temperature: -16 },
  { zone: 'F', altitude_min: 901, altitude_max: 1000, temperature: -17 },
  { zone: 'F', altitude_min: 1001, altitude_max: 1200, temperature: -19 },
  { zone: 'F', altitude_min: 1201, altitude_max: 1400, temperature: -21 },
  { zone: 'F', altitude_min: 1401, altitude_max: 9999, temperature: -23 },

  // Zone G
  { zone: 'G', altitude_min: 0, altitude_max: 200, temperature: -12 },
  { zone: 'G', altitude_min: 201, altitude_max: 400, temperature: -13 },
  { zone: 'G', altitude_min: 401, altitude_max: 500, temperature: -14 },
  { zone: 'G', altitude_min: 501, altitude_max: 600, temperature: -15 },
  { zone: 'G', altitude_min: 601, altitude_max: 700, temperature: -16 },
  { zone: 'G', altitude_min: 701, altitude_max: 800, temperature: -17 },
  { zone: 'G', altitude_min: 801, altitude_max: 900, temperature: -18 },
  { zone: 'G', altitude_min: 901, altitude_max: 1000, temperature: -19 },
  { zone: 'G', altitude_min: 1001, altitude_max: 1200, temperature: -21 },
  { zone: 'G', altitude_min: 1201, altitude_max: 1400, temperature: -23 },
  { zone: 'G', altitude_min: 1401, altitude_max: 9999, temperature: -25 },

  // Zone H
  { zone: 'H', altitude_min: 0, altitude_max: 200, temperature: -15 },
  { zone: 'H', altitude_min: 201, altitude_max: 400, temperature: -16 },
  { zone: 'H', altitude_min: 401, altitude_max: 500, temperature: -17 },
  { zone: 'H', altitude_min: 501, altitude_max: 600, temperature: -18 },
  { zone: 'H', altitude_min: 601, altitude_max: 700, temperature: -19 },
  { zone: 'H', altitude_min: 701, altitude_max: 800, temperature: -20 },
  { zone: 'H', altitude_min: 801, altitude_max: 900, temperature: -21 },
  { zone: 'H', altitude_min: 901, altitude_max: 1000, temperature: -22 },
  { zone: 'H', altitude_min: 1001, altitude_max: 1200, temperature: -24 },
  { zone: 'H', altitude_min: 1201, altitude_max: 1400, temperature: -26 },
  { zone: 'H', altitude_min: 1401, altitude_max: 9999, temperature: -28 },

  // Zone I
  { zone: 'I', altitude_min: 0, altitude_max: 200, temperature: -17 },
  { zone: 'I', altitude_min: 201, altitude_max: 400, temperature: -18 },
  { zone: 'I', altitude_min: 401, altitude_max: 500, temperature: -19 },
  { zone: 'I', altitude_min: 501, altitude_max: 600, temperature: -20 },
  { zone: 'I', altitude_min: 601, altitude_max: 700, temperature: -21 },
  { zone: 'I', altitude_min: 701, altitude_max: 800, temperature: -22 },
  { zone: 'I', altitude_min: 801, altitude_max: 900, temperature: -23 },
  { zone: 'I', altitude_min: 901, altitude_max: 1000, temperature: -24 },
  { zone: 'I', altitude_min: 1001, altitude_max: 1200, temperature: -26 },
  { zone: 'I', altitude_min: 1201, altitude_max: 1400, temperature: -28 },
  { zone: 'I', altitude_min: 1401, altitude_max: 9999, temperature: -29 }
];

// 2. Coefficients G par typologie de construction
const coefficientsData = [
  { typologie: 'RT 2012', coefficient: 0.3, description: 'Réglementation Thermique 2012' },
  { typologie: 'RT 2005', coefficient: 0.36, description: 'Réglementation Thermique 2005' },
  { typologie: 'RT 2000', coefficient: 0.45, description: 'Réglementation Thermique 2000' },
  { typologie: 'Maison Passive', coefficient: 0.6, description: 'Maison passive' },
  { typologie: 'Maison des années 1990-2000', coefficient: 0.8, description: 'Construction années 1990-2000' },
  { typologie: 'Maison des années 1980-1990', coefficient: 1, description: 'Construction années 1980-1990' },
  { typologie: 'Maison des années 1970-1980', coefficient: 1.1, description: 'Construction années 1970-1980' },
  { typologie: 'Maison des années 1960-1970', coefficient: 1.3, description: 'Construction années 1960-1970' },
  { typologie: 'Maison des années 1950-1960', coefficient: 1.4, description: 'Construction années 1950-1960' },
  { typologie: 'Maison des années 1940-1950', coefficient: 1.6, description: 'Construction années 1940-1950' },
  { typologie: 'Maison des années 1930-1940', coefficient: 1.8, description: 'Construction années 1930-1940' },
  { typologie: 'Maison avant 1930', coefficient: 2, description: 'Construction avant 1930' },
  { typologie: 'Maison en Pierre', coefficient: 1.8, description: 'Maison en pierre' },
  { typologie: 'Maison avec 6 cm de LDV', coefficient: 0.85, description: 'Maison avec 6 cm de laine de verre' },
  { typologie: 'Maison avec 10 cm de LDV', coefficient: 0.65, description: 'Maison avec 10 cm de laine de verre' },
  { typologie: 'Maison avec 20 cm de LDV', coefficient: 0.5, description: 'Maison avec 20 cm de laine de verre' },
  { typologie: 'Maison avec 30 cm de LDV', coefficient: 0.4, description: 'Maison avec 30 cm de laine de verre' },
  { typologie: 'Mobil-Home sans RT', coefficient: 2.2, description: 'Mobil-home sans réglementation' },
  { typologie: 'Mobil-Home avec RT', coefficient: 1.6, description: 'Mobil-home avec réglementation' },
  { typologie: 'Appartement', coefficient: 1.1, description: 'Appartement standard' },
  { typologie: 'Véranda', coefficient: 2.8, description: 'Véranda' }
];

// Insertion des températures de base
const insertTemp = db.prepare('INSERT INTO temperature_base_data (zone, altitude_min, altitude_max, temperature) VALUES (?, ?, ?, ?)');
const insertManyTemp = db.transaction((temps) => {
  for (const temp of temps) {
    insertTemp.run(temp.zone, temp.altitude_min, temp.altitude_max, temp.temperature);
  }
});

try {
  insertManyTemp(temperaturesData);
  console.log(`✓ ${temperaturesData.length} températures de base insérées`);
} catch (error) {
  console.error('Erreur insertion températures:', error.message);
}

// Insertion des coefficients G
const insertCoef = db.prepare('INSERT INTO coefficient_g_data (typologie, coefficient, description) VALUES (?, ?, ?)');
const insertManyCoef = db.transaction((coefs) => {
  for (const coef of coefs) {
    insertCoef.run(coef.typologie, coef.coefficient, coef.description);
  }
});

try {
  insertManyCoef(coefficientsData);
  console.log(`✓ ${coefficientsData.length} coefficients G insérés`);
} catch (error) {
  console.error('Erreur insertion coefficients:', error.message);
}

console.log('\n✅ Initialisation terminée avec succès!');
