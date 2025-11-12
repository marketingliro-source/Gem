import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import styles from './AgentSelector.module.css';

const AgentSelector = ({ agents = [], selectedAgents = [], onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleAgent = (agentId) => {
    const isSelected = selectedAgents.includes(agentId);
    if (isSelected) {
      onChange(selectedAgents.filter(id => id !== agentId));
    } else {
      onChange([...selectedAgents, agentId]);
    }
  };

  const selectAll = () => {
    onChange(agents.map(agent => agent.id));
  };

  const deselectAll = () => {
    onChange([]);
  };

  const selectedCount = selectedAgents.length;
  const totalCount = agents.length;

  const displayText = selectedCount === 0
    ? 'Sélectionner des agents'
    : selectedCount === totalCount
    ? 'Tous les agents'
    : `${selectedCount} agent${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''}`;

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span>{displayText}</span>
        <ChevronDown
          size={18}
          className={`${styles.icon} ${isOpen ? styles.iconOpen : ''}`}
        />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <button
              className={styles.action}
              onClick={selectAll}
              disabled={selectedCount === totalCount}
              type="button"
            >
              Tous
            </button>
            <button
              className={styles.action}
              onClick={deselectAll}
              disabled={selectedCount === 0}
              type="button"
            >
              Aucun
            </button>
          </div>

          <div className={styles.list}>
            {agents.length === 0 ? (
              <div className={styles.empty}>Aucun agent disponible</div>
            ) : (
              agents.map((agent) => {
                const isSelected = selectedAgents.includes(agent.id);
                return (
                  <label
                    key={agent.id}
                    className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                  >
                    <div className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAgent(agent.id)}
                        className={styles.checkboxInput}
                      />
                      {isSelected && <Check size={14} className={styles.checkIcon} />}
                    </div>
                    <span className={styles.label}>{agent.username}</span>
                    {agent.total_clients !== undefined && (
                      <span className={styles.count}>
                        {agent.total_clients} client{agent.total_clients > 1 ? 's' : ''}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentSelector;
