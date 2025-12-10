import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { X, Copy, Fan, Wind, Layers } from 'lucide-react';
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
    { key: 'destratification', label: 'Destratification', color: '#10b981', Icon: Fan },
    { key: 'pression', label: 'Pression', color: '#8b5cf6', Icon: Wind },
    { key: 'matelas_isolants', label: 'Matelas Isolants', color: '#f59e0b', Icon: Layers }
  ];

  const handleDuplicate = async (type_produit) => {
    setSelectedType(type_produit);
    setLoading(true);

    try {
      const response = await api.post(`/clients/produits/${client.produit_id}/duplicate`, {
        type_produit
      });

      const produitLabel = PRODUITS.find(p => p.key === type_produit).label;

      alert(`✅ Client dupliqué avec succès!\n\nNouveau produit: ${produitLabel}\n\n` +
        `📋 ${response.data.copied?.comments || 0} commentaire(s)\n` +
        `📅 ${response.data.copied?.appointments || 0} rendez-vous\n` +
        `📎 ${response.data.copied?.documents || 0} document(s)`
      );

      onDuplicated && onDuplicated();
      onClose();
    } catch (error) {
      console.error('Erreur duplication:', error);
      alert('❌ Erreur lors de la duplication du client\n\n' + (error.response?.data?.error || error.message));
      setLoading(false);
      setSelectedType(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={loading ? null : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Copy size={24} style={{ color: 'var(--accent-color)' }} />
            <div>
              <h2 className={styles.title}>Dupliquer le client</h2>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.content}>
          {/* Source Client Info */}
          <div style={{
            padding: '14px 16px',
            background: 'var(--bg-hover)',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-secondary)',
              marginBottom: '6px'
            }}>
              Client source
            </div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {client.societe}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Produit actuel:</span>
              <span style={{
                fontWeight: '500',
                color: PRODUITS.find(p => p.key === client.type_produit)?.color || 'var(--text-secondary)'
              }}>
                {PRODUITS.find(p => p.key === client.type_produit)?.label || client.type_produit}
              </span>
            </div>
          </div>

          {/* Product Selection */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '12px'
            }}>
              Type de produit pour la copie
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PRODUITS.map(produit => {
                const isSelected = selectedType === produit.key;
                const isLoading = loading && isSelected;
                const isDisabled = loading && !isSelected;
                const Icon = produit.Icon;

                return (
                  <button
                    key={produit.key}
                    onClick={() => handleDuplicate(produit.key)}
                    disabled={loading}
                    style={{
                      padding: '14px 16px',
                      background: isLoading ? produit.color : 'var(--bg-secondary)',
                      border: `1px solid ${isLoading ? produit.color : isDisabled ? 'var(--border-color)' : produit.color}`,
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      opacity: isDisabled ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.background = `${produit.color}10`;
                        e.currentTarget.style.borderColor = produit.color;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                      }
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: '36px',
                      height: '36px',
                      background: isLoading ? 'rgba(255, 255, 255, 0.2)' : `${produit.color}15`,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon size={20} style={{ color: isLoading ? 'white' : produit.color }} />
                    </div>

                    {/* Label */}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: '500',
                        color: isLoading ? 'white' : 'var(--text-primary)'
                      }}>
                        {produit.label}
                      </div>
                      {isLoading && (
                        <div style={{
                          fontSize: '12px',
                          color: 'rgba(255,255,255,0.9)',
                          marginTop: '2px'
                        }}>
                          Duplication en cours...
                        </div>
                      )}
                    </div>

                    {/* Loading Spinner */}
                    {isLoading && (
                      <div style={{
                        width: '18px',
                        height: '18px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite'
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info Note */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(59, 130, 246, 0.05)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: '1.5',
            borderLeft: '3px solid var(--accent-color)'
          }}>
            <strong>Note:</strong> La copie inclura toutes les données du client (société, contacts, SIRET)
            ainsi que les commentaires, rendez-vous et documents associés.
          </div>
        </div>

        {/* Footer */}
        {!loading && (
          <div className={styles.modalFooter}>
            <button onClick={onClose} className={styles.cancelBtn}>
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
