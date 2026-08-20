import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const EMPTY = { firstName: '', lastName: '', email: '', phoneExtension: '', departmentId: '', jobTitleId: '', isActive: true };

export function EmployeesAdmin() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  function load() {
    api.get('/api/employees').then(setRows);
  }

  useEffect(() => {
    load();
    api.get('/api/departments').then(setDepartments);
    api.get('/api/job-titles').then(setJobTitles);
  }, []);

  function startEdit(row) {
    setEditingId(row.employee_id);
    setForm({
      firstName: row.first_name, lastName: row.last_name, email: row.email,
      phoneExtension: row.phone_extension || '', departmentId: row.department_id,
      jobTitleId: row.job_title_id, isActive: !!row.is_active
    });
  }

  function startCreate() {
    setEditingId('new');
    setForm(EMPTY);
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    try {
      if (editingId === 'new') await api.post('/api/employees', form);
      else await api.put(`/api/employees/${editingId}`, form);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this employee?')) return;
    setError(null);
    try {
      await api.del(`/api/employees/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-resource">
      <button onClick={startCreate}>New employee</button>
      {error && <p className="error-text">{error}</p>}

      {editingId && (
        <form className="inline-form" onSubmit={save}>
          <input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          <input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input placeholder="Phone ext." value={form.phoneExtension} onChange={(e) => setForm({ ...form, phoneExtension: e.target.value })} />
          <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
            <option value="" disabled>Department</option>
            {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
          </select>
          <select value={form.jobTitleId} onChange={(e) => setForm({ ...form, jobTitleId: e.target.value })} required>
            <option value="" disabled>Job title</option>
            {jobTitles.map((j) => <option key={j.job_title_id} value={j.job_title_id}>{j.title_name}</option>)}
          </select>
          <label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          <div className="modal-actions">
            <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
            <button type="submit" className="primary">Save</button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Job title</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employee_id}>
              <td>{r.first_name} {r.last_name}</td>
              <td>{r.email}</td>
              <td>{r.department_name}</td>
              <td>{r.title_name}</td>
              <td>{r.is_active ? 'Yes' : 'No'}</td>
              <td>
                <button onClick={() => startEdit(r)}>Edit</button>
                <button onClick={() => remove(r.employee_id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
