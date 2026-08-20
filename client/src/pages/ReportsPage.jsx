import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const TABS = [
  { key: 'open-by-age', label: 'Open problems by age' },
  { key: 'specialist-workload', label: 'Specialist workload' },
  { key: 'equipment-failures', label: 'Equipment failure ranking' },
  { key: 'type-frequency', label: 'Problem type frequency' }
];

export function ReportsPage() {
  const [tab, setTab] = useState(TABS[0].key);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    const params = tab === 'open-by-age' ? { dateFrom, dateTo } : undefined;
    api.get(`/api/reports/${tab}`, params)
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [tab, dateFrom, dateTo]);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="page reports-page">
      <h1>Reports</h1>
      <div className="filter-row">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'open-by-age' && (
        <div className="filter-row">
          <label>From <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label>To <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <table className="data-table">
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{columns.map((c) => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length || 1} className="empty-row">No data.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
