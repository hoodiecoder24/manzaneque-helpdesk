-- =====================================================================
-- 03_overloaded_specialists.sql
-- Purpose: which specialists currently carry more open problems than
-- the average specialist — the resourcing question the brief asks
-- ("are specialists sufficiently resourced?"), as a standalone query
-- rather than through vw_specialist_workload, to demonstrate GROUP BY
-- + HAVING directly.
-- Demonstrates: aggregate function (COUNT, AVG) with GROUP BY and a
-- HAVING clause filtering on the aggregate itself.
-- Expected output: zero or more specialists whose open_problem_count
-- exceeds the company-wide average open load per specialist.
-- =====================================================================
SELECT
    hs.staff_id,
    CONCAT(e.first_name, ' ', e.last_name) AS specialist_name,
    COUNT(p.problem_id) AS open_problem_count
FROM helpdesk_staff hs
INNER JOIN employee e ON e.employee_id = hs.employee_id
INNER JOIN problem p  ON p.assigned_staff_id = hs.staff_id
                      AND p.status IN ('ASSIGNED', 'IN_PROGRESS')
WHERE hs.staff_role = 'SPECIALIST'
GROUP BY hs.staff_id, e.first_name, e.last_name
HAVING COUNT(p.problem_id) > (
    SELECT AVG(open_count) FROM (
        SELECT COUNT(*) AS open_count
        FROM problem
        WHERE status IN ('ASSIGNED', 'IN_PROGRESS')
        GROUP BY assigned_staff_id
    ) AS per_specialist_load
)
ORDER BY open_problem_count DESC;
