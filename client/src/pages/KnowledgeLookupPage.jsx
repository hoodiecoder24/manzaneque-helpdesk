import { useState } from 'react';
import { api } from '../api/client.js';
import { ProblemTypePicker } from '../components/ProblemTypePicker.jsx';

// Brief: look up previous problems of the same type, same equipment, or
// same caller, and how they were resolved.
export function KnowledgeLookupPage() {
  return (
    <div className="page knowledge-lookup-page">
      <h1>Knowledge Lookup</h1>
      <ByType />
      <ByEquipment />
      <ByCaller />
    </div>
  );
}

function ResultsTable({ rows }) {
  if (rows === null) return null;
  if (rows.length === 0) return <p className="empty-row">No resolved problems found.</p>;
  return (
    <table className="data-table">
      <thead>
        <tr><th>Problem #</th><th>Caller</th><th>Equipment</th><th>Type</th><th>Resolved by</th><th>Resolution</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.problem_id}>
            <td>PR-{String(r.problem_id).padStart(6, '0')}</td>
            <td>{r.caller_name}</td>
            <td>{r.serial_number}</td>
            <td>{r.problem_type_name}</td>
            <td>{r.resolved_by_name || '—'}</td>
            <td>{r.resolution_notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ByType() {
  const [problemTypeId, setProblemTypeId] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  async function search() {
    setError(null);
    try {
      setRows(await api.get('/api/knowledge/similar', { problemTypeId }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="lookup-block">
      <h2>By problem type</h2>
      <ProblemTypePicker value={problemTypeId} onChange={setProblemTypeId} />
      <button type="button" onClick={search} disabled={!problemTypeId}>Search</button>
      {error && <p className="error-text">{error}</p>}
      <ResultsTable rows={rows} />
    </section>
  );
}

function ByEquipment() {
  const [equipmentId, setEquipmentId] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  async function search() {
    setError(null);
    try {
      setRows(await api.get(`/api/knowledge/by-equipment/${equipmentId}`));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="lookup-block">
      <h2>By equipment ID</h2>
      <div className="lookup-row">
        <input placeholder="Equipment ID" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} />
        <button type="button" onClick={search} disabled={!equipmentId}>Search</button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <ResultsTable rows={rows} />
    </section>
  );
}

function ByCaller() {
  const [callerId, setCallerId] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  async function search() {
    setError(null);
    try {
      setRows(await api.get(`/api/knowledge/by-caller/${callerId}`));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="lookup-block">
      <h2>By caller (employee ID)</h2>
      <div className="lookup-row">
        <input placeholder="Employee ID" value={callerId} onChange={(e) => setCallerId(e.target.value)} />
        <button type="button" onClick={search} disabled={!callerId}>Search</button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <ResultsTable rows={rows} />
    </section>
  );
}
