import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { X, Save, Upload, Download, Trash2, MessageSquare, Calendar, Send } from 'lucide-react';
import SiretAutocomplete from './SiretAutocomplete';
import styles from './ClientModal.module.css';

const ClientModal = ({ client, onClose }) => {
  const { user } = useAuth();
  const isNew = !client;
  
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [comments, setComments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  const [formData, setFormData] = useState({
    // Bénéficiaire
    societe: client?.societe || '',
    adresse: client?.adresse || '',
    code_postal: client?.code_postal || '',
    telephone: client?.telephone || '',
    siret: client?.siret || '',
    
    // Site Travaux
    nom_site: client?.nom_site || '',
    adresse_travaux: client?.adresse_travaux || '',
    code_postal_travaux: client?.code_postal_travaux || '',
    
    // Contact Signataire
    nom_signataire: client?.nom_signataire || '',
    fonction: client?.fonction || '',
    telephone_signataire: client?.telephone_signataire || '',
    mail_signataire: client?.mail_signataire || '',
    
    // Produit
    type_produit: client?.type_produit || 'destratification',
    code_naf: client?.code_naf || '',
    statut: client?.statut || 'nouveau',
    
    // Données techniques (JSON)
    donnees_techniques: client?.donnees_techniques || {}
  });

  const [technicalData, setTechnicalData] = useState({
    // Destratification
    hauteur_max: client?.donnees_techniques?.hauteur_max || '',
    m2_hors_bureau: client?.donnees_techniques?.m2_hors_bureau || '',
    type_chauffage: client?.donnees_techniques?.type_chauffage || '',
    nb_chauffage: client?.donnees_techniques?.nb_chauffage || '',
    puissance_totale: client?.donnees_techniques?.puissance_totale || '',
    marque_chauffage: client?.donnees_techniques?.marque_chauffage || '',
    nb_zones: client?.donnees_techniques?.nb_zones || '',
    
    // Pression
    nb_groupes: client?.donnees_techniques?.nb_groupes || '',
    puissance_totale_pression: client?.donnees_techniques?.puissance_totale_pression || '',
    
    // Matelas
    chaufferie: client?.donnees_techniques?.chaufferie || '',
    calorifuge: client?.donnees_techniques?.calorifuge || '',
    ps_estimes: client?.donnees_techniques?.ps_estimes || ''
  });

  const STATUTS = [
    { key: 'nouveau', label: 'Nouveau' },
    { key: 'nrp', label: 'NRP' },
    { key: 'a_rappeler', label: 'À Rappeler' },
    { key: 'mail_infos_envoye', label: 'Mail Infos Envoyé' },
    { key: 'infos_recues', label: 'Infos Reçues' },
    { key: 'devis_envoye', label: 'Devis Envoyé' },
    { key: 'devis_signe', label: 'Devis Signé' },
    { key: 'pose_prevue', label: 'Pose Prévue' },
    { key: 'pose_terminee', label: 'Pose Terminée' },
    { key: 'coffrac', label: 'Coffrac' },
    { key: 'termine', label: 'Terminé' }
  ];

  useEffect(() => {
    if (!isNew) {
      fetchDocuments();
      fetchComments();
      fetchAppointments();
    }
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await api.get(\`/documents/client/\${client.id}\`);
      setDocuments(response.data);
    } catch (error) {
      console.error('Erreur chargement documents:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(\`/clients/\${client.id}/comments\`);
      setComments(response.data);
    } catch (error) {
      console.error('Erreur chargement commentaires:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await api.get(\`/clients/\${client.id}/appointments\`);
      setAppointments(response.data);
    } catch (error) {
      console.error('Erreur chargement rendez-vous:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTechnicalChange = (e) => {
    setTechnicalData({ ...technicalData, [e.target.name]: e.target.value });
  };

  /**
   * Enrichissement automatique via SIRET
   * Remplit le formulaire avec les données des APIs externes
   */
  const handleEnrichData = (enrichedData) => {
    console.log('📊 Enrichissement reçu:', enrichedData);

    // Mettre à jour les champs principaux
    setFormData(prev => ({
      ...prev,
      societe: enrichedData.denomination || prev.societe,
      adresse: enrichedData.adresse?.adresseComplete || prev.adresse,
      code_postal: enrichedData.adresse?.codePostal || prev.code_postal,
      telephone: enrichedData.telephone || prev.telephone,
      code_naf: enrichedData.codeNAF || prev.code_naf,
      siret: enrichedData.siret || prev.siret
    }));

    // Remplir données techniques si disponibles
    if (enrichedData.donneesTechniques && Object.keys(enrichedData.donneesTechniques).length > 0) {
      setTechnicalData(prev => ({
        ...prev,
        ...enrichedData.donneesTechniques
      }));

      console.log('✅ Données techniques auto-remplies:', enrichedData.donneesTechniques);
    }

    // Afficher recommandations si disponibles
    if (enrichedData.recommandations && enrichedData.recommandations.length > 0) {
      const recoMessages = enrichedData.recommandations
        .map(r => `• ${r.produit}: ${r.raison}`)
        .join('\n');

      console.log('💡 Recommandations produits:\n' + recoMessages);

      // Optionnel: afficher une notification
      alert(`Produits recommandés:\n\n${recoMessages}\n\nScore de complétude: ${enrichedData.scoreCompletude}%`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Préparer les données techniques selon le produit
      let donneesFinales = {};
      if (formData.type_produit === 'destratification') {
        donneesFinales = {
          hauteur_max: technicalData.hauteur_max,
          m2_hors_bureau: technicalData.m2_hors_bureau,
          type_chauffage: technicalData.type_chauffage,
          nb_chauffage: technicalData.nb_chauffage,
          puissance_totale: technicalData.puissance_totale,
          marque_chauffage: technicalData.marque_chauffage,
          nb_zones: technicalData.nb_zones
        };
      } else if (formData.type_produit === 'pression') {
        donneesFinales = {
          nb_groupes: technicalData.nb_groupes,
          puissance_totale: technicalData.puissance_totale_pression
        };
      } else if (formData.type_produit === 'matelas_isolants') {
        donneesFinales = {
          chaufferie: technicalData.chaufferie,
          calorifuge: technicalData.calorifuge,
          ps_estimes: technicalData.ps_estimes
        };
      }

      const payload = {
        ...formData,
        donnees_techniques: donneesFinales
      };

      if (isNew) {
        await api.post('/clients', payload);
      } else {
        await api.patch(\`/clients/\${client.id}\`, payload);
      }

      onClose(true); // Refresh la liste
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await api.post(\`/documents/upload/\${client.id}\`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      fetchDocuments();
      e.target.value = '';
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('Erreur lors de l\'upload du fichier');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Supprimer ce document ?')) return;

    try {
      await api.delete(\`/documents/\${docId}\`);
      fetchDocuments();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleDownloadDocument = async (docId, fileName) => {
    try {
      const response = await api.get(\`/documents/download/\${docId}\`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      alert('Erreur lors du téléchargement');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await api.post(\`/clients/\${client.id}/comments\`, { content: newComment });
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Erreur ajout commentaire:', error);
      alert('Erreur lors de l\'ajout du commentaire');
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={() => onClose(false)}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{isNew ? 'Nouveau Client' : \`Client - \${client.societe || 'Sans nom'}\`}</h2>
          <button className={styles.closeBtn} onClick={() => onClose(false)}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            className={\`\${styles.tab} \${activeTab === 'info' ? styles.activeTab : ''}\`}
            onClick={() => setActiveTab('info')}
          >
            Informations
          </button>
          {!isNew && (
            <>
              <button
                className={\`\${styles.tab} \${activeTab === 'documents' ? styles.activeTab : ''}\`}
                onClick={() => setActiveTab('documents')}
              >
                Documents ({documents.length})
              </button>
              <button
                className={\`\${styles.tab} \${activeTab === 'comments' ? styles.activeTab : ''}\`}
                onClick={() => setActiveTab('comments')}
              >
                Commentaires ({comments.length})
              </button>
            </>
          )}
        </div>

        <div className={styles.modalBody}>
          {activeTab === 'info' && (
            <form onSubmit={handleSubmit}>
              {/* Section Bénéficiaire */}
              <div className={styles.section}>
                <h3>Bénéficiaire</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Société</label>
                    <input
                      type="text"
                      name="societe"
                      value={formData.societe}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>SIRET</label>
                    <SiretAutocomplete
                      value={formData.siret}
                      onChange={(value) => setFormData({ ...formData, siret: value })}
                      onEnrich={handleEnrichData}
                      typeProduit={formData.type_produit}
                      disabled={loading}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Adresse</label>
                    <input
                      type="text"
                      name="adresse"
                      value={formData.adresse}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Code Postal</label>
                    <input
                      type="text"
                      name="code_postal"
                      value={formData.code_postal}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Téléphone</label>
                    <input
                      type="text"
                      name="telephone"
                      value={formData.telephone}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Code NAF</label>
                    <input
                      type="text"
                      name="code_naf"
                      value={formData.code_naf}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>

              {/* Section Site Travaux */}
              <div className={styles.section}>
                <h3>Site Travaux</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Nom du Site</label>
                    <input
                      type="text"
                      name="nom_site"
                      value={formData.nom_site}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Adresse Travaux</label>
                    <input
                      type="text"
                      name="adresse_travaux"
                      value={formData.adresse_travaux}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Code Postal</label>
                    <input
                      type="text"
                      name="code_postal_travaux"
                      value={formData.code_postal_travaux}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>

              {/* Section Contact Signataire */}
              <div className={styles.section}>
                <h3>Contact Signataire</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Nom et Prénom</label>
                    <input
                      type="text"
                      name="nom_signataire"
                      value={formData.nom_signataire}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Fonction</label>
                    <input
                      type="text"
                      name="fonction"
                      value={formData.fonction}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Téléphone</label>
                    <input
                      type="text"
                      name="telephone_signataire"
                      value={formData.telephone_signataire}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Email</label>
                    <input
                      type="email"
                      name="mail_signataire"
                      value={formData.mail_signataire}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>

              {/* Section Produit et Statut */}
              <div className={styles.section}>
                <h3>Produit CEE</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Type de Produit *</label>
                    <select
                      name="type_produit"
                      value={formData.type_produit}
                      onChange={handleChange}
                      className={styles.select}
                      required
                    >
                      <option value="destratification">Destratification</option>
                      <option value="pression">Pression</option>
                      <option value="matelas_isolants">Matelas Isolants</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Statut</label>
                    <select
                      name="statut"
                      value={formData.statut}
                      onChange={handleChange}
                      className={styles.select}
                    >
                      {STATUTS.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section Données Techniques Dynamique */}
              <div className={styles.section}>
                <h3>Données Techniques - {formData.type_produit}</h3>
                <div className={styles.formGrid}>
                  {formData.type_produit === 'destratification' && (
                    <>
                      <div className={styles.formGroup}>
                        <label>Hauteur Max (m)</label>
                        <input type="number" name="hauteur_max" value={technicalData.hauteur_max} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                      <div className={styles.formGroup}>
                        <label>m² Hors Bureau</label>
                        <input type="number" name="m2_hors_bureau" value={technicalData.m2_hors_bureau} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Type de Chauffage</label>
                        <input type="text" name="type_chauffage" value={technicalData.type_chauffage} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Nombre de Chauffage</label>
                        <input type="number" name="nb_chauffage" value={technicalData.nb_chauffage} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Puissance Totale (kW)</label>
                        <input type="number" name="puissance_totale" value={technicalData.puissance_totale} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Marque Chauffage</label>
                        <input type="text" name="marque_chauffage" value={technicalData.marque_chauffage} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Nombre de Zones</label>
                        <input type="number" name="nb_zones" value={technicalData.nb_zones} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                    </>
                  )}

                  {formData.type_produit === 'pression' && (
                    <>
                      <div className={styles.formGroup}>
                        <label>Nombre de Groupes</label>
                        <input type="number" name="nb_groupes" value={technicalData.nb_groupes} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Puissance Totale (kW)</label>
                        <input type="number" name="puissance_totale_pression" value={technicalData.puissance_totale_pression} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                    </>
                  )}

                  {formData.type_produit === 'matelas_isolants' && (
                    <>
                      <div className={styles.formGroup}>
                        <label>Chaufferie</label>
                        <input type="text" name="chaufferie" value={technicalData.chaufferie} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Calorifuge</label>
                        <input type="text" name="calorifuge" value={technicalData.calorifuge} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                      <div className={styles.formGroup}>
                        <label>PS Estimés</label>
                        <input type="text" name="ps_estimes" value={technicalData.ps_estimes} onChange={handleTechnicalChange} className={styles.input} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => onClose(false)}>
                  Annuler
                </button>
                <button type="submit" className={styles.saveBtn} disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'documents' && (
            <div className={styles.documentsTab}>
              <div className={styles.uploadSection}>
                <label className={styles.uploadBtn}>
                  <Upload size={18} />
                  {uploadingFile ? 'Upload...' : 'Ajouter un document'}
                  <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploadingFile} />
                </label>
                <p className={styles.hint}>PDF, Images, Documents Office (max 10MB)</p>
              </div>

              <div className={styles.documentsList}>
                {documents.map(doc => (
                  <div key={doc.id} className={styles.documentItem}>
                    <div className={styles.documentInfo}>
                      <strong>{doc.file_name}</strong>
                      <span className={styles.documentMeta}>
                        {(doc.file_size / 1024).toFixed(0)} KB - {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className={styles.documentActions}>
                      <button onClick={() => handleDownloadDocument(doc.id, doc.file_name)} className={styles.iconBtn}>
                        <Download size={18} />
                      </button>
                      <button onClick={() => handleDeleteDocument(doc.id)} className={styles.iconBtn}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {documents.length === 0 && (
                  <div className={styles.emptyState}>Aucun document</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className={styles.commentsTab}>
              <div className={styles.addComment}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  className={styles.textarea}
                  rows={3}
                />
                <button onClick={handleAddComment} className={styles.sendBtn} disabled={!newComment.trim()}>
                  <Send size={18} />
                  Envoyer
                </button>
              </div>

              <div className={styles.commentsList}>
                {comments.map(comment => (
                  <div key={comment.id} className={styles.commentItem}>
                    <div className={styles.commentHeader}>
                      <strong>{comment.username}</strong>
                      <span className={styles.commentDate}>
                        {new Date(comment.created_at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <div className={styles.commentContent}>{comment.content}</div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className={styles.emptyState}>Aucun commentaire</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientModal;
