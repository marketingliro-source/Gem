import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import {
  Search, Plus, FileText, Trash2, RefreshCw, Download, Upload,
  ChevronLeft, ChevronRight, MessageSquare, HelpCircle, UserCheck, Copy
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ClientModal from '../components/ClientModal';
import ImportCSVHelpModal from '../components/ImportCSVHelpModal';
import AssignClientsModal from '../components/AssignClientsModal';
import styles from './Clients.module.css';

const Clients = () => {
  const { produit } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState(searchParams.get('statut') || '');
  const [filterProduit, setFilterProduit] = useState(produit || '');
  const [filterCodeNAF, setFilterCodeNAF] = useState('');
  const [filterCodePostal, setFilterCodePostal] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // Pagination
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  // Sélection multiple
  const [selectedClients, setSelectedClients] = useState([]);

  // Modal attribution
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Preview commentaires
  const [hoveredClient, setHoveredClient] = useState(null);
  const [clientComments, setClientComments] = useState({});

  // Import/Export states
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);

  // Statuts dynamiques
  const [statuts, setStatuts] = useState([
    { key: '', label: 'Tous les statuts', color: '#6366f1' }
  ]);

  const PRODUITS = [
    { key: '', label: 'Tous les produits' },
    { key: 'destratification', label: 'Destratification', color: '#10b981' },
    { key: 'pression', label: 'Pression', color: '#8b5cf6' },
    { key: 'matelas_isolants', label: 'Matelas Isolants', color: '#f59e0b' }
  ];

  useEffect(() => {
    if (produit) {
      setFilterProduit(produit);
    }
  }, [produit]);

  useEffect(() => {
    fetchStatuts();
  }, []);

  useEffect(() => {
    fetchClients();
  }, [filterStatut, filterProduit, filterCodeNAF, filterCodePostal, pagination.page, pagination.limit]);

  const fetchStatuts = async () => {
    try {
      const response = await api.get('/statuts');
      // Ajouter l'option "Tous les statuts" en premier
      setStatuts([
        { key: '', label: 'Tous les statuts', color: '#6366f1' },
        ...response.data
      ]);
    } catch (error) {
      console.error('Erreur chargement statuts:', error);
    }
  };

  const fetchClients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatut) params.append('statut', filterStatut);
      if (filterProduit) params.append('type_produit', filterProduit);
      if (filterCodeNAF) params.append('code_naf', filterCodeNAF);
      if (filterCodePostal) params.append('code_postal', filterCodePostal);
      if (searchTerm) params.append('search', searchTerm);
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);

      const response = await api.get(`/clients?${params.toString()}`);

      // Support both formats
      if (response.data.clients) {
        setClients(response.data.clients);
        setPagination(prev => ({ ...prev, ...response.data.pagination }));
      } else {
        setClients(response.data);
        setPagination(prev => ({ ...prev, total: response.data.length, pages: 1 }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = () => {
    setSelectedClient(null);
    setShowModal(true);
  };

  const handleEditClient = (client) => {
    setSelectedClient(client);
    setShowModal(true);
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;

    try {
      await api.delete(`/clients/${clientId}`);
      fetchClients();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du client');
    }
  };

  const handleModalClose = (shouldRefresh) => {
    setShowModal(false);
    setSelectedClient(null);
    if (shouldRefresh) {
      fetchClients();
    }
  };

  // Sélection multiple
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedClients(filteredClients.map(client => client.id));
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
    if (!window.confirm(`Supprimer ${selectedClients.length} client(s) ?`)) return;

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

  const handleDuplicateClient = async (client) => {
    if (!window.confirm(`Dupliquer le client "${client.societe}" avec tous ses commentaires, rendez-vous et documents ?`)) {
      return;
    }

    try {
      const response = await api.post(`/clients/${client.id}/duplicate`);
      alert(`Client dupliqué avec succès!\n\n` +
        `✅ ${response.data.copied.comments} commentaire(s)\n` +
        `✅ ${response.data.copied.appointments} rendez-vous futur(s)\n` +
        `✅ ${response.data.copied.documents} document(s)`
      );
      fetchClients();
      // Ouvrir le modal du nouveau client
      setSelectedClient(response.data.client);
    } catch (error) {
      console.error('Erreur duplication:', error);
      alert('Erreur lors de la duplication du client');
    }
  };

  const handleStatusChange = async (clientId, newStatut) => {
    try {
      await api.patch(`/clients/${clientId}`, { statut: newStatut });
      // Update local state to avoid full refetch
      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, statut: newStatut } : c
      ));
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  // Preview commentaires
  const fetchClientComments = async (clientId) => {
    if (clientComments[clientId]) return;

    try {
      const response = await api.get(`/clients/${clientId}/comments`);
      setClientComments(prev => ({
        ...prev,
        [clientId]: response.data.slice(0, 4)
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

  // Import CSV
  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setImporting(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await api.post('/clients/import/csv', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert(`✅ Import réussi!\n${response.data.imported} client(s) importé(s)`);
        fetchClients();
      } catch (error) {
        const errorMsg = error.response?.data?.error || 'Erreur lors de l\'import CSV';
        alert(`❌ Échec de l'import\n${errorMsg}`);
        console.error('Import error:', error);
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  // Export Excel
  const handleExportExcel = async () => {
    setExporting(true);
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

      alert(`✅ Export réussi!\nFichier téléchargé avec succès`);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      const errorMsg = error.response?.data?.error || 'Erreur lors de l\'export Excel';
      alert(`❌ Échec de l'export\n${errorMsg}`);
    } finally {
      setExporting(false);
    }
  };

  const getStatutObj = (statut) => {
    return statuts.find(s => s.key === statut) || statuts[0];
  };

  const getProduitObj = (produit) => {
    return PRODUITS.find(p => p.key === produit) || PRODUITS[0];
  };

  const renderStatutBadge = (statut) => {
    const statutObj = getStatutObj(statut);
    if (!statutObj || !statutObj.color) return null;

    return (
      <span
        className={styles.badge}
        style={{ backgroundColor: `${statutObj.color}20`, color: statutObj.color }}
      >
        {statutObj.label}
      </span>
    );
  };

  const renderProduitBadge = (produit) => {
    const produitObj = getProduitObj(produit);
    if (!produitObj || !produitObj.color) return null;

    return (
      <span
        className={styles.badge}
        style={{ backgroundColor: `${produitObj.color}20`, color: produitObj.color }}
      >
        {produitObj.label}
      </span>
    );
  };

  const filteredClients = clients.filter(client => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      client.societe?.toLowerCase().includes(searchLower) ||
      client.nom_signataire?.toLowerCase().includes(searchLower) ||
      client.telephone?.toLowerCase().includes(searchLower) ||
      client.siret?.toLowerCase().includes(searchLower) ||
      client.code_postal?.toLowerCase().includes(searchLower)
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
        <button onClick={handleAddClient} className={styles.addBtn}>
          <Plus size={20} />
          Nouveau Client
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Rechercher un client (société, nom, tél, SIRET)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.filters}>
          <select
            value={filterStatut}
            onChange={(e) => {
              setFilterStatut(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={styles.statusFilter}
          >
            {statuts.map(status => (
              <option key={status.key} value={status.key}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            value={filterProduit}
            onChange={(e) => {
              setFilterProduit(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={styles.statusFilter}
          >
            {PRODUITS.map(produit => (
              <option key={produit.key} value={produit.key}>
                {produit.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Code Postal..."
            value={filterCodePostal}
            onChange={(e) => {
              setFilterCodePostal(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={styles.codePostalFilter}
          />

          <input
            type="text"
            placeholder="Code NAF..."
            value={filterCodeNAF}
            onChange={(e) => {
              setFilterCodeNAF(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={styles.codeNafFilter}
          />

          <button onClick={fetchClients} className={styles.iconBtn} title="Rafraîchir">
            <RefreshCw size={18} />
          </button>

          <div className={styles.importGroup}>
            <button
              onClick={handleImportCSV}
              className={styles.importBtn}
              title="Importer CSV"
              disabled={importing}
            >
              <Upload size={18} />
              {importing ? 'Import en cours...' : 'Import CSV'}
            </button>
            <button
              onClick={() => setShowImportHelp(true)}
              className={styles.helpBtn}
              title="Guide d'import CSV"
            >
              <HelpCircle size={18} />
            </button>
          </div>

          <button
            onClick={handleExportExcel}
            className={styles.exportBtn}
            title="Exporter en Excel"
            disabled={exporting}
          >
            <Download size={18} />
            {exporting ? 'Export en cours...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {selectedClients.length > 0 && (
        <div className={styles.bulkActions}>
          <span>{selectedClients.length} sélectionné(s)</span>
          <div className={styles.bulkButtons}>
            {user?.role === 'admin' && (
              <button onClick={() => setShowAssignModal(true)} className={styles.btnPrimary}>
                <UserCheck size={16} /> Attribuer
              </button>
            )}
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
                    checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Société</th>
                <th>Contact</th>
                <th>Téléphone</th>
                <th>Code Postal</th>
                <th>{filterProduit ? 'Code NAF' : 'Produit'}</th>
                <th>Statut</th>
                {user?.role === 'admin' && <th>Attribué à</th>}
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr
                  key={client.id}
                  className={selectedClients.includes(client.id) ? styles.selected : ''}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(client.id)}
                      onChange={() => handleSelectClient(client.id)}
                    />
                  </td>
                  <td className={styles.name}>{client.societe || '-'}</td>
                  <td>{client.nom_signataire || '-'}</td>
                  <td>{client.telephone || '-'}</td>
                  <td>{client.code_postal || '-'}</td>
                  <td>
                    {filterProduit ? (client.code_naf || '-') : renderProduitBadge(client.type_produit)}
                  </td>
                  <td>
                    <select
                      value={client.statut}
                      onChange={(e) => handleStatusChange(client.id, e.target.value)}
                      className={styles.statusSelect}
                      style={{
                        borderColor: getStatutObj(client.statut)?.color || '#10b981'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {statuts.filter(s => s.key !== '').map(status => (
                        <option key={status.key} value={status.key}>
                          {status.label}
                        </option>
                      ))}
                    </select>
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
                        onClick={() => handleEditClient(client)}
                        className={styles.btnView}
                      >
                        Voir
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateClient(client);
                        }}
                        className={styles.btnSecondary}
                        title="Dupliquer ce client"
                      >
                        <Copy size={16} />
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
            {[...Array(Math.min(pagination.pages, 10))].map((_, index) => {
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

          <div className={styles.limitSelector}>
            <label>Afficher:</label>
            <select
              value={pagination.limit === pagination.total ? 'all' : pagination.limit}
              onChange={(e) => {
                const value = e.target.value;
                const newLimit = value === 'all' ? pagination.total : parseInt(value);
                setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
              }}
              className={styles.limitSelect}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="all">Tous</option>
            </select>
          </div>
        </div>
      )}

      {showModal && (
        <ClientModal
          client={selectedClient}
          isNew={!selectedClient}
          onClose={handleModalClose}
        />
      )}

      {/* Modal d'aide pour l'import CSV */}
      <ImportCSVHelpModal
        isOpen={showImportHelp}
        onClose={() => setShowImportHelp(false)}
      />

      {/* Modal d'attribution en masse */}
      {showAssignModal && (
        <AssignClientsModal
          clientIds={selectedClients}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => {
            setSelectedClients([]);
            fetchClients();
          }}
        />
      )}
    </div>
  );
};

export default Clients;
