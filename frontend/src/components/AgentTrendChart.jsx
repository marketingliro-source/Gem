import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AgentSelector from './AgentSelector';
import styles from './AgentTrendChart.module.css';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const METRICS = [
  { value: 'totalClients', label: 'Nombre de clients' },
  { value: 'leadsConverted', label: 'Leads convertis' },
  { value: 'documentsReceived', label: 'Documents reçus' },
  { value: 'mailsSent', label: 'Mails envoyés' }
];

const AgentTrendChart = ({ agentTrendData, agents = [], title = "Évolution des performances" }) => {
  const [visibleAgents, setVisibleAgents] = useState({});
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('totalClients');

  // Transform data for recharts (merge all agent data by date)
  const chartData = useMemo(() => {
    if (!agentTrendData || Object.keys(agentTrendData).length === 0) {
      return [];
    }

    const dateMap = {};

    Object.entries(agentTrendData).forEach(([agentName, data]) => {
      data.forEach(item => {
        if (!dateMap[item.date]) {
          dateMap[item.date] = { date: item.date };
        }
        // Use the selected metric instead of hardcoded 'count'
        dateMap[item.date][agentName] = item[selectedMetric] || 0;
      });
    });

    return Object.values(dateMap).sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );
  }, [agentTrendData, selectedMetric]);

  const agentNames = Object.keys(agentTrendData || {});

  // Initialize: select all agents and make them all visible
  useEffect(() => {
    if (agents.length > 0 && selectedAgentIds.length === 0) {
      setSelectedAgentIds(agents.map(a => a.id));
    }
  }, [agents.length]);

  // Initialize all agents as visible
  useEffect(() => {
    const initialState = {};
    agentNames.forEach(agent => {
      initialState[agent] = true;
    });
    setVisibleAgents(initialState);
  }, [agentNames.length]);

  // Filter agentTrendData based on selected agents
  const filteredAgentTrendData = useMemo(() => {
    if (!agentTrendData || selectedAgentIds.length === 0) {
      return {};
    }

    const filtered = {};
    Object.entries(agentTrendData).forEach(([agentName, data]) => {
      const agent = agents.find(a => a.username === agentName);
      if (agent && selectedAgentIds.includes(agent.id)) {
        filtered[agentName] = data;
      }
    });
    return filtered;
  }, [agentTrendData, selectedAgentIds, agents]);

  const toggleAgent = (agentName) => {
    setVisibleAgents(prev => ({
      ...prev,
      [agentName]: !prev[agentName]
    }));
  };

  const filteredAgentNames = Object.keys(filteredAgentTrendData);

  if (!agentTrendData || agentNames.length === 0) {
    return (
      <div className={styles.empty}>
        Aucune donnée de tendance disponible
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.controls}>
          <div className={styles.metricSelector}>
            <label className={styles.metricLabel}>Afficher par:</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className={styles.metricSelect}
            >
              {METRICS.map(metric => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>
          {agents.length > 0 && (
            <AgentSelector
              agents={agents}
              selectedAgents={selectedAgentIds}
              onChange={setSelectedAgentIds}
            />
          )}
        </div>
      </div>

      {filteredAgentNames.length > 0 && (
        <div className={styles.legendContainer}>
          <div className={styles.legend}>
            {filteredAgentNames.map((agent, index) => (
            <button
              key={agent}
              className={`${styles.legendItem} ${!visibleAgents[agent] ? styles.legendItemDisabled : ''}`}
              onClick={() => toggleAgent(agent)}
              style={{
                '--agent-color': COLORS[index % COLORS.length]
              }}
            >
              <span className={styles.legendDot}></span>
              {agent}
            </button>
          ))}
        </div>
        </div>
      )}

      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="date"
              stroke="#999"
              tick={{ fontSize: 12 }}
            />
            <YAxis stroke="#999" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: '#1e1e1e',
                border: '1px solid #333',
                borderRadius: '8px'
              }}
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
              }}
            />
            {filteredAgentNames.map((agent, index) =>
              visibleAgents[agent] && (
                <Line
                  key={agent}
                  type="monotone"
                  dataKey={agent}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name={agent}
                />
              )
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AgentTrendChart;
