-- =====================================================================
-- 03_views.sql
-- Four management-information views (M3). Each answers one question the
-- brief asks; aggregation lives here, not in application code.
-- =====================================================================

DROP VIEW IF EXISTS vw_open_problems_by_age;
DROP VIEW IF EXISTS vw_specialist_workload;
DROP VIEW IF EXISTS vw_equipment_failure_ranking;
DROP VIEW IF EXISTS vw_problem_type_frequency;

-- ---------------------------------------------------------------------
-- vw_open_problems_by_age
-- Question: what is outstanding, and for how long?
-- Every problem not yet RESOLVED/CLOSED, with its age in hours and the
-- caller/equipment/type/assignee context needed to triage it.
-- ---------------------------------------------------------------------
CREATE VIEW vw_open_problems_by_age AS
SELECT
    p.problem_id,
    p.status,
    p.priority,
    p.logged_at,
    TIMESTAMPDIFF(HOUR, p.logged_at, NOW()) AS age_hours,
    CONCAT(e.first_name, ' ', e.last_name) AS caller_name,
    d.department_name,
    eq.serial_number,
    et.type_name AS equipment_type_name,
    pt.type_name AS problem_type_name,
    p.assigned_staff_id,
    CONCAT(se.first_name, ' ', se.last_name) AS assigned_staff_name
FROM problem p
JOIN employee e        ON e.employee_id = p.caller_employee_id
JOIN department d       ON d.department_id = e.department_id
JOIN equipment eq       ON eq.equipment_id = p.equipment_id
JOIN equipment_type et  ON et.equipment_type_id = eq.equipment_type_id
JOIN problem_type pt    ON pt.problem_type_id = p.problem_type_id
LEFT JOIN helpdesk_staff hs ON hs.staff_id = p.assigned_staff_id
LEFT JOIN employee se       ON se.employee_id = hs.employee_id
WHERE p.status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS');

-- ---------------------------------------------------------------------
-- vw_specialist_workload
-- Question: are specialists sufficiently resourced?
-- Per specialist: how many problems currently open, how many resolved
-- historically, and their average resolution time in minutes.
-- ---------------------------------------------------------------------
CREATE VIEW vw_specialist_workload AS
SELECT
    hs.staff_id,
    CONCAT(e.first_name, ' ', e.last_name) AS specialist_name,
    COUNT(CASE WHEN p.status IN ('ASSIGNED', 'IN_PROGRESS') THEN 1 END) AS open_problem_count,
    COUNT(CASE WHEN p.status IN ('RESOLVED', 'CLOSED') THEN 1 END) AS resolved_problem_count,
    ROUND(AVG(CASE WHEN p.status IN ('RESOLVED', 'CLOSED') THEN p.minutes_to_resolve END), 1)
        AS avg_minutes_to_resolve
FROM helpdesk_staff hs
JOIN employee e ON e.employee_id = hs.employee_id
LEFT JOIN problem p ON p.assigned_staff_id = hs.staff_id
WHERE hs.staff_role = 'SPECIALIST'
GROUP BY hs.staff_id, e.first_name, e.last_name;

-- ---------------------------------------------------------------------
-- vw_equipment_failure_ranking
-- Question: how is the equipment performing overall?
-- Per equipment item: how many problems have been logged against it and
-- how recently, ranked worst-first.
-- ---------------------------------------------------------------------
CREATE VIEW vw_equipment_failure_ranking AS
SELECT
    eq.equipment_id,
    eq.serial_number,
    et.type_name AS equipment_type_name,
    eq.make,
    eq.model,
    COUNT(p.problem_id) AS problem_count,
    MAX(p.logged_at) AS last_problem_logged_at
FROM equipment eq
JOIN equipment_type et ON et.equipment_type_id = eq.equipment_type_id
LEFT JOIN problem p ON p.equipment_id = eq.equipment_id
GROUP BY eq.equipment_id, eq.serial_number, et.type_name, eq.make, eq.model
ORDER BY problem_count DESC;

-- ---------------------------------------------------------------------
-- vw_problem_type_frequency
-- Question: where is employee training needed?
-- Rolls specific problem types up to their top-level parent so frequency
-- is meaningful even when specialists log against fine-grained subtypes.
-- ---------------------------------------------------------------------
CREATE VIEW vw_problem_type_frequency AS
WITH RECURSIVE type_root (problem_type_id, root_type_id) AS (
    SELECT problem_type_id, problem_type_id
    FROM problem_type
    WHERE parent_type_id IS NULL
    UNION ALL
    SELECT pt.problem_type_id, tr.root_type_id
    FROM problem_type pt
    JOIN type_root tr ON pt.parent_type_id = tr.problem_type_id
)
SELECT
    root.root_type_id,
    root_pt.type_name AS root_type_name,
    COUNT(p.problem_id) AS problem_count
FROM type_root root
JOIN problem_type root_pt ON root_pt.problem_type_id = root.root_type_id
LEFT JOIN problem p ON p.problem_type_id = root.problem_type_id
GROUP BY root.root_type_id, root_pt.type_name
ORDER BY problem_count DESC;
