import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import ClientModal from '../components/ClientModal';
import { Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, MessageSquare, Download } from 'lucide-react';
import styles from './Clients.module.css';

const CLIENT_STATUSES = [
  { value: '', label: 'Tous', color: '#6366f1' },
  { value: 'nouveau', label: 'Nouveau', color: '#10b981' },
  { value: 'mail_envoye', label: 'Mail envoyé', color: '#3b82f6' },
  { value: 'documents_recus', label: 'Documents reçus', color: '#8b5cf6' },
  { value: 'annule', label: 'Annulé', color: '#ef4444' },
];

const Clients = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedClients, setSelectedClients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [selectedClient, setSelectedClient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [hoveredClient, setHoveredClient] = useState(null);
  const [clientComments, setClientComments] = useState({});

  useEffect(() => {
    fetchClients();
  }, [selectedStatus, pagination.page]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients', {
        params: {
          status: selectedStatus,
          page: pagination.page,
          limit: pagination.limit
        }
      });
      setClients(response.data.clients);
      setPagination(prev => ({ ...prev, ...response.data.pagination }));
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedClients(clients.map(client => client.id));
    } else {
      setSelectedClients([]);
    }
  };

  const handleSelectClient = (clientId) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedClients.length) return;
    if (!confirm(`Supprimer ${selectedClients.length} client(s) ?`)) return;

    try {
      for (const id of selectedClients) {
        await api.delete(`/clients/${id}`);
      }
      setSelectedClients([]);
      fetchClients();
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  const fetchClientComments = async (clientId) => {
    if (clientComments[clientId]) return; // Already cached

    try {
      const response = await api.get(`/clients/${clientId}/comments`);
      setClientComments(prev => ({
        ...prev,
        [clientId]: response.data.slice(0, 4) // Limit to 4 comments
      }));
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires:', error);
      setClientComments(prev => ({
        ...prev,
        [clientId]: []
      }));
    }
  };

  const handleCommentHover = (clientId) => {
    setHoveredClient(clientId);
    fetchClientComments(clientId);
  };

  const handleExportExcel = async () => {
    try {
      const response = await api.get('/clients/export/excel', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clients_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export Excel');
    }
  };

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.first_name?.toLowerCase().includes(searchLower) ||
      client.last_name?.toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower) ||
      client.phone?.toLowerCase().includes(searchLower) ||
      client.city?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {user?.role === 'admin' ? 'Gestion des Clients' : 'Mes Clients'}
          </h1>
          <p className={styles.subtitle}>
            {pagination.total} client(s) total
          </p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.filters}>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={styles.statusFilter}
          >
            {CLIENT_STATUSES.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <button onClick={fetchClients} className={styles.iconBtn} title="Rafraîchir">
            <RefreshCw size={18} />
          </button>

          <button
            onClick={handleExportExcel}
            className={styles.exportBtn}
            title="Exporter en Excel"
          >
            <Download size={18} />
            Exporter Excel
          </button>
        </div>
      </div>

      {selectedClients.length > 0 && (
        <div className={styles.bulkActions}>
          <span>{selectedClients.length} sélectionné(s)</span>
          <div className={styles.bulkButtons}>
            <button onClick={handleBulkDelete} className={styles.btnDanger}>
              <Trash2 size={16} /> Supprimer
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Chargement...</div>
        ) : filteredClients.length === 0 ? (
          <div className={styles.empty}>Aucun client trouvé</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedClients.length === clients.length && clients.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Ville</th>
                <th>Statut</th>
                {user?.role === 'admin' && <th>Attribué à</th>}
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id} className={selectedClients.includes(client.id) ? styles.selected : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(client.id)}
                      onChange={() => handleSelectClient(client.id)}
                    />
                  </td>
                  <td className={styles.name}>{client.last_name}</td>
                  <td className={styles.name}>{client.first_name}</td>
                  <td>{client.email || '-'}</td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.city || '-'}</td>
                  <td>
                    {client.status && (
                      <span className={`${styles.statusBadge} ${styles[`status_${client.status}`]}`}>
                        {client.status === 'nouveau' && 'Nouveau'}
                        {client.status === 'mail_envoye' && 'Mail envoyé'}
                        {client.status === 'documents_recus' && 'Documents reçus'}
                        {client.status === 'annule' && 'Annulé'}
                      </span>
                    )}
                  </td>
                  {user?.role === 'admin' && (
                    <td>{client.assigned_username || 'Non attribué'}</td>
                  )}
                  <td className={styles.date}>
                    {new Date(client.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      <div
                        className={styles.commentIconWrapper}
                        onMouseEnter={() => handleCommentHover(client.id)}
                        onMouseLeave={() => setHoveredClient(null)}
                      >
                        <MessageSquare size={18} className={styles.commentIcon} />

                        {hoveredClient === client.id && clientComments[client.id] && (
                          <div className={styles.commentTooltip}>
                            {clientComments[client.id].length === 0 ? (
                              <div className={styles.noComments}>Aucun commentaire</div>
                            ) : (
                              clientComments[client.id].map((comment, index) => (
                                <div key={comment.id || index} className={styles.commentItem}>
                                  <div className={styles.commentText}>
                                    {comment.content.length > 80
                                      ? `${comment.content.substring(0, 80)}...`
                                      : comment.content}
                                  </div>
                                  <div className={styles.commentMeta}>
                                    {comment.username} · {new Date(comment.created_at).toLocaleDateString('fr-FR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedClient(client);
                          setShowModal(true);
                        }}
                        className={styles.btnView}
                      >
                        Voir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.total > 0 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className={styles.pageBtn}
          >
            <ChevronLeft size={18} /> Précédent
          </button>

          <div className={styles.pageNumbers}>
            {[...Array(pagination.pages)].map((_, index) => {
              const pageNum = index + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                  className={`${styles.pageNumber} ${pagination.page === pageNum ? styles.pageNumberActive : ''}`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <span className={styles.pageInfo}>
            {pagination.total} client(s) · Page {pagination.page}/{pagination.pages}
          </span>

          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.pages}
            className={styles.pageBtn}
          >
            Suivant <ChevronRight size={18} />
          </button>
        </div>
      )}

      {showModal && selectedClient && (
        <ClientModal
          client={selectedClient}
          onClose={() => {
            setShowModal(false);
            setSelectedClient(null);
            fetchClients();
          }}
        />
      )}
    </div>
  );
};

export default Clients;
