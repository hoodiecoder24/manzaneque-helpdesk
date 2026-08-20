-- =====================================================================
-- 02_indexes.sql
-- Indexes beyond those InnoDB creates automatically for PRIMARY KEY and
-- UNIQUE constraints. Every FK column gets one (MySQL does not add these
-- automatically the way it does for the referencing side of a FK on some
-- engines — InnoDB does index FK columns automatically, but we index the
-- composite/report-filter columns explicitly and document why).
-- Run once against tables freshly created by 01_schema.sql. Since that
-- script drops and recreates every table, re-running 01 then 02 in
-- sequence is safe; running 02 alone a second time is not (MySQL 8.0
-- has no CREATE INDEX IF NOT EXISTS), so it is not intended to be re-run
-- in isolation.
-- =====================================================================

-- employee.department_id / job_title_id are already indexed by InnoDB as
-- the FK columns; no additional index needed for lookups by department
-- alone, since department listings are small reference-table scans.

-- ---------------------------------------------------------------------
-- equipment: report and lookup filters.
-- ---------------------------------------------------------------------
-- Serial lookup (Log a Call screen) is already covered by the UNIQUE
-- constraint on serial_number. Equipment failure ranking groups by type.
CREATE INDEX idx_equipment_type ON equipment (equipment_type_id);

-- ---------------------------------------------------------------------
-- software_licence: licence validity is checked per equipment on every
-- serial lookup, and expiry reporting filters/sorts by end date.
-- ---------------------------------------------------------------------
CREATE INDEX idx_licence_equipment ON software_licence (equipment_id);
CREATE INDEX idx_licence_end_date ON software_licence (licence_end_date);

-- ---------------------------------------------------------------------
-- problem_type: the recursive hierarchy walk in fn_find_specialist joins
-- repeatedly on parent_type_id.
-- ---------------------------------------------------------------------
CREATE INDEX idx_problem_type_parent ON problem_type (parent_type_id);

-- ---------------------------------------------------------------------
-- specialist_expertise: fn_find_specialist and sp_assign_least_loaded
-- both look up "which staff cover problem_type X" — the PK already
-- covers (staff_id, problem_type_id); add the reverse order for lookups
-- keyed by problem_type_id first.
-- ---------------------------------------------------------------------
CREATE INDEX idx_expertise_problem_type ON specialist_expertise (problem_type_id);

-- ---------------------------------------------------------------------
-- problem: this is the table every report and the Problem List screen
-- filters, sorts and joins on. Cover the filterable/sortable columns
-- individually and the hot composite used for workload counting.
-- ---------------------------------------------------------------------
CREATE INDEX idx_problem_caller ON problem (caller_employee_id);
CREATE INDEX idx_problem_equipment ON problem (equipment_id);
CREATE INDEX idx_problem_type ON problem (problem_type_id);
CREATE INDEX idx_problem_status ON problem (status);
CREATE INDEX idx_problem_assigned_staff ON problem (assigned_staff_id);
CREATE INDEX idx_problem_logged_by ON problem (logged_by_staff_id);
-- Problem List default sort is newest-first; open-by-age report filters
-- on status then orders by logged_at.
CREATE INDEX idx_problem_status_logged_at ON problem (status, logged_at);
-- sp_assign_least_loaded counts each specialist's currently-open problems
-- — this composite lets that COUNT ... GROUP BY use an index range scan
-- instead of a full table scan as problem volume grows.
CREATE INDEX idx_problem_assigned_status ON problem (assigned_staff_id, status);

-- ---------------------------------------------------------------------
-- call_log: problem detail screen loads full call history per problem,
-- ordered chronologically.
-- ---------------------------------------------------------------------
CREATE INDEX idx_call_log_problem ON call_log (problem_id, logged_at);
CREATE INDEX idx_call_log_staff ON call_log (staff_id);

-- ---------------------------------------------------------------------
-- audit_log: evidence/reporting lookups by problem.
-- ---------------------------------------------------------------------
CREATE INDEX idx_audit_log_problem ON audit_log (problem_id, changed_at);

-- ---------------------------------------------------------------------
-- helpdesk_staff: login is by username (already UNIQUE -> indexed);
-- role filter used by RBAC-adjacent admin listings.
-- ---------------------------------------------------------------------
CREATE INDEX idx_helpdesk_staff_role ON helpdesk_staff (staff_role);
