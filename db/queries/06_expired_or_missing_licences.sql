-- =====================================================================
-- 06_expired_or_missing_licences.sql
-- Purpose: every equipment item whose software licence has expired, or
-- which has no licence record at all — feeds the licence-validity
-- indicator on the Log a Call serial lookup and is a compliance check
-- in its own right.
-- Demonstrates: multi-table LEFT JOIN (equipment must survive even with
-- zero licence rows) combined with a date-based WHERE condition.
-- Expected output: one row per (equipment, licence) pair that is
-- expired, plus one row per equipment item with no licence at all
-- (software_name/licence_end_date NULL in that case).
-- =====================================================================
SELECT
    eq.equipment_id,
    eq.serial_number,
    et.type_name AS equipment_type_name,
    sw.software_name,
    sl.licence_end_date,
    CASE
        WHEN sl.licence_id IS NULL THEN 'NO LICENCE ON RECORD'
        WHEN sl.licence_end_date < CURDATE() THEN 'EXPIRED'
    END AS licence_status
FROM equipment eq
INNER JOIN equipment_type et ON et.equipment_type_id = eq.equipment_type_id
LEFT JOIN software_licence sl ON sl.equipment_id = eq.equipment_id
LEFT JOIN software sw         ON sw.software_id = sl.software_id
WHERE sl.licence_id IS NULL
   OR sl.licence_end_date < CURDATE()
ORDER BY eq.equipment_id;
