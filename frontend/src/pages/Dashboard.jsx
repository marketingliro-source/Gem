import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Mail, FileText, XCircle, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DateRangeSelector from '../components/DateRangeSelector';
import AgentPerformanceTable from '../components/AgentPerformanceTable';
import AgentTrendChart from '../components/AgentTrendChart';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [agentsData, setAgentsData] = useState([]);
  const [personalData, setPersonalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ period: 'month', start_date: null, end_date: null });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching analytics for user:', user);

      // Build query params
      const params = new URLSearchParams({ period: dateRange.period });
      if (dateRange.start_date) params.append('start_date', dateRange.start_date);
      if (dateRange.end_date) params.append('end_date', dateRange.end_date);

      // Fetch general analytics (funnel, leads status, agent trends for admin)
      console.log('📊 Fetching general analytics...');
      const analyticsResponse = await api.get(`/analytics?${params.toString()}`);
      console.log('Analytics response:', analyticsResponse.data);
      setData(analyticsResponse.data);

      // If admin, fetch all agents performance
      if (user?.role === 'admin') {
        const agentsResponse = await api.get(`/analytics/agents?${params.toString()}`);
        console.log('Agents response:', agentsResponse.data);
        setAgentsData(agentsResponse.data.agents || []);
      }

      // If agent, fetch personal performance data
      if (user?.role === 'agent') {
        const personalResponse = await api.get(`/analytics/agent/${user.id}?${params.toString()}`);
        console.log('Personal data response:', personalResponse.data);
        // Flatten the response structure to match the expected format
        const flattenedData = {
          ...personalResponse.data.agent,
          teamAverage: personalResponse.data.teamAverage,
          trendData: personalResponse.data.trend
        };
        setPersonalData(flattenedData);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      // Build query params with period and date range
      const params = new URLSearchParams({ period: dateRange.period });
      if (dateRange.start_date) params.append('start_date', dateRange.start_date);
      if (dateRange.end_date) params.append('end_date', dateRange.end_date);

      const response = await api.get(`/analytics/export/excel?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const date = new Date().toISOString().split('T')[0];
      const fileName = user?.role === 'admin'
        ? `analytics_admin_${dateRange.period}_${date}.xlsx`
        : `analytics_${user?.username}_${dateRange.period}_${date}.xlsx`;

      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export Excel');
    }
  };

  if (loading) {
    return <div className={styles.loading}>Chargement des statistiques...</div>;
  }

  if (!data) {
    return <div className={styles.error}>Erreur lors du chargement des données</div>;
  }

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
  const funnelData = data.charts.trackingData;
  const statusData = data.charts.leadsStatus;

  // ADMIN VIEW
  if (user?.role === 'admin') {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <TrendingUp size={32} /> Tableau de bord
          </h1>
          <div className={styles.controls}>
            <DateRangeSelector value={dateRange} onChange={setDateRange} />
            <button onClick={exportToExcel} className={styles.exportBtn}>
              <Download size={18} />
              Exporter Excel
            </button>
          </div>
        </div>

        {/* Summary Cards - Hide Leads from display */}
        <div className={styles.summaryGrid}>
          <div className={styles.card}>
            <div className={styles.cardIcon} style={{background: 'rgba(16, 185, 129, 0.1)'}}>
              <Users size={24} style={{color: '#10b981'}} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{data.summary.totalClients}</div>
              <div className={styles.cardLabel}>Clients</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon} style={{background: 'rgba(245, 158, 11, 0.1)'}}>
              <Mail size={24} style={{color: '#f59e0b'}} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{data.summary.mailSent}</div>
              <div className={styles.cardLabel}>Courriers envoyés</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon} style={{background: 'rgba(16, 185, 129, 0.1)'}}>
              <FileText size={24} style={{color: '#10b981'}} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{data.summary.documentReceived}</div>
              <div className={styles.cardLabel}>Documents reçus</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon} style={{background: 'rgba(239, 68, 68, 0.1)'}}>
              <XCircle size={24} style={{color: '#ef4444'}} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{data.summary.cancelled}</div>
              <div className={styles.cardLabel}>Annulés</div>
              <div className={styles.cardSubtext}>{data.summary.cancellationRate}% du total</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon} style={{background: 'rgba(139, 92, 246, 0.1)'}}>
              <TrendingUp size={24} style={{color: '#8b5cf6'}} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{data.summary.conversionRate}%</div>
              <div className={styles.cardLabel}>Taux de conversion</div>
              <div className={styles.cardSubtext}>Leads → Clients</div>
            </div>
          </div>
        </div>

        {/* Agent Performance Table */}
        <AgentPerformanceTable agents={agentsData} period={dateRange.period} />

        {/* Agent Trends Line Chart */}
        {data.agentTrendData && Object.keys(data.agentTrendData).length > 0 && (
          <AgentTrendChart
            agentTrendData={data.agentTrendData}
            agents={agentsData}
            title="Évolution des performances par agent"
          />
        )}

        {/* Charts Grid */}
        <div className={styles.chartsGrid}>
          {/* Funnel / Tracking Progression */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Entonnoir de conversion</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" stroke="#999" />
                <YAxis dataKey="name" type="category" width={150} stroke="#999" />
                <Tooltip contentStyle={{background: '#1e1e1e', border: '1px solid #333'}} />
                <Bar dataKey="value" fill="#10b981">
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Leads Status Distribution */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Statut des leads</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.status}: ${entry.count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{background: '#1e1e1e', border: '1px solid #333'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  // AGENT VIEW
  if (user?.role === 'agent' && personalData) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <TrendingUp size={32} /> Ma Performance
          </h1>
          <div className={styles.controls}>
            <DateRangeSelector value={dateRange} onChange={setDateRange} />
            <button onClick={exportToExcel} className={styles.exportBtn}>
              <Download size={18} />
              Exporter Excel
            </button>
          </div>
        </div>

        {/* Personal Metrics Cards */}
        <div className={styles.summaryGrid}>
          <div className={styles.card}>
            <div className={styles.cardIcon} style={{background: 'rgba(16, 185, 129, 0.1)'}}>
              <Users size={24} style={{color: '#10b981'}} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{personalData.total_clients}</div>
              <div className={styles.cardLabel}>Mes Clients</div>
              <div className={styles.cardSubtext}>
                Moy. équipe: {personalData.teamAverage?.avg_clients?.toFixed(1) || 'N/A'}
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon} style={{background: 'rgba(245, 158, 11, 0.1)'}}>
              <Mail size={24} style={{color: '#f59e0b'}} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{personalData.mail_sent}</div>
              <div className={styles.cardLabel}>Courriers envoyés</div>
              <div className={styles.cardSubtext}>{personalData.mail_sent_rate}% de mes clients</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon} style={{background: 'rgba(16, 185, 129, 0.1)'}}>
              <FileText size={24} style={{color: '#10b981'}} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{personalData.document_received}</div>
              <div className={styles.cardLabel}>Documents reçus</div>
              <div className={styles.cardSubtext}>{personalData.document_received_rate}% de mes clients</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon} style={{background: 'rgba(239, 68, 68, 0.1)'}}>
              <XCircle size={24} style={{color: '#ef4444'}} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{personalData.cancelled}</div>
              <div className={styles.cardLabel}>Annulés</div>
              <div className={styles.cardSubtext}>{personalData.cancellation_rate}% de mes clients</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon} style={{background: 'rgba(139, 92, 246, 0.1)'}}>
              <TrendingUp size={24} style={{color: '#8b5cf6'}} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{personalData.conversion_rate}%</div>
              <div className={styles.cardLabel}>Taux de conversion</div>
              <div className={styles.cardSubtext}>Leads → Clients</div>
            </div>
          </div>
        </div>

        {/* Personal Trend Chart */}
        {personalData.trendData && personalData.trendData.length > 0 && (
          <AgentTrendChart
            agentTrendData={{[user.username]: personalData.trendData}}
            title="Évolution de mes performances"
          />
        )}

        {/* Team Comparison Card */}
        {personalData.teamAverage && (
          <div className={styles.comparisonCard}>
            <h3 className={styles.chartTitle}>Comparaison avec l'équipe</h3>
            <div className={styles.comparisonGrid}>
              <div className={styles.comparisonItem}>
                <div className={styles.comparisonLabel}>Taux Courriers</div>
                <div className={styles.comparisonValues}>
                  <span className={styles.myValue}>{personalData.mail_sent_rate}%</span>
                  <span className={styles.separator}>vs</span>
                  <span className={styles.avgValue}>
                    {personalData.teamAverage.avg_mail_rate?.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className={styles.comparisonItem}>
                <div className={styles.comparisonLabel}>Taux Documents</div>
                <div className={styles.comparisonValues}>
                  <span className={styles.myValue}>{personalData.document_received_rate}%</span>
                  <span className={styles.separator}>vs</span>
                  <span className={styles.avgValue}>
                    {personalData.teamAverage.avg_doc_rate?.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className={styles.comparisonItem}>
                <div className={styles.comparisonLabel}>Taux Annulation</div>
                <div className={styles.comparisonValues}>
                  <span className={styles.myValue}>{personalData.cancellation_rate}%</span>
                  <span className={styles.separator}>vs</span>
                  <span className={styles.avgValue}>
                    {personalData.teamAverage.avg_cancel_rate?.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className={styles.chartsGrid}>
          {/* Funnel */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Entonnoir de conversion</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" stroke="#999" />
                <YAxis dataKey="name" type="category" width={150} stroke="#999" />
                <Tooltip contentStyle={{background: '#1e1e1e', border: '1px solid #333'}} />
                <Bar dataKey="value" fill="#10b981">
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Leads Status */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Statut de mes leads</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.status}: ${entry.count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{background: '#1e1e1e', border: '1px solid #333'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Dashboard;
