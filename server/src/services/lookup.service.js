// Log a Call auto-fill lookups (ARCHITECTURE.md §4.2 — caller/serial lookup).
import { pool } from '../db/pool.js';

export async function lookupCaller(employeeId) {
  const [rows] = await pool.query(
    `SELECT e.employee_id, e.first_name, e.last_name, e.email, e.department_id, d.department_name,
            e.job_title_id, jt.title_name, e.is_active
     FROM employee e
     JOIN department d ON d.department_id = e.department_id
     JOIN job_title jt ON jt.job_title_id = e.job_title_id
     WHERE e.employee_id = ?`,
    [employeeId]
  );
  return rows[0] || null;
}

// Licence validity: TRUE only if a licence row exists for this equipment
// whose window covers today. Equipment with no licence row at all (never
// licensed) and equipment with only an expired row both read as invalid.
export async function lookupEquipmentBySerial(serial) {
  const [rows] = await pool.query(
    `SELECT eq.equipment_id, eq.serial_number, eq.equipment_type_id, et.type_name AS equipment_type_name,
            eq.make, eq.model, eq.assigned_employee_id,
            CONCAT(e.first_name, ' ', e.last_name) AS assigned_employee_name, eq.is_retired
     FROM equipment eq
     JOIN equipment_type et ON et.equipment_type_id = eq.equipment_type_id
     LEFT JOIN employee e ON e.employee_id = eq.assigned_employee_id
     WHERE eq.serial_number = ?`,
    [serial]
  );
  const equipment = rows[0];
  if (!equipment) return null;

  const [licences] = await pool.query(
    `SELECT sl.licence_id, s.software_name, sl.licence_start_date, sl.licence_end_date,
            (CURDATE() BETWEEN sl.licence_start_date AND sl.licence_end_date) AS is_valid
     FROM software_licence sl
     JOIN software s ON s.software_id = sl.software_id
     WHERE sl.equipment_id = ?
     ORDER BY sl.licence_end_date DESC`,
    [equipment.equipment_id]
  );

  return { ...equipment, licences };
}
