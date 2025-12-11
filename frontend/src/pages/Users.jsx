import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import EditUserModal from '../components/EditUserModal';
import { UserPlus, Trash2, Shield, User, Edit } from 'lucide-react';
import styles from './Users.module.css';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'telepro',
    allowed_ip: '',
    ip_restriction_enabled: false
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', newUser);
      setNewUser({
        username: '',
        password: '',
        role: 'telepro',
        allowed_ip: '',
        ip_restriction_enabled: false
      });
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Erreur lors de la création');
    }
  };

  const handleDeleteUser = async (userId) => {
    const user = users.find(u => u.id === userId);
    const userName = user ? user.username : 'cet utilisateur';

    if (!confirm(`Supprimer l'utilisateur "${userName}" ?\n\nCette action est irréversible.\nLes clients assignés seront désassignés automatiquement.`)) {
      return;
    }

    try {
      const response = await api.delete(`/users/${userId}`);

      // Afficher les impacts si présents
      if (response.data.impacts && response.data.impacts.length > 0) {
        const impactsMessage = response.data.impacts.join('\n• ');
        alert(`✓ ${response.data.message}\n\nImpacts:\n• ${impactsMessage}`);
      } else {
        alert(`✓ ${response.data.message}`);
      }

      fetchUsers();
    } catch (error) {
      // Afficher le message d'erreur détaillé du backend
      const errorMessage = error.response?.data?.error || 'Erreur lors de la suppression';
      alert(`❌ Erreur: ${errorMessage}`);
      console.error('Erreur lors de la suppression:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestion des Utilisateurs</h1>
          <p className={styles.subtitle}>{users.length} utilisateur(s)</p>
        </div>
        <button onClick={() => setShowModal(true)} className={styles.createBtn}>
          <UserPlus size={20} /> Nouvel utilisateur
        </button>
      </div>

      <div className={styles.grid}>
        {loading ? (
          <div className={styles.loading}>Chargement...</div>
        ) : (
          users.map(user => (
            <div key={user.id} className={styles.userCard}>
              <div className={styles.userHeader}>
                <div className={styles.avatar}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className={styles.userInfo}>
                  <h3 className={styles.username}>{user.username}</h3>
                  <div className={`${styles.badge} ${user.role === 'admin' ? styles.badgeAdmin : styles.badgeTéléprospecteur}`}>
                    {user.role === 'admin' ? (
                      <><Shield size={14} /> Administrateur</>
                    ) : (
                      <><User size={14} /> Téléprospecteur</>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.userFooter}>
                <span className={styles.date}>
                  Créé le {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </span>
                <div className={styles.actions}>
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setShowEditModal(true);
                    }}
                    className={styles.editBtn}
                    title="Modifier"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className={styles.deleteBtn}
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Créer un utilisateur</h2>
            <form onSubmit={handleCreateUser} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="username">Nom d'utilisateur</label>
                <input
                  type="text"
                  id="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                  placeholder="Entrez le nom d'utilisateur"
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="password">Mot de passe</label>
                <input
                  type="password"
                  id="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  placeholder="Entrez le mot de passe"
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="role">Rôle</label>
                <select
                  id="role"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="telepro">Téléprospecteur (Telepro)</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              {/* Section Restriction IP - Uniquement pour les agents */}
              {newUser.role === 'telepro' && (
                <>
                  <div className={styles.inputGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={newUser.ip_restriction_enabled}
                        onChange={(e) => setNewUser({
                          ...newUser,
                          ip_restriction_enabled: e.target.checked
                        })}
                      />
                      <span>Activer la restriction par IP</span>
                    </label>
                    <p className={styles.helperText}>
                      Limite l'accès de cet agent à une adresse IP spécifique
                    </p>
                  </div>

                  {newUser.ip_restriction_enabled && (
                    <div className={styles.inputGroup}>
                      <label htmlFor="allowed_ip">Adresse IP autorisée</label>
                      <input
                        type="text"
                        id="allowed_ip"
                        value={newUser.allowed_ip}
                        onChange={(e) => setNewUser({
                          ...newUser,
                          allowed_ip: e.target.value
                        })}
                        placeholder="Ex: 192.168.1.100"
                      />
                    </div>
                  )}
                </>
              )}

              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} className={styles.cancelBtn}>
                  Annuler
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            fetchUsers();
          }}
        />
      )}
    </div>
  );
};

export default Users;
