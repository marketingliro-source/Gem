import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { X, MessageSquare, Calendar, Send, User, Save, CheckCircle, Mail, FileText, XCircle, Phone, Calculator } from 'lucide-react';
import styles from './ClientModal.module.css';
import DimensioningModal from './DimensioningModal';

const ClientModal = ({ client, onClose }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    date: '',
    time: ''
  });
  const [activeTab, setActiveTab] = useState('info');
  const [editMode, setEditMode] = useState(false);
  const [clientInfo, setClientInfo] = useState({
    first_name: client.first_name || '',
    last_name: client.last_name || '',
    email: client.email || '',
    address: client.address || '',
    city: client.city || '',
    postal_code: client.postal_code || '',
    landline_phone: client.landline_phone || '',
    mobile_phone: client.mobile_phone || '',
    mail_sent: client.mail_sent || false,
    document_received: client.document_received || false,
    cancelled: client.cancelled || false
  });
  const [showDimensioningModal, setShowDimensioningModal] = useState(false);

  useEffect(() => {
    fetchComments();
    fetchAppointments();
  }, [client]);

  const fetchComments = async () => {
    try {
      const response = await api.get(`/clients/${client.id}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await api.get(`/clients/${client.id}/appointments`);
      setAppointments(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des RDV:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await api.post(`/clients/${client.id}/comments`, {
        content: newComment
      });
      setNewComment('');
      fetchComments();
    } catch (error) {
      alert('Erreur lors de l\'ajout du commentaire');
    }
  };

  const handleAddAppointment = async (e) => {
    e.preventDefault();
    if (!newAppointment.title || !newAppointment.date || !newAppointment.time) return;

    try {
      await api.post(`/clients/${client.id}/appointments`, {
        ...newAppointment
      });
      setNewAppointment({ title: '', date: '', time: '' });
      fetchAppointments();
    } catch (error) {
      alert('Erreur lors de l\'ajout du RDV');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Supprimer ce commentaire ?')) return;

    try {
      await api.delete(`/clients/${client.id}/comments/${commentId}`);
      fetchComments();
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  const handleDeleteAppointment = async (appointmentId) => {
    if (!confirm('Supprimer ce RDV ?')) return;

    try {
      await api.delete(`/clients/${client.id}/appointments/${appointmentId}`);
      fetchAppointments();
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  const handleTrackingChange = (field) => {
    // For agents: can only check (not uncheck)
    // For admins: can toggle
    if (user.role === 'agent' && clientInfo[field]) {
      return; // Agent cannot uncheck
    }
    setClientInfo({
      ...clientInfo,
      [field]: !clientInfo[field]
    });
    if (!editMode) {
      setEditMode(true);
    }
  };

  const handleSaveClientInfo = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/clients/${client.id}`, clientInfo);
      setEditMode(false);
      alert('Informations mises à jour');
      onClose();
    } catch (error) {
      alert('Erreur lors de la mise à jour');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2 className={styles.title}>
                {client.first_name} {client.last_name}
              </h2>
              {client.status && (
                <span className={`${styles.statusBadge} ${styles[`status_${client.status}`]}`}>
                  {client.status === 'nouveau' && '🆕 Nouveau client'}
                  {client.status === 'mail_envoye' && '✉️ Mail envoyé'}
                  {client.status === 'documents_recus' && '📄 Documents reçus'}
                  {client.status === 'annule' && '❌ Annulé'}
                </span>
              )}
            </div>
            <div className={styles.info}>
              {client.email && <span>{client.email}</span>}
              {client.phone && <span>{client.phone}</span>}
              {client.city && <span>{client.city}</span>}
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={() => setShowDimensioningModal(true)}
              className={styles.dimensioningBtn}
              title="Générer une note de dimensionnement"
            >
              <Calculator size={20} />
              Note de dimensionnement
            </button>
            <button onClick={onClose} className={styles.closeBtn}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'info' ? styles.active : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <User size={16} />
            Informations
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'comments' ? styles.active : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            <MessageSquare size={16} />
            Commentaires ({comments.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'appointments' ? styles.active : ''}`}
            onClick={() => setActiveTab('appointments')}
          >
            <Calendar size={16} />
            Rendez-vous ({appointments.length})
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'info' ? (
            <div className={styles.infoTab}>
              <div className={styles.editHeader}>
                <h3>Informations du client</h3>
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} className={styles.editBtn}>
                    Modifier
                  </button>
                ) : null}
              </div>

              <form onSubmit={handleSaveClientInfo} className={styles.infoForm}>
                <div className={styles.formGroup}>
                  <label>Prénom *</label>
                  <input
                    type="text"
                    value={clientInfo.first_name}
                    onChange={(e) => setClientInfo({...clientInfo, first_name: e.target.value})}
                    disabled={!editMode}
                    required
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Nom *</label>
                  <input
                    type="text"
                    value={clientInfo.last_name}
                    onChange={(e) => setClientInfo({...clientInfo, last_name: e.target.value})}
                    disabled={!editMode}
                    required
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={clientInfo.email}
                    onChange={(e) => setClientInfo({...clientInfo, email: e.target.value})}
                    disabled={!editMode}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Adresse</label>
                  <input
                    type="text"
                    value={clientInfo.address}
                    onChange={(e) => setClientInfo({...clientInfo, address: e.target.value})}
                    disabled={!editMode}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Ville</label>
                    <input
                      type="text"
                      value={clientInfo.city}
                      onChange={(e) => setClientInfo({...clientInfo, city: e.target.value})}
                      disabled={!editMode}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Code postal</label>
                    <input
                      type="text"
                      value={clientInfo.postal_code}
                      onChange={(e) => setClientInfo({...clientInfo, postal_code: e.target.value})}
                      disabled={!editMode}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.separator}></div>

                <div className={styles.formGroup}>
                  <label>
                    <Phone size={16} /> Numéros de téléphone
                  </label>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Fixe</label>
                      <input
                        type="tel"
                        value={clientInfo.landline_phone}
                        onChange={(e) => setClientInfo({...clientInfo, landline_phone: e.target.value})}
                        disabled={!editMode}
                        placeholder="01 23 45 67 89"
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>Mobile</label>
                      <input
                        type="tel"
                        value={clientInfo.mobile_phone}
                        onChange={(e) => setClientInfo({...clientInfo, mobile_phone: e.target.value})}
                        disabled={!editMode}
                        placeholder="06 12 34 56 78"
                        className={styles.input}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.separator}></div>

                <h4 className={styles.sectionTitle}>
                  <CheckCircle size={18} /> Suivi du dossier
                </h4>

                <div className={styles.trackingGroup}>
                  <label
                    className={`${styles.trackingLabel} ${clientInfo.mail_sent ? styles.checked : ''}`}
                    onClick={() => handleTrackingChange('mail_sent')}
                  >
                    <Mail size={18} />
                    <span>Courrier envoyé</span>
                    {clientInfo.mail_sent && <CheckCircle size={16} className={styles.checkIcon} />}
                  </label>

                  <label
                    className={`${styles.trackingLabel} ${clientInfo.document_received ? styles.checked : ''}`}
                    onClick={() => handleTrackingChange('document_received')}
                  >
                    <FileText size={18} />
                    <span>Document reçu</span>
                    {clientInfo.document_received && <CheckCircle size={16} className={styles.checkIcon} />}
                  </label>

                  <label
                    className={`${styles.trackingLabel} ${clientInfo.cancelled ? styles.checked : ''} ${clientInfo.cancelled ? styles.cancelled : ''}`}
                    onClick={() => handleTrackingChange('cancelled')}
                  >
                    <XCircle size={18} />
                    <span>Annulé</span>
                    {clientInfo.cancelled && <CheckCircle size={16} className={styles.checkIcon} />}
                  </label>
                </div>

                {user.role === 'agent' && (
                  <p className={styles.trackingHint}>
                    💡 Vous pouvez cocher les cases mais pas les décocher. Contactez un administrateur pour modifier.
                  </p>
                )}

                {editMode && (
                  <div className={styles.formActions}>
                    <button type="button" onClick={() => {
                      setEditMode(false);
                      setClientInfo({
                        first_name: client.first_name || '',
                        last_name: client.last_name || '',
                        email: client.email || '',
                        address: client.address || '',
                        city: client.city || '',
                        postal_code: client.postal_code || '',
                        landline_phone: client.landline_phone || '',
                        mobile_phone: client.mobile_phone || '',
                        mail_sent: client.mail_sent || false,
                        document_received: client.document_received || false,
                        cancelled: client.cancelled || false
                      });
                    }} className={styles.cancelBtn}>
                      Annuler
                    </button>
                    <button type="submit" className={styles.saveBtn}>
                      <Save size={16} /> Enregistrer
                    </button>
                  </div>
                )}
              </form>
            </div>
          ) : activeTab === 'comments' ? (
            <>
              <div className={styles.list}>
                {comments.length === 0 ? (
                  <div className={styles.empty}>Aucun commentaire</div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className={styles.comment}>
                      <div className={styles.commentHeader}>
                        <span className={styles.username}>{comment.username}</span>
                        <span className={styles.date}>
                          {new Date(comment.created_at).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <p className={styles.commentContent}>{comment.content}</p>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className={styles.deleteBtn}
                      >
                        Supprimer
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className={styles.form}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  rows={3}
                  className={styles.textarea}
                />
                <button type="submit" className={styles.submitBtn}>
                  <Send size={16} /> Envoyer
                </button>
              </form>
            </>
          ) : (
            <>
              <div className={styles.list}>
                {appointments.length === 0 ? (
                  <div className={styles.empty}>Aucun rendez-vous</div>
                ) : (
                  appointments.map(appointment => (
                    <div key={appointment.id} className={styles.appointment}>
                      <div className={styles.appointmentHeader}>
                        <span className={styles.appointmentTitle}>{appointment.title}</span>
                        <span className={styles.username}>{appointment.username}</span>
                      </div>
                      <div className={styles.appointmentDate}>
                        {new Date(appointment.date).toLocaleDateString('fr-FR')} à {appointment.time}
                      </div>
                      <button
                        onClick={() => handleDeleteAppointment(appointment.id)}
                        className={styles.deleteBtn}
                      >
                        Supprimer
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddAppointment} className={styles.form}>
                <input
                  type="text"
                  value={newAppointment.title}
                  onChange={(e) => setNewAppointment({ ...newAppointment, title: e.target.value })}
                  placeholder="Titre du RDV"
                  className={styles.input}
                />
                <div className={styles.row}>
                  <input
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                    className={styles.input}
                  />
                  <input
                    type="time"
                    value={newAppointment.time}
                    onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                    className={styles.input}
                  />
                </div>
                <button type="submit" className={styles.submitBtn}>
                  <Calendar size={16} /> Créer le RDV
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {showDimensioningModal && (
        <DimensioningModal
          client={client}
          onClose={() => setShowDimensioningModal(false)}
        />
      )}
    </div>
  );
};

export default ClientModal;
