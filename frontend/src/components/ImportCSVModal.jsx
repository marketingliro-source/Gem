import React, { useState } from 'react';
import { X, Upload, AlertCircle, HelpCircle } from 'lucide-react';
import api from '../utils/api';
import styles from './ImportCSVModal.module.css';

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
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Upload size={24} />
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
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumber}>1</span>
                  Sélectionnez le type de produit
                </div>
                <p className={styles.stepDescription}>
                  Tous les clients importés seront associés à ce produit
                </p>
              </div>

              <div className={styles.productButtons}>
                {PRODUITS.map(produit => (
                  <button
                    key={produit.key}
                    onClick={() => handleProduitSelect(produit.key)}
                    className={styles.productButton}
                    style={{
                      borderColor: `${produit.color}40`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${produit.color}10`;
                      e.currentTarget.style.borderColor = produit.color;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                      e.currentTarget.style.borderColor = `${produit.color}40`;
                    }}
                  >
                    <div
                      className={styles.productIcon}
                      style={{ background: `${produit.color}15` }}
                    >
                      {produit.icon}
                    </div>
                    <div className={styles.productInfo}>
                      <div className={styles.productLabel}>
                        {produit.label}
                      </div>
                      <div className={styles.productKey}>
                        Valeur technique: <code>{produit.key}</code>
                      </div>
                    </div>
                    <div
                      className={styles.productArrow}
                      style={{ color: produit.color }}
                    >
                      →
                    </div>
                  </button>
                ))}
              </div>

              {/* Help link */}
              <div className={styles.helpBox}>
                <HelpCircle size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <div>
                  <span>Besoin d'aide ? </span>
                  <button
                    onClick={() => {
                      handleClose();
                      onShowHelp();
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
              <div
                className={styles.selectedProductBox}
                style={{
                  background: `${selectedProduitObj.color}10`,
                  borderColor: `${selectedProduitObj.color}40`
                }}
              >
                <div className={styles.selectedProductIcon}>{selectedProduitObj.icon}</div>
                <div className={styles.selectedProductInfo}>
                  <div className={styles.selectedProductLabel}>
                    Produit sélectionné
                  </div>
                  <div
                    className={styles.selectedProductName}
                    style={{ color: selectedProduitObj.color }}
                  >
                    {selectedProduitObj.label}
                  </div>
                </div>
                <button onClick={handleBack} className={styles.changeButton}>
                  Changer
                </button>
              </div>

              {/* File Upload */}
              <div>
                <div className={styles.stepHeader} style={{ marginBottom: '12px' }}>
                  <span className={styles.stepNumber}>2</span>
                  Sélectionnez le fichier CSV
                </div>

                <div
                  onClick={() => document.getElementById('csv-file-input').click()}
                  className={`${styles.fileUploadArea} ${file ? styles.hasFile : ''}`}
                >
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={importing}
                  />
                  <Upload
                    size={40}
                    className={`${styles.uploadIcon} ${file ? styles.hasFile : ''}`}
                  />
                  {file ? (
                    <div>
                      <div className={`${styles.uploadTitle} ${styles.success}`}>
                        ✓ Fichier sélectionné
                      </div>
                      <div className={styles.uploadFileName}>
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className={styles.uploadTitle}>
                        Cliquez pour sélectionner un fichier CSV
                      </div>
                      <div className={styles.uploadHint}>
                        Format: CSV UTF-8 (séparateur point-virgule)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Warning */}
              <div className={styles.warningBox}>
                <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                <div>
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
