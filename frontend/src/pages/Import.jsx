import React, { useState } from 'react';
import api from '../utils/api';
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import styles from './Import.module.css';

const Import = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Veuillez sélectionner un fichier CSV valide');
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Aucun fichier sélectionné');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/leads/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setResult(response.data);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'import');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'first_name,last_name,email,phone\nJean,Dupont,jean.dupont@email.com,0601020304\nMarie,Martin,marie.martin@email.com,0612345678';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-import-leads.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <Upload size={32} /> Import CSV
        </h1>
        <p className={styles.subtitle}>
          Importez vos leads en masse depuis un fichier CSV
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <FileText size={24} />
            <h2>Format du fichier</h2>
          </div>
          <div className={styles.cardContent}>
            <p>Votre fichier CSV doit contenir les colonnes suivantes :</p>
            <ul className={styles.list}>
              <li><strong>first_name</strong> (obligatoire) - Prénom du lead</li>
              <li><strong>last_name</strong> (obligatoire) - Nom du lead</li>
              <li><strong>email</strong> (optionnel) - Email du lead</li>
              <li><strong>phone</strong> (optionnel) - Téléphone du lead</li>
            </ul>
            <button onClick={downloadTemplate} className={styles.downloadBtn}>
              <Download size={16} /> Télécharger le modèle
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <Upload size={24} />
            <h2>Importer un fichier</h2>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.uploadZone}>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className={styles.fileInput}
                id="csvFile"
              />
              <label htmlFor="csvFile" className={styles.fileLabel}>
                <Upload size={32} />
                <span className={styles.fileName}>
                  {file ? file.name : 'Cliquez pour sélectionner un fichier CSV'}
                </span>
                <span className={styles.fileHint}>
                  Formats acceptés: .csv
                </span>
              </label>
            </div>

            {error && (
              <div className={styles.alert + ' ' + styles.alertError}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className={styles.alert + ' ' + styles.alertSuccess}>
                <CheckCircle size={20} />
                <div>
                  <p><strong>{result.message}</strong></p>
                  {result.errors && (
                    <ul className={styles.errorList}>
                      {result.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>... et {result.errors.length - 5} autres erreurs</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!file || loading}
              className={styles.importBtn}
            >
              {loading ? 'Import en cours...' : 'Importer les leads'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.infoCard}>
        <h3>Instructions importantes</h3>
        <ul className={styles.instructions}>
          <li>Les leads importés seront placés dans "Leads à attribuer"</li>
          <li>Vous devrez les attribuer manuellement aux agents</li>
          <li>Le statut initial de tous les leads sera "Nouveau"</li>
          <li>Assurez-vous que votre fichier est encodé en UTF-8</li>
          <li>La première ligne doit contenir les noms des colonnes</li>
          <li>Les lignes avec des données manquantes seront ignorées</li>
        </ul>
      </div>
    </div>
  );
};

export default Import;
