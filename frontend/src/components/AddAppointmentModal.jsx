import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { X, Save, Search, Calendar, Clock } from 'lucide-react';
import styles from './AddAppointmentModal.module.css';

const AddAppointmentModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    title: '',
    client_base_id: null,
    location: '',
    notes: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, date: today }));
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchContacts();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchContacts = async () => {
    setSearching(true);
    try {
      // Search only clients (no leads system in backend)
      const clientsRes = await api.get(`/clients?search=${searchQuery}`);

      const clients = (clientsRes.data.clients || clientsRes.data).map(client => {
        // Build display name with both company and contact name
        let name = client.societe || '';
        if (client.nom_signataire && client.societe) {
          name = `${client.societe} - ${client.nom_signataire}`;
        } else if (client.nom_signataire) {
          name = client.nom_signataire;
        }

        return {
          ...client,
          type: 'client',
          displayName: name || 'Sans nom',
          // Map client fields to expected format
          phone: client.telephone || '',
          city: client.code_postal || ''
        };
      });

      setSearchResults(clients);
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setSearchQuery(contact.displayName);
    setSearchResults([]);

    // Set client_base_id from selected contact
    setFormData(prev => ({
      ...prev,
      client_base_id: contact.id,
      title: `RDV avec ${contact.nom_signataire || contact.societe || 'Client'}`
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedContact) {
      setError('Veuillez sélectionner un contact');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/appointments', formData);
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création du rendez-vous');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Nouveau Rendez-vous</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Rechercher un contact</label>
            <div className={styles.searchWrapper}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, prénom, téléphone..."
                className={styles.searchInput}
                autoComplete="off"
              />
              {searching && <div className={styles.spinner}></div>}
            </div>

            {searchResults.length > 0 && (
              <div className={styles.searchResults}>
                {searchResults.map((contact) => (
                  <div
                    key={`${contact.type}-${contact.id}`}
                    onClick={() => handleSelectContact(contact)}
                    className={styles.searchResultItem}
                  >
                    <div className={styles.contactName}>{contact.displayName}</div>
                    <div className={styles.contactInfo}>
                      {contact.phone} • {contact.city}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedContact && (
              <div className={styles.selectedContact}>
                <div className={styles.contactBadge}>
                  ✅ {selectedContact.displayName}
                </div>
              </div>
            )}
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>
                <Calendar size={16} /> Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>
                <Clock size={16} /> Heure
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Titre du rendez-vous</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Ex: Visite technique"
              className={styles.input}
            />
          </div>

          {error && (
            <div className={styles.error}>{error}</div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !selectedContact}
              className={styles.saveBtn}
            >
              <Save size={18} />
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAppointmentModal;
