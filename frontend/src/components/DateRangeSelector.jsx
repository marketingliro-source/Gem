import React, { useState } from 'react';
import styles from './DateRangeSelector.module.css';

const DateRangeSelector = ({ value, onChange }) => {
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const presets = [
    { value: 'day', label: "Aujourd'hui" },
    { value: 'week', label: '7 derniers jours' },
    { value: 'month', label: '30 derniers jours' },
    { value: 'year', label: 'Cette année' },
    { value: 'custom', label: 'Période personnalisée' }
  ];

  const handlePresetChange = (e) => {
    const selectedValue = e.target.value;

    if (selectedValue === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange({ period: selectedValue, start_date: null, end_date: null });
    }
  };

  const handleCustomApply = () => {
    if (startDate && endDate) {
      onChange({
        period: 'custom',
        start_date: startDate,
        end_date: endDate
      });
      setShowCustom(false);
    }
  };

  const handleCustomCancel = () => {
    setShowCustom(false);
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className={styles.container}>
      <select
        value={value?.period || 'month'}
        onChange={handlePresetChange}
        className={styles.select}
      >
        {presets.map(preset => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>

      {showCustom && (
        <div className={styles.customModal}>
          <div className={styles.customContent}>
            <h3 className={styles.customTitle}>Sélectionner une période personnalisée</h3>

            <div className={styles.dateInputs}>
              <div className={styles.dateField}>
                <label className={styles.label}>Date de début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={styles.dateInput}
                />
              </div>

              <div className={styles.dateField}>
                <label className={styles.label}>Date de fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className={styles.dateInput}
                />
              </div>
            </div>

            <div className={styles.customActions}>
              <button
                onClick={handleCustomCancel}
                className={styles.cancelBtn}
              >
                Annuler
              </button>
              <button
                onClick={handleCustomApply}
                disabled={!startDate || !endDate}
                className={styles.applyBtn}
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector;
