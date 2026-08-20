-- =====================================================================
-- 04_procedures.sql
-- Three procedures + one function. Multi-step operations run as
-- transactions here so the API layer never has to coordinate writes.
-- =====================================================================

DROP PROCEDURE IF EXISTS sp_log_new_call;
DROP PROCEDURE IF EXISTS sp_assign_least_loaded;
DROP PROCEDURE IF EXISTS sp_resolve_problem;
DROP FUNCTION IF EXISTS fn_find_specialist;

DELIMITER $$

-- ---------------------------------------------------------------------
-- fn_find_specialist(problem_type_id)
-- Brief: "If there is no specialist listed for a more specific problem
-- type, then a specialist from the more general problem type will be
-- used." Walks parent_type_id upward from the given type until it finds
-- a type with at least one qualified specialist, and returns that
-- type's id. Returns NULL if no ancestor (or the type itself) has one.
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_find_specialist(p_problem_type_id INT UNSIGNED)
RETURNS INT UNSIGNED
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_result_type_id INT UNSIGNED DEFAULT NULL;

    WITH RECURSIVE type_chain (problem_type_id, parent_type_id, depth) AS (
        SELECT problem_type_id, parent_type_id, 0
        FROM problem_type
        WHERE problem_type_id = p_problem_type_id
        UNION ALL
        SELECT pt.problem_type_id, pt.parent_type_id, tc.depth + 1
        FROM problem_type pt
        JOIN type_chain tc ON pt.problem_type_id = tc.parent_type_id
    )
    SELECT tc.problem_type_id INTO v_result_type_id
    FROM type_chain tc
    WHERE EXISTS (
        SELECT 1
        FROM specialist_expertise se
        JOIN helpdesk_staff hs ON hs.staff_id = se.staff_id
        WHERE se.problem_type_id = tc.problem_type_id
          AND hs.staff_role = 'SPECIALIST'
          AND hs.is_active = 1
    )
    ORDER BY tc.depth ASC
    LIMIT 1;

    RETURN v_result_type_id;
END$$

-- ---------------------------------------------------------------------
-- sp_log_new_call(caller, equipment, problem_type, priority, notes,
--                  logging staff, OUT problem_id, OUT problem_number)
-- Transaction: creates a new problem plus its initial call_log row, and
-- returns the problem number to quote back to the caller. Used only for
-- the *first* call on a problem — follow-up calls insert directly into
-- call_log via the API layer since they do not create new state.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_log_new_call (
    IN  p_caller_employee_id INT UNSIGNED,
    IN  p_equipment_id       INT UNSIGNED,
    IN  p_problem_type_id    INT UNSIGNED,
    IN  p_priority           VARCHAR(10),
    IN  p_notes              TEXT,
    IN  p_logged_by_staff_id INT UNSIGNED,
    OUT p_problem_id         INT UNSIGNED,
    OUT p_problem_number     VARCHAR(16)
)
proc: BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    INSERT INTO problem (
        caller_employee_id, equipment_id, problem_type_id,
        status, priority, logged_by_staff_id
    ) VALUES (
        p_caller_employee_id, p_equipment_id, p_problem_type_id,
        'OPEN', p_priority, p_logged_by_staff_id
    );

    SET p_problem_id = LAST_INSERT_ID();

    INSERT INTO call_log (problem_id, staff_id, call_type, notes)
    VALUES (p_problem_id, p_logged_by_staff_id, 'INITIAL', p_notes);

    SET p_problem_number = CONCAT('PR-', LPAD(p_problem_id, 6, '0'));

    COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_assign_least_loaded(problem_id, OUT assigned_staff_id)
-- Brief: "the specialist who is currently the least loaded can be
-- allocated." Finds the specialist pool via fn_find_specialist (walking
-- the hierarchy on fallback), then picks the one with the fewest
-- currently-open (ASSIGNED/IN_PROGRESS) problems; ties broken by whoever
-- was assigned longest ago (earliest last assignment), so workload
-- keeps rotating rather than always landing on the same tied specialist.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_assign_least_loaded (
    IN  p_problem_id        INT UNSIGNED,
    OUT p_assigned_staff_id INT UNSIGNED
)
proc: BEGIN
    DECLARE v_problem_type_id  INT UNSIGNED;
    DECLARE v_resolved_type_id INT UNSIGNED;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT problem_type_id INTO v_problem_type_id
    FROM problem
    WHERE problem_id = p_problem_id
    FOR UPDATE;

    SET v_resolved_type_id = fn_find_specialist(v_problem_type_id);

    IF v_resolved_type_id IS NULL THEN
        SET p_assigned_staff_id = NULL;
        ROLLBACK;
        LEAVE proc;
    END IF;

    SELECT hs.staff_id INTO p_assigned_staff_id
    FROM helpdesk_staff hs
    JOIN specialist_expertise se ON se.staff_id = hs.staff_id
    LEFT JOIN (
        SELECT assigned_staff_id, COUNT(*) AS open_count, MAX(logged_at) AS last_assigned_at
        FROM problem
        WHERE status IN ('ASSIGNED', 'IN_PROGRESS')
        GROUP BY assigned_staff_id
    ) load_summary ON load_summary.assigned_staff_id = hs.staff_id
    WHERE se.problem_type_id = v_resolved_type_id
      AND hs.staff_role = 'SPECIALIST'
      AND hs.is_active = 1
    ORDER BY
        COALESCE(load_summary.open_count, 0) ASC,
        COALESCE(load_summary.last_assigned_at, '1970-01-01') ASC
    LIMIT 1;

    UPDATE problem
    SET assigned_staff_id = p_assigned_staff_id,
        status = 'ASSIGNED'
    WHERE problem_id = p_problem_id;

    COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_resolve_problem(problem_id, resolution_notes, resolving staff)
-- Sets resolved_at, stores the resolution notes and transitions status
-- to RESOLVED. minutes_to_resolve is derived by trg_problem_before_update
-- on the same UPDATE, not computed here.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_resolve_problem (
    IN p_problem_id       INT UNSIGNED,
    IN p_resolution_notes TEXT,
    IN p_resolved_by_staff_id INT UNSIGNED
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    UPDATE problem
    SET status = 'RESOLVED',
        resolved_at = NOW(),
        resolution_notes = p_resolution_notes
    WHERE problem_id = p_problem_id;

    INSERT INTO call_log (problem_id, staff_id, call_type, notes)
    VALUES (p_problem_id, p_resolved_by_staff_id, 'FOLLOW_UP',
            CONCAT('Resolved: ', p_resolution_notes));

    COMMIT;
END$$

DELIMITER ;
