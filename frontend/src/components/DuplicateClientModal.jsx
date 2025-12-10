import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { X, Copy, CheckCircle, Loader2 } from 'lucide-react';
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
    { key: 'destratification', label: 'Destratification', color: '#10b981', icon: '🌀', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { key: 'pression', label: 'Pression', color: '#8b5cf6', icon: '💨', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
    { key: 'matelas_isolants', label: 'Matelas Isolants', color: '#f59e0b', icon: '🛡️', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }
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
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        {/* Header */}
        <div className={styles.header} style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '28px 32px',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <Copy size={24} style={{ color: 'white' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Dupliquer le client</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                Choisissez le type de produit pour la copie
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={styles.closeBtn}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: loading ? 0.5 : 1
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.content} style={{ padding: '32px' }}>
          {/* Source Client Info */}
          <div style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
            borderRadius: '12px',
            marginBottom: '28px',
            border: '1px solid rgba(99, 102, 241, 0.2)'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#6366f1',
              marginBottom: '8px'
            }}>
              Client source
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
              {client.societe}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Produit actuel:</span>
              <span style={{
                fontWeight: '600',
                color: PRODUITS.find(p => p.key === client.type_produit)?.color || '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>{PRODUITS.find(p => p.key === client.type_produit)?.icon}</span>
                {PRODUITS.find(p => p.key === client.type_produit)?.label || client.type_produit}
              </span>
            </div>
          </div>

          {/* Product Selection Grid */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1e293b',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>Sélectionnez le type de produit</span>
            </h3>

            <div style={{ display: 'grid', gap: '14px' }}>
              {PRODUITS.map(produit => {
                const isSelected = selectedType === produit.key;
                const isLoading = loading && isSelected;
                const isDisabled = loading && !isSelected;

                return (
                  <button
                    key={produit.key}
                    onClick={() => handleDuplicate(produit.key)}
                    disabled={loading}
                    style={{
                      padding: '22px 26px',
                      background: isLoading
                        ? produit.gradient
                        : isDisabled
                        ? '#f8fafc'
                        : 'white',
                      border: `2px solid ${isLoading ? produit.color : isDisabled ? '#e2e8f0' : produit.color}`,
                      borderRadius: '14px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '18px',
                      opacity: isDisabled ? 0.4 : 1,
                      transform: isLoading ? 'scale(0.98)' : 'scale(1)',
                      boxShadow: isLoading
                        ? `0 8px 24px ${produit.color}33`
                        : '0 2px 8px rgba(0,0,0,0.04)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                        e.currentTarget.style.boxShadow = `0 12px 32px ${produit.color}22`;
                        e.currentTarget.style.borderColor = produit.color;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                      }
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      fontSize: '36px',
                      width: '56px',
                      height: '56px',
                      background: isLoading
                        ? 'rgba(255, 255, 255, 0.25)'
                        : `${produit.color}15`,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.3s'
                    }}>
                      {produit.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{
                        fontSize: '19px',
                        fontWeight: '650',
                        color: isLoading ? 'white' : '#1e293b',
                        marginBottom: '4px',
                        transition: 'color 0.3s'
                      }}>
                        {produit.label}
                      </div>
                      {isLoading && (
                        <div style={{
                          fontSize: '13px',
                          color: 'rgba(255,255,255,0.95)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          Duplication en cours...
                        </div>
                      )}
                    </div>

                    {/* Right Icon */}
                    <div style={{ flexShrink: 0 }}>
                      {isLoading ? (
                        <div style={{
                          width: '28px',
                          height: '28px',
                          border: '3px solid rgba(255,255,255,0.3)',
                          borderTop: '3px solid white',
                          borderRadius: '50%',
                          animation: 'spin 0.6s linear infinite'
                        }} />
                      ) : (
                        <CheckCircle size={28} style={{ color: isDisabled ? '#cbd5e1' : produit.color, opacity: isDisabled ? 0.3 : 0.6 }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info Box */}
          <div style={{
            padding: '14px 18px',
            background: 'rgba(100, 116, 139, 0.06)',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#64748b',
            lineHeight: '1.6',
            display: 'flex',
            gap: '12px'
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>ℹ️</span>
            <span>
              La copie inclura <strong>toutes les données communes</strong> (société, contacts, SIRET)
              ainsi que les <strong>éléments liés</strong> (commentaires, rendez-vous, documents).
            </span>
          </div>
        </div>

        {/* Footer */}
        {!loading && (
          <div className={styles.modalFooter} style={{
            padding: '20px 32px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            borderRadius: '0 0 16px 16px'
          }}>
            <button
              onClick={onClose}
              className={styles.cancelBtn}
              style={{
                padding: '10px 24px',
                fontSize: '15px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
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
