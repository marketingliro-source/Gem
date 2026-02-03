import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import {
  Search, Plus, FileText, Trash2, RefreshCw, Download, Upload,
  ChevronLeft, ChevronRight, MessageSquare, HelpCircle, UserCheck, Copy
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ClientModal from '../components/ClientModal';
import ImportCSVHelpModal from '../components/ImportCSVHelpModal';
import ImportCSVModal from '../components/ImportCSVModal';
import AssignClientsModal from '../components/AssignClientsModal';
import DuplicateClientModal from '../components/DuplicateClientModal';
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
  const [filterAssignedTo, setFilterAssignedTo] = useState('');
  const [telepros, setTelepros] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // Pagination
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  // Sélection multiple
  const [selectedClients, setSelectedClients] = useState([]);

  // Modal attribution
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Modal duplication
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [clientToDuplicate, setClientToDuplicate] = useState(null);

  // Preview commentaires
  const [hoveredClient, setHoveredClient] = useState(null);
  const [clientComments, setClientComments] = useState({});

  // Import/Export states
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Statuts dynamiques
  const [statuts, setStatuts] = useState([
    { key: '', label: 'Tous les statuts', color: '#6366f1' }
  ]);

  // Tri multi-colonnes
  const [sortConfig, setSortConfig] = useState({ field: 'updated_at', order: 'DESC' });

  // Commentaire rapide inline
  const [inlineCommentClientId, setInlineCommentClientId] = useState(null);
  const [inlineCommentText, setInlineCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  // Refs pour synchronisation des scrolls
  const tableContainerRef = useRef(null);
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);

  // Synchroniser les scrolls
  const syncScroll = (source) => {
    const scrollLeft = source.current?.scrollLeft || 0;

    if (tableContainerRef.current && source !== tableContainerRef) {
      tableContainerRef.current.scrollLeft = scrollLeft;
    }
    if (topScrollRef.current && source !== topScrollRef) {
      topScrollRef.current.scrollLeft = scrollLeft;
    }
    if (bottomScrollRef.current && source !== bottomScrollRef) {
      bottomScrollRef.current.scrollLeft = scrollLeft;
    }
  };

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
    if (user?.role === 'admin') {
      fetchTelepros();
    }
  }, [user]);

  useEffect(() => {
    fetchClients();
  }, [filterStatut, filterProduit, filterCodeNAF, filterCodePostal, filterAssignedTo, pagination.page, pagination.limit, sortConfig]);

  // Ajuster la largeur des barres de scroll pour correspondre au tableau
  useEffect(() => {
    const updateScrollBars = () => {
      if (tableContainerRef.current) {
        const tableWidth = tableContainerRef.current.querySelector('table')?.scrollWidth || 0;

        if (topScrollRef.current) {
          const scrollContent = topScrollRef.current.querySelector(`.${styles.scrollBarContent}`);
          if (scrollContent) {
            scrollContent.style.width = `${tableWidth}px`;
          }
        }

        if (bottomScrollRef.current) {
          const scrollContent = bottomScrollRef.current.querySelector(`.${styles.scrollBarContent}`);
          if (scrollContent) {
            scrollContent.style.width = `${tableWidth}px`;
          }
        }
      }
    };

    // Mettre à jour après le chargement et à chaque changement
    updateScrollBars();
    window.addEventListener('resize', updateScrollBars);

    return () => {
      window.removeEventListener('resize', updateScrollBars);
    };
  }, [clients, loading]);

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

  const fetchTelepros = async () => {
    try {
      // Charger tous les utilisateurs (admins + télépros)
      const response = await api.get('/users');
      setTelepros(response.data);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
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
      if (filterAssignedTo) params.append('assigned_to', filterAssignedTo);
      if (searchTerm) params.append('search', searchTerm);
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      params.append('sort_field', sortConfig.field);
      params.append('sort_order', sortConfig.order);

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

  // Sélection multiple (utilise produit_id pour l'attribution)
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedClients(filteredClients.map(client => client.produit_id));
    } else {
      setSelectedClients([]);
    }
  };

  const handleSelectClient = (produitId) => {
    setSelectedClients(prev =>
      prev.includes(produitId)
        ? prev.filter(id => id !== produitId)
        : [...prev, produitId]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedClients.length) return;

    const confirmMessage = `Supprimer ${selectedClients.length} produit(s) sélectionné(s) ?\n\n` +
      `Note: Si un client n'a plus aucun produit après suppression, il sera complètement supprimé.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const response = await api.post('/clients/produits/bulk-delete', {
        produitIds: selectedClients
      });

      alert(`✅ ${response.data.produitsDeleted} produit(s) supprimé(s)\n` +
            (response.data.clientsDeleted > 0
              ? `🗑️ ${response.data.clientsDeleted} client(s) complet(s) supprimé(s) (plus de produits)`
              : ''));

      setSelectedClients([]);
      fetchClients();
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  const handleDuplicateClient = (client) => {
    setClientToDuplicate(client);
    setShowDuplicateModal(true);
  };

  const handleDuplicationComplete = () => {
    fetchClients();
    setClientToDuplicate(null);
  };

  const handleStatusChange = async (clientId, produitId, newStatut) => {
    try {
      await api.patch(`/clients/produits/${produitId}`, { statut: newStatut });
      // Update local state to avoid full refetch
      setClients(prev => prev.map(c =>
        c.produit_id === produitId ? { ...c, statut: newStatut } : c
      ));
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  // Tri multi-colonnes
  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'DESC' ? 'ASC' : 'DESC'
    }));
  };

  const getSortIcon = (field) => {
    if (sortConfig.field !== field) return ' ↕';
    return sortConfig.order === 'DESC' ? ' ↓' : ' ↑';
  };

  // Commentaire rapide inline
  const handleOpenInlineComment = (clientId) => {
    setInlineCommentClientId(clientId);
    setInlineCommentText('');
  };

  const handleCancelInlineComment = () => {
    setInlineCommentClientId(null);
    setInlineCommentText('');
  };

  const handleSaveInlineComment = async (clientId) => {
    if (!inlineCommentText.trim()) return;

    setSavingComment(true);
    try {
      await api.post(`/clients/${clientId}/comments`, {
        content: inlineCommentText
      });

      // Rafraîchir les clients pour voir la mise à jour
      await fetchClients();

      // Fermer le formulaire
      setInlineCommentClientId(null);
      setInlineCommentText('');
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
      alert('Erreur lors de l\'ajout du commentaire');
    } finally {
      setSavingComment(false);
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

  // Import CSV - Ouvrir la modal avec sélection de produit
  const handleImportCSV = () => {
    setShowImportModal(true);
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

          {user?.role === 'admin' && (
            <select
              value={filterAssignedTo}
              onChange={(e) => {
                setFilterAssignedTo(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={styles.statusFilter}
            >
              <option value="">Tous les utilisateurs</option>
              {telepros.map(telepro => (
                <option key={telepro.id} value={telepro.id}>
                  {telepro.username} ({telepro.role === 'admin' ? 'Admin' : 'Télépro'})
                </option>
              ))}
            </select>
          )}

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
              <button onClick={() => setShowAssignModal(true)} className={styles.btnSecondary}>
                <UserCheck size={16} /> Attribuer ({selectedClients.length})
              </button>
            )}
            <button onClick={handleBulkDelete} className={styles.btnDanger}>
              <Trash2 size={16} /> Supprimer ({selectedClients.length})
            </button>
          </div>
        </div>
      )}

      {/* Pagination en haut */}
      {pagination.total > 0 && !loading && (
        <div className={`${styles.pagination} ${styles.paginationTop}`}>
          <div className={styles.paginationInfo}>
            <span className={styles.totalCount}>
              {pagination.total} client{pagination.total > 1 ? 's' : ''} trouvé{pagination.total > 1 ? 's' : ''}
            </span>
          </div>
          <div className={styles.paginationControls}>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className={styles.pageBtnCompact}
              title="Page précédente"
            >
              <ChevronLeft size={16} />
            </button>
            <span className={styles.pageInfoCompact}>
              Page {pagination.page}/{pagination.pages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.pages}
              className={styles.pageBtnCompact}
              title="Page suivante"
            >
              <ChevronRight size={16} />
            </button>
            <div className={styles.limitSelectorCompact}>
              <select
                value={pagination.limit === pagination.total ? 'all' : pagination.limit}
                onChange={(e) => {
                  const value = e.target.value;
                  const newLimit = value === 'all' ? pagination.total : parseInt(value);
                  setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
                }}
                className={styles.limitSelectCompact}
                title="Nombre de résultats par page"
              >
                <option value="20">20/page</option>
                <option value="50">50/page</option>
                <option value="100">100/page</option>
                <option value="all">Tous</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Barre de scroll horizontal du haut (en dessous du header) */}
      {!loading && filteredClients.length > 0 && (
        <div className={styles.scrollBarContainer}>
          <div
            ref={topScrollRef}
            className={styles.scrollBar}
            onScroll={() => syncScroll(topScrollRef)}
          >
            <div className={styles.scrollBarContent} />
          </div>
        </div>
      )}

      <div
        className={styles.tableContainer}
        ref={tableContainerRef}
        onScroll={() => syncScroll(tableContainerRef)}
      >
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
                <th onClick={() => handleSort('societe')} style={{ cursor: 'pointer' }}>
                  Société{getSortIcon('societe')}
                </th>
                <th>Contact</th>
                <th>Téléphone</th>
                <th onClick={() => handleSort('ville')} style={{ cursor: 'pointer' }}>
                  Localisation{getSortIcon('ville')}
                </th>
                <th>{filterProduit ? 'Code NAF' : 'Produit'}</th>
                <th onClick={() => handleSort('statut')} style={{ cursor: 'pointer' }}>
                  Statut{getSortIcon('statut')}
                </th>
                {user?.role === 'admin' && (
                  <th onClick={() => handleSort('assigned_to')} style={{ cursor: 'pointer' }}>
                    Attribué à{getSortIcon('assigned_to')}
                  </th>
                )}
                {user?.role === 'admin' && (
                  <th onClick={() => handleSort('assigned_at')} style={{ cursor: 'pointer' }}>
                    Date attribution{getSortIcon('assigned_at')}
                  </th>
                )}
                <th onClick={() => handleSort('updated_at')} style={{ cursor: 'pointer' }}>
                  Dernière interaction{getSortIcon('updated_at')}
                </th>
                <th>Dernier commentaire</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr
                  key={client.id}
                  className={selectedClients.includes(client.produit_id) ? styles.selected : ''}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(client.produit_id)}
                      onChange={() => handleSelectClient(client.produit_id)}
                    />
                  </td>
                  <td className={styles.name}>{client.societe || '-'}</td>
                  <td>{client.nom_signataire || '-'}</td>
                  <td>{client.telephone || '-'}</td>
                  <td>
                    {client.ville && client.code_postal
                      ? `${client.ville} (${client.code_postal})`
                      : client.ville || client.code_postal || '-'
                    }
                  </td>
                  <td>
                    {filterProduit ? (client.code_naf || '-') : renderProduitBadge(client.type_produit)}
                  </td>
                  <td>
                    <select
                      value={client.statut}
                      onChange={(e) => handleStatusChange(client.id, client.produit_id, e.target.value)}
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
                  {user?.role === 'admin' && (
                    <td className={styles.date}>
                      {client.assigned_at
                        ? new Date(client.assigned_at).toLocaleDateString('fr-FR')
                        : '-'
                      }
                    </td>
                  )}
                  <td className={styles.date}>
                    {new Date(client.updated_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td>
                    <div className={styles.lastCommentCell}>
                      {client.last_comment ? (
                        <div
                          className={styles.lastCommentText}
                          title={client.last_comment}
                        >
                          <span className={styles.commentContent}>
                            {client.last_comment.length > 100
                              ? `${client.last_comment.substring(0, 100)}...`
                              : client.last_comment}
                          </span>
                          {client.last_comment.length > 100 && (
                            <span className={styles.commentMore}>...</span>
                          )}
                        </div>
                      ) : (
                        <span className={styles.noComment}>-</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      {inlineCommentClientId === client.id ? (
                        <div className={styles.inlineCommentForm}>
                          <textarea
                            value={inlineCommentText}
                            onChange={(e) => setInlineCommentText(e.target.value)}
                            placeholder="Votre commentaire..."
                            className={styles.inlineCommentTextarea}
                            autoFocus
                          />
                          <div className={styles.inlineCommentButtons}>
                            <button
                              onClick={() => handleSaveInlineComment(client.id)}
                              disabled={!inlineCommentText.trim() || savingComment}
                              className={styles.btnSaveComment}
                            >
                              {savingComment ? 'Envoi...' : 'Envoyer'}
                            </button>
                            <button
                              onClick={handleCancelInlineComment}
                              disabled={savingComment}
                              className={styles.btnCancelComment}
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOpenInlineComment(client.id)}
                            className={styles.btnComment}
                            title="Ajouter un commentaire rapide"
                          >
                            + Commentaire
                          </button>
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
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Barre de scroll horizontal du bas (au-dessus de la pagination) */}
      {!loading && filteredClients.length > 0 && (
        <div className={styles.scrollBarContainer}>
          <div
            ref={bottomScrollRef}
            className={styles.scrollBar}
            onScroll={() => syncScroll(bottomScrollRef)}
          >
            <div className={styles.scrollBarContent} />
          </div>
        </div>
      )}

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

      {/* Modal d'import CSV avec sélection de produit */}
      <ImportCSVModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => fetchClients()}
        onShowHelp={() => setShowImportHelp(true)}
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

      {/* Modal duplication avec choix du produit */}
      {showDuplicateModal && clientToDuplicate && (
        <DuplicateClientModal
          client={clientToDuplicate}
          onClose={() => {
            setShowDuplicateModal(false);
            setClientToDuplicate(null);
          }}
          onDuplicated={handleDuplicationComplete}
        />
      )}
    </div>
  );
};

export default Clients;
