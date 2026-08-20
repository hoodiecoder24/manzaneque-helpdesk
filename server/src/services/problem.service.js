// Problem workflow: list/detail reads plus the four state-changing
// operations, each delegated to its stored procedure so the transaction
// and derived values (problem number, minutes_to_resolve, audit rows)
// live in the database, not here.
import { pool } from '../db/pool.js';

const LIST_BASE = `
  SELECT p.problem_id, p.status, p.priority, p.logged_at, p.resolved_at, p.minutes_to_resolve,
         p.caller_employee_id, CONCAT(ce.first_name, ' ', ce.last_name) AS caller_name,
         p.equipment_id, eq.serial_number,
         p.problem_type_id, pt.type_name AS problem_type_name,
         p.assigned_staff_id, CONCAT(ae.first_name, ' ', ae.last_name) AS assigned_staff_name,
         p.logged_by_staff_id
  FROM problem p
  JOIN employee ce ON ce.employee_id = p.caller_employee_id
  JOIN equipment eq ON eq.equipment_id = p.equipment_id
  JOIN problem_type pt ON pt.problem_type_id = p.problem_type_id
  LEFT JOIN helpdesk_staff ahs ON ahs.staff_id = p.assigned_staff_id
  LEFT JOIN employee ae ON ae.employee_id = ahs.employee_id`;

export async function listProblems(filters) {
  const where = [];
  const values = [];

  if (filters.status) { where.push('p.status = ?'); values.push(filters.status); }
  if (filters.problemTypeId) { where.push('p.problem_type_id = ?'); values.push(filters.problemTypeId); }
  if (filters.callerEmployeeId) { where.push('p.caller_employee_id = ?'); values.push(filters.callerEmployeeId); }
  if (filters.equipmentId) { where.push('p.equipment_id = ?'); values.push(filters.equipmentId); }
  if (filters.assignedStaffId) { where.push('p.assigned_staff_id = ?'); values.push(filters.assignedStaffId); }
  if (filters.dateFrom) { where.push('p.logged_at >= ?'); values.push(`${filters.dateFrom} 00:00:00`); }
  if (filters.dateTo) { where.push('p.logged_at <= ?'); values.push(`${filters.dateTo} 23:59:59`); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows] = await pool.query(
    `${LIST_BASE} ${whereClause} ORDER BY p.logged_at DESC LIMIT ? OFFSET ?`,
    [...values, filters.pageSize, offset]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM problem p ${whereClause}`,
    values
  );

  return { rows, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getProblem(problemId) {
  const [rows] = await pool.query(`${LIST_BASE} WHERE p.problem_id = ?`, [problemId]);
  const problem = rows[0];
  if (!problem) return null;

  const [calls] = await pool.query(
    `SELECT cl.call_log_id, cl.call_type, cl.notes, cl.logged_at, cl.staff_id,
            CONCAT(e.first_name, ' ', e.last_name) AS staff_name
     FROM call_log cl
     JOIN helpdesk_staff hs ON hs.staff_id = cl.staff_id
     JOIN employee e ON e.employee_id = hs.employee_id
     WHERE cl.problem_id = ?
     ORDER BY cl.logged_at ASC, cl.call_log_id ASC`,
    [problemId]
  );

  return { ...problem, calls };
}

// sp_log_new_call has two OUT params, so this needs one dedicated
// connection: session (@)-variables are connection-scoped, and a pooled
// .query() call could otherwise land on a different connection than the
// one that ran CALL.
export async function logNewCall(data, loggedByStaffId) {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      'CALL sp_log_new_call(?, ?, ?, ?, ?, ?, @p_problem_id, @p_problem_number)',
      [data.callerEmployeeId, data.equipmentId, data.problemTypeId, data.priority, data.notes, loggedByStaffId]
    );
    const [[out]] = await connection.query('SELECT @p_problem_id AS problemId, @p_problem_number AS problemNumber');
    return out;
  } finally {
    connection.release();
  }
}

export async function addFollowUpCall(problemId, staffId, notes) {
  await pool.query(
    `INSERT INTO call_log (problem_id, staff_id, call_type, notes) VALUES (?, ?, 'FOLLOW_UP', ?)`,
    [problemId, staffId, notes]
  );
}

export async function reclassifyProblem(problemId, problemTypeId) {
  await pool.query('UPDATE problem SET problem_type_id = ? WHERE problem_id = ?', [problemTypeId, problemId]);
}

export async function assignLeastLoaded(problemId) {
  const connection = await pool.getConnection();
  try {
    await connection.query('CALL sp_assign_least_loaded(?, @p_assigned_staff_id)', [problemId]);
    const [[out]] = await connection.query('SELECT @p_assigned_staff_id AS assignedStaffId');
    return out;
  } finally {
    connection.release();
  }
}

export async function resolveProblem(problemId, resolutionNotes, resolvedByStaffId) {
  await pool.query('CALL sp_resolve_problem(?, ?, ?)', [problemId, resolutionNotes, resolvedByStaffId]);
}
