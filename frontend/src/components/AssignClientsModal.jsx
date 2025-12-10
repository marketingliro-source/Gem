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

      alert(`✅ ${response.data.message}`);
      onAssigned && onAssigned();
      onClose();
    } catch (error) {
      console.error('Erreur attribution en masse:', error);
      alert('❌ Erreur lors de l\'attribution');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserCheck size={24} style={{ color: 'var(--accent-color)' }} />
            <div>
              <h2 className={styles.title}>Attribuer des clients</h2>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.content}>
          {/* Info */}
          <div style={{
            padding: '14px 16px',
            background: 'var(--bg-hover)',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '4px'
            }}>
              {clientIds.length} client(s) sélectionné(s)
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Choisissez le télépro à qui attribuer ces clients.
              Les clients déjà attribués seront réattribués.
            </div>
          </div>

          {/* Select Telepro */}
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

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button
            onClick={onClose}
            className={styles.cancelBtn}
            disabled={loading}
          >
            Annuler
          </button>
          <button
            onClick={handleAssign}
            className={styles.saveBtn}
            disabled={loading || !selectedUserId}
            style={{
              opacity: loading || !selectedUserId ? 0.6 : 1,
              cursor: loading || !selectedUserId ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Attribution...' : 'Attribuer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignClientsModal;
