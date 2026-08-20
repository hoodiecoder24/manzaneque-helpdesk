// Thin reads over the four M3 management-information views. All
// aggregation lives in db/03_views.sql — this layer only applies the
// optional date filter the brief asks for on reports.
import { pool } from '../db/pool.js';

export async function openProblemsByAge(dateFrom, dateTo) {
  const where = [];
  const values = [];
  if (dateFrom) { where.push('logged_at >= ?'); values.push(`${dateFrom} 00:00:00`); }
  if (dateTo) { where.push('logged_at <= ?'); values.push(`${dateTo} 23:59:59`); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM vw_open_problems_by_age ${whereClause} ORDER BY age_hours DESC`, values);
  return rows;
}

export async function specialistWorkload() {
  const [rows] = await pool.query('SELECT * FROM vw_specialist_workload ORDER BY open_problem_count DESC');
  return rows;
}

export async function equipmentFailureRanking() {
  const [rows] = await pool.query('SELECT * FROM vw_equipment_failure_ranking');
  return rows;
}

export async function problemTypeFrequency() {
  const [rows] = await pool.query('SELECT * FROM vw_problem_type_frequency');
  return rows;
}
