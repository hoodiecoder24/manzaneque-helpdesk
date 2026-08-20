// Admin CRUD over the problem-type hierarchy, plus a tree-shaped read for
// the cascading picker on Log a Call and reclassification.
import { pool } from '../db/pool.js';

export async function listProblemTypesFlat() {
  const [rows] = await pool.query(
    'SELECT problem_type_id, type_name, parent_type_id FROM problem_type ORDER BY type_name'
  );
  return rows;
}

// Builds the parent -> children tree in JS from the flat, indexed list —
// this is presentation shaping of already-fetched rows, not aggregation,
// so it does not belong in a view.
export async function getProblemTypeTree() {
  const flat = await listProblemTypesFlat();
  const byId = new Map(flat.map((row) => [row.problem_type_id, { ...row, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    if (node.parent_type_id === null) {
      roots.push(node);
    } else {
      byId.get(node.parent_type_id)?.children.push(node);
    }
  }
  return roots;
}

export async function getProblemType(problemTypeId) {
  const [rows] = await pool.query(
    'SELECT problem_type_id, type_name, parent_type_id FROM problem_type WHERE problem_type_id = ?',
    [problemTypeId]
  );
  return rows[0] || null;
}

export async function createProblemType(data) {
  const [result] = await pool.query(
    'INSERT INTO problem_type (type_name, parent_type_id) VALUES (?, ?)',
    [data.typeName, data.parentTypeId ?? null]
  );
  return getProblemType(result.insertId);
}

export async function updateProblemType(problemTypeId, data) {
  const fields = [];
  const values = [];
  if (data.typeName !== undefined) { fields.push('type_name = ?'); values.push(data.typeName); }
  if (data.parentTypeId !== undefined) { fields.push('parent_type_id = ?'); values.push(data.parentTypeId); }
  if (fields.length === 0) return getProblemType(problemTypeId);

  values.push(problemTypeId);
  await pool.query(`UPDATE problem_type SET ${fields.join(', ')} WHERE problem_type_id = ?`, values);
  return getProblemType(problemTypeId);
}

export async function deleteProblemType(problemTypeId) {
  await pool.query('DELETE FROM problem_type WHERE problem_type_id = ?', [problemTypeId]);
}
