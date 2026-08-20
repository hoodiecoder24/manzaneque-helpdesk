-- =====================================================================
-- 06_roles.sql
-- Four least-privilege MySQL roles (M2 security) plus the restricted
-- application user, which is granted every role and connects as
-- neither root nor any single fixed-privilege account. The app enforces
-- which role's privileges apply per request via its own RBAC middleware
-- — MySQL roles here exist so the *database* also refuses what the API
-- should never have asked for in the first place (defence in depth).
-- Run as root/admin during provisioning only.
-- =====================================================================

DROP USER IF EXISTS 'hd_app'@'%';
DROP ROLE IF EXISTS hd_operator, hd_specialist, hd_analyst, hd_admin;

CREATE ROLE hd_operator, hd_specialist, hd_analyst, hd_admin;

-- ---------------------------------------------------------------------
-- hd_operator — logs calls, looks up callers/equipment/knowledge base,
-- tracks problems in their own queue. Cannot resolve, assign, or touch
-- reference/admin data.
-- ---------------------------------------------------------------------
GRANT SELECT ON manzaneque_helpdesk.employee            TO hd_operator;
GRANT SELECT ON manzaneque_helpdesk.department           TO hd_operator;
GRANT SELECT ON manzaneque_helpdesk.job_title            TO hd_operator;
GRANT SELECT ON manzaneque_helpdesk.equipment            TO hd_operator;
GRANT SELECT ON manzaneque_helpdesk.equipment_type       TO hd_operator;
GRANT SELECT ON manzaneque_helpdesk.software_licence     TO hd_operator;
GRANT SELECT ON manzaneque_helpdesk.software             TO hd_operator;
GRANT SELECT ON manzaneque_helpdesk.problem_type         TO hd_operator;
GRANT SELECT, INSERT ON manzaneque_helpdesk.problem      TO hd_operator;
GRANT SELECT, INSERT ON manzaneque_helpdesk.call_log     TO hd_operator;
GRANT EXECUTE ON PROCEDURE manzaneque_helpdesk.sp_log_new_call TO hd_operator;
GRANT EXECUTE ON PROCEDURE manzaneque_helpdesk.sp_assign_least_loaded TO hd_operator;
GRANT EXECUTE ON FUNCTION manzaneque_helpdesk.fn_find_specialist TO hd_operator;

-- ---------------------------------------------------------------------
-- hd_specialist — works their assigned queue: reclassify, add follow-up
-- calls, resolve. No access to reference-data maintenance or reports.
-- ---------------------------------------------------------------------
GRANT SELECT ON manzaneque_helpdesk.employee            TO hd_specialist;
GRANT SELECT ON manzaneque_helpdesk.department           TO hd_specialist;
GRANT SELECT ON manzaneque_helpdesk.equipment            TO hd_specialist;
GRANT SELECT ON manzaneque_helpdesk.equipment_type       TO hd_specialist;
GRANT SELECT ON manzaneque_helpdesk.software_licence     TO hd_specialist;
GRANT SELECT ON manzaneque_helpdesk.software             TO hd_specialist;
GRANT SELECT ON manzaneque_helpdesk.problem_type         TO hd_specialist;
GRANT SELECT ON manzaneque_helpdesk.specialist_expertise TO hd_specialist;
GRANT SELECT, UPDATE ON manzaneque_helpdesk.problem      TO hd_specialist;
GRANT SELECT, INSERT ON manzaneque_helpdesk.call_log     TO hd_specialist;
GRANT SELECT ON manzaneque_helpdesk.audit_log            TO hd_specialist;
GRANT EXECUTE ON PROCEDURE manzaneque_helpdesk.sp_resolve_problem TO hd_specialist;
GRANT EXECUTE ON PROCEDURE manzaneque_helpdesk.sp_assign_least_loaded TO hd_specialist;
GRANT EXECUTE ON FUNCTION manzaneque_helpdesk.fn_find_specialist TO hd_specialist;

-- ---------------------------------------------------------------------
-- hd_analyst — read-only across the reporting views and their source
-- tables. No writes anywhere.
-- ---------------------------------------------------------------------
GRANT SELECT ON manzaneque_helpdesk.vw_open_problems_by_age      TO hd_analyst;
GRANT SELECT ON manzaneque_helpdesk.vw_specialist_workload        TO hd_analyst;
GRANT SELECT ON manzaneque_helpdesk.vw_equipment_failure_ranking  TO hd_analyst;
GRANT SELECT ON manzaneque_helpdesk.vw_problem_type_frequency     TO hd_analyst;
GRANT SELECT ON manzaneque_helpdesk.problem              TO hd_analyst;
GRANT SELECT ON manzaneque_helpdesk.employee             TO hd_analyst;
GRANT SELECT ON manzaneque_helpdesk.equipment            TO hd_analyst;
GRANT SELECT ON manzaneque_helpdesk.equipment_type       TO hd_analyst;
GRANT SELECT ON manzaneque_helpdesk.problem_type         TO hd_analyst;
GRANT SELECT ON manzaneque_helpdesk.helpdesk_staff       TO hd_analyst;

-- ---------------------------------------------------------------------
-- hd_admin — full CRUD on the reference data the app exposes admin
-- screens for (employees, equipment, problem types), plus everything
-- the other roles can do, for support purposes. No DDL.
-- ---------------------------------------------------------------------
GRANT hd_operator, hd_specialist, hd_analyst TO hd_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON manzaneque_helpdesk.employee       TO hd_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON manzaneque_helpdesk.equipment      TO hd_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON manzaneque_helpdesk.problem_type   TO hd_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON manzaneque_helpdesk.department     TO hd_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON manzaneque_helpdesk.job_title      TO hd_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON manzaneque_helpdesk.equipment_type TO hd_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON manzaneque_helpdesk.software       TO hd_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON manzaneque_helpdesk.software_licence TO hd_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON manzaneque_helpdesk.helpdesk_staff TO hd_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON manzaneque_helpdesk.specialist_expertise TO hd_admin;

-- ---------------------------------------------------------------------
-- Restricted application user. The Express app authenticates to MySQL
-- as this single user and holds every role; the app's own RBAC
-- middleware (server/src/middleware) decides which role's privileges a
-- given JWT is allowed to exercise. Never used interactively, never
-- granted directly to a person.
--
-- The password below MUST match DB_APP_PASSWORD in your .env. If you
-- change one, change the other (see README) — this script only runs
-- automatically on first container init, so a later .env edit alone
-- will not update it; re-run this file's CREATE/ALTER USER by hand.
-- ---------------------------------------------------------------------
CREATE USER 'hd_app'@'%' IDENTIFIED BY 'change_me_app';
GRANT hd_operator, hd_specialist, hd_analyst, hd_admin TO 'hd_app'@'%';
SET DEFAULT ROLE ALL TO 'hd_app'@'%';

FLUSH PRIVILEGES;
