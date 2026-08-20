# Index reference

Source: `db/02_indexes.sql`. These are indexes added on top of what InnoDB creates automatically for every PRIMARY KEY and UNIQUE constraint. The automatic ones (for example equipment.serial_number, helpdesk_staff.username, employee.email) are not listed again here.

No EXPLAIN output has been captured yet. This still needs to be done against a running database, comparing plans with and without `db/02_indexes.sql` applied, and saved as evidence per ARCHITECTURE.md section 3.8.

## idx_equipment_type on equipment (equipment_type_id)

Foreign key column, joins equipment to equipment_type. Used by `vw_equipment_failure_ranking`, which joins the two tables and groups by equipment. Also used by every equipment listing endpoint (`GET /api/equipment`, `GET /api/equipment/:id`) and by the equipment serial lookup, all of which join equipment to equipment_type.

## idx_licence_equipment on software_licence (equipment_id)

Foreign key column. Used by the equipment serial lookup (`server/src/services/lookup.service.js`, `lookupEquipmentBySerial`), which selects all licences for one equipment_id. Also used by `db/queries/06_expired_or_missing_licences.sql`, which left joins software_licence onto equipment by this column.

## idx_licence_end_date on software_licence (licence_end_date)

Used by the licence validity check in the equipment serial lookup, which compares CURDATE() against licence_start_date and licence_end_date. Also used by `db/queries/06_expired_or_missing_licences.sql`, which filters on `sl.licence_end_date < CURDATE()`.

## idx_problem_type_parent on problem_type (parent_type_id)

Used by `fn_find_specialist` (`db/04_procedures.sql`), whose recursive CTE walks parent_type_id upward from a given problem type. Also used by `vw_problem_type_frequency` (`db/03_views.sql`), whose recursive CTE walks parent_type_id downward from each root type.

## idx_expertise_problem_type on specialist_expertise (problem_type_id)

The primary key on specialist_expertise is (staff_id, problem_type_id), which does not help a lookup that starts from problem_type_id. This index covers that direction. Used by `fn_find_specialist`, whose EXISTS subquery filters specialist_expertise by problem_type_id, and by `sp_assign_least_loaded`, which joins specialist_expertise to helpdesk_staff on the resolved problem type id.

## idx_problem_caller on problem (caller_employee_id)

Used by the problem list filter `callerEmployeeId` (`GET /api/problems`), by the knowledge lookup by caller (`GET /api/knowledge/by-caller/:id`), and by `vw_open_problems_by_age`, which joins problem to employee on this column.

## idx_problem_equipment on problem (equipment_id)

Used by the problem list filter `equipmentId`, by the knowledge lookup by equipment (`GET /api/knowledge/by-equipment/:id`), and by `vw_equipment_failure_ranking`, which left joins problem onto equipment by this column.

## idx_problem_type on problem (problem_type_id)

Used by the problem list filter `problemTypeId`, by the knowledge lookup by type (`GET /api/knowledge/similar`), and by `vw_problem_type_frequency`, which left joins problem onto the type_root CTE by this column.

## idx_problem_status on problem (status)

Used by the problem list filter `status`, and by `vw_open_problems_by_age`, whose WHERE clause filters `status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS')`.

## idx_problem_assigned_staff on problem (assigned_staff_id)

Used by the problem list filter `assignedStaffId`, and by `vw_specialist_workload`, which left joins problem onto helpdesk_staff by this column.

## idx_problem_logged_by on problem (logged_by_staff_id)

Foreign key column to helpdesk_staff. No current API route filters problems by this column directly. It supports the foreign key check that runs when a helpdesk_staff row is restricted from deletion because it has logged problems.

## idx_problem_status_logged_at on problem (status, logged_at)

Composite index. Supports queries that filter on status and then need rows ordered by logged_at, such as the problem list when a status filter is applied, which always orders by `logged_at DESC`. Does not help a plain `ORDER BY logged_at` when no status filter is present, since status is the leading column.

## idx_problem_assigned_status on problem (assigned_staff_id, status)

Composite index. Used by `sp_assign_least_loaded`, whose subquery counts open problems (`status IN ('ASSIGNED', 'IN_PROGRESS')`) grouped by assigned_staff_id, to find the least loaded qualified specialist.

## idx_call_log_problem on call_log (problem_id, logged_at)

Used by the problem detail call history query (`server/src/services/problem.service.js`, `getProblem`), which selects all calls for one problem_id ordered by logged_at.

## idx_call_log_staff on call_log (staff_id)

Foreign key column, joins call_log to helpdesk_staff. Used by the same call history query, which joins call_log to helpdesk_staff to get the staff member's name for each call.

## idx_audit_log_problem on audit_log (problem_id, changed_at)

Foreign key column plus a time column. No current API route reads audit_log. It was queried directly against the database during manual verification of the triggers. It supports lookups of an individual problem's change history if a route is added later.

## idx_helpdesk_staff_role on helpdesk_staff (staff_role)

No current API route filters helpdesk_staff by staff_role. `GET /api/staff` returns every staff row regardless of role. This index is in place for a role based filter on staff listings if one is added later.
