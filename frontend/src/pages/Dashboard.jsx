import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [statType, setStatType] = useState('clients'); // 'clients' or 'conversion'
  const [selectedTelepro, setSelectedTelepro] = useState('all'); // 'all' or username

  // Définition des 10 statuts avec couleurs
  const STATUTS = [
    { key: 'nouveau', label: 'Nouveau', color: '#10b981' },
    { key: 'a_rappeler', label: 'À Rappeler', color: '#f59e0b' },
    { key: 'mail_infos_envoye', label: 'Mail Infos Envoyé', color: '#3b82f6' },
    { key: 'infos_recues', label: 'Infos Reçues', color: '#8b5cf6' },
    { key: 'devis_envoye', label: 'Devis Envoyé', color: '#ec4899' },
    { key: 'devis_signe', label: 'Devis Signé', color: '#14b8a6' },
    { key: 'pose_prevue', label: 'Pose Prévue', color: '#f97316' },
    { key: 'pose_terminee', label: 'Pose Terminée', color: '#06b6d4' },
    { key: 'coffrac', label: 'Coffrac', color: '#84cc16' },
    { key: 'termine', label: 'Terminé', color: '#059669' }
  ];

  const PRODUITS = [
    { key: 'destratification', label: 'Destratification', color: '#10b981' },
    { key: 'pression', label: 'Pression', color: '#8b5cf6' },
    { key: 'matelas_isolants', label: 'Matelas Isolants', color: '#f59e0b' }
  ];

  // Couleurs dynamiques pour les télépros
  const TELEPRO_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f97316'];

  const getTeleproColor = (index) => {
    return TELEPRO_COLORS[index % TELEPRO_COLORS.length];
  };

  // Generate months from January 2025 to current month and fill missing data with 0
  const fillYearToDate = (data) => {
    if (!data || data.length === 0) return [];

    const months = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed (0 = January)

    // Generate months from January of current year to current month
    for (let i = 0; i <= currentMonth; i++) {
      const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
      months.push(monthKey);
    }

    // Get all telepro names from the data
    const allTelepros = new Set();
    data.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== 'month') allTelepros.add(key);
      });
    });

    // Create full dataset with all months from Jan to now
    return months.map(month => {
      const existingData = data.find(d => d.month === month);
      if (existingData) {
        return existingData;
      } else {
        // Fill missing month with 0 for all telepros
        const emptyMonth = { month };
        allTelepros.forEach(telepro => {
          emptyMonth[telepro] = 0;
        });
        return emptyMonth;
      }
    });
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/analytics?period=${period}`);
      setData(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatutClick = (statut) => {
    // Naviguer vers la page clients filtrée par statut
    navigate(`/clients?statut=${statut}`);
  };

  const handleProduitClick = (produit) => {
    // Naviguer vers la page clients filtrée par produit
    navigate(`/clients/${produit}`);
  };

  if (loading) {
    return <div className={styles.loading}>Chargement des statistiques...</div>;
  }

  if (!data) {
    return <div className={styles.error}>Aucune donnée disponible</div>;
  }

  // Préparer les données pour les cartes de statuts
  const statutsData = STATUTS.map(statut => {
    const count = data.summary?.par_statut?.find(s => s.statut === statut.key)?.count || 0;
    return { ...statut, count };
  });

  // Préparer les données pour les produits
  const produitsData = PRODUITS.map(produit => {
    const count = data.summary?.par_produit?.find(p => p.type_produit === produit.key)?.count || 0;
    return { ...produit, count };
  });

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard Gem Isolation</h1>
          <p className={styles.subtitle}>
            Bienvenue {user?.username} - {user?.role === 'admin' ? 'Administrateur' : 'Téléprospecteur'}
          </p>
        </div>
        <div className={styles.periodSelector}>
          <label htmlFor="period">Période: </label>
          <select
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={styles.periodDropdown}
          >
            <option value="day">Aujourd'hui</option>
            <option value="week">7 derniers jours</option>
            <option value="month">30 derniers jours</option>
            <option value="year">12 derniers mois</option>
          </select>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard} style={{ borderLeft: '4px solid #10b981' }}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#10b98120' }}>
            <Users size={24} color="#10b981" />
          </div>
          <div className={styles.summaryContent}>
            <div className={styles.summaryLabel}>Total Clients</div>
            <div className={styles.summaryValue}>{data.summary?.totalClients || 0}</div>
          </div>
        </div>

        {PRODUITS.map(produit => {
          const count = data.summary?.par_produit?.find(p => p.type_produit === produit.key)?.count || 0;
          return (
            <div
              key={produit.key}
              className={styles.summaryCard}
              style={{ borderLeft: `4px solid ${produit.color}`, cursor: 'pointer' }}
              onClick={() => handleProduitClick(produit.key)}
            >
              <div className={styles.summaryIcon} style={{ backgroundColor: `${produit.color}20` }}>
                <Package size={24} color={produit.color} />
              </div>
              <div className={styles.summaryContent}>
                <div className={styles.summaryLabel}>{produit.label}</div>
                <div className={styles.summaryValue}>{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cartes de statuts cliquables */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Statuts des Clients</h2>
        <div className={styles.statutsGrid}>
          {statutsData.map(statut => (
            <div
              key={statut.key}
              className={styles.statutCard}
              style={{
                borderLeft: `4px solid ${statut.color}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => handleStatutClick(statut.key)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className={styles.statutContent}>
                <div className={styles.statutLabel}>{statut.label}</div>
                <div className={styles.statutCount} style={{ color: statut.color }}>
                  {statut.count}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Graphiques */}
      <div className={styles.chartsSection}>
        {/* Distribution par statut */}
        <div className={styles.chartCard} style={{ gridColumn: '1 / -1' }}>
          <h3 className={styles.chartTitle}>Distribution par Statut</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={data.summary?.par_statut || []}
                dataKey="count"
                nameKey="statut"
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={(entry) => {
                  const statut = STATUTS.find(s => s.key === entry.statut);
                  return `${statut?.label}: ${entry.count}`;
                }}
              >
                {(data.summary?.par_statut || []).map((entry, index) => {
                  const statut = STATUTS.find(s => s.key === entry.statut);
                  return <Cell key={`cell-${index}`} fill={statut?.color || '#999'} />;
                })}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution par produit */}
        <div className={styles.chartCard} style={{ gridColumn: '1 / -1' }}>
          <h3 className={styles.chartTitle}>Distribution par Produit</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.summary?.par_produit || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="type_produit"
                tickFormatter={(value) => {
                  const produit = PRODUITS.find(p => p.key === value);
                  return produit?.label || value;
                }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => {
                  const produit = PRODUITS.find(p => p.key === value);
                  return produit?.label || value;
                }}
              />
              <Bar dataKey="count">
                {(data.summary?.par_produit || []).map((entry, index) => {
                  const produit = PRODUITS.find(p => p.key === entry.type_produit);
                  return <Cell key={`cell-${index}`} fill={produit?.color || '#999'} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Statistiques Télépros (12 derniers mois) */}
        {user?.role === 'admin' && data.charts?.teleproMonthlyStats && (
          <div className={styles.chartCard} style={{ gridColumn: '1 / -1' }}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Statistiques Téléprospecteurs (depuis janvier {new Date().getFullYear()})</h3>
              <div className={styles.chartControls}>
                <select
                  value={statType}
                  onChange={(e) => setStatType(e.target.value)}
                  className={styles.chartSelect}
                >
                  <option value="clients">Nombre de clients par mois</option>
                  <option value="conversion">Taux de conversion (%)</option>
                </select>
                <select
                  value={selectedTelepro}
                  onChange={(e) => setSelectedTelepro(e.target.value)}
                  className={styles.chartSelect}
                >
                  <option value="all">Tous les télépros</option>
                  {data.charts?.teleproPerformance?.map((t) => (
                    <option key={t.username} value={t.username}>{t.username}</option>
                  ))}
                </select>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              {(() => {
                const rawData = statType === 'clients' ? data.charts.teleproMonthlyStats : data.charts.teleproConversionStats;
                const filledData = fillYearToDate(rawData);

                if (!filledData || filledData.length === 0) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '350px', color: 'var(--text-secondary)' }}>
                      Aucune donnée disponible depuis janvier {new Date().getFullYear()}
                    </div>
                  );
                }

                const telepros = Object.keys(filledData[0]).filter(k => k !== 'month');

                return (
                  <LineChart data={filledData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year.slice(2)}`;
                      }}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => {
                        const [year, month] = value.split('-');
                        const date = new Date(year, month - 1);
                        return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                      }}
                    />
                    <Legend />
                    {telepros
                      .filter(username => selectedTelepro === 'all' || username === selectedTelepro)
                      .map((username, index) => (
                        <Line
                          key={username}
                          type="monotone"
                          dataKey={username}
                          stroke={getTeleproColor(index)}
                          strokeWidth={2}
                          name={username}
                          dot={{ fill: getTeleproColor(index), r: 4 }}
                          activeDot={{ r: 6 }}
                          connectNulls
                        />
                      ))}
                  </LineChart>
                );
              })()}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Activité récente */}
      {data.recentClients && data.recentClients.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Clients Récents</h2>
          <div className={styles.recentTable}>
            <table>
              <thead>
                <tr>
                  <th>Société</th>
                  <th>Contact</th>
                  <th>Produit</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentClients.map(client => {
                  const statut = STATUTS.find(s => s.key === client.statut);
                  const produit = PRODUITS.find(p => p.key === client.type_produit);
                  return (
                    <tr key={client.id} onClick={() => navigate(`/clients?id=${client.id}`)} style={{ cursor: 'pointer' }}>
                      <td>{client.societe || '-'}</td>
                      <td>{client.nom_signataire || '-'}</td>
                      <td>
                        <span
                          className={styles.badge}
                          style={{ backgroundColor: `${produit?.color}20`, color: produit?.color }}
                        >
                          {produit?.label || client.type_produit}
                        </span>
                      </td>
                      <td>
                        <span
                          className={styles.badge}
                          style={{ backgroundColor: `${statut?.color}20`, color: statut?.color }}
                        >
                          {statut?.label || client.statut}
                        </span>
                      </td>
                      <td>{new Date(client.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mes Objectifs (telepro only) */}
      {user?.role === 'telepro' && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Mes Objectifs</h2>
          <div className={styles.objectifsGrid}>
            <div className={styles.objectifCard}>
              <div className={styles.objectifLabel}>Total Clients</div>
              <div className={styles.objectifValue}>{data.summary?.totalClients || 0}</div>
              <div className={styles.objectifSubtext}>clients assignés</div>
            </div>
            <div className={styles.objectifCard}>
              <div className={styles.objectifLabel}>Terminés</div>
              <div className={styles.objectifValue} style={{ color: '#059669' }}>
                {statutsData.find(s => s.key === 'termine')?.count || 0}
              </div>
              <div className={styles.objectifSubtext}>
                {data.summary?.totalClients > 0 ?
                  `${((statutsData.find(s => s.key === 'termine')?.count || 0) / data.summary.totalClients * 100).toFixed(1)}%`
                  : '0%'} de conversion
              </div>
            </div>
            <div className={styles.objectifCard}>
              <div className={styles.objectifLabel}>À Rappeler</div>
              <div className={styles.objectifValue} style={{ color: '#f59e0b' }}>
                {statutsData.find(s => s.key === 'a_rappeler')?.count || 0}
              </div>
              <div className={styles.objectifSubtext}>clients à relancer</div>
            </div>
            <div className={styles.objectifCard}>
              <div className={styles.objectifLabel}>En Cours</div>
              <div className={styles.objectifValue} style={{ color: '#3b82f6' }}>
                {data.summary?.totalClients - (statutsData.find(s => s.key === 'termine')?.count || 0) || 0}
              </div>
              <div className={styles.objectifSubtext}>dossiers actifs</div>
            </div>
          </div>
        </div>
      )}

      {/* Performance des téléprospecteurs (admin only) */}
      {user?.role === 'admin' && data.charts?.teleproPerformance && data.charts.teleproPerformance.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Performance des Téléprospecteurs</h2>
          <div className={styles.performanceTable}>
            <table>
              <thead>
                <tr>
                  <th>Téléprospecteur</th>
                  <th>Total Clients</th>
                  <th>Terminés</th>
                  <th>Taux de Réussite</th>
                </tr>
              </thead>
              <tbody>
                {data.charts.teleproPerformance.map(telepro => (
                  <tr key={telepro.id}>
                    <td><strong>{telepro.username}</strong></td>
                    <td>{telepro.client_count}</td>
                    <td>{telepro.termine_count}</td>
                    <td>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${telepro.client_count > 0 ? (telepro.termine_count / telepro.client_count * 100) : 0}%`,
                            backgroundColor: '#10b981'
                          }}
                        />
                        <span className={styles.progressText}>
                          {telepro.client_count > 0 ? ((telepro.termine_count / telepro.client_count) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
