import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { X, Calculator, Save, FileText } from 'lucide-react';
import styles from './DimensioningModal.module.css';

const DimensioningModal = ({ client, onClose }) => {
  const [zones, setZones] = useState([]);
  const [typologies, setTypologies] = useState([]);
  const [formData, setFormData] = useState({
    // Logement
    surface_chauffee: '',
    hauteur_plafond: '2.5',
    zone_climatique: '',
    altitude: '',
    typologie: '',
    temperature_confort: '19',

    // Pompe à chaleur
    marque: '',
    reference_exterieur: '',
    reference_hydraulique: '',
    modele: '',
    puissance_nominale: '',
    efficacite_saisonniere: '',
    puissance_tbase: '',
    temperature_arret: '',
    compatibilite_emetteurs: '',
    regime_fonctionnement: ''
  });

  const [calculations, setCalculations] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchZones();
    fetchTypologies();
  }, []);

  const fetchZones = async () => {
    try {
      const response = await api.get('/dimensioning/zones');
      setZones(response.data);
    } catch (error) {
      console.error('Erreur chargement zones:', error);
    }
  };

  const fetchTypologies = async () => {
    try {
      const response = await api.get('/dimensioning/typologies');
      setTypologies(response.data);
    } catch (error) {
      console.error('Erreur chargement typologies:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post(`/dimensioning/generate/${client.id}`, formData);
      setCalculations(response.data.calculations);
      alert('Note de dimensionnement générée avec succès!');

      // Télécharger automatiquement le PDF avec authentification
      const pdfResponse = await api.get(`/dimensioning/pdf/${response.data.noteId}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([pdfResponse.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dimensionnement_${client.last_name}_${client.first_name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erreur lors de la génération: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>
              <Calculator size={24} /> Note de Dimensionnement
            </h2>
            <p className={styles.subtitle}>
              Client: {client.first_name} {client.last_name}
            </p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Section Logement */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Informations Logement</h3>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>Surface chauffée (m²) *</label>
                <input
                  type="number"
                  name="surface_chauffee"
                  value={formData.surface_chauffee}
                  onChange={handleChange}
                  required
                  min="1"
                  step="0.01"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Hauteur sous plafond (m) *</label>
                <input
                  type="number"
                  name="hauteur_plafond"
                  value={formData.hauteur_plafond}
                  onChange={handleChange}
                  required
                  min="1"
                  step="0.01"
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>Zone climatique *</label>
                <select
                  name="zone_climatique"
                  value={formData.zone_climatique}
                  onChange={handleChange}
                  required
                  className={styles.select}
                >
                  <option value="">Sélectionner...</option>
                  {zones.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Altitude (m) *</label>
                <input
                  type="number"
                  name="altitude"
                  value={formData.altitude}
                  onChange={handleChange}
                  required
                  min="0"
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Typologie de construction *</label>
              <select
                name="typologie"
                value={formData.typologie}
                onChange={handleChange}
                required
                className={styles.select}
              >
                <option value="">Sélectionner...</option>
                {typologies.map(typo => (
                  <option key={typo.typologie} value={typo.typologie}>
                    {typo.typologie} {typo.description && `- ${typo.description}`}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Température de confort (°C) *</label>
              <input
                type="number"
                name="temperature_confort"
                value={formData.temperature_confort}
                onChange={handleChange}
                required
                min="15"
                max="25"
                step="0.1"
                className={styles.input}
              />
            </div>
          </div>

          {/* Section Pompe à Chaleur */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Pompe à Chaleur</h3>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>Marque *</label>
                <input
                  type="text"
                  name="marque"
                  value={formData.marque}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Modèle *</label>
                <input
                  type="text"
                  name="modele"
                  value={formData.modele}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>Référence extérieur</label>
                <input
                  type="text"
                  name="reference_exterieur"
                  value={formData.reference_exterieur}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Référence hydraulique</label>
                <input
                  type="text"
                  name="reference_hydraulique"
                  value={formData.reference_hydraulique}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>Puissance nominale (kW) *</label>
                <input
                  type="number"
                  name="puissance_nominale"
                  value={formData.puissance_nominale}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Efficacité saisonnière ETAS (%)</label>
                <input
                  type="number"
                  name="efficacite_saisonniere"
                  value={formData.efficacite_saisonniere}
                  onChange={handleChange}
                  min="0"
                  max="200"
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>Puissance à Tbase (W) *</label>
                <input
                  type="number"
                  name="puissance_tbase"
                  value={formData.puissance_tbase}
                  onChange={handleChange}
                  required
                  min="0"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Température d'arrêt (°C)</label>
                <input
                  type="number"
                  name="temperature_arret"
                  value={formData.temperature_arret}
                  onChange={handleChange}
                  step="0.1"
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Compatibilité émetteurs</label>
              <input
                type="text"
                name="compatibilite_emetteurs"
                value={formData.compatibilite_emetteurs}
                onChange={handleChange}
                placeholder="Ex: Radiateurs, plancher chauffant..."
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Régime de fonctionnement</label>
              <input
                type="text"
                name="regime_fonctionnement"
                value={formData.regime_fonctionnement}
                onChange={handleChange}
                placeholder="Ex: 55/45°C, 35/28°C..."
                className={styles.input}
              />
            </div>
          </div>

          {/* Résultats */}
          {calculations && (
            <div className={styles.results}>
              <h3 className={styles.sectionTitle}>Résultats des calculs</h3>
              <div className={styles.resultGrid}>
                <div className={styles.resultItem}>
                  <span>Volume:</span>
                  <strong>{calculations.volume.toFixed(2)} m³</strong>
                </div>
                <div className={styles.resultItem}>
                  <span>Température de base:</span>
                  <strong>{calculations.temperatureBase}°C</strong>
                </div>
                <div className={styles.resultItem}>
                  <span>Coefficient G:</span>
                  <strong>{calculations.coefficientG} W/(m³·K)</strong>
                </div>
                <div className={styles.resultItem}>
                  <span>ΔT:</span>
                  <strong>{calculations.deltaT.toFixed(1)}°C</strong>
                </div>
                <div className={styles.resultItem}>
                  <span>Déperditions:</span>
                  <strong>{calculations.deperditions.toFixed(0)} W</strong>
                </div>
                <div className={styles.resultItem}>
                  <span>Taux de couverture:</span>
                  <strong className={calculations.tauxCouverture >= 80 && calculations.tauxCouverture <= 120 ? styles.success : styles.warning}>
                    {calculations.tauxCouverture.toFixed(1)}%
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>
              Annuler
            </button>
            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? (
                'Génération en cours...'
              ) : (
                <>
                  <FileText size={18} />
                  Générer le PDF
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DimensioningModal;
