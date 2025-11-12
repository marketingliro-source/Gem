import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Filter, Download, Trash2, RefreshCw, UserPlus, Search, ChevronLeft, ChevronRight, FileUp, MessageSquare } from 'lucide-react';
import LeadModal from '../components/LeadModal';
import ImportModal from '../components/ImportModal';
import styles from './Leads.module.css';

const STATUSES = [
  { value: '', label: 'Tous', color: '#6366f1' },
  { value: 'nouveau', label: 'Nouveau', color: '#10b981' },
  { value: 'nrp', label: 'NRP', color: '#f59e0b' },
  { value: 'a_rappeler', label: 'À rappeler', color: '#3b82f6' },
  { value: 'pas_interesse', label: 'Pas intéressé', color: '#ef4444' },
  { value: 'trash', label: 'Corbeille', color: '#6b7280' },
];

const Leads = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [selectedLead, setSelectedLead] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [hoveredLead, setHoveredLead] = useState(null);
  const [leadComments, setLeadComments] = useState({});

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAgents();
    }
  }, [user]);

  useEffect(() => {
    fetchLeads();
  }, [selectedStatus, assignedToFilter, pagination.page]);

  const fetchAgents = async () => {
    try {
      const response = await api.get('/users?role=agent');
      setAgents(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des agents:', error);
    }
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = {
        status: selectedStatus,
        page: pagination.page,
        limit: pagination.limit
      };

      // Ajouter le filtre par agent si spécifié (admin uniquement)
      if (assignedToFilter) {
        params.assigned_to = assignedToFilter;
      }

      const response = await api.get('/leads', { params });
      setLeads(response.data.leads);
      setPagination(prev => ({ ...prev, ...response.data.pagination }));
    } catch (error) {
      console.error('Erreur lors du chargement des leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeads(leads.map(lead => lead.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId) => {
    setSelectedLeads(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedLeads.length) return;
    if (!confirm(`Supprimer ${selectedLeads.length} lead(s) ?`)) return;

    try {
      await api.delete('/leads/bulk', { data: { lead_ids: selectedLeads } });
      setSelectedLeads([]);
      fetchLeads();
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  const handleBulkRecycle = async () => {
    if (!selectedLeads.length) return;
    if (!confirm(`Recycler ${selectedLeads.length} lead(s) ? Cela supprimera tous les commentaires et RDV.`)) return;

    try {
      await api.post('/leads/recycle', { lead_ids: selectedLeads });
      setSelectedLeads([]);
      fetchLeads();
    } catch (error) {
      alert('Erreur lors du recyclage');
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedLeads.length || user.role !== 'admin') return;

    try {
      const response = await api.get('/users/agents');
      setAgents(response.data);
      setShowAssignModal(true);
    } catch (error) {
      alert('Erreur lors du chargement des agents');
    }
  };

  const handleAssignConfirm = async () => {
    if (!selectedAgent) {
      alert('Veuillez sélectionner un agent');
      return;
    }

    try {
      await api.post('/leads/assign', { lead_ids: selectedLeads, user_id: parseInt(selectedAgent) });
      setSelectedLeads([]);
      setShowAssignModal(false);
      setSelectedAgent('');
      fetchLeads();
    } catch (error) {
      alert('Erreur lors de l\'attribution');
    }
  };

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await api.patch(`/leads/${leadId}`, { status: newStatus });
      fetchLeads();
    } catch (error) {
      alert('Erreur lors de la mise à jour');
    }
  };

  const fetchLeadComments = async (leadId) => {
    if (leadComments[leadId]) return; // Already cached

    try {
      const response = await api.get(`/comments/lead/${leadId}`);
      setLeadComments(prev => ({
        ...prev,
        [leadId]: response.data.slice(0, 4) // Limit to 4 comments
      }));
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires:', error);
      setLeadComments(prev => ({
        ...prev,
        [leadId]: []
      }));
    }
  };

  const handleCommentHover = (leadId) => {
    setHoveredLead(leadId);
    fetchLeadComments(leadId);
  };

  const handleExportExcel = async () => {
    try {
      const response = await api.get('/leads/export/excel', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export Excel');
    }
  };

  const filteredLeads = leads.filter(lead => {
    const searchLower = searchTerm.toLowerCase();
    return (
      lead.first_name?.toLowerCase().includes(searchLower) ||
      lead.last_name?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.phone?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusLabel = (status) => {
    return STATUSES.find(s => s.value === status)?.label || status;
  };

  const getStatusColor = (status) => {
    return STATUSES.find(s => s.value === status)?.color || '#6366f1';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {user?.role === 'admin' ? 'Gestion des Leads' : 'Mes Leads'}
          </h1>
          <p className={styles.subtitle}>
            {pagination.total} lead(s) total
          </p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Rechercher un lead..."
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
            {STATUSES.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          {user?.role === 'admin' && (
            <select
              value={assignedToFilter}
              onChange={(e) => {
                setAssignedToFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={styles.statusFilter}
            >
              <option value="">Tous les agents</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.username}
                </option>
              ))}
            </select>
          )}

          <button onClick={fetchLeads} className={styles.iconBtn} title="Rafraîchir">
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

          {user?.role === 'admin' && (
            <button
              onClick={() => setShowImportModal(true)}
              className={styles.importBtn}
              title="Importer des leads"
            >
              <FileUp size={18} />
              Importer CSV
            </button>
          )}
        </div>
      </div>

      {selectedLeads.length > 0 && (
        <div className={styles.bulkActions}>
          <span>{selectedLeads.length} sélectionné(s)</span>
          <div className={styles.bulkButtons}>
            {user?.role === 'admin' && (
              <button onClick={handleBulkAssign} className={styles.btnSecondary}>
                <UserPlus size={16} /> Attribuer
              </button>
            )}
            <button onClick={handleBulkRecycle} className={styles.btnWarning}>
              <RefreshCw size={16} /> Recycler
            </button>
            <button onClick={handleBulkDelete} className={styles.btnDanger}>
              <Trash2 size={16} /> Supprimer
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Chargement...</div>
        ) : filteredLeads.length === 0 ? (
          <div className={styles.empty}>Aucun lead trouvé</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedLeads.length === leads.length && leads.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Statut</th>
                {user?.role === 'admin' && <th>Attribué à</th>}
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => (
                <tr key={lead.id} className={selectedLeads.includes(lead.id) ? styles.selected : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={() => handleSelectLead(lead.id)}
                    />
                  </td>
                  <td className={styles.name}>{lead.last_name}</td>
                  <td className={styles.name}>{lead.first_name}</td>
                  <td>{lead.email || '-'}</td>
                  <td>{lead.phone || '-'}</td>
                  <td>
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className={styles.statusSelect}
                      style={{ borderColor: getStatusColor(lead.status) }}
                    >
                      {STATUSES.filter(s => s.value).map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  {user?.role === 'admin' && (
                    <td>{lead.assigned_username || 'Non attribué'}</td>
                  )}
                  <td className={styles.date}>
                    {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      <div
                        className={styles.commentIconWrapper}
                        onMouseEnter={() => handleCommentHover(lead.id)}
                        onMouseLeave={() => setHoveredLead(null)}
                      >
                        <MessageSquare size={18} className={styles.commentIcon} />

                        {hoveredLead === lead.id && leadComments[lead.id] && (
                          <div className={styles.commentTooltip}>
                            {leadComments[lead.id].length === 0 ? (
                              <div className={styles.noComments}>Aucun commentaire</div>
                            ) : (
                              leadComments[lead.id].map((comment, index) => (
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
                          setSelectedLead(lead);
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
            {pagination.total} lead(s) · Page {pagination.page}/{pagination.pages}
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

      {showModal && (
        <LeadModal
          lead={selectedLead}
          onClose={() => {
            setShowModal(false);
            setSelectedLead(null);
            fetchLeads();
          }}
        />
      )}

      {showAssignModal && (
        <div className={styles.overlay} onClick={() => setShowAssignModal(false)}>
          <div className={styles.assignModal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Attribuer les leads</h2>
            <p className={styles.modalSubtitle}>
              {selectedLeads.length} lead(s) sélectionné(s)
            </p>

            <div className={styles.agentList}>
              {agents.length === 0 ? (
                <p className={styles.noAgents}>Aucun agent disponible. Créez d'abord des agents dans la section Utilisateurs.</p>
              ) : (
                agents.map(agent => (
                  <label key={agent.id} className={styles.agentOption}>
                    <input
                      type="radio"
                      name="agent"
                      value={agent.id}
                      checked={selectedAgent === agent.id.toString()}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                    />
                    <div className={styles.agentInfo}>
                      <div className={styles.agentAvatar}>
                        {agent.username.charAt(0).toUpperCase()}
                      </div>
                      <span className={styles.agentName}>{agent.username}</span>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedAgent('');
                }}
                className={styles.cancelBtn}
              >
                Annuler
              </button>
              <button
                onClick={handleAssignConfirm}
                disabled={!selectedAgent}
                className={styles.confirmBtn}
              >
                Attribuer
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => fetchLeads()}
        />
      )}
    </div>
  );
};

export default Leads;
