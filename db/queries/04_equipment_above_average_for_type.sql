-- =====================================================================
-- 04_equipment_above_average_for_type.sql
-- Purpose: which individual equipment items fail more often than other
-- equipment of the *same type* — sharper than vw_equipment_failure_ranking's
-- flat ranking, since a laptop with 6 problems is unremarkable if every
-- laptop has 6, but notable if the average laptop has 1.
-- Demonstrates: a correlated subquery — the inner SELECT re-evaluates
-- per outer row, referencing the outer row's equipment_type_id.
-- Expected output: equipment items whose own problem count exceeds the
-- average problem count of other equipment sharing their type.
-- =====================================================================
SELECT
    eq.equipment_id,
    eq.serial_number,
    et.type_name AS equipment_type_name,
    (SELECT COUNT(*) FROM problem p WHERE p.equipment_id = eq.equipment_id) AS own_problem_count
FROM equipment eq
INNER JOIN equipment_type et ON et.equipment_type_id = eq.equipment_type_id
WHERE (SELECT COUNT(*) FROM problem p WHERE p.equipment_id = eq.equipment_id)
      >
      (SELECT AVG(type_counts.problem_count)
       FROM (
           SELECT eq2.equipment_id,
                  (SELECT COUNT(*) FROM problem p2 WHERE p2.equipment_id = eq2.equipment_id) AS problem_count
           FROM equipment eq2
           WHERE eq2.equipment_type_id = eq.equipment_type_id
       ) AS type_counts)
ORDER BY own_problem_count DESC;
