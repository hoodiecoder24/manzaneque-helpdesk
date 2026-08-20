// Knowledge Lookup screen: previous problems of the same type, equipment,
// or caller, and how they were resolved (ARCHITECTURE.md §4.2).
import { pool } from '../db/pool.js';

const RESOLVED_BASE = `
  SELECT p.problem_id, p.status, p.priority, p.logged_at, p.resolved_at, p.minutes_to_resolve,
         p.resolution_notes,
         CONCAT(ce.first_name, ' ', ce.last_name) AS caller_name,
         eq.serial_number, pt.type_name AS problem_type_name,
         CONCAT(ae.first_name, ' ', ae.last_name) AS resolved_by_name
  FROM problem p
  JOIN employee ce ON ce.employee_id = p.caller_employee_id
  JOIN equipment eq ON eq.equipment_id = p.equipment_id
  JOIN problem_type pt ON pt.problem_type_id = p.problem_type_id
  LEFT JOIN helpdesk_staff ahs ON ahs.staff_id = p.assigned_staff_id
  LEFT JOIN employee ae ON ae.employee_id = ahs.employee_id`;

export async function knowledgeBySimilarType(problemTypeId) {
  const [rows] = await pool.query(
    `${RESOLVED_BASE} WHERE p.problem_type_id = ? AND p.status IN ('RESOLVED', 'CLOSED')
     ORDER BY p.resolved_at DESC LIMIT 50`,
    [problemTypeId]
  );
  return rows;
}

export async function knowledgeByEquipment(equipmentId) {
  const [rows] = await pool.query(
    `${RESOLVED_BASE} WHERE p.equipment_id = ? AND p.status IN ('RESOLVED', 'CLOSED')
     ORDER BY p.resolved_at DESC LIMIT 50`,
    [equipmentId]
  );
  return rows;
}

export async function knowledgeByCaller(callerEmployeeId) {
  const [rows] = await pool.query(
    `${RESOLVED_BASE} WHERE p.caller_employee_id = ? AND p.status IN ('RESOLVED', 'CLOSED')
     ORDER BY p.resolved_at DESC LIMIT 50`,
    [callerEmployeeId]
  );
  return rows;
}
