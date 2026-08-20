// Read-only reference lookups. Maintained in SQL (seed data), not via API
// CRUD — see ARCHITECTURE.md §4.1.
import { pool } from '../db/pool.js';

export async function listDepartments() {
  const [rows] = await pool.query('SELECT department_id, department_name FROM department ORDER BY department_name');
  return rows;
}

export async function listJobTitles() {
  const [rows] = await pool.query('SELECT job_title_id, title_name FROM job_title ORDER BY title_name');
  return rows;
}

export async function listEquipmentTypes() {
  const [rows] = await pool.query('SELECT equipment_type_id, type_name FROM equipment_type ORDER BY type_name');
  return rows;
}

export async function listSoftware() {
  const [rows] = await pool.query('SELECT software_id, software_name, vendor FROM software ORDER BY software_name');
  return rows;
}

export async function listStaff() {
  const [rows] = await pool.query(
    `SELECT hs.staff_id, hs.username, hs.staff_role, hs.is_active,
            CONCAT(e.first_name, ' ', e.last_name) AS full_name
     FROM helpdesk_staff hs
     JOIN employee e ON e.employee_id = hs.employee_id
     ORDER BY full_name`
  );
  return rows;
}
