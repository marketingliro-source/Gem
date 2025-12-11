import React from 'react';
import { X, Download, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import styles from './ImportCSVHelpModal.module.css';

const ImportCSVHelpModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    // Template CSV avec toutes les colonnes
    const headers = [
      'societe',
      'adresse',
      'code_postal',
      'telephone',
      'siret',
      'nom_site',
      'adresse_travaux',
      'code_postal_travaux',
      'nom_signataire',
      'fonction',
      'telephone_signataire',
      'mail_signataire',
      'type_produit',
      'code_naf',
      'statut'
    ];

    // Exemple de données
    const example1 = [
      'Gem Isolation SARL',
      '123 Rue de la Paix',
      '75001',
      '0123456789',
      '12345678900001',
      'Site Principal',
      '123 Rue de la Paix',
      '75001',
      'Jean Dupont',
      'Directeur Général',
      '0123456789',
      'j.dupont@gem-isolation.fr',
      'destratification',
      '4322B',
      'nouveau'
    ];

    const example2 = [
      'Entreprise XYZ',
      '456 Avenue des Champs',
      '69001',
      '0456789123',
      '98765432100002',
      '',
      '',
      '',
      'Marie Martin',
      'Responsable Travaux',
      '0456789123',
      'm.martin@xyz.fr',
      'pression',
      '8610Z',
      'a_rappeler'
    ];

    // Créer le CSV avec BOM UTF-8 pour Excel
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(';'),
      example1.join(';'),
      example2.join(';')
    ].join('\n');

    // Télécharger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_import_clients.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <FileText size={24} />
            <h2>Guide d'import CSV</h2>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Nouvelle fonctionnalité */}
          <div style={{
            marginBottom: '24px',
            padding: '16px 18px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.05) 100%)',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            fontSize: '14px',
            color: '#065f46',
            lineHeight: '1.6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontWeight: '600', color: '#059669' }}>
              <CheckCircle size={20} />
              <span>Nouveau : Sélection du produit simplifiée</span>
            </div>
            <p style={{ marginBottom: 0 }}>
              <strong>Bonne nouvelle !</strong> Vous n'avez plus besoin d'inclure la colonne <code style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }}>type_produit</code> dans votre CSV.
              Le type de produit est maintenant sélectionné directement lors de l'import via un menu déroulant,
              ce qui évite les erreurs de saisie.
            </p>
          </div>

          {/* Étape 1 */}
          <div className={styles.section}>
            <div className={styles.stepTitle}>
              <span className={styles.stepNumber}>1</span>
              <h3>Télécharger le template</h3>
            </div>
            <p>Commencez par télécharger notre fichier template CSV :</p>
            <button onClick={handleDownloadTemplate} className={styles.downloadBtn}>
              <Download size={18} />
              Télécharger le template CSV
            </button>
          </div>

          {/* Étape 2 */}
          <div className={styles.section}>
            <div className={styles.stepTitle}>
              <span className={styles.stepNumber}>2</span>
              <h3>Remplir le fichier CSV</h3>
            </div>
            <p>Ouvrez le fichier dans Excel ou un éditeur de texte et remplissez vos données :</p>

            <div className={styles.fieldsGrid}>
              <div className={styles.fieldCategory}>
                <h4>📋 Informations Bénéficiaire</h4>
                <ul>
                  <li><strong>societe</strong> : Nom de l'entreprise (requis)</li>
                  <li><strong>adresse</strong> : Adresse complète</li>
                  <li><strong>code_postal</strong> : Code postal (5 chiffres)</li>
                  <li><strong>telephone</strong> : Numéro de téléphone</li>
                  <li><strong>siret</strong> : Numéro SIRET (14 chiffres)</li>
                </ul>
              </div>

              <div className={styles.fieldCategory}>
                <h4>🏗️ Site Travaux (optionnel)</h4>
                <ul>
                  <li><strong>nom_site</strong> : Nom du site</li>
                  <li><strong>adresse_travaux</strong> : Adresse du site</li>
                  <li><strong>code_postal_travaux</strong> : Code postal du site</li>
                </ul>
              </div>

              <div className={styles.fieldCategory}>
                <h4>👤 Contact Signataire</h4>
                <ul>
                  <li><strong>nom_signataire</strong> : Nom du signataire</li>
                  <li><strong>fonction</strong> : Fonction du signataire</li>
                  <li><strong>telephone_signataire</strong> : Téléphone du signataire</li>
                  <li><strong>mail_signataire</strong> : Email du signataire</li>
                </ul>
              </div>

              <div className={styles.fieldCategory}>
                <h4>⚙️ Produit & Statut</h4>
                <ul>
                  <li><strong>type_produit</strong> : <span style={{color: '#94a3b8', textDecoration: 'line-through'}}>Cette colonne sera ignorée</span> - Le type de produit est maintenant sélectionné lors de l'import</li>
                  <li><strong>code_naf</strong> : Code NAF de l'entreprise</li>
                  <li><strong>statut</strong> : nouveau, a_rappeler, mail_infos_envoye, etc.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Étape 3 */}
          <div className={styles.section}>
            <div className={styles.stepTitle}>
              <span className={styles.stepNumber}>3</span>
              <h3>Enregistrer au format CSV</h3>
            </div>
            <div className={styles.importantBox}>
              <AlertCircle size={20} />
              <div>
                <p><strong>Important :</strong> Enregistrez votre fichier au format <strong>CSV UTF-8 (délimiteur : point-virgule)</strong></p>
                <p className={styles.excelTip}>Dans Excel : <em>Fichier → Enregistrer sous → Type : CSV UTF-8 (délimité par des virgules)</em></p>
              </div>
            </div>
          </div>

          {/* Étape 4 */}
          <div className={styles.section}>
            <div className={styles.stepTitle}>
              <span className={styles.stepNumber}>4</span>
              <h3>Importer le fichier</h3>
            </div>
            <p>Cliquez sur le bouton <strong>"Import CSV"</strong> et sélectionnez votre fichier.</p>
          </div>

          {/* Conseils */}
          <div className={styles.tipsSection}>
            <h4>
              <CheckCircle size={18} />
              Conseils pour un import réussi
            </h4>
            <ul>
              <li>Le champ <strong>societe</strong> est obligatoire</li>
              <li>Utilisez le <strong>point-virgule (;)</strong> comme séparateur</li>
              <li>Pour les champs vides, laissez-les simplement vides (ne mettez pas "vide" ou "N/A")</li>
              <li>Le <strong>type de produit</strong> est sélectionné lors de l'import via un menu déroulant (plus besoin de le saisir dans le CSV)</li>
              <li>Les statuts valides : nouveau, a_rappeler, mail_infos_envoye, infos_recues, devis_envoye, devis_signe, pose_prevue, pose_terminee, coffrac, termine</li>
              <li>Si vous n'indiquez pas de statut, il sera automatiquement défini sur "nouveau"</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button onClick={onClose} className={styles.closeButton}>
            Fermer
          </button>
          <button onClick={handleDownloadTemplate} className={styles.downloadButtonFooter}>
            <Download size={18} />
            Télécharger le template
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportCSVHelpModal;
