import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';

// Looks up an active staff account by username, joined to employee for
// display name. Password verification happens in the controller (needs
// the plaintext, which never belongs in a service that might get reused
// for non-auth lookups).
export async function findActiveStaffByUsername(username) {
  const [rows] = await pool.query(
    `SELECT hs.staff_id, hs.employee_id, hs.username, hs.password_hash, hs.staff_role,
            CONCAT(e.first_name, ' ', e.last_name) AS full_name
     FROM helpdesk_staff hs
     JOIN employee e ON e.employee_id = hs.employee_id
     WHERE hs.username = ? AND hs.is_active = 1`,
    [username]
  );
  return rows[0] || null;
}

export async function findStaffById(staffId) {
  const [rows] = await pool.query(
    `SELECT hs.staff_id, hs.employee_id, hs.username, hs.staff_role,
            CONCAT(e.first_name, ' ', e.last_name) AS full_name
     FROM helpdesk_staff hs
     JOIN employee e ON e.employee_id = hs.employee_id
     WHERE hs.staff_id = ? AND hs.is_active = 1`,
    [staffId]
  );
  return rows[0] || null;
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
