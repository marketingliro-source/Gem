import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { X, Save, Upload, Download, Trash2, MessageSquare, Calendar, Send, FileText, Eye } from 'lucide-react';
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
  const [dragActive, setDragActive] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    notes: ''
  });
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Multi-produits : stocker tous les produits du client
  const [clientProduits, setClientProduits] = useState([]);
  const [currentProduitId, setCurrentProduitId] = useState(client?.produit_id || null);

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

    // Contact sur Site
    nom_contact_site: client?.nom_contact_site || '',
    prenom_contact_site: client?.prenom_contact_site || '',
    fonction_contact_site: client?.fonction_contact_site || '',
    mail_contact_site: client?.mail_contact_site || '',
    telephone_contact_site: client?.telephone_contact_site || '',

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

    // Matelas
    chaufferie: client?.donnees_techniques?.chaufferie || '',
    calorifuge: client?.donnees_techniques?.calorifuge || '',
    ps_estimes: client?.donnees_techniques?.ps_estimes || ''
  });

  // Groupes de pression dynamiques
  const initGroupesPression = () => {
    if (client?.donnees_techniques?.groupes_pression && Array.isArray(client.donnees_techniques.groupes_pression)) {
      return client.donnees_techniques.groupes_pression;
    }
    // Migration: si ancien format (nb_groupes/puissance_totale_pression)
    if (client?.donnees_techniques?.nb_groupes || client?.donnees_techniques?.puissance_totale_pression) {
      const nbGroupes = parseInt(client.donnees_techniques.nb_groupes) || 1;
      const puissanceTotal = parseFloat(client.donnees_techniques.puissance_totale_pression) || 0;
      return Array.from({ length: nbGroupes }, (_, i) => ({
        numero: i + 1,
        puissance: i === 0 ? puissanceTotal : 0
      }));
    }
    return [{ numero: 1, puissance: 0 }];
  };
  const [groupesPression, setGroupesPression] = useState(initGroupesPression());

  const PRODUITS = [
    { key: 'destratification', label: 'Destratification', color: '#10b981' },
    { key: 'pression', label: 'Pression', color: '#8b5cf6' },
    { key: 'matelas_isolants', label: 'Matelas Isolants', color: '#f59e0b' }
  ];

  const [telepros, setTelepros] = useState([]);
  const [statuts, setStatuts] = useState([]);

  useEffect(() => {
    if (!isNew) {
      fetchClientComplete();
      fetchDocuments();
      fetchComments();
      fetchAppointments();
    }
    if (user?.role === 'admin') {
      fetchTelepros();
    }
    fetchStatuts();
  }, []);

  const fetchClientComplete = async () => {
    try {
      const response = await api.get(`/clients/${client.id}`);
      // response.data contient { ...client_base, produits: [...] }
      setClientProduits(response.data.produits || []);
    } catch (error) {
      console.error('Erreur chargement client complet:', error);
    }
  };

  const fetchStatuts = async () => {
    try {
      const response = await api.get('/statuts');
      setStatuts(response.data);
    } catch (error) {
      console.error('Erreur chargement statuts:', error);
    }
  };

  const fetchTelepros = async () => {
    try {
      const response = await api.get('/users/telepros');
      setTelepros(response.data);
    } catch (error) {
      console.error('Erreur chargement télépros:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await api.get(`/documents/client/${client.id}`);
      setDocuments(response.data);
    } catch (error) {
      console.error('Erreur chargement documents:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(`/clients/${client.id}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Erreur chargement commentaires:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await api.get(`/clients/${client.id}/appointments`);
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

  // Gestion des groupes de pression dynamiques
  const handleAddGroupe = () => {
    const nextNumero = groupesPression.length + 1;
    setGroupesPression([...groupesPression, { numero: nextNumero, puissance: 0 }]);
  };

  const handleRemoveGroupe = (index) => {
    if (groupesPression.length === 1) {
      alert('Vous devez avoir au moins un groupe');
      return;
    }
    setGroupesPression(groupesPression.filter((_, i) => i !== index));
  };

  const handleGroupeChange = (index, field, value) => {
    const updated = [...groupesPression];
    updated[index][field] = field === 'puissance' ? parseFloat(value) || 0 : value;
    setGroupesPression(updated);
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
          groupes_pression: groupesPression
        };
      } else if (formData.type_produit === 'matelas_isolants') {
        donneesFinales = {
          chaufferie: technicalData.chaufferie,
          calorifuge: technicalData.calorifuge,
          ps_estimes: technicalData.ps_estimes
        };
      }

      if (isNew) {
        // Créer nouveau client avec produit
        const payload = {
          ...formData,
          donnees_techniques: donneesFinales
        };
        await api.post('/clients', payload);
      } else {
        // Édition : séparer données communes vs données produit
        // 1. Sauvegarder données communes (client_base)
        const commonData = {
          societe: formData.societe,
          adresse: formData.adresse,
          code_postal: formData.code_postal,
          telephone: formData.telephone,
          siret: formData.siret,
          nom_site: formData.nom_site,
          adresse_travaux: formData.adresse_travaux,
          code_postal_travaux: formData.code_postal_travaux,
          nom_signataire: formData.nom_signataire,
          fonction: formData.fonction,
          telephone_signataire: formData.telephone_signataire,
          mail_signataire: formData.mail_signataire,
          nom_contact_site: formData.nom_contact_site,
          prenom_contact_site: formData.prenom_contact_site,
          fonction_contact_site: formData.fonction_contact_site,
          mail_contact_site: formData.mail_contact_site,
          telephone_contact_site: formData.telephone_contact_site,
          code_naf: formData.code_naf
        };
        await api.patch(`/clients/${client.id}`, commonData);

        // 2. Sauvegarder données produit spécifiques
        if (currentProduitId) {
          const produitData = {
            // Note: type_produit n'est plus modifiable en édition (champ disabled)
            donnees_techniques: donneesFinales,
            statut: formData.statut
          };

          await api.patch(`/clients/produits/${currentProduitId}`, produitData);
        }
      }

      onClose(true); // Refresh la liste
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Store count BEFORE clearing input
    const fileCount = files.length;

    setUploadingFile(true);
    try {
      for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);

        await api.post(`/documents/upload/${client.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      fetchDocuments();
      if (e.target) e.target.value = '';
      alert(`${fileCount} document(s) ajouté(s) avec succès`);
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('Erreur lors de l\'upload du fichier');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setUploadingFile(true);

      try {
        for (let file of files) {
          const formData = new FormData();
          formData.append('file', file);

          await api.post(`/documents/upload/${client.id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }

        fetchDocuments();
        alert(`${files.length} document(s) ajouté(s) avec succès`);
      } catch (error) {
        console.error('Erreur upload:', error);
        alert('Erreur lors de l\'upload des fichiers');
      } finally {
        setUploadingFile(false);
      }
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Supprimer ce document ?')) return;

    try {
      await api.delete(`/documents/${docId}`);
      fetchDocuments();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleDownloadDocument = async (docId, fileName) => {
    try {
      const response = await api.get(`/documents/download/${docId}`, {
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
      await api.post(`/clients/${client.id}/comments`, { content: newComment });
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Erreur ajout commentaire:', error);
      alert('Erreur lors de l\'ajout du commentaire');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Supprimer ce commentaire ?')) return;

    try {
      await api.delete(`/clients/${client.id}/comments/${commentId}`);
      fetchComments();
    } catch (error) {
      console.error('Erreur suppression commentaire:', error);
      alert('Erreur lors de la suppression du commentaire');
    }
  };

  const handleAddAppointment = async (e) => {
    e.preventDefault();
    if (!newAppointment.title || !newAppointment.date || !newAppointment.time) {
      alert('Veuillez remplir les champs obligatoires (Titre, Date, Heure)');
      return;
    }

    try {
      await api.post(`/clients/${client.id}/appointments`, newAppointment);
      setNewAppointment({ title: '', date: '', time: '', location: '', notes: '' });
      fetchAppointments();
      alert('Rendez-vous ajouté avec succès');
    } catch (error) {
      console.error('Erreur ajout rendez-vous:', error);
      alert('Erreur lors de l\'ajout du rendez-vous');
    }
  };

  const handleDeleteAppointment = async (appointmentId) => {
    if (!window.confirm('Supprimer ce rendez-vous ?')) return;

    try {
      await api.delete(`/clients/${client.id}/appointments/${appointmentId}`);
      fetchAppointments();
    } catch (error) {
      console.error('Erreur suppression rendez-vous:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handlePreviewDocument = async (doc) => {
    try {
      // Check if file type is previewable (images or PDF)
      const fileExtension = doc.file_name.split('.').pop().toLowerCase();
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const isPdf = fileExtension === 'pdf';
      const isImage = imageExtensions.includes(fileExtension);

      if (!isImage && !isPdf) {
        alert('Aperçu non disponible pour ce type de fichier.\nVeuillez le télécharger pour le consulter.');
        return;
      }

      // Fetch document as blob
      const response = await api.get(`/documents/download/${doc.id}`, {
        responseType: 'blob'
      });

      // Create blob URL
      const blob = new Blob([response.data], {
        type: isPdf ? 'application/pdf' : response.data.type
      });
      const url = window.URL.createObjectURL(blob);

      setPreviewDocument(doc);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Erreur aperçu:', error);
      alert('Erreur lors de l\'aperçu du document');
    }
  };

  const handleClosePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewDocument(null);
    setPreviewUrl(null);
  };

  const getProduitObj = (type) => {
    return PRODUITS.find(p => p.key === type) || PRODUITS[0];
  };

  return (
    <div className={styles.overlay} onClick={() => onClose(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isNew ? 'Nouveau Client' : `Client - ${client.societe || 'Sans nom'}`}</h2>
          <button className={styles.closeBtn} onClick={() => onClose(false)}>
            <X size={24} />
          </button>
        </div>

        {/* Encadré produits multiples */}
        {!isNew && clientProduits.length > 1 && (
          <div style={{
            margin: '16px 24px',
            padding: '12px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
              <strong>Ce client a {clientProduits.length} produits :</strong>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {clientProduits.map(p => {
                const produitObj = getProduitObj(p.type_produit);
                const isCurrent = p.id === currentProduitId;
                return (
                  <span
                    key={p.id}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: isCurrent ? '600' : '400',
                      background: isCurrent ? produitObj.color : `${produitObj.color}30`,
                      color: isCurrent ? '#fff' : produitObj.color,
                      border: isCurrent ? `2px solid ${produitObj.color}` : 'none'
                    }}
                  >
                    {produitObj.label} {isCurrent && '(en cours)'}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'info' ? styles.active : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Informations
          </button>
          {!isNew && (
            <>
              <button
                className={`${styles.tab} ${activeTab === 'documents' ? styles.active : ''}`}
                onClick={() => setActiveTab('documents')}
              >
                Documents ({documents.length})
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'comments' ? styles.active : ''}`}
                onClick={() => setActiveTab('comments')}
              >
                Commentaires ({comments.length})
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'appointments' ? styles.active : ''}`}
                onClick={() => setActiveTab('appointments')}
              >
                Rendez-vous ({appointments.length})
              </button>
            </>
          )}
        </div>

        <div className={styles.content}>
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

              {/* Section Contact sur Site */}
              <div className={styles.section}>
                <h3>Contact sur Site</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Nom</label>
                    <input
                      type="text"
                      name="nom_contact_site"
                      value={formData.nom_contact_site}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Prénom</label>
                    <input
                      type="text"
                      name="prenom_contact_site"
                      value={formData.prenom_contact_site}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Fonction</label>
                    <input
                      type="text"
                      name="fonction_contact_site"
                      value={formData.fonction_contact_site}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Email</label>
                    <input
                      type="email"
                      name="mail_contact_site"
                      value={formData.mail_contact_site}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Téléphone</label>
                    <input
                      type="text"
                      name="telephone_contact_site"
                      value={formData.telephone_contact_site}
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
                    {isNew ? (
                      <select
                        name="type_produit"
                        value={formData.type_produit}
                        onChange={handleChange}
                        className={styles.styledSelect}
                        style={{
                          borderColor: PRODUITS.find(p => p.key === formData.type_produit)?.color || '#10b981'
                        }}
                        required
                      >
                        {PRODUITS.map(p => (
                          <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={PRODUITS.find(p => p.key === formData.type_produit)?.label || formData.type_produit}
                        className={styles.styledInput}
                        style={{
                          borderColor: PRODUITS.find(p => p.key === formData.type_produit)?.color || '#10b981',
                          backgroundColor: '#1e293b',
                          color: '#94a3b8',
                          cursor: 'not-allowed'
                        }}
                        disabled
                        title="Le type de produit ne peut pas être modifié. Utilisez le bouton 'Dupliquer' pour créer un nouveau produit."
                      />
                    )}
                    {!isNew && (
                      <small style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        💡 Utilisez le bouton "Dupliquer" pour créer un autre type de produit
                      </small>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    <label>Statut</label>
                    <select
                      name="statut"
                      value={formData.statut}
                      onChange={handleChange}
                      className={styles.styledSelect}
                      style={{
                        borderColor: statuts.find(s => s.key === formData.statut)?.color || '#10b981'
                      }}
                    >
                      {statuts.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  {user?.role === 'admin' && !isNew && (
                    <div className={styles.formGroup}>
                      <label>Attribué à</label>
                      <select
                        value={client?.assigned_to || ''}
                        onChange={async (e) => {
                          const userId = e.target.value;
                          if (userId) {
                            try {
                              await api.patch(`/clients/${client.id}/assign`, { userId: parseInt(userId) });
                              alert('Client attribué avec succès');
                            } catch (error) {
                              console.error('Erreur attribution:', error);
                              alert('Erreur lors de l\'attribution');
                            }
                          }
                        }}
                        className={styles.styledSelect}
                      >
                        <option value="">Non attribué</option>
                        {telepros.map(t => (
                          <option key={t.id} value={t.id}>{t.username}</option>
                        ))}
                      </select>
                    </div>
                  )}
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
                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <label style={{ margin: 0 }}>Groupes de Pression</label>
                        <button
                          type="button"
                          onClick={handleAddGroupe}
                          className={styles.addButton}
                          style={{
                            background: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>+</span>
                          Ajouter un groupe
                        </button>
                      </div>

                      {groupesPression.map((groupe, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '100px 1fr 40px',
                            gap: '12px',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'rgba(139, 92, 246, 0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            marginBottom: '8px'
                          }}
                        >
                          <div>
                            <label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>
                              Groupe
                            </label>
                            <input
                              type="number"
                              value={groupe.numero}
                              onChange={(e) => handleGroupeChange(index, 'numero', e.target.value)}
                              className={styles.input}
                              style={{ padding: '8px', fontSize: '14px' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>
                              Puissance (kW)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={groupe.puissance}
                              onChange={(e) => handleGroupeChange(index, 'puissance', e.target.value)}
                              className={styles.input}
                              style={{ padding: '8px', fontSize: '14px' }}
                              placeholder="Ex: 150"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveGroupe(index)}
                            disabled={groupesPression.length === 1}
                            style={{
                              background: groupesPression.length === 1 ? '#64748b' : '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px',
                              cursor: groupesPression.length === 1 ? 'not-allowed' : 'pointer',
                              fontSize: '18px',
                              marginTop: '18px',
                              opacity: groupesPression.length === 1 ? 0.5 : 1
                            }}
                            title={groupesPression.length === 1 ? 'Au moins un groupe requis' : 'Supprimer ce groupe'}
                          >
                            −
                          </button>
                        </div>
                      ))}

                      <div style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: '#8b5cf6',
                        fontWeight: '500'
                      }}>
                        Total: {groupesPression.length} groupe(s) • Puissance totale: {groupesPression.reduce((sum, g) => sum + (parseFloat(g.puissance) || 0), 0).toFixed(1)} kW
                      </div>
                    </div>
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
              <div
                className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput').click()}
              >
                <input
                  id="fileInput"
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={uploadingFile}
                />
                <div className={styles.dropzoneContent}>
                  <div className={styles.uploadIcon}>
                    <Upload size={48} />
                  </div>
                  <div className={styles.dropzoneText}>
                    {uploadingFile ? 'Upload en cours...' : 'Glissez vos fichiers ici ou cliquez pour parcourir'}
                  </div>
                  <div className={styles.dropzoneHint}>
                    PDF, Images, Documents Office (max 10MB par fichier)
                  </div>
                </div>
              </div>

              <div className={styles.documentsList}>
                {documents.map(doc => (
                  <div key={doc.id} className={styles.documentCard}>
                    <div className={styles.fileIcon}>
                      <FileText size={24} />
                    </div>
                    <div className={styles.documentInfo}>
                      <div className={styles.documentName}>{doc.file_name}</div>
                      <div className={styles.documentMeta}>
                        {(doc.file_size / 1024).toFixed(0)} KB • {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <div className={styles.documentActions}>
                      <button onClick={() => handlePreviewDocument(doc)} className={styles.iconBtn} title="Aperçu">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleDownloadDocument(doc.id, doc.file_name)} className={styles.iconBtn} title="Télécharger">
                        <Download size={18} />
                      </button>
                      <button onClick={() => handleDeleteDocument(doc.id)} className={styles.iconBtn} title="Supprimer">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {documents.length === 0 && (
                  <div className={styles.emptyState}>
                    <FileText size={48} />
                    <div className={styles.emptyStateText}>Aucun document</div>
                    <div className={styles.hint}>Utilisez la zone ci-dessus pour ajouter des documents</div>
                  </div>
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
                      <div>
                        <strong>{comment.username}</strong>
                        <span className={styles.commentDate}>
                          {' '} · {new Date(comment.created_at).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className={styles.iconBtn}
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
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

          {/* Onglet Rendez-vous */}
          {activeTab === 'appointments' && (
            <div className={styles.appointmentsTab}>
              <form onSubmit={handleAddAppointment} className={styles.appointmentForm}>
                <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Nouveau Rendez-vous</h4>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Titre *</label>
                    <input
                      type="text"
                      value={newAppointment.title}
                      onChange={(e) => setNewAppointment({ ...newAppointment, title: e.target.value })}
                      className={styles.input}
                      placeholder="Ex: Visite technique"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Lieu</label>
                    <input
                      type="text"
                      value={newAppointment.location}
                      onChange={(e) => setNewAppointment({ ...newAppointment, location: e.target.value })}
                      className={styles.input}
                      placeholder="Adresse du rendez-vous"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Date *</label>
                    <input
                      type="date"
                      value={newAppointment.date}
                      onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                      className={styles.input}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Heure *</label>
                    <input
                      type="time"
                      value={newAppointment.time}
                      onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                      className={styles.input}
                      required
                    />
                  </div>
                </div>
                <div className={styles.formGroup} style={{ marginTop: '16px' }}>
                  <label>Notes / Description</label>
                  <textarea
                    value={newAppointment.notes}
                    onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                    className={styles.textarea}
                    rows={3}
                    placeholder="Détails du rendez-vous..."
                  />
                </div>
                <button type="submit" className={styles.saveBtn} style={{ marginTop: '16px' }}>
                  <Calendar size={18} />
                  Ajouter le rendez-vous
                </button>
              </form>

              <div className={styles.appointmentsList}>
                <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Rendez-vous prévus</h4>
                {appointments.map(apt => (
                  <div key={apt.id} className={styles.appointmentItem}>
                    <div className={styles.appointmentIcon}>
                      <Calendar size={20} />
                    </div>
                    <div className={styles.appointmentDetails}>
                      <div className={styles.appointmentTitle}>{apt.title}</div>
                      <div className={styles.appointmentDateTime}>
                        {new Date(apt.date).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })} à {apt.time}
                      </div>
                      {apt.location && (
                        <div className={styles.appointmentLocation}>📍 {apt.location}</div>
                      )}
                      {apt.notes && (
                        <div className={styles.appointmentNotes}>{apt.notes}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAppointment(apt.id)}
                      className={styles.iconBtn}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {appointments.length === 0 && (
                  <div className={styles.emptyState}>
                    <Calendar size={48} />
                    <div className={styles.emptyStateText}>Aucun rendez-vous prévu</div>
                    <div className={styles.hint}>Utilisez le formulaire ci-dessus pour ajouter un rendez-vous</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de prévisualisation des documents */}
      {previewDocument && previewUrl && (
        <div className={styles.previewOverlay} onClick={handleClosePreview}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewHeader}>
              <h3>{previewDocument.file_name}</h3>
              <button onClick={handleClosePreview} className={styles.closeBtn}>
                <X size={24} />
              </button>
            </div>
            <div className={styles.previewContent}>
              {previewDocument.file_name.toLowerCase().endsWith('.pdf') ? (
                <embed
                  src={previewUrl}
                  type="application/pdf"
                  width="100%"
                  height="100%"
                  className={styles.previewEmbed}
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={previewDocument.file_name}
                  className={styles.previewImage}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientModal;
