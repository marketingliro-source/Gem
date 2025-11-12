import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { X, Save, Shield, Wifi } from 'lucide-react';
import styles from './EditUserModal.module.css';

const EditUserModal = ({ user, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    username: user.username || '',
    password: '',
    role: user.role || 'agent',
    allowed_ip: user.allowed_ip || '',
    ip_restriction_enabled: user.ip_restriction_enabled || false
  });
  const [currentIp, setCurrentIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCurrentIp();
  }, []);

  const fetchCurrentIp = async () => {
    try {
      const response = await api.get('/auth/client-ip');
      setCurrentIp(response.data.ip);
    } catch (err) {
      console.error('Erreur lors de la récupération de l\'IP:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const updateData = {
        username: formData.username,
        role: formData.role,
        allowed_ip: formData.allowed_ip || null,
        ip_restriction_enabled: formData.ip_restriction_enabled
      };

      // N'inclure le mot de passe que s'il est renseigné
      if (formData.password) {
        updateData.password = formData.password;
      }

      await api.patch(`/users/${user.id}`, updateData);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentIp = () => {
    setFormData({ ...formData, allowed_ip: currentIp });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Modifier l'utilisateur</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Shield size={18} />
              Informations de base
            </h3>

            <div className={styles.formGroup}>
              <label>Nom d'utilisateur</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Mot de passe</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Laisser vide pour ne pas modifier"
                className={styles.input}
              />
              <span className={styles.hint}>Laisser vide pour conserver le mot de passe actuel</span>
            </div>

            <div className={styles.formGroup}>
              <label>Rôle</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
                className={styles.select}
              >
                <option value="agent">Agent (Télépro)</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
          </div>

          <div className={`${styles.section} ${formData.role === 'admin' ? styles.sectionDisabled : ''}`}>
            <h3 className={styles.sectionTitle}>
              <Wifi size={18} />
              Restriction IP
            </h3>

            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.ip_restriction_enabled}
                  onChange={(e) => setFormData({ ...formData, ip_restriction_enabled: e.target.checked })}
                  className={styles.checkbox}
                  disabled={formData.role === 'admin'}
                />
                <span>Activer la restriction par IP</span>
              </label>
              <span className={styles.hint}>
                L'utilisateur ne pourra se connecter que depuis l'adresse IP autorisée
              </span>
            </div>

            {formData.ip_restriction_enabled && formData.role !== 'admin' && (
              <>
                <div className={styles.formGroup}>
                  <label>Adresse IP autorisée</label>
                  <div className={styles.ipInput}>
                    <input
                      type="text"
                      value={formData.allowed_ip}
                      onChange={(e) => setFormData({ ...formData, allowed_ip: e.target.value })}
                      placeholder="Ex: 192.168.1.100"
                      className={styles.input}
                    />
                    {currentIp && (
                      <button
                        type="button"
                        onClick={handleUseCurrentIp}
                        className={styles.useCurrentIpBtn}
                      >
                        Utiliser IP actuelle
                      </button>
                    )}
                  </div>
                  {currentIp && (
                    <span className={styles.hint}>Votre IP actuelle : <strong>{currentIp}</strong></span>
                  )}
                </div>
              </>
            )}
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
              disabled={loading}
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

export default EditUserModal;
