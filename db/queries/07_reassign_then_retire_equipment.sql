-- =====================================================================
-- 07_reassign_then_retire_equipment.sql
-- Purpose: demonstrates the referential-action behaviour designed into
-- the schema (§3.2) with a real UPDATE/DELETE pair rather than just
-- describing it. Run the three statements in order against the seed
-- database (each SELECT shows the effect of the statement before it).
--
-- Demonstrates:
--   1. UPDATE — unassigns and retires one currently-assigned piece of
--      equipment (an ordinary, unconditional UPDATE).
--   2. DELETE — removes that now-unassigned, never-referenced-by-any-
--      problem equipment row. Because software_licence.equipment_id is
--      declared ON DELETE CASCADE, any licence rows for it disappear
--      automatically with it — shown by the before/after licence count.
--      The WHERE clause deliberately excludes equipment referenced by
--      any problem row, because problem.equipment_id is ON DELETE
--      RESTRICT: attempting to delete equipment a problem points to
--      would be rejected by the database, which is the other half of
--      the referential-action design working as intended.
-- =====================================================================

-- Step 1: pick and retire one in-use equipment item.
UPDATE equipment
SET assigned_employee_id = NULL,
    is_retired = 1
WHERE equipment_id = (
    SELECT equipment_id FROM (
        SELECT equipment_id
        FROM equipment
        WHERE assigned_employee_id IS NOT NULL
          AND is_retired = 0
        ORDER BY equipment_id
        LIMIT 1
    ) AS pick
);

-- Step 2 (evidence): licence rows attached to that equipment, before deletion.
SELECT eq.equipment_id, eq.serial_number, COUNT(sl.licence_id) AS licence_count
FROM equipment eq
LEFT JOIN software_licence sl ON sl.equipment_id = eq.equipment_id
WHERE eq.is_retired = 1 AND eq.assigned_employee_id IS NULL
GROUP BY eq.equipment_id, eq.serial_number
ORDER BY eq.equipment_id DESC
LIMIT 1;

-- Step 3: delete the retired, unassigned equipment item — but only if no
-- problem row references it (that FK is RESTRICT, not CASCADE, so the
-- database would otherwise reject this delete).
DELETE FROM equipment
WHERE is_retired = 1
  AND assigned_employee_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM problem p WHERE p.equipment_id = equipment.equipment_id)
ORDER BY equipment_id DESC
LIMIT 1;

-- Step 4 (evidence): re-run the Step 2 query's shape for the same serial —
-- zero rows confirms the equipment and its licences are both gone, i.e.
-- CASCADE fired for software_licence without a separate DELETE statement.
