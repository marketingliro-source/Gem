import React, { useState } from 'react';
import { ArrowUpDown, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import styles from './AgentPerformanceTable.module.css';

const AgentPerformanceTable = ({ agents = [], period }) => {
  const [sortField, setSortField] = useState('total_clients');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedAgents = [...agents].sort((a, b) => {
    const aValue = a[sortField] || 0;
    const bValue = b[sortField] || 0;

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Performance Agents');

    // Définir les colonnes
    sheet.columns = [
      { header: 'Agent', key: 'username', width: 20 },
      { header: 'Total Clients', key: 'total_clients', width: 15 },
      { header: 'Courriers Envoyés', key: 'mail_sent', width: 18 },
      { header: 'Documents Reçus', key: 'document_received', width: 18 },
      { header: 'Annulés', key: 'cancelled', width: 12 },
      { header: 'Taux Courriers (%)', key: 'mail_rate', width: 18 },
      { header: 'Taux Documents (%)', key: 'doc_rate', width: 18 },
      { header: 'Dernière Activité', key: 'last_activity', width: 20 }
    ];

    // Style de l'en-tête
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 25;

    // Style des bordures
    const borderStyle = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    // Bordures sur l'en-tête
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = borderStyle;
    });

    // Fonction pour déterminer la couleur selon le taux
    const getPerformanceColor = (rate) => {
      if (rate >= 70) return 'FF10B981'; // Vert (bon)
      if (rate >= 40) return 'FFF59E0B'; // Orange (moyen)
      return 'FFEF4444'; // Rouge (faible)
    };

    // Ajouter les données avec le style
    sortedAgents.forEach((agent, index) => {
      const mailRate = agent.mail_sent_rate || 0;
      const docRate = agent.document_received_rate || 0;

      const row = sheet.addRow({
        username: agent.username,
        total_clients: agent.total_clients,
        mail_sent: agent.mail_sent,
        document_received: agent.document_received,
        cancelled: agent.cancelled,
        mail_rate: mailRate,
        doc_rate: docRate,
        last_activity: agent.last_activity ? new Date(agent.last_activity).toLocaleDateString('fr-FR') : 'N/A'
      });

      // Couleur de fond alternée pour les lignes
      const rowFillColor = index % 2 === 0 ? 'FFF0F0F0' : 'FFFFFFFF';

      // Appliquer le style à chaque cellule
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // Bordures
        cell.border = borderStyle;

        // Alignement vertical par défaut
        if (!cell.alignment) {
          cell.alignment = { vertical: 'middle' };
        }

        // Appliquer la couleur de fond alternée (sauf pour les colonnes 6 et 7 qui sont les taux)
        if (colNumber !== 6 && colNumber !== 7) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
        }

        // Centrer les colonnes numériques (colonnes 2, 3, 4, 5)
        if (colNumber >= 2 && colNumber <= 5) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });

      // Colorier les cellules de taux selon la performance
      const mailRateCell = row.getCell(6);
      if (mailRate > 0) {
        mailRateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: getPerformanceColor(parseFloat(mailRate)) } };
        mailRateCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        mailRateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        mailRateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
        mailRateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      const docRateCell = row.getCell(7);
      if (docRate > 0) {
        docRateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: getPerformanceColor(parseFloat(docRate)) } };
        docRateCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        docRateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        docRateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
        docRateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    // Ajouter un filtre automatique
    sheet.autoFilter = 'A1:H1';

    // Générer et télécharger le fichier
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `performance_agents_${period}_${date}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const getRateColor = (rate, isNegative = false) => {
    if (isNegative) {
      // For cancellation rate: lower is better
      if (rate < 5) return styles.rateGood;
      if (rate < 15) return styles.rateWarning;
      return styles.rateDanger;
    } else {
      // For other rates: higher is better
      if (rate >= 70) return styles.rateGood;
      if (rate >= 40) return styles.rateWarning;
      return styles.rateDanger;
    }
  };

  if (!agents || agents.length === 0) {
    return (
      <div className={styles.empty}>
        Aucune donnée de performance disponible
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Performance des Agents</h3>
        <button onClick={exportToExcel} className={styles.exportBtn}>
          <Download size={18} />
          Exporter Excel
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('username')} className={styles.sortable}>
                <div className={styles.headerCell}>
                  Agent
                  <ArrowUpDown size={16} />
                </div>
              </th>
              <th onClick={() => handleSort('total_clients')} className={styles.sortable}>
                <div className={styles.headerCell}>
                  Clients
                  <ArrowUpDown size={16} />
                </div>
              </th>
              <th onClick={() => handleSort('mail_sent')} className={styles.sortable}>
                <div className={styles.headerCell}>
                  Courriers
                  <ArrowUpDown size={16} />
                </div>
              </th>
              <th onClick={() => handleSort('mail_sent_rate')} className={styles.sortable}>
                <div className={styles.headerCell}>
                  Taux courriers
                  <ArrowUpDown size={16} />
                </div>
              </th>
              <th onClick={() => handleSort('document_received')} className={styles.sortable}>
                <div className={styles.headerCell}>
                  Documents
                  <ArrowUpDown size={16} />
                </div>
              </th>
              <th onClick={() => handleSort('document_received_rate')} className={styles.sortable}>
                <div className={styles.headerCell}>
                  Taux docs
                  <ArrowUpDown size={16} />
                </div>
              </th>
              <th onClick={() => handleSort('cancelled')} className={styles.sortable}>
                <div className={styles.headerCell}>
                  Annulés
                  <ArrowUpDown size={16} />
                </div>
              </th>
              <th onClick={() => handleSort('cancellation_rate')} className={styles.sortable}>
                <div className={styles.headerCell}>
                  Taux annulation
                  <ArrowUpDown size={16} />
                </div>
              </th>
              <th onClick={() => handleSort('conversion_rate')} className={styles.sortable}>
                <div className={styles.headerCell}>
                  Conversion
                  <ArrowUpDown size={16} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAgents.map((agent, index) => (
              <tr key={agent.id} className={index < 3 ? styles.topPerformer : ''}>
                <td className={styles.agentName}>
                  {index < 3 && <span className={styles.rank}>#{index + 1}</span>}
                  {agent.username}
                </td>
                <td className={styles.number}>{agent.total_clients}</td>
                <td className={styles.number}>{agent.mail_sent}</td>
                <td>
                  <span className={`${styles.rate} ${getRateColor(agent.mail_sent_rate)}`}>
                    {agent.mail_sent_rate}%
                  </span>
                </td>
                <td className={styles.number}>{agent.document_received}</td>
                <td>
                  <span className={`${styles.rate} ${getRateColor(agent.document_received_rate)}`}>
                    {agent.document_received_rate}%
                  </span>
                </td>
                <td className={styles.number}>{agent.cancelled}</td>
                <td>
                  <span className={`${styles.rate} ${getRateColor(agent.cancellation_rate, true)}`}>
                    {agent.cancellation_rate}%
                  </span>
                </td>
                <td>
                  <span className={`${styles.rate} ${getRateColor(agent.conversion_rate)}`}>
                    {agent.conversion_rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AgentPerformanceTable;
