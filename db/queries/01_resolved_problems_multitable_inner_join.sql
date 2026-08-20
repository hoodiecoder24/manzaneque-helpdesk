-- =====================================================================
-- 01_open_problems_multitable_join.sql
-- Purpose: full resolution detail for every closed-out problem — who
-- called, from which department, on what equipment, of what type, and
-- which specialist resolved it. Backs the Reports screen's drill-down
-- and the Knowledge Lookup "how was this resolved" view.
-- Demonstrates: multi-table INNER JOIN across 6 tables. INNER is
-- correct here (not LEFT) because a RESOLVED/CLOSED problem is
-- guaranteed by sp_assign_least_loaded to have an assigned specialist —
-- every row is expected to match on every join.
-- Expected output: one row per RESOLVED/CLOSED problem, newest first.
-- =====================================================================
SELECT
    p.problem_id,
    CONCAT('PR-', LPAD(p.problem_id, 6, '0')) AS problem_number,
    p.status,
    p.minutes_to_resolve,
    CONCAT(caller.first_name, ' ', caller.last_name) AS caller_name,
    d.department_name,
    eq.serial_number,
    pt.type_name AS problem_type_name,
    CONCAT(spec.first_name, ' ', spec.last_name) AS resolved_by_name,
    p.resolution_notes
FROM problem p
INNER JOIN employee caller      ON caller.employee_id = p.caller_employee_id
INNER JOIN department d         ON d.department_id = caller.department_id
INNER JOIN equipment eq         ON eq.equipment_id = p.equipment_id
INNER JOIN problem_type pt      ON pt.problem_type_id = p.problem_type_id
INNER JOIN helpdesk_staff hs    ON hs.staff_id = p.assigned_staff_id
INNER JOIN employee spec        ON spec.employee_id = hs.employee_id
WHERE p.status IN ('RESOLVED', 'CLOSED')
ORDER BY p.resolved_at DESC;
