-- =====================================================================
-- 02_open_problems_with_optional_assignment.sql
-- Purpose: every currently outstanding problem, including ones not yet
-- assigned to a specialist. Backs the Problem List screen's "open"
-- filter, where an unassigned row must still display.
-- Demonstrates: multi-table LEFT JOIN across 6 tables. LEFT is required
-- (not INNER) because OPEN problems legitimately have a NULL
-- assigned_staff_id — an INNER join there would silently drop them.
-- Expected output: one row per OPEN/ASSIGNED/IN_PROGRESS problem,
-- assigned_specialist_name is NULL for unassigned (OPEN) rows.
-- =====================================================================
SELECT
    p.problem_id,
    CONCAT('PR-', LPAD(p.problem_id, 6, '0')) AS problem_number,
    p.status,
    p.priority,
    p.logged_at,
    CONCAT(caller.first_name, ' ', caller.last_name) AS caller_name,
    d.department_name,
    eq.serial_number,
    pt.type_name AS problem_type_name,
    CONCAT(spec.first_name, ' ', spec.last_name) AS assigned_specialist_name
FROM problem p
INNER JOIN employee caller   ON caller.employee_id = p.caller_employee_id
INNER JOIN department d      ON d.department_id = caller.department_id
INNER JOIN equipment eq      ON eq.equipment_id = p.equipment_id
INNER JOIN problem_type pt   ON pt.problem_type_id = p.problem_type_id
LEFT JOIN helpdesk_staff hs  ON hs.staff_id = p.assigned_staff_id
LEFT JOIN employee spec      ON spec.employee_id = hs.employee_id
WHERE p.status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
ORDER BY p.logged_at DESC;
