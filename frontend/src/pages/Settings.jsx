import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Settings as SettingsIcon, Thermometer, Home, Save, Edit2 } from 'lucide-react';
import styles from './Settings.module.css';

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('temperature');
  const [temperatureData, setTemperatureData] = useState([]);
  const [coefficientData, setCoefficientData] = useState([]);
  const [editingTemp, setEditingTemp] = useState(null);
  const [editingCoef, setEditingCoef] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rediriger si pas admin
  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tempRes, coefRes] = await Promise.all([
        api.get('/dimensioning/temperature-data'),
        api.get('/dimensioning/coefficient-data')
      ]);
      setTemperatureData(tempRes.data);
      setCoefficientData(coefRes.data);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTemperature = async (id, newTemp) => {
    try {
      await api.put(`/dimensioning/temperature-data/${id}`, {
        temperature: newTemp
      });
      setEditingTemp(null);
      fetchData();
      alert('Température mise à jour avec succès');
    } catch (error) {
      alert('Erreur lors de la mise à jour');
    }
  };

  const handleUpdateCoefficient = async (id, newCoef, newDesc) => {
    try {
      await api.put(`/dimensioning/coefficient-data/${id}`, {
        coefficient: newCoef,
        description: newDesc
      });
      setEditingCoef(null);
      fetchData();
      alert('Coefficient mis à jour avec succès');
    } catch (error) {
      alert('Erreur lors de la mise à jour');
    }
  };

  // Grouper les températures par zone
  const groupedTemperatures = temperatureData.reduce((acc, item) => {
    if (!acc[item.zone]) {
      acc[item.zone] = [];
    }
    acc[item.zone].push(item);
    return acc;
  }, {});

  if (user?.role !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <SettingsIcon size={32} />
          Paramètres de dimensionnement
        </h1>
        <p className={styles.subtitle}>
          Gérer les données de référence pour les notes de dimensionnement
        </p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'temperature' ? styles.active : ''}`}
          onClick={() => setActiveTab('temperature')}
        >
          <Thermometer size={18} />
          Températures de base
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'coefficient' ? styles.active : ''}`}
          onClick={() => setActiveTab('coefficient')}
        >
          <Home size={18} />
          Coefficients G
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'temperature' ? (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Températures de base par zone climatique et altitude</h2>
              <span className={styles.badge}>{temperatureData.length} valeurs</span>
            </div>

            {Object.keys(groupedTemperatures).sort().map(zone => (
              <div key={zone} className={styles.zoneGroup}>
                <h3 className={styles.zoneTitle}>Zone {zone}</h3>
                <div className={styles.table}>
                  <div className={styles.tableHeader}>
                    <div>Altitude min (m)</div>
                    <div>Altitude max (m)</div>
                    <div>Température (°C)</div>
                    <div>Actions</div>
                  </div>
                  {groupedTemperatures[zone].map(item => (
                    <div key={item.id} className={styles.tableRow}>
                      <div>{item.altitude_min}</div>
                      <div>{item.altitude_max === 9999 ? '>' + item.altitude_min : item.altitude_max}</div>
                      <div>
                        {editingTemp?.id === item.id ? (
                          <input
                            type="number"
                            value={editingTemp.temperature}
                            onChange={(e) => setEditingTemp({
                              ...editingTemp,
                              temperature: parseFloat(e.target.value)
                            })}
                            className={styles.editInput}
                            step="0.1"
                          />
                        ) : (
                          <span className={styles.tempValue}>{item.temperature}°C</span>
                        )}
                      </div>
                      <div className={styles.actions}>
                        {editingTemp?.id === item.id ? (
                          <>
                            <button
                              onClick={() => handleUpdateTemperature(item.id, editingTemp.temperature)}
                              className={styles.saveBtn}
                            >
                              <Save size={16} /> Sauvegarder
                            </button>
                            <button
                              onClick={() => setEditingTemp(null)}
                              className={styles.cancelBtn}
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditingTemp(item)}
                            className={styles.editBtn}
                          >
                            <Edit2 size={16} /> Modifier
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Coefficients G par typologie de construction</h2>
              <span className={styles.badge}>{coefficientData.length} typologies</span>
            </div>

            <div className={styles.table}>
              <div className={styles.tableHeader}>
                <div>Typologie</div>
                <div>Coefficient G (W/m³·K)</div>
                <div>Description</div>
                <div>Actions</div>
              </div>
              {coefficientData.map(item => (
                <div key={item.id} className={styles.tableRow}>
                  <div className={styles.typologie}>{item.typologie}</div>
                  <div>
                    {editingCoef?.id === item.id ? (
                      <input
                        type="number"
                        value={editingCoef.coefficient}
                        onChange={(e) => setEditingCoef({
                          ...editingCoef,
                          coefficient: parseFloat(e.target.value)
                        })}
                        className={styles.editInput}
                        step="0.01"
                      />
                    ) : (
                      <span className={styles.coefValue}>{item.coefficient}</span>
                    )}
                  </div>
                  <div>
                    {editingCoef?.id === item.id ? (
                      <input
                        type="text"
                        value={editingCoef.description || ''}
                        onChange={(e) => setEditingCoef({
                          ...editingCoef,
                          description: e.target.value
                        })}
                        className={styles.editInput}
                        placeholder="Description"
                      />
                    ) : (
                      <span className={styles.description}>{item.description}</span>
                    )}
                  </div>
                  <div className={styles.actions}>
                    {editingCoef?.id === item.id ? (
                      <>
                        <button
                          onClick={() => handleUpdateCoefficient(
                            item.id,
                            editingCoef.coefficient,
                            editingCoef.description
                          )}
                          className={styles.saveBtn}
                        >
                          <Save size={16} /> Sauvegarder
                        </button>
                        <button
                          onClick={() => setEditingCoef(null)}
                          className={styles.cancelBtn}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingCoef(item)}
                        className={styles.editBtn}
                      >
                        <Edit2 size={16} /> Modifier
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
