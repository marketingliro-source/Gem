import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { Search, Loader, Check, Building2 } from 'lucide-react';
import styles from './SiretAutocomplete.module.css';

/**
 * Composant Autocomplete intelligent pour SIRET
 * Suggestions en temps réel + enrichissement automatique
 */
const SiretAutocomplete = ({ value, onChange, onEnrich, typeProduit, disabled }) => {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [enriching, setEnriching] = useState(false);

  const debounceTimer = useRef(null);
  const wrapperRef = useRef(null);

  // Fermer suggestions si clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Synchroniser avec valeur externe
  useEffect(() => {
    if (value !== query) {
      setQuery(value || '');
    }
  }, [value]);

  /**
   * Recherche de suggestions avec debounce
   */
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue);

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Si moins de 2 caractères, ne pas chercher
    if (newValue.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce search (300ms)
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue.trim());
    }, 300);
  };

  /**
   * Appel API pour suggestions
   */
  const fetchSuggestions = async (searchQuery) => {
    setLoading(true);
    try {
      const response = await api.get('/enrichment/suggest', {
        params: {
          q: searchQuery,
          limit: 10
        }
      });

      setSuggestions(response.data || []);
      setShowSuggestions(true);
      setSelectedIndex(-1);

    } catch (error) {
      console.error('Erreur suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sélection d'une suggestion
   */
  const handleSelectSuggestion = async (suggestion) => {
    setQuery(suggestion.siret);
    onChange(suggestion.siret);
    setShowSuggestions(false);
    setSuggestions([]);

    // Enrichir automatiquement les données
    await enrichData(suggestion.siret);
  };

  /**
   * Enrichissement automatique des données
   */
  const enrichData = async (siret) => {
    if (!siret || siret.length !== 14) {
      return;
    }

    setEnriching(true);
    try {
      const response = await api.get(`/enrichment/siret/${siret}`, {
        params: { typeProduit }
      });

      const enrichedData = response.data;

      // Appeler callback pour remplir le formulaire
      if (onEnrich) {
        onEnrich(enrichedData);
      }

      // Afficher message si enrichissement partiel
      if (enrichedData.enrichmentStatus === 'partial' && enrichedData.message) {
        alert(`ℹ️ ${enrichedData.message}\n\n${enrichedData.enrichmentWarning || ''}`);
      }

      console.log('✅ Données enrichies:', enrichedData);

    } catch (error) {
      console.error('Erreur enrichissement:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Erreur inconnue';
      alert(`⚠️ Enrichissement impossible\n\n${errorMsg}\n\nVeuillez remplir manuellement les informations.`);
    } finally {
      setEnriching(false);
    }
  };

  /**
   * Navigation clavier dans les suggestions
   */
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (query.length === 14) {
          // Si SIRET complet tapé directement
          setShowSuggestions(false);
          enrichData(query);
        }
        break;

      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;

      default:
        break;
    }
  };

  /**
   * Enrichissement manuel (bouton)
   */
  const handleManualEnrich = () => {
    if (query.length === 14) {
      enrichData(query);
    }
  };

  return (
    <div className={styles.autocompleteWrapper} ref={wrapperRef}>
      <div className={styles.inputGroup}>
        <div className={styles.inputWithIcon}>
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher par SIRET ou nom d'entreprise..."
            className={styles.input}
            disabled={disabled}
            maxLength={50}
          />

          <div className={styles.inputIcons}>
            {loading && <Loader size={18} className={styles.spinner} />}
            {!loading && query && query.length === 14 && !enriching && (
              <button
                type="button"
                onClick={handleManualEnrich}
                className={styles.enrichBtn}
                title="Enrichir les données"
              >
                <Search size={18} />
              </button>
            )}
            {enriching && <Loader size={18} className={styles.spinner} />}
          </div>
        </div>

        {query.length === 14 && (
          <span className={styles.helperText}>
            ✓ SIRET valide - Cliquez sur <Search size={12} style={{display: 'inline'}} /> pour enrichir
          </span>
        )}
      </div>

      {/* Liste de suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className={styles.suggestionsDropdown}>
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.siret}
              className={`${styles.suggestionItem} ${
                index === selectedIndex ? styles.selected : ''
              }`}
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <div className={styles.suggestionIcon}>
                <Building2 size={20} />
              </div>

              <div className={styles.suggestionContent}>
                <div className={styles.suggestionTitle}>
                  {suggestion.denomination}
                </div>
                <div className={styles.suggestionDetails}>
                  <span className={styles.siret}>SIRET: {suggestion.siret}</span>
                  {suggestion.commune && (
                    <span className={styles.location}>
                      {suggestion.codePostal} {suggestion.commune}
                    </span>
                  )}
                </div>
                {suggestion.codeNAF && (
                  <div className={styles.naf}>
                    NAF: {suggestion.codeNAF}
                  </div>
                )}
              </div>

              <div className={styles.suggestionAction}>
                <Check size={16} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message si pas de résultats */}
      {showSuggestions && !loading && suggestions.length === 0 && query.length >= 2 && (
        <div className={styles.suggestionsDropdown}>
          <div className={styles.noResults}>
            Aucune entreprise trouvée pour "{query}"
          </div>
        </div>
      )}
    </div>
  );
};

export default SiretAutocomplete;
