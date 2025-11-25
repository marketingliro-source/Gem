const regionsData = require('../data/regions.json');

/**
 * Utilitaires pour gérer les codes et noms de régions
 */
class RegionsUtils {
  /**
   * Convertit un nom de région en code
   * @param {string} nom - Nom de la région (ex: "Île-de-France" ou "idf")
   * @returns {string|null} Code région ou null
   */
  static nomVersCode(nom) {
    if (!nom) return null;

    // Si c'est déjà un code valide, le retourner
    if (regionsData.mapping[nom]) {
      return nom;
    }

    // Normaliser le nom (minuscules, sans accents)
    const nomNormalise = nom
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever accents
      .trim();

    // Chercher dans le mapping inverse
    return regionsData.reverse_mapping[nomNormalise] || null;
  }

  /**
   * Convertit un code région en nom
   * @param {string} code - Code région (ex: "11")
   * @returns {string|null} Nom de la région ou null
   */
  static codeVersNom(code) {
    if (!code) return null;
    return regionsData.mapping[code] || null;
  }

  /**
   * Récupère tous les départements d'une région
   * @param {string} codeRegion - Code région
   * @returns {Array<string>} Liste des codes départements
   */
  static getDepartements(codeRegion) {
    const region = regionsData.regions.find(r => r.code === codeRegion);
    return region ? region.departements : [];
  }

  /**
   * Trouve la région d'un département
   * @param {string} codeDepartement - Code département (ex: "75")
   * @returns {string|null} Code région ou null
   */
  static getRegionFromDepartement(codeDepartement) {
    const region = regionsData.regions.find(r =>
      r.departements.includes(codeDepartement)
    );
    return region ? region.code : null;
  }

  /**
   * Liste toutes les régions
   * @returns {Array} Liste des régions avec code et nom
   */
  static getAll() {
    return regionsData.regions.map(r => ({
      code: r.code,
      nom: r.nom
    }));
  }

  /**
   * Valide si un code région existe
   * @param {string} code - Code à valider
   * @returns {boolean}
   */
  static estValide(code) {
    return !!regionsData.mapping[code];
  }
}

module.exports = RegionsUtils;
