import React, { useState } from 'react';
import api from '../utils/api';
import { Search, Download, FileSpreadsheet, Filter, MapPin, Building2, Zap, Loader } from 'lucide-react';
import styles from './Prospection.module.css';

const Prospection = () => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);

  const [filters, setFilters] = useState({
    codeNAF: '',
    departement: '',
    region: '',
    codePostal: '',
    typeProduit: '',
    enrichPhone: false,
    limit: 100
  });

  const PRODUITS = [
    { value: '', label: 'Tous les produits' },
    { value: 'destratification', label: 'Destratification' },
    { value: 'pression', label: 'Pression' },
    { value: 'matelas_isolants', label: 'Matelas Isolants' }
  ];

  const REGIONS = [
    { value: '', label: 'Toutes les régions' },
    { value: '11', label: 'Île-de-France' },
    { value: '84', label: 'Auvergne-Rhône-Alpes' },
    { value: '93', label: 'Provence-Alpes-Côte d\'Azur' },
    { value: '75', label: 'Nouvelle-Aquitaine' },
    { value: '76', label: 'Occitanie' },
    { value: '44', label: 'Grand Est' },
    { value: '32', label: 'Hauts-de-France' },
    { value: '28', label: 'Normandie' },
    { value: '24', label: 'Centre-Val de Loire' },
    { value: '52', label: 'Pays de la Loire' },
    { value: '53', label: 'Bretagne' },
    { value: '27', label: 'Bourgogne-Franche-Comté' }
  ];

  // Codes NAF pertinents pour le BTP/CEE
  const NAF_SUGGESTIONS = [
    { code: '4120B', label: 'Construction d\'autres bâtiments' },
    { code: '4322B', label: 'Installation équipements thermiques' },
    { code: '4329A', label: 'Travaux d\'isolation' },
    { code: '4321A', label: 'Installation électrique' },
    { code: '4322A', label: 'Installation eau/gaz' },
    { code: '4120A', label: 'Construction de maisons individuelles' }
  ];

  const handleFilterChange = (name, value) => {
    setFilters({ ...filters, [name]: value });
  };

  const handleSearch = async () => {
    // Validation
    if (!filters.codeNAF && !filters.departement && !filters.region && !filters.codePostal) {
      alert('Veuillez sélectionner au moins un critère de recherche (NAF ou géographique)');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/prospection/search', filters);

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
          {/* Code NAF */}
          <div className={styles.filterGroup}>
            <label>Code NAF/APE</label>
            <select
              value={filters.codeNAF}
              onChange={(e) => handleFilterChange('codeNAF', e.target.value)}
              className={styles.select}
            >
              <option value="">Sélectionner un code NAF</option>
              {NAF_SUGGESTIONS.map(naf => (
                <option key={naf.code} value={naf.code}>
                  {naf.code} - {naf.label}
                </option>
              ))}
            </select>
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

          {/* Code Postal */}
          <div className={styles.filterGroup}>
            <label>Code Postal</label>
            <input
              type="text"
              value={filters.codePostal}
              onChange={(e) => handleFilterChange('codePostal', e.target.value)}
              placeholder="Ex: 75001"
              className={styles.input}
              maxLength={5}
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
            <h2>{totalResults} prospect(s) trouvé(s)</h2>
            <span className={styles.resultsMeta}>
              Affichage de {results.length} résultats
            </span>
          </div>

          <div className={styles.resultsGrid}>
            {results.map((prospect, index) => (
              <div key={prospect.siret || index} className={styles.prospectCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon}>
                    <Building2 size={24} />
                  </div>
                  <div className={styles.cardTitle}>
                    <h3>{prospect.denomination}</h3>
                    <span className={styles.siret}>SIRET: {prospect.siret}</span>
                  </div>
                  <div
                    className={styles.scoreBadge}
                    style={{ backgroundColor: getScoreColor(prospect.scorePertinence) }}
                  >
                    {prospect.scorePertinence || 50}
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.infoRow}>
                    <MapPin size={16} />
                    <span>
                      {prospect.adresse?.adresseComplete || 'Adresse non disponible'}
                    </span>
                  </div>

                  {prospect.codeNAF && (
                    <div className={styles.infoRow}>
                      <Building2 size={16} />
                      <span>NAF: {prospect.codeNAF}</span>
                    </div>
                  )}

                  {prospect.telephone && (
                    <div className={styles.infoRow}>
                      <Zap size={16} />
                      <span className={styles.contact}>{prospect.telephone}</span>
                    </div>
                  )}

                  {prospect.recommandations && prospect.recommandations.length > 0 && (
                    <div className={styles.recommendations}>
                      {prospect.recommandations.map((reco, i) => (
                        <span key={i} className={styles.recoBadge}>
                          {reco.produit}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <button
                    onClick={() => handleImportAsClient(prospect)}
                    className={styles.importBtn}
                  >
                    <Download size={16} />
                    Importer comme client
                  </button>
                </div>
              </div>
            ))}
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
