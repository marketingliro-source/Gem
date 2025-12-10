import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Plus, Edit2, Eye, EyeOff, Save, X } from 'lucide-react';
import styles from './Clients.module.css';

const Settings = () => {
  const [statuts, setStatuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ label: '', color: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStatut, setNewStatut] = useState({ key: '', label: '', color: '#3b82f6' });

  useEffect(() => {
    fetchStatuts();
  }, []);

  const fetchStatuts = async () => {
    try {
      const response = await api.get('/statuts');
      setStatuts(response.data);
    } catch (error) {
      console.error('Erreur chargement statuts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await api.patch(`/statuts/${id}/toggle`);
      fetchStatuts();
    } catch (error) {
      alert('Erreur lors du changement de statut');
    }
  };

  const handleStartEdit = (statut) => {
    setEditingId(statut.id);
    setEditForm({
      label: statut.label,
      color: statut.color
    });
  };

  const handleSaveEdit = async (id) => {
    try {
      await api.patch(`/statuts/${id}`, editForm);
      setEditingId(null);
      fetchStatuts();
    } catch (error) {
      alert('Erreur lors de la modification');
    }
  };

  const handleAddStatut = async () => {
    if (!newStatut.key || !newStatut.label) {
      alert('Clé et label requis');
      return;
    }

    try {
      await api.post('/statuts', newStatut);
      setShowAddForm(false);
      setNewStatut({ key: '', label: '', color: '#3b82f6' });
      fetchStatuts();
    } catch (error) {
      alert(error.response?.data?.error || 'Erreur lors de la création');
    }
  };

  if (loading) {
    return <div className={styles.loading}>Chargement...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Paramètres</h1>
          <p className={styles.subtitle}>
            Gérer les statuts du CRM (réservé aux administrateurs)
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className={styles.addBtn}
        >
          <Plus size={20} /> Nouveau statut
        </button>
      </div>

      {showAddForm && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h3 style={{ marginBottom: '16px' }}>Ajouter un nouveau statut</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 150px', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>
                Clé (unique) *
              </label>
              <input
                type="text"
                value={newStatut.key}
                onChange={(e) => setNewStatut({ ...newStatut, key: e.target.value })}
                placeholder="ex: en_attente"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>
                Label *
              </label>
              <input
                type="text"
                value={newStatut.label}
                onChange={(e) => setNewStatut({ ...newStatut, label: e.target.value })}
                placeholder="ex: En attente"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>
                Couleur
              </label>
              <input
                type="color"
                value={newStatut.color}
                onChange={(e) => setNewStatut({ ...newStatut, color: e.target.value })}
                style={{
                  width: '100%',
                  height: '42px',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowAddForm(false)}
              className={styles.iconBtn}
              style={{ padding: '10px 20px', fontSize: '14px' }}
            >
              <X size={16} /> Annuler
            </button>
            <button
              onClick={handleAddStatut}
              className={styles.addBtn}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                textTransform: 'none',
                letterSpacing: 'normal'
              }}
            >
              <Save size={16} /> Créer le statut
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Clé</th>
              <th>Label</th>
              <th style={{ width: '150px' }}>Couleur</th>
              <th style={{ width: '100px' }}>Statut</th>
              <th style={{ width: '150px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {statuts.map((statut, index) => (
              <tr key={statut.id}>
                <td>{index + 1}</td>
                <td>
                  <code style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'monospace'
                  }}>
                    {statut.key}
                  </code>
                </td>
                <td>
                  {editingId === statut.id ? (
                    <input
                      type="text"
                      value={editForm.label}
                      onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '6px',
                        color: '#fff'
                      }}
                    />
                  ) : (
                    statut.label
                  )}
                </td>
                <td>
                  {editingId === statut.id ? (
                    <input
                      type="color"
                      value={editForm.color}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                      style={{
                        width: '100%',
                        height: '38px',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          background: statut.color,
                          border: '2px solid rgba(255,255,255,0.1)'
                        }}
                      />
                      <code style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {statut.color}
                      </code>
                    </div>
                  )}
                </td>
                <td>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: statut.active === 1 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                    color: statut.active === 1 ? '#10b981' : '#94a3b8'
                  }}>
                    {statut.active === 1 ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {editingId === statut.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(statut.id)}
                          className={styles.btnSecondary}
                          title="Enregistrer"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className={styles.iconBtn}
                          style={{ padding: '8px 16px' }}
                          title="Annuler"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(statut)}
                          className={styles.btnSecondary}
                          title="Modifier"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(statut.id)}
                          className={statut.active === 1 ? styles.btnWarning : styles.btnSecondary}
                          title={statut.active === 1 ? 'Désactiver' : 'Activer'}
                        >
                          {statut.active === 1 ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#94a3b8'
      }}>
        <strong style={{ color: '#3b82f6' }}>💡 Info:</strong>
        <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
          <li>Les statuts inactifs ne sont pas visibles par les télépros</li>
          <li>Les statuts inactifs restent associés aux clients existants</li>
          <li>La clé ne peut pas être modifiée après création</li>
          <li>L'ordre des statuts peut être modifié ultérieurement</li>
        </ul>
      </div>
    </div>
  );
};

export default Settings;
