import React, { useState } from 'react';
import { X, Upload, AlertCircle, HelpCircle } from 'lucide-react';
import api from '../utils/api';
import styles from './ClientModal.module.css';

const ImportCSVModal = ({ isOpen, onClose, onSuccess, onShowHelp }) => {
  const [selectedProduit, setSelectedProduit] = useState('');
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState(1); // 1 = choix produit, 2 = choix fichier

  const PRODUITS = [
    { key: 'destratification', label: 'Destratification', color: '#10b981', icon: '💨' },
    { key: 'pression', label: 'Pression', color: '#8b5cf6', icon: '⚡' },
    { key: 'matelas_isolants', label: 'Matelas Isolants', color: '#f59e0b', icon: '🔥' }
  ];

  const handleProduitSelect = (produitKey) => {
    setSelectedProduit(produitKey);
    setStep(2);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        alert('Veuillez sélectionner un fichier CSV');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedProduit) {
      alert('Veuillez sélectionner un produit et un fichier');
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type_produit', selectedProduit);

    try {
      const response = await api.post('/clients/import/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const produitLabel = PRODUITS.find(p => p.key === selectedProduit)?.label;
      alert(`✅ Import réussi!\n${response.data.imported} client(s) importé(s)\nProduit: ${produitLabel}`);
      onSuccess();
      handleClose();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Erreur lors de l\'import CSV';
      alert(`❌ Échec de l'import\n${errorMsg}`);
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedProduit('');
    setFile(null);
    setImporting(false);
    onClose();
  };

  const handleBack = () => {
    setStep(1);
    setFile(null);
  };

  if (!isOpen) return null;

  const selectedProduitObj = PRODUITS.find(p => p.key === selectedProduit);

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
        {/* Header */}
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Upload size={24} style={{ color: '#6366f1' }} />
            <h2 className={styles.title}>Importer des clients depuis CSV</h2>
          </div>
          <button onClick={handleClose} className={styles.closeBtn} disabled={importing}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Step 1: Product Selection */}
          {step === 1 && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  fontSize: '15px',
                  fontWeight: '600'
                }}>
                  <span style={{
                    background: '#6366f1',
                    color: 'white',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: '700'
                  }}>
                    1
                  </span>
                  Sélectionnez le type de produit
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginLeft: '32px' }}>
                  Tous les clients importés seront associés à ce produit
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {PRODUITS.map(produit => (
                  <button
                    key={produit.key}
                    onClick={() => handleProduitSelect(produit.key)}
                    style={{
                      padding: '16px 20px',
                      background: 'var(--bg-secondary)',
                      border: `2px solid ${produit.color}40`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${produit.color}10`;
                      e.currentTarget.style.borderColor = produit.color;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                      e.currentTarget.style.borderColor = `${produit.color}40`;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{
                      fontSize: '32px',
                      width: '48px',
                      height: '48px',
                      background: `${produit.color}15`,
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {produit.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: '2px'
                      }}>
                        {produit.label}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Valeur technique: <code style={{
                          background: '#f1f5f9',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px'
                        }}>{produit.key}</code>
                      </div>
                    </div>
                    <div style={{
                      fontSize: '20px',
                      color: produit.color
                    }}>
                      →
                    </div>
                  </button>
                ))}
              </div>

              {/* Help link */}
              <div style={{
                marginTop: '20px',
                padding: '12px',
                background: 'rgba(59, 130, 246, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                color: '#64748b'
              }}>
                <HelpCircle size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <div>
                  <span>Besoin d'aide ? </span>
                  <button
                    onClick={() => {
                      handleClose();
                      onShowHelp();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      fontWeight: '600',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Consultez le guide d'import CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: File Selection */}
          {step === 2 && (
            <div>
              {/* Selected Product Display */}
              <div style={{
                padding: '14px 16px',
                background: `${selectedProduitObj.color}10`,
                border: `1px solid ${selectedProduitObj.color}40`,
                borderRadius: '8px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ fontSize: '24px' }}>{selectedProduitObj.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
                    Produit sélectionné
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: selectedProduitObj.color }}>
                    {selectedProduitObj.label}
                  </div>
                </div>
                <button
                  onClick={handleBack}
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  Changer
                </button>
              </div>

              {/* File Upload */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  fontSize: '15px',
                  fontWeight: '600'
                }}>
                  <span style={{
                    background: '#6366f1',
                    color: 'white',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: '700'
                  }}>
                    2
                  </span>
                  Sélectionnez le fichier CSV
                </div>

                <div
                  onClick={() => document.getElementById('csv-file-input').click()}
                  style={{
                    padding: '40px 20px',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: file ? '#f0fdf4' : 'var(--bg-secondary)',
                    transition: 'all 0.2s',
                    marginTop: '12px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.background = file ? '#f0fdf4' : 'var(--bg-secondary)';
                  }}
                >
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={importing}
                  />
                  <Upload size={40} style={{
                    color: file ? '#10b981' : '#94a3b8',
                    marginBottom: '12px',
                    display: 'block',
                    margin: '0 auto 12px'
                  }} />
                  {file ? (
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#10b981', marginBottom: '4px' }}>
                        ✓ Fichier sélectionné
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Cliquez pour sélectionner un fichier CSV
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Format: CSV UTF-8 (séparateur point-virgule)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Warning */}
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(245, 158, 11, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                gap: '10px',
                fontSize: '12px',
                color: '#92400e'
              }}>
                <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ lineHeight: '1.5' }}>
                  <strong>Important:</strong> La colonne "type_produit" dans votre CSV sera ignorée.
                  Tous les clients seront importés avec le produit <strong>{selectedProduitObj.label}</strong>.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          {step === 1 ? (
            <button onClick={handleClose} className={styles.cancelBtn}>
              Annuler
            </button>
          ) : (
            <>
              <button onClick={handleBack} className={styles.cancelBtn} disabled={importing}>
                ← Retour
              </button>
              <button
                onClick={handleImport}
                className={styles.saveBtn}
                disabled={!file || importing}
                style={{
                  opacity: !file || importing ? 0.5 : 1,
                  cursor: !file || importing ? 'not-allowed' : 'pointer'
                }}
              >
                <Upload size={18} />
                {importing ? 'Import en cours...' : 'Importer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportCSVModal;
