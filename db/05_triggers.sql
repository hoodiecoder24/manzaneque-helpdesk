-- =====================================================================
-- 05_triggers.sql
-- Two triggers on problem, both fired by any UPDATE — one derives a
-- value before the row is written, the other records history after.
-- =====================================================================

DROP TRIGGER IF EXISTS trg_problem_before_update;
DROP TRIGGER IF EXISTS trg_problem_after_update;

DELIMITER $$

-- ---------------------------------------------------------------------
-- trg_problem_before_update
-- Derives minutes_to_resolve the moment resolved_at is set (and was not
-- already set), so the value is never computed or trusted from the app.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_problem_before_update
BEFORE UPDATE ON problem
FOR EACH ROW
BEGIN
    IF NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL THEN
        SET NEW.minutes_to_resolve = TIMESTAMPDIFF(MINUTE, NEW.logged_at, NEW.resolved_at);
    END IF;
END$$

-- ---------------------------------------------------------------------
-- trg_problem_after_update
-- Audit row on any status, type or assignment change — the fields that
-- represent the lifecycle of the ticket. Justified under M2 security as
-- traceability of who/what changed a problem, and when.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_problem_after_update
AFTER UPDATE ON problem
FOR EACH ROW
BEGIN
    IF NOT (NEW.status <=> OLD.status) THEN
        INSERT INTO audit_log (problem_id, changed_field, old_value, new_value)
        VALUES (NEW.problem_id, 'status', OLD.status, NEW.status);
    END IF;

    IF NOT (NEW.problem_type_id <=> OLD.problem_type_id) THEN
        INSERT INTO audit_log (problem_id, changed_field, old_value, new_value)
        VALUES (NEW.problem_id, 'problem_type_id', OLD.problem_type_id, NEW.problem_type_id);
    END IF;

    IF NOT (NEW.assigned_staff_id <=> OLD.assigned_staff_id) THEN
        INSERT INTO audit_log (problem_id, changed_field, old_value, new_value)
        VALUES (NEW.problem_id, 'assigned_staff_id', OLD.assigned_staff_id, NEW.assigned_staff_id);
    END IF;
END$$

DELIMITER ;
