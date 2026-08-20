import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const EMPTY = { typeName: '', parentTypeId: '' };

export function ProblemTypesAdmin() {
  const [rows, setRows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  function load() {
    api.get('/api/problem-types').then(setRows);
  }

  useEffect(load, []);

  function startEdit(row) {
    setEditingId(row.problem_type_id);
    setForm({ typeName: row.type_name, parentTypeId: row.parent_type_id || '' });
  }

  function startCreate() {
    setEditingId('new');
    setForm(EMPTY);
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    const payload = { ...form, parentTypeId: form.parentTypeId || null };
    try {
      if (editingId === 'new') await api.post('/api/problem-types', payload);
      else await api.put(`/api/problem-types/${editingId}`, payload);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this problem type?')) return;
    setError(null);
    try {
      await api.del(`/api/problem-types/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function parentName(id) {
    return rows.find((r) => r.problem_type_id === id)?.type_name || '—';
  }

  return (
    <div className="admin-resource">
      <button onClick={startCreate}>New problem type</button>
      {error && <p className="error-text">{error}</p>}

      {editingId && (
        <form className="inline-form" onSubmit={save}>
          <input placeholder="Type name" value={form.typeName} onChange={(e) => setForm({ ...form, typeName: e.target.value })} required />
          <select value={form.parentTypeId} onChange={(e) => setForm({ ...form, parentTypeId: e.target.value })}>
            <option value="">No parent (top level)</option>
            {rows.filter((r) => r.problem_type_id !== editingId).map((r) => (
              <option key={r.problem_type_id} value={r.problem_type_id}>{r.type_name}</option>
            ))}
          </select>
          <div className="modal-actions">
            <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
            <button type="submit" className="primary">Save</button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead><tr><th>Type</th><th>Parent</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.problem_type_id}>
              <td>{r.type_name}</td>
              <td>{r.parent_type_id ? parentName(r.parent_type_id) : '—'}</td>
              <td>
                <button onClick={() => startEdit(r)}>Edit</button>
                <button onClick={() => remove(r.problem_type_id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
