import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { X, MessageSquare, Calendar, Send, User, Save } from 'lucide-react';
import styles from './LeadModal.module.css';

const LeadModal = ({ lead, onClose }) => {
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
  const [leadInfo, setLeadInfo] = useState({
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    address: lead.address || '',
    mobile_phone: lead.mobile_phone || '',
    country: lead.country || '',
    city: lead.city || '',
    postal_code: lead.postal_code || ''
  });

  useEffect(() => {
    fetchComments();
    fetchAppointments();
  }, [lead]);

  const fetchComments = async () => {
    try {
      const response = await api.get(`/comments/lead/${lead.id}`);
      setComments(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await api.get(`/appointments/lead/${lead.id}`);
      setAppointments(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des RDV:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await api.post('/comments', {
        lead_id: lead.id,
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
      await api.post('/appointments', {
        lead_id: lead.id,
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
      await api.delete(`/comments/${commentId}`);
      fetchComments();
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  const handleDeleteAppointment = async (appointmentId) => {
    if (!confirm('Supprimer ce RDV ?')) return;

    try {
      await api.delete(`/appointments/${appointmentId}`);
      fetchAppointments();
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  const handleSaveLeadInfo = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/leads/${lead.id}`, leadInfo);
      setEditMode(false);
      alert('Informations mises à jour');
      onClose(); // Ferme et rafraîchit
    } catch (error) {
      alert('Erreur lors de la mise à jour');
    }
  };

  const handleConvertToClient = async () => {
    if (!confirm(`Convertir "${lead.first_name} ${lead.last_name}" en client ?\n\nCela supprimera le lead et créera un nouveau client avec ses informations, commentaires et rendez-vous.`)) {
      return;
    }

    try {
      const response = await api.post(`/clients/convert-from-lead/${lead.id}`);
      alert('Lead converti en client avec succès !');
      onClose(); // Ferme et rafraîchit
    } catch (error) {
      alert('Erreur lors de la conversion');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>
              {lead.first_name} {lead.last_name}
            </h2>
            <div className={styles.info}>
              {lead.email && <span>{lead.email}</span>}
              {lead.phone && <span>{lead.phone}</span>}
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
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
                <h3>Informations du lead</h3>
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} className={styles.editBtn}>
                    Modifier
                  </button>
                ) : null}
              </div>

              <form onSubmit={handleSaveLeadInfo} className={styles.infoForm}>
                <div className={styles.formGroup}>
                  <label>Prénom *</label>
                  <input
                    type="text"
                    value={leadInfo.first_name}
                    onChange={(e) => setLeadInfo({...leadInfo, first_name: e.target.value})}
                    disabled={!editMode}
                    required
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Nom *</label>
                  <input
                    type="text"
                    value={leadInfo.last_name}
                    onChange={(e) => setLeadInfo({...leadInfo, last_name: e.target.value})}
                    disabled={!editMode}
                    required
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={leadInfo.email}
                    onChange={(e) => setLeadInfo({...leadInfo, email: e.target.value})}
                    disabled={!editMode}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Téléphone fixe</label>
                  <input
                    type="tel"
                    value={leadInfo.phone}
                    onChange={(e) => setLeadInfo({...leadInfo, phone: e.target.value})}
                    disabled={!editMode}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Téléphone mobile</label>
                  <input
                    type="tel"
                    value={leadInfo.mobile_phone}
                    onChange={(e) => setLeadInfo({...leadInfo, mobile_phone: e.target.value})}
                    disabled={!editMode}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Adresse complète</label>
                  <input
                    type="text"
                    value={leadInfo.address}
                    onChange={(e) => setLeadInfo({...leadInfo, address: e.target.value})}
                    disabled={!editMode}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Pays</label>
                    <input
                      type="text"
                      value={leadInfo.country}
                      onChange={(e) => setLeadInfo({...leadInfo, country: e.target.value})}
                      disabled={!editMode}
                      className={styles.input}
                      placeholder="France"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Ville</label>
                    <input
                      type="text"
                      value={leadInfo.city}
                      onChange={(e) => setLeadInfo({...leadInfo, city: e.target.value})}
                      disabled={!editMode}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Code postal</label>
                  <input
                    type="text"
                    value={leadInfo.postal_code}
                    onChange={(e) => setLeadInfo({...leadInfo, postal_code: e.target.value})}
                    disabled={!editMode}
                    className={styles.input}
                  />
                </div>

                {editMode && (
                  <div className={styles.formActions}>
                    <button type="button" onClick={() => {
                      setEditMode(false);
                      setLeadInfo({
                        first_name: lead.first_name || '',
                        last_name: lead.last_name || '',
                        email: lead.email || '',
                        phone: lead.phone || '',
                        address: lead.address || '',
                        mobile_phone: lead.mobile_phone || '',
                        country: lead.country || '',
                        city: lead.city || '',
                        postal_code: lead.postal_code || ''
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

              {!editMode && (
                <div className={styles.convertSection}>
                  <button onClick={handleConvertToClient} className={styles.convertBtn}>
                    <User size={16} /> Convertir en Client
                  </button>
                  <p className={styles.convertInfo}>
                    Transforme ce lead en client. Toutes les informations, commentaires et rendez-vous seront conservés.
                  </p>
                </div>
              )}
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
    </div>
  );
};

export default LeadModal;
