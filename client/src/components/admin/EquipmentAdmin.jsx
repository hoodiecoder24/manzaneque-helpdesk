import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const EMPTY = { serialNumber: '', equipmentTypeId: '', make: '', model: '', purchaseDate: '', assignedEmployeeId: '', isRetired: false };

export function EquipmentAdmin() {
  const [rows, setRows] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  function load() {
    api.get('/api/equipment').then(setRows);
  }

  useEffect(() => {
    load();
    api.get('/api/equipment-types').then(setEquipmentTypes);
    api.get('/api/employees').then(setEmployees);
  }, []);

  function startEdit(row) {
    setEditingId(row.equipment_id);
    setForm({
      serialNumber: row.serial_number, equipmentTypeId: row.equipment_type_id,
      make: row.make, model: row.model, purchaseDate: row.purchase_date || '',
      assignedEmployeeId: row.assigned_employee_id || '', isRetired: !!row.is_retired
    });
  }

  function startCreate() {
    setEditingId('new');
    setForm(EMPTY);
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    const payload = { ...form, assignedEmployeeId: form.assignedEmployeeId || null, purchaseDate: form.purchaseDate || null };
    try {
      if (editingId === 'new') await api.post('/api/equipment', payload);
      else await api.put(`/api/equipment/${editingId}`, payload);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this equipment item?')) return;
    setError(null);
    try {
      await api.del(`/api/equipment/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-resource">
      <button onClick={startCreate}>New equipment</button>
      {error && <p className="error-text">{error}</p>}

      {editingId && (
        <form className="inline-form" onSubmit={save}>
          <input placeholder="Serial number" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} required />
          <select value={form.equipmentTypeId} onChange={(e) => setForm({ ...form, equipmentTypeId: e.target.value })} required>
            <option value="" disabled>Type</option>
            {equipmentTypes.map((t) => <option key={t.equipment_type_id} value={t.equipment_type_id}>{t.type_name}</option>)}
          </select>
          <input placeholder="Make" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required />
          <input placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
          <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          <select value={form.assignedEmployeeId} onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}>
            <option value="">Unassigned</option>
            {employees.map((e2) => <option key={e2.employee_id} value={e2.employee_id}>{e2.first_name} {e2.last_name}</option>)}
          </select>
          <label><input type="checkbox" checked={form.isRetired} onChange={(e) => setForm({ ...form, isRetired: e.target.checked })} /> Retired</label>
          <div className="modal-actions">
            <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
            <button type="submit" className="primary">Save</button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead><tr><th>Serial</th><th>Type</th><th>Make/Model</th><th>Assigned</th><th>Retired</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.equipment_id}>
              <td>{r.serial_number}</td>
              <td>{r.equipment_type_name}</td>
              <td>{r.make} {r.model}</td>
              <td>{r.assigned_employee_name || '—'}</td>
              <td>{r.is_retired ? 'Yes' : 'No'}</td>
              <td>
                <button onClick={() => startEdit(r)}>Edit</button>
                <button onClick={() => remove(r.equipment_id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
