const fs = require('fs');
const path = require('path');

/**
 * Service de gestion des codes NAF/APE
 * Lecture de la base complète des codes INSEE
 */
class NAFService {
  constructor() {
    this.nafData = null;
    this.loadNAFData();
  }

  /**
   * Charge les données NAF depuis le fichier JSON
   */
  loadNAFData() {
    try {
      const filePath = path.join(__dirname, '../data/codes-naf.json');
      const rawData = fs.readFileSync(filePath, 'utf-8');
      this.nafData = JSON.parse(rawData);
      console.log('✅ Base codes NAF chargée:', this.nafData.metadata.total_codes, 'codes');
    } catch (error) {
      console.error('❌ Erreur chargement codes NAF:', error.message);
      this.nafData = { sections: {}, categories_cee: {}, metadata: {} };
    }
  }

  /**
   * Récupère tous les codes NAF
   * @returns {Array}
   */
  getAllCodes() {
    const allCodes = [];

    if (!this.nafData || !this.nafData.sections) {
      return allCodes;
    }

    Object.entries(this.nafData.sections).forEach(([sectionCode, section]) => {
      Object.entries(section.divisions || {}).forEach(([divisionCode, division]) => {
        (division.codes || []).forEach(code => {
          allCodes.push({
            ...code,
            section: sectionCode,
            sectionLibelle: section.libelle,
            division: divisionCode,
            divisionLibelle: division.libelle
          });
        });
      });
    });

    return allCodes;
  }

  /**
   * Récupère les codes par section
   * @param {string} sectionCode - Code section (A-Z)
   * @returns {Array}
   */
  getCodesBySection(sectionCode) {
    if (!this.nafData || !this.nafData.sections[sectionCode]) {
      return [];
    }

    const section = this.nafData.sections[sectionCode];
    const codes = [];

    Object.entries(section.divisions || {}).forEach(([divisionCode, division]) => {
      (division.codes || []).forEach(code => {
        codes.push({
          ...code,
          section: sectionCode,
          sectionLibelle: section.libelle,
          division: divisionCode,
          divisionLibelle: division.libelle
        });
      });
    });

    return codes;
  }

  /**
   * Récupère les codes par division
   * @param {string} divisionCode - Code division (2 chiffres)
   * @returns {Array}
   */
  getCodesByDivision(divisionCode) {
    const allCodes = this.getAllCodes();
    return allCodes.filter(code => code.division === divisionCode);
  }

  /**
   * Recherche de codes NAF
   * @param {string} query - Requête de recherche
   * @returns {Array}
   */
  searchCodes(query) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const allCodes = this.getAllCodes();

    return allCodes.filter(code => {
      return (
        code.code.toLowerCase().includes(searchTerm) ||
        code.libelle.toLowerCase().includes(searchTerm) ||
        code.divisionLibelle.toLowerCase().includes(searchTerm)
      );
    }).slice(0, 50); // Limiter à 50 résultats
  }

  /**
   * Récupère les codes pertinents pour un type de produit CEE
   * @param {string} typeProduit - destratification | pression | matelas_isolants
   * @returns {Array}
   */
  getCodesForProduct(typeProduit) {
    if (!this.nafData || !this.nafData.categories_cee) {
      return [];
    }

    const category = this.nafData.categories_cee[typeProduit];
    if (!category) {
      return [];
    }

    const allCodes = this.getAllCodes();
    const relevantCodes = category.codes || [];

    return allCodes.filter(code => relevantCodes.includes(code.code));
  }

  /**
   * Récupère les sections principales
   * @returns {Array}
   */
  getSections() {
    if (!this.nafData || !this.nafData.sections) {
      return [];
    }

    return Object.entries(this.nafData.sections).map(([code, section]) => ({
      code,
      libelle: section.libelle,
      nombreDivisions: Object.keys(section.divisions || {}).length
    }));
  }

  /**
   * Récupère les divisions d'une section
   * @param {string} sectionCode - Code section
   * @returns {Array}
   */
  getDivisionsBySection(sectionCode) {
    if (!this.nafData || !this.nafData.sections[sectionCode]) {
      return [];
    }

    const section = this.nafData.sections[sectionCode];
    return Object.entries(section.divisions || {}).map(([code, division]) => ({
      code,
      libelle: division.libelle,
      nombreCodes: (division.codes || []).length
    }));
  }

  /**
   * Obtient les infos d'un code NAF spécifique
   * @param {string} codeNAF - Code NAF (ex: "4120B")
   * @returns {Object|null}
   */
  getCodeInfo(codeNAF) {
    const allCodes = this.getAllCodes();
    return allCodes.find(code => code.code === codeNAF) || null;
  }

  /**
   * Récupère les catégories CEE
   * @returns {Object}
   */
  getCategoriesCEE() {
    return this.nafData?.categories_cee || {};
  }

  /**
   * Statistiques sur la base NAF
   * @returns {Object}
   */
  getStats() {
    const allCodes = this.getAllCodes();

    return {
      totalCodes: allCodes.length,
      sections: this.getSections().length,
      divisions: Object.values(this.nafData?.sections || {})
        .reduce((acc, section) => acc + Object.keys(section.divisions || {}).length, 0),
      categoriesCEE: Object.keys(this.nafData?.categories_cee || {}).length,
      metadata: this.nafData?.metadata || {}
    };
  }

  /**
   * Expande un code NAF partiel en codes complets
   * Ex: "52.10" → ["52.10A", "52.10B"]
   * Ex: "86.10" → ["86.10Z"]
   * @param {string} partialCode - Code NAF partiel (ex: "52.10", "8610")
   * @returns {Array<string>} - Liste des codes NAF complets
   */
  expandPartialCode(partialCode) {
    if (!partialCode) {
      return [];
    }

    // Nettoyer le code : enlever les points et espaces
    const cleanCode = partialCode.replace(/[.\s]/g, '');

    // Si le code a déjà une lettre (code complet), le retourner tel quel
    if (/[A-Z]$/.test(cleanCode)) {
      // Reformater avec le point si nécessaire (ex: "5210A" → "52.10A")
      if (cleanCode.length === 5) {
        return [`${cleanCode.slice(0, 2)}.${cleanCode.slice(2)}`];
      }
      return [cleanCode];
    }

    // Obtenir tous les codes et filtrer ceux qui commencent par le code partiel
    const allCodes = this.getAllCodes();
    const matchingCodes = allCodes
      .filter(code => {
        const codeClean = code.code.replace(/[.\s]/g, '');
        return codeClean.startsWith(cleanCode);
      })
      .map(code => code.code);

    return matchingCodes;
  }

  /**
   * Exporte les codes NAF pour le frontend (format optimisé)
   * @param {Object} filters - Filtres optionnels
   * @returns {Array}
   */
  exportForFrontend(filters = {}) {
    let codes = this.getAllCodes();

    // Filtrer par section si spécifié
    if (filters.section) {
      codes = codes.filter(c => c.section === filters.section);
    }

    // Filtrer par division si spécifié
    if (filters.division) {
      codes = codes.filter(c => c.division === filters.division);
    }

    // Filtrer par type produit si spécifié
    if (filters.typeProduit) {
      const relevantCodes = this.getCodesForProduct(filters.typeProduit);
      const relevantCodeValues = relevantCodes.map(c => c.code);
      codes = codes.filter(c => relevantCodeValues.includes(c.code));
    }

    // Trier par code
    codes.sort((a, b) => a.code.localeCompare(b.code));

    return codes.map(code => ({
      value: code.code,
      label: `${code.code} - ${code.libelle}`,
      libelle: code.libelle,
      division: code.divisionLibelle
    }));
  }
}

module.exports = new NAFService();
