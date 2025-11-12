import React, { useState } from 'react';
import api from '../utils/api';
import { X, FileUp, Download, AlertCircle, CheckCircle } from 'lucide-react';
import styles from './ImportModal.module.css';

const ImportModal = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Veuillez sélectionner un fichier CSV valide');
      setFile(null);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = 'first_name,last_name,email,phone\nJean,Dupont,jean.dupont@email.com,0601020304\nMarie,Martin,marie.martin@email.com,0612345678';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_import_leads.csv';
    link.click();
  };

  const handleImport = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      setError('');
      const response = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
      if (response.data.imported > 0) {
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'import');
      setResult(err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Importer des leads (CSV)</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          {!result ? (
            <>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Télécharger le modèle</h3>
                <p className={styles.description}>
                  Téléchargez le fichier modèle et remplissez-le avec vos données.
                </p>
                <button onClick={handleDownloadTemplate} className={styles.downloadBtn}>
                  <Download size={18} />
                  Télécharger le modèle CSV
                </button>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Format du fichier CSV</h3>
                <ul className={styles.instructions}>
                  <li><strong>first_name</strong> : Prénom (obligatoire)</li>
                  <li><strong>last_name</strong> : Nom (obligatoire)</li>
                  <li><strong>email</strong> : Email (optionnel)</li>
                  <li><strong>phone</strong> : Téléphone (optionnel)</li>
                </ul>
                <p className={styles.note}>
                  Le fichier doit être encodé en <strong>UTF-8</strong> et utiliser une virgule comme séparateur.
                </p>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Sélectionner le fichier</h3>
                <div className={styles.fileInput}>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    id="csvFile"
                    className={styles.inputFile}
                  />
                  <label htmlFor="csvFile" className={styles.fileLabel}>
                    <FileUp size={20} />
                    {file ? file.name : 'Choisir un fichier CSV'}
                  </label>
                </div>
              </div>

              {error && (
                <div className={styles.error}>
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={!file || loading}
                className={styles.importBtn}
              >
                {loading ? 'Import en cours...' : 'Importer les leads'}
              </button>
            </>
          ) : (
            <div className={styles.result}>
              {result.imported > 0 ? (
                <>
                  <div className={styles.successIcon}>
                    <CheckCircle size={48} />
                  </div>
                  <h3>{result.imported} lead(s) importé(s) avec succès !</h3>
                  {result.errors?.length > 0 && (
                    <div className={styles.warnings}>
                      <p>{result.errors.length} erreur(s) détectée(s) :</p>
                      <ul>
                        {result.errors.slice(0, 5).map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className={styles.errorIcon}>
                    <AlertCircle size={48} />
                  </div>
                  <h3>Erreur lors de l'import</h3>
                  {result.errors && (
                    <ul className={styles.errorList}>
                      {result.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
