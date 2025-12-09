import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { X, UserCheck } from 'lucide-react';
import styles from './ClientModal.module.css';

const AssignClientsModal = ({ clientIds, onClose, onAssigned }) => {
  const [telepros, setTelepros] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTelepros();
  }, []);

  const fetchTelepros = async () => {
    try {
      const response = await api.get('/users/telepros');
      setTelepros(response.data);
    } catch (error) {
      console.error('Erreur chargement télépros:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) {
      alert('Veuillez sélectionner un télépro');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/clients/bulk-assign', {
        clientIds,
        userId: parseInt(selectedUserId)
      });

      alert(response.data.message);
      onAssigned && onAssigned();
      onClose();
    } catch (error) {
      console.error('Erreur attribution en masse:', error);
      alert('Erreur lors de l\'attribution');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserCheck size={24} style={{ color: '#10b981' }} />
            <h2>Attribuer {clientIds.length} client(s)</h2>
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.section}>
            <p style={{ marginBottom: '20px', color: '#94a3b8' }}>
              Sélectionnez le télépro à qui attribuer les {clientIds.length} client(s) sélectionné(s).
              Les clients déjà attribués seront réattribués.
            </p>

            <div className={styles.formGroup}>
              <label>Télépro *</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className={styles.styledSelect}
                disabled={loading}
                required
              >
                <option value="">-- Sélectionner un télépro --</option>
                {telepros.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.username} ({t.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            onClick={onClose}
            className={styles.cancelButton}
            disabled={loading}
          >
            Annuler
          </button>
          <button
            onClick={handleAssign}
            className={styles.saveButton}
            disabled={loading || !selectedUserId}
          >
            {loading ? 'Attribution...' : 'Attribuer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignClientsModal;
