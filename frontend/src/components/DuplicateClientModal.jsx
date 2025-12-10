import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { X, Copy, CheckCircle } from 'lucide-react';
import styles from './ClientModal.module.css';

const DuplicateClientModal = ({ client, onClose, onDuplicated }) => {
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const { produit } = useParams();
  const initialProduit = useRef(produit);

  // Fermer la modale si l'utilisateur change de catégorie de produit
  useEffect(() => {
    if (produit !== initialProduit.current) {
      onClose();
    }
  }, [produit, onClose]);

  const PRODUITS = [
    { key: 'destratification', label: 'Destratification', color: '#10b981', icon: '🌀' },
    { key: 'pression', label: 'Pression', color: '#8b5cf6', icon: '💨' },
    { key: 'matelas_isolants', label: 'Matelas Isolants', color: '#f59e0b', icon: '🛡️' }
  ];

  const handleDuplicate = async (type_produit) => {
    setSelectedType(type_produit);
    setLoading(true);

    try {
      const response = await api.post(`/clients/produits/${client.produit_id}/duplicate`, {
        type_produit
      });

      alert(`✅ Client dupliqué avec succès!\n\nNouveau produit: ${PRODUITS.find(p => p.key === type_produit).label}\n\n` +
        `📋 ${response.data.copied?.comments || 0} commentaire(s)\n` +
        `📅 ${response.data.copied?.appointments || 0} rendez-vous\n` +
        `📎 ${response.data.copied?.documents || 0} document(s)`
      );

      onDuplicated && onDuplicated();
      onClose();
    } catch (error) {
      console.error('Erreur duplication:', error);
      alert('Erreur lors de la duplication du client');
      setLoading(false);
      setSelectedType(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Copy size={24} style={{ color: '#3b82f6' }} />
            <h2>Dupliquer le client</h2>
          </div>
          <button onClick={onClose} className={styles.closeBtn} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <div style={{
              padding: '16px',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '8px',
              marginBottom: '24px',
              borderLeft: '4px solid #3b82f6'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Client source:</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>{client.societe}</div>
              <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                Produit actuel: <span style={{ fontWeight: '500' }}>
                  {PRODUITS.find(p => p.key === client.type_produit)?.label || client.type_produit}
                </span>
              </div>
            </div>

            <p style={{ marginBottom: '20px', color: '#475569', fontSize: '15px' }}>
              Dans quel type de produit voulez-vous créer la copie ?
            </p>

            <div style={{
              display: 'grid',
              gap: '12px'
            }}>
              {PRODUITS.map(produit => (
                <button
                  key={produit.key}
                  onClick={() => handleDuplicate(produit.key)}
                  disabled={loading}
                  style={{
                    padding: '20px 24px',
                    background: loading && selectedType === produit.key
                      ? `linear-gradient(135deg, ${produit.color}dd 0%, ${produit.color}99 100%)`
                      : loading
                      ? '#f1f5f9'
                      : `linear-gradient(135deg, ${produit.color}22 0%, ${produit.color}11 100%)`,
                    border: `2px solid ${loading && selectedType === produit.key ? produit.color : loading ? '#cbd5e1' : `${produit.color}44`}`,
                    borderRadius: '12px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    opacity: loading && selectedType !== produit.key ? 0.4 : 1,
                    transform: loading && selectedType === produit.key ? 'scale(0.98)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${produit.color}33 0%, ${produit.color}22 100%)`;
                      e.currentTarget.style.borderColor = produit.color;
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = `0 4px 12px ${produit.color}33`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${produit.color}22 0%, ${produit.color}11 100%)`;
                      e.currentTarget.style.borderColor = `${produit.color}44`;
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <span style={{ fontSize: '32px' }}>{produit.icon}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: loading && selectedType === produit.key ? 'white' : '#1e293b',
                      marginBottom: '4px'
                    }}>
                      {produit.label}
                    </div>
                    {loading && selectedType === produit.key && (
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
                        ⏳ Duplication en cours...
                      </div>
                    )}
                  </div>
                  {loading && selectedType === produit.key ? (
                    <div style={{
                      width: '24px',
                      height: '24px',
                      border: '3px solid rgba(255,255,255,0.3)',
                      borderTop: '3px solid white',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                  ) : (
                    <CheckCircle size={24} style={{ color: produit.color, opacity: 0.5 }} />
                  )}
                </button>
              ))}
            </div>

            <div style={{
              marginTop: '20px',
              padding: '12px 16px',
              background: 'rgba(148, 163, 184, 0.1)',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#64748b'
            }}>
              ℹ️ La copie inclura les données communes (société, contacts, SIRET) et les éléments liés (commentaires, rendez-vous, documents).
            </div>
          </div>
        </div>

        {!loading && (
          <div className={styles.modalFooter}>
            <button
              onClick={onClose}
              className={styles.cancelBtn}
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DuplicateClientModal;
