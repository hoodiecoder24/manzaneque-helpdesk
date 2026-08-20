// Admin CRUD over the equipment register (ARCHITECTURE.md §4.2 Admin screen).
import { pool } from '../db/pool.js';

const SELECT_BASE = `
  SELECT eq.equipment_id, eq.serial_number, eq.equipment_type_id, et.type_name AS equipment_type_name,
         eq.make, eq.model, eq.purchase_date, eq.assigned_employee_id,
         CONCAT(e.first_name, ' ', e.last_name) AS assigned_employee_name, eq.is_retired
  FROM equipment eq
  JOIN equipment_type et ON et.equipment_type_id = eq.equipment_type_id
  LEFT JOIN employee e ON e.employee_id = eq.assigned_employee_id`;

export async function listEquipment() {
  const [rows] = await pool.query(`${SELECT_BASE} ORDER BY eq.serial_number`);
  return rows;
}

export async function getEquipment(equipmentId) {
  const [rows] = await pool.query(`${SELECT_BASE} WHERE eq.equipment_id = ?`, [equipmentId]);
  return rows[0] || null;
}

export async function createEquipment(data) {
  const [result] = await pool.query(
    `INSERT INTO equipment (serial_number, equipment_type_id, make, model, purchase_date, assigned_employee_id, is_retired)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.serialNumber, data.equipmentTypeId, data.make, data.model, data.purchaseDate ?? null, data.assignedEmployeeId ?? null, data.isRetired]
  );
  return getEquipment(result.insertId);
}

export async function updateEquipment(equipmentId, data) {
  const fields = [];
  const values = [];
  const map = {
    serialNumber: 'serial_number', equipmentTypeId: 'equipment_type_id', make: 'make',
    model: 'model', purchaseDate: 'purchase_date', assignedEmployeeId: 'assigned_employee_id',
    isRetired: 'is_retired'
  };
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(data[key]);
    }
  }
  if (fields.length === 0) return getEquipment(equipmentId);

  values.push(equipmentId);
  await pool.query(`UPDATE equipment SET ${fields.join(', ')} WHERE equipment_id = ?`, values);
  return getEquipment(equipmentId);
}

export async function deleteEquipment(equipmentId) {
  await pool.query('DELETE FROM equipment WHERE equipment_id = ?', [equipmentId]);
}
