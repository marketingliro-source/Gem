import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Search, Download, FileSpreadsheet, Filter, MapPin, Building2, Zap, Loader, X } from 'lucide-react';
import styles from './Prospection.module.css';

const Prospection = () => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [nafSuggestions, setNafSuggestions] = useState([]);

  // États pour la sélection en masse
  const [selectedProspects, setSelectedProspects] = useState(new Set());
  const [importing, setImporting] = useState(false);

  // État pour la pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  // États pour l'autocomplete NAF
  const [nafAutocompleteQuery, setNafAutocompleteQuery] = useState('');
  const [nafAutocompleteSuggestions, setNafAutocompleteSuggestions] = useState([]);
  const [nafAutocompleteLoading, setNafAutocompleteLoading] = useState(false);
  const [showNafAutocomplete, setShowNafAutocomplete] = useState(false);

  const [filters, setFilters] = useState({
    codesNAF: [], // Support multi-NAF
    departement: '',
    region: '',
    typeProduit: '',
    enrichPhone: false,
    limit: 100, // 100 par défaut (aligné avec backend)
    // Critères techniques
    hauteurMin: '',
    surfaceMin: '',
    typesChauffage: [],
    classesDPE: []
  });

  const PRODUITS = [
    { value: '', label: 'Tous les produits' },
    { value: 'destratification', label: 'Destratification' },
    { value: 'pression', label: 'Pression' },
    { value: 'matelas_isolants', label: 'Matelas Isolants' }
  ];

  // Codes régions INSEE officiels (depuis 2016) - Métropole + Outre-mer
  const REGIONS = [
    { value: '', label: 'Toutes les régions' },
    // Métropole
    { value: '11', label: 'Île-de-France' },
    { value: '24', label: 'Centre-Val de Loire' },
    { value: '27', label: 'Bourgogne-Franche-Comté' },
    { value: '28', label: 'Normandie' },
    { value: '32', label: 'Hauts-de-France' },
    { value: '44', label: 'Grand Est' },
    { value: '52', label: 'Pays de la Loire' },
    { value: '53', label: 'Bretagne' },
    { value: '75', label: 'Nouvelle-Aquitaine' },
    { value: '76', label: 'Occitanie' },
    { value: '84', label: 'Auvergne-Rhône-Alpes' },
    { value: '93', label: 'Provence-Alpes-Côte d\'Azur' },
    { value: '94', label: 'Corse' },
    // Outre-mer (DOM-TOM)
    { value: '01', label: 'Guadeloupe' },
    { value: '02', label: 'Martinique' },
    { value: '03', label: 'Guyane' },
    { value: '04', label: 'La Réunion' },
    { value: '06', label: 'Mayotte' }
  ];

  const TYPES_CHAUFFAGE = [
    { value: 'collectif', label: 'Collectif' },
    { value: 'individuel', label: 'Individuel' },
    { value: 'air', label: 'Air' },
    { value: 'gaz', label: 'Gaz' },
    { value: 'fioul', label: 'Fioul' },
    { value: 'electrique', label: 'Électrique' },
    { value: 'bois', label: 'Bois' },
    { value: 'reseau_chaleur', label: 'Réseau de chaleur' }
  ];

  const CLASSES_DPE = [
    { value: 'A', label: 'A (Excellent)', color: '#00a650' },
    { value: 'B', label: 'B (Très bon)', color: '#50b948' },
    { value: 'C', label: 'C (Bon)', color: '#c7d301' },
    { value: 'D', label: 'D (Moyen)', color: '#f5e625' },
    { value: 'E', label: 'E (Passable)', color: '#fcaf17' },
    { value: 'F', label: 'F (Médiocre)', color: '#ee3124' },
    { value: 'G', label: 'G (Mauvais)', color: '#d71e20' }
  ];

  // Charger les NAF suggestions depuis le backend selon le produit
  useEffect(() => {
    const loadNafSuggestions = async () => {
      if (filters.typeProduit) {
        try {
          const response = await api.get(`/prospection/naf/relevant?typeProduit=${filters.typeProduit}`);
          setNafSuggestions(response.data.codes || []);
        } catch (error) {
          console.error('Erreur chargement NAF:', error);
          // Fallback vers suggestions par défaut
          setNafSuggestions(DEFAULT_NAF_SUGGESTIONS);
        }
      } else {
        setNafSuggestions(DEFAULT_NAF_SUGGESTIONS);
      }
    };

    loadNafSuggestions();
  }, [filters.typeProduit]);

  // Suggestions NAF par défaut (BTP générique)
  const DEFAULT_NAF_SUGGESTIONS = [
    { code: '4120B', label: 'Construction d\'autres bâtiments', pertinence: 'moyenne' },
    { code: '4322B', label: 'Installation équipements thermiques', pertinence: 'haute' },
    { code: '4329A', label: 'Travaux d\'isolation', pertinence: 'haute' },
    { code: '4321A', label: 'Installation électrique', pertinence: 'moyenne' },
    { code: '4322A', label: 'Installation eau/gaz', pertinence: 'haute' },
    { code: '4120A', label: 'Construction de maisons individuelles', pertinence: 'moyenne' }
  ];

  // Ajouter/retirer un code NAF
  const toggleNafCode = (code) => {
    if (filters.codesNAF.includes(code)) {
      // Retirer
      setFilters({
        ...filters,
        codesNAF: filters.codesNAF.filter(c => c !== code)
      });
    } else {
      // Ajouter
      setFilters({
        ...filters,
        codesNAF: [...filters.codesNAF, code]
      });
    }
  };

  // Retirer un code NAF (depuis le chip)
  const removeNafCode = (code) => {
    setFilters({
      ...filters,
      codesNAF: filters.codesNAF.filter(c => c !== code)
    });
  };

  // Recherche autocomplete NAF (recherche dans tous les 732 codes)
  const searchNafAutocomplete = async (query) => {
    if (!query || query.trim().length < 2) {
      setNafAutocompleteSuggestions([]);
      return;
    }

    setNafAutocompleteLoading(true);
    try {
      const response = await api.get(`/prospection/naf/search`, {
        params: { query: query.trim(), limit: 50 }
      });
      setNafAutocompleteSuggestions(response.data.codes || []);
      setShowNafAutocomplete(true);
    } catch (error) {
      console.error('Erreur recherche NAF:', error);
      setNafAutocompleteSuggestions([]);
    } finally {
      setNafAutocompleteLoading(false);
    }
  };

  // Effet pour déclencher la recherche avec un délai (debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nafAutocompleteQuery) {
        searchNafAutocomplete(nafAutocompleteQuery);
      } else {
        setNafAutocompleteSuggestions([]);
        setShowNafAutocomplete(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [nafAutocompleteQuery]);

  // Ajouter un code NAF depuis l'autocomplete
  const addNafCodeFromAutocomplete = (code) => {
    if (!filters.codesNAF.includes(code)) {
      setFilters({
        ...filters,
        codesNAF: [...filters.codesNAF, code]
      });
    }
    // Réinitialiser l'autocomplete
    setNafAutocompleteQuery('');
    setNafAutocompleteSuggestions([]);
    setShowNafAutocomplete(false);
  };

  // Fermer l'autocomplete quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNafAutocomplete && !event.target.closest('.nafAutocompleteWrapper')) {
        setShowNafAutocomplete(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNafAutocomplete]);

  // Toggle type chauffage
  const toggleTypeChauffage = (type) => {
    if (filters.typesChauffage.includes(type)) {
      setFilters({
        ...filters,
        typesChauffage: filters.typesChauffage.filter(t => t !== type)
      });
    } else {
      setFilters({
        ...filters,
        typesChauffage: [...filters.typesChauffage, type]
      });
    }
  };

  // Toggle classe DPE
  const toggleClasseDPE = (classe) => {
    if (filters.classesDPE.includes(classe)) {
      setFilters({
        ...filters,
        classesDPE: filters.classesDPE.filter(c => c !== classe)
      });
    } else {
      setFilters({
        ...filters,
        classesDPE: [...filters.classesDPE, classe]
      });
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters({ ...filters, [name]: value });
  };

  const handleSearch = async () => {
    // Validation
    if (filters.codesNAF.length === 0 && !filters.departement && !filters.region && !filters.codePostal) {
      alert('Veuillez sélectionner au moins un critère de recherche (NAF ou géographique)');
      return;
    }

    if (!filters.typeProduit) {
      alert('Veuillez sélectionner un type de produit CEE');
      return;
    }

    setLoading(true);
    try {
      // Préparer le payload avec codesNAF au lieu de codeNAF
      const searchPayload = {
        ...filters,
        // Si un seul NAF, envoyer aussi codeNAF pour compatibilité
        codeNAF: filters.codesNAF.length === 1 ? filters.codesNAF[0] : undefined
      };

      const response = await api.post('/prospection/search', searchPayload);

      setResults(response.data.results || []);
      setTotalResults(response.data.total || 0);

      console.log('✅ Prospection:', response.data);

    } catch (error) {
      console.error('Erreur prospection:', error);
      alert('Erreur lors de la recherche de prospects');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (results.length === 0) {
      alert('Aucun résultat à exporter');
      return;
    }

    setExporting(true);
    try {
      const response = await api.post('/prospection/export/excel', {
        results,
        criteria: filters
      }, {
        responseType: 'blob'
      });

      // Télécharger le fichier
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `prospects-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      console.log('✅ Export Excel réussi');

    } catch (error) {
      console.error('Erreur export:', error);
      alert('Erreur lors de l\'export Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleImportAsClient = async (prospect) => {
    if (!confirm(`Importer "${prospect.denomination}" comme client ?`)) return;

    try {
      const clientData = {
        societe: prospect.denomination,
        siret: prospect.siret,
        adresse: prospect.adresse?.adresseComplete || '',
        code_postal: prospect.adresse?.codePostal || '',
        telephone: prospect.telephone || '',
        code_naf: prospect.codeNAF,
        type_produit: filters.typeProduit || 'destratification',
        statut: 'nouveau',
        donnees_techniques: prospect.bdnbData ? {
          hauteur_max: prospect.bdnbData.hauteur,
          m2_hors_bureau: prospect.bdnbData.surfacePlancher
        } : {}
      };

      await api.post('/clients', clientData);
      alert(`✅ "${prospect.denomination}" ajouté aux clients`);

    } catch (error) {
      console.error('Erreur import client:', error);
      alert('Erreur lors de l\'import');
    }
  };

  // Gestion de la sélection en masse
  const toggleSelectProspect = (siret) => {
    const newSelected = new Set(selectedProspects);
    if (newSelected.has(siret)) {
      newSelected.delete(siret);
    } else {
      newSelected.add(siret);
    }
    setSelectedProspects(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProspects.size === results.length) {
      // Tout désélectionner
      setSelectedProspects(new Set());
    } else {
      // Tout sélectionner (page actuelle)
      const allSirets = new Set(results.map(p => p.siret));
      setSelectedProspects(allSirets);
    }
  };

  // Import en masse des prospects sélectionnés
  const handleBulkImport = async () => {
    if (selectedProspects.size === 0) {
      alert('Veuillez sélectionner au moins un prospect');
      return;
    }

    if (!confirm(`Importer ${selectedProspects.size} prospect(s) sélectionné(s) comme clients ?`)) {
      return;
    }

    setImporting(true);
    let importedCount = 0;
    let failedCount = 0;

    try {
      // Importer chaque prospect sélectionné
      for (const siret of selectedProspects) {
        const prospect = results.find(p => p.siret === siret);
        if (!prospect) continue;

        try {
          const clientData = {
            societe: prospect.denomination,
            siret: prospect.siret,
            adresse: prospect.adresse?.adresseComplete || '',
            code_postal: prospect.adresse?.codePostal || '',
            telephone: prospect.telephone || '',
            code_naf: prospect.codeNAF,
            type_produit: filters.typeProduit || 'destratification',
            statut: 'nouveau',
            donnees_techniques: prospect.bdnbData ? {
              hauteur_max: prospect.bdnbData.hauteur,
              m2_hors_bureau: prospect.bdnbData.surfacePlancher
            } : {}
          };

          await api.post('/clients', clientData);
          importedCount++;
        } catch (error) {
          console.error(`Erreur import ${prospect.denomination}:`, error);
          failedCount++;
        }
      }

      alert(`✅ Import terminé !\n${importedCount} prospect(s) importé(s)\n${failedCount > 0 ? `${failedCount} erreur(s)` : ''}`);

      // Réinitialiser la sélection
      setSelectedProspects(new Set());

    } catch (error) {
      console.error('Erreur import en masse:', error);
      alert('Erreur lors de l\'import en masse');
    } finally {
      setImporting(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#059669';
    if (score >= 60) return '#f59e0b';
    return '#6b7280';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Search size={32} />
            Module de Prospection
          </h1>
          <p className={styles.subtitle}>
            Recherche avancée d'entreprises par secteur et région
          </p>
        </div>
      </div>

      {/* Filtres de recherche */}
      <div className={styles.filtersCard}>
        <div className={styles.filtersHeader}>
          <Filter size={20} />
          <h2>Critères de recherche</h2>
        </div>

        <div className={styles.filtersGrid}>
          {/* Codes NAF (Multi-select) */}
          <div className={styles.filterGroup} style={{ gridColumn: '1 / -1' }}>
            <label>Codes NAF/APE (sélection multiple)</label>

            {/* Chips des codes NAF sélectionnés */}
            {filters.codesNAF.length > 0 && (
              <div className={styles.nafChips}>
                {filters.codesNAF.map(code => {
                  const nafData = nafSuggestions.find(n => n.code === code) ||
                                  DEFAULT_NAF_SUGGESTIONS.find(n => n.code === code);
                  return (
                    <span key={code} className={styles.nafChip}>
                      {code} - {nafData?.label || ''}
                      <button
                        type="button"
                        onClick={() => removeNafCode(code)}
                        className={styles.chipRemove}
                        aria-label="Retirer"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Champ de recherche autocomplete pour les codes NAF */}
            <div className={`${styles.nafSelector} nafAutocompleteWrapper`} style={{ position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={nafAutocompleteQuery}
                  onChange={(e) => setNafAutocompleteQuery(e.target.value)}
                  onFocus={() => {
                    if (nafAutocompleteSuggestions.length > 0) {
                      setShowNafAutocomplete(true);
                    }
                  }}
                  placeholder="Rechercher un code NAF (tapez au moins 2 caractères)..."
                  className={styles.input}
                  style={{ paddingRight: '40px' }}
                />
                {nafAutocompleteLoading && (
                  <div style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6b7280'
                  }}>
                    <Search size={18} className={styles.spinning} />
                  </div>
                )}
              </div>

              {/* Dropdown d'autocomplete */}
              {showNafAutocomplete && nafAutocompleteSuggestions.length > 0 && (
                <div className={styles.autocompleteDropdown}>
                  <div className={styles.autocompleteHeader}>
                    {nafAutocompleteSuggestions.length} résultat(s) trouvé(s)
                  </div>
                  {nafAutocompleteSuggestions.map(naf => (
                    <div
                      key={naf.code}
                      className={`${styles.autocompleteItem} ${filters.codesNAF.includes(naf.code) ? styles.autocompleteItemDisabled : ''}`}
                      onClick={() => {
                        if (!filters.codesNAF.includes(naf.code)) {
                          addNafCodeFromAutocomplete(naf.code);
                        }
                      }}
                    >
                      <div className={styles.autocompleteItemCode}>{naf.code}</div>
                      <div className={styles.autocompleteItemLabel}>{naf.libelle}</div>
                      <div className={styles.autocompleteItemDivision}>{naf.division}</div>
                      {filters.codesNAF.includes(naf.code) && (
                        <span className={styles.autocompleteItemBadge}>Déjà ajouté</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className={styles.nafHelp}>
                💡 Tapez au moins 2 caractères pour rechercher parmi les 732 codes NAF.
                {filters.typeProduit && ' Vous pouvez rechercher par code ou par libellé.'}
              </p>
            </div>
          </div>

          {/* Région */}
          <div className={styles.filterGroup}>
            <label>Région</label>
            <select
              value={filters.region}
              onChange={(e) => handleFilterChange('region', e.target.value)}
              className={styles.select}
            >
              {REGIONS.map(region => (
                <option key={region.value} value={region.value}>
                  {region.label}
                </option>
              ))}
            </select>
          </div>

          {/* Département */}
          <div className={styles.filterGroup}>
            <label>Département</label>
            <input
              type="text"
              value={filters.departement}
              onChange={(e) => handleFilterChange('departement', e.target.value)}
              placeholder="Ex: 75, 69, 13..."
              className={styles.input}
              maxLength={3}
            />
          </div>

          {/* Type de produit */}
          <div className={styles.filterGroup}>
            <label>Type de produit CEE</label>
            <select
              value={filters.typeProduit}
              onChange={(e) => handleFilterChange('typeProduit', e.target.value)}
              className={styles.select}
            >
              {PRODUITS.map(prod => (
                <option key={prod.value} value={prod.value}>
                  {prod.label}
                </option>
              ))}
            </select>
          </div>

          {/* Limite résultats */}
          <div className={styles.filterGroup}>
            <label>Nombre max de résultats</label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              className={styles.select}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {/* Critères techniques */}
        {filters.typeProduit && (
          <div className={styles.technicalFilters}>
            <h3 className={styles.sectionTitle}>
              <Zap size={18} />
              Critères techniques (optionnel)
            </h3>

            <div className={styles.filtersGrid}>
              {/* Hauteur minimale (Destratification) */}
              {(filters.typeProduit === 'destratification' || filters.typeProduit === '') && (
                <div className={styles.filterGroup}>
                  <label>Hauteur minimale (m)</label>
                  <input
                    type="number"
                    value={filters.hauteurMin}
                    onChange={(e) => handleFilterChange('hauteurMin', e.target.value)}
                    placeholder="Ex: 6"
                    className={styles.input}
                    min="0"
                    max="50"
                    step="0.5"
                  />
                  <span className={styles.hint}>Pour destratification (≥4m recommandé)</span>
                </div>
              )}

              {/* Surface minimale (Tous produits) */}
              <div className={styles.filterGroup}>
                <label>Surface minimale (m²)</label>
                <input
                  type="number"
                  value={filters.surfaceMin}
                  onChange={(e) => handleFilterChange('surfaceMin', e.target.value)}
                  placeholder="Ex: 500"
                  className={styles.input}
                  min="0"
                  max="50000"
                  step="100"
                />
                <span className={styles.hint}>Surface plancher du bâtiment</span>
              </div>

              {/* Types de chauffage (Destratification + Pression) */}
              {(filters.typeProduit === 'destratification' || filters.typeProduit === 'pression' || filters.typeProduit === '') && (
                <div className={styles.filterGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Types de chauffage</label>
                  <div className={styles.checkboxGrid}>
                    {TYPES_CHAUFFAGE.map(type => (
                      <label key={type.value} className={styles.checkboxItem}>
                        <input
                          type="checkbox"
                          checked={filters.typesChauffage.includes(type.value)}
                          onChange={() => toggleTypeChauffage(type.value)}
                        />
                        <span>{type.label}</span>
                      </label>
                    ))}
                  </div>
                  <span className={styles.hint}>Pour destratification (air) et pression (collectif)</span>
                </div>
              )}

              {/* Classes DPE (Matelas isolants) */}
              {(filters.typeProduit === 'matelas_isolants' || filters.typeProduit === '') && (
                <div className={styles.filterGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Classes DPE (mauvaise isolation)</label>
                  <div className={styles.dpeGrid}>
                    {CLASSES_DPE.map(classe => (
                      <label
                        key={classe.value}
                        className={`${styles.dpeItem} ${filters.classesDPE.includes(classe.value) ? styles.dpeItemSelected : ''}`}
                        style={{
                          borderColor: filters.classesDPE.includes(classe.value) ? classe.color : '#d1d5db'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={filters.classesDPE.includes(classe.value)}
                          onChange={() => toggleClasseDPE(classe.value)}
                          style={{ display: 'none' }}
                        />
                        <span
                          className={styles.dpeLabel}
                          style={{
                            backgroundColor: classe.color,
                            color: 'white'
                          }}
                        >
                          {classe.value}
                        </span>
                      </label>
                    ))}
                  </div>
                  <span className={styles.hint}>Recommandé: E, F, G pour matelas isolants</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Options avancées */}
        <div className={styles.advancedOptions}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={filters.enrichPhone}
              onChange={(e) => handleFilterChange('enrichPhone', e.target.checked)}
            />
            <span>Enrichir avec numéros de téléphone (limite: 50 premiers)</span>
          </label>

          <div className={styles.limitSelector}>
            <label>Nombre de résultats:</label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value) || 0)}
              className={styles.select}
            >
              <option value="20">20 résultats</option>
              <option value="50">50 résultats</option>
              <option value="100">100 résultats</option>
              <option value="0">Tous les résultats</option>
            </select>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className={styles.filterActions}>
          <button
            onClick={handleSearch}
            disabled={loading}
            className={styles.searchBtn}
          >
            {loading ? (
              <><Loader size={20} className={styles.spinner} /> Recherche en cours...</>
            ) : (
              <><Search size={20} /> Rechercher</>
            )}
          </button>

          {results.length > 0 && (
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className={styles.exportBtn}
            >
              {exporting ? (
                <><Loader size={20} className={styles.spinner} /> Export...</>
              ) : (
                <><FileSpreadsheet size={20} /> Exporter Excel</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Résultats */}
      {results.length > 0 && (
        <div className={styles.resultsSection}>
          <div className={styles.resultsHeader}>
            <div className={styles.resultsHeaderLeft}>
              <label className={styles.selectAllCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedProspects.size === results.length && results.length > 0}
                  onChange={toggleSelectAll}
                />
                <span>Tout sélectionner ({results.length})</span>
              </label>
              <h2>{totalResults} prospect(s) trouvé(s)</h2>
            </div>
            <div className={styles.resultsHeaderRight}>
              {selectedProspects.size > 0 && (
                <button
                  onClick={handleBulkImport}
                  disabled={importing}
                  className={styles.bulkImportBtn}
                >
                  {importing ? (
                    <>
                      <Loader size={16} className={styles.spinner} />
                      Import en cours...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Importer {selectedProspects.size} prospect(s)
                    </>
                  )}
                </button>
              )}
              <span className={styles.resultsMeta}>
                Affichage de {results.length} résultats
              </span>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedProspects.size === results.length && results.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Société</th>
                  <th>SIRET</th>
                  <th>Adresse</th>
                  <th>Code Postal</th>
                  <th>Code NAF</th>
                  <th>Téléphone</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((prospect, index) => (
                  <tr
                    key={prospect.siret || index}
                    className={selectedProspects.has(prospect.siret) ? styles.selected : ''}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedProspects.has(prospect.siret)}
                        onChange={() => toggleSelectProspect(prospect.siret)}
                      />
                    </td>
                    <td className={styles.name}>
                      <div className={styles.companyInfo}>
                        <Building2 size={16} className={styles.companyIcon} />
                        <span>{prospect.denomination || 'Non renseigné'}</span>
                      </div>
                    </td>
                    <td className={styles.siret}>{prospect.siret}</td>
                    <td className={styles.address}>
                      <div className={styles.addressInfo}>
                        <MapPin size={14} />
                        <span>{prospect.adresse?.adresseComplete || 'Non renseignée'}</span>
                      </div>
                    </td>
                    <td>{prospect.adresse?.codePostal || '-'}</td>
                    <td>{prospect.codeNAF || '-'}</td>
                    <td>{prospect.telephone || '-'}</td>
                    <td>
                      <span
                        className={styles.scoreBadgeTable}
                        style={{ backgroundColor: getScoreColor(prospect.scorePertinence) }}
                      >
                        {Math.round(prospect.scorePertinence) || 0}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleImportAsClient(prospect)}
                        className={styles.importBtnTable}
                        title="Importer comme client"
                      >
                        <Download size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Message si pas de résultats */}
      {!loading && results.length === 0 && totalResults === 0 && (
        <div className={styles.emptyState}>
          <Search size={64} />
          <h3>Aucune recherche effectuée</h3>
          <p>Configurez vos critères de recherche ci-dessus et cliquez sur "Rechercher"</p>
        </div>
      )}

    </div>
  );
};

export default Prospection;
