// Admin CRUD over the personnel register (ARCHITECTURE.md §4.2 Admin screen).
import { pool } from '../db/pool.js';

export async function listEmployees() {
  const [rows] = await pool.query(
    `SELECT emp.employee_id, emp.first_name, emp.last_name, emp.email, emp.phone_extension,
            emp.department_id, d.department_name, emp.job_title_id, jt.title_name, emp.is_active
     FROM employee emp
     JOIN department d ON d.department_id = emp.department_id
     JOIN job_title jt ON jt.job_title_id = emp.job_title_id
     ORDER BY emp.last_name, emp.first_name`
  );
  return rows;
}

export async function getEmployee(employeeId) {
  const [rows] = await pool.query(
    `SELECT emp.employee_id, emp.first_name, emp.last_name, emp.email, emp.phone_extension,
            emp.department_id, d.department_name, emp.job_title_id, jt.title_name, emp.is_active
     FROM employee emp
     JOIN department d ON d.department_id = emp.department_id
     JOIN job_title jt ON jt.job_title_id = emp.job_title_id
     WHERE emp.employee_id = ?`,
    [employeeId]
  );
  return rows[0] || null;
}

export async function createEmployee(data) {
  const [result] = await pool.query(
    `INSERT INTO employee (first_name, last_name, email, phone_extension, department_id, job_title_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.firstName, data.lastName, data.email, data.phoneExtension ?? null, data.departmentId, data.jobTitleId, data.isActive]
  );
  return getEmployee(result.insertId);
}

export async function updateEmployee(employeeId, data) {
  const fields = [];
  const values = [];
  const map = {
    firstName: 'first_name', lastName: 'last_name', email: 'email',
    phoneExtension: 'phone_extension', departmentId: 'department_id',
    jobTitleId: 'job_title_id', isActive: 'is_active'
  };
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(data[key]);
    }
  }
  if (fields.length === 0) return getEmployee(employeeId);

  values.push(employeeId);
  await pool.query(`UPDATE employee SET ${fields.join(', ')} WHERE employee_id = ?`, values);
  return getEmployee(employeeId);
}

export async function deleteEmployee(employeeId) {
  await pool.query('DELETE FROM employee WHERE employee_id = ?', [employeeId]);
}
