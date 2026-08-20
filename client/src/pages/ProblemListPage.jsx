import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export function ProblemListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState(user.role === 'SPECIALIST' ? 'ASSIGNED' : '');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0, pageSize: 20 });
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = { page, pageSize: 20 };
    if (status) params.status = status;
    if (user.role === 'SPECIALIST') params.assignedStaffId = user.staffId;

    api.get('/api/problems', params)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [status, page, user]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="page problem-list-page">
      <h1>Problems</h1>

      <div className="filter-row">
        <label>
          Status
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Problem #</th><th>Status</th><th>Priority</th><th>Type</th>
            <th>Caller</th><th>Equipment</th><th>Assigned to</th><th>Logged</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((p) => (
            <tr key={p.problem_id} className="clickable-row" onClick={() => navigate(`/problems/${p.problem_id}`)}>
              <td>PR-{String(p.problem_id).padStart(6, '0')}</td>
              <td>{p.status}</td>
              <td>{p.priority}</td>
              <td>{p.problem_type_name}</td>
              <td>{p.caller_name}</td>
              <td>{p.serial_number}</td>
              <td>{p.assigned_staff_name || '—'}</td>
              <td>{new Date(p.logged_at).toLocaleString()}</td>
            </tr>
          ))}
          {data.rows.length === 0 && (
            <tr><td colSpan={8} className="empty-row">No problems match this filter.</td></tr>
          )}
        </tbody>
      </table>

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
