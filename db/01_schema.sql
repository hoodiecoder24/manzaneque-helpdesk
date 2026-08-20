-- =====================================================================
-- 01_schema.sql
-- Manzaneque Limited IT Helpdesk — full schema (13 tables).
-- Referential actions: RESTRICT on reference data, SET NULL on optional
-- assignment, CASCADE on dependent detail rows (see ARCHITECTURE.md §3.2).
-- Idempotent: safe to re-run against an empty or previously-built database.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS call_log;
DROP TABLE IF EXISTS problem;
DROP TABLE IF EXISTS specialist_expertise;
DROP TABLE IF EXISTS helpdesk_staff;
DROP TABLE IF EXISTS problem_type;
DROP TABLE IF EXISTS software_licence;
DROP TABLE IF EXISTS software;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS equipment_type;
DROP TABLE IF EXISTS employee;
DROP TABLE IF EXISTS job_title;
DROP TABLE IF EXISTS department;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. department — reference table for organisational departments.
-- ---------------------------------------------------------------------
CREATE TABLE department (
    department_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(80) NOT NULL,
    CONSTRAINT uq_department_name UNIQUE (department_name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. job_title — reference table for employee job titles.
-- ---------------------------------------------------------------------
CREATE TABLE job_title (
    job_title_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title_name     VARCHAR(80) NOT NULL,
    CONSTRAINT uq_job_title_name UNIQUE (title_name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. employee — personnel register; source of the caller lookup.
-- ---------------------------------------------------------------------
CREATE TABLE employee (
    employee_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(60) NOT NULL,
    last_name       VARCHAR(60) NOT NULL,
    email           VARCHAR(120) NOT NULL,
    phone_extension VARCHAR(10) NULL,
    department_id   INT UNSIGNED NOT NULL,
    job_title_id    INT UNSIGNED NOT NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_employee_email UNIQUE (email),
    CONSTRAINT fk_employee_department FOREIGN KEY (department_id)
        REFERENCES department (department_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_employee_job_title FOREIGN KEY (job_title_id)
        REFERENCES job_title (job_title_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. equipment_type — reference table (laptop, monitor, printer, ...).
-- ---------------------------------------------------------------------
CREATE TABLE equipment_type (
    equipment_type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_name          VARCHAR(80) NOT NULL,
    CONSTRAINT uq_equipment_type_name UNIQUE (type_name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. equipment — serial-numbered assets, optionally assigned to staff.
-- ---------------------------------------------------------------------
CREATE TABLE equipment (
    equipment_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    serial_number      VARCHAR(60) NOT NULL,
    equipment_type_id  INT UNSIGNED NOT NULL,
    make               VARCHAR(80) NOT NULL,
    model              VARCHAR(80) NOT NULL,
    purchase_date      DATE NULL,
    assigned_employee_id INT UNSIGNED NULL,
    is_retired         TINYINT(1) NOT NULL DEFAULT 0,
    CONSTRAINT uq_equipment_serial UNIQUE (serial_number),
    CONSTRAINT fk_equipment_type FOREIGN KEY (equipment_type_id)
        REFERENCES equipment_type (equipment_type_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_equipment_assigned_employee FOREIGN KEY (assigned_employee_id)
        REFERENCES employee (employee_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. software — software product catalogue.
-- ---------------------------------------------------------------------
CREATE TABLE software (
    software_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    software_name  VARCHAR(100) NOT NULL,
    vendor         VARCHAR(100) NULL,
    CONSTRAINT uq_software_name UNIQUE (software_name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. software_licence — one licence record per equipment/software pair,
--    with a bounded validity window.
-- ---------------------------------------------------------------------
CREATE TABLE software_licence (
    licence_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    equipment_id      INT UNSIGNED NOT NULL,
    software_id       INT UNSIGNED NOT NULL,
    licence_key       VARCHAR(120) NOT NULL,
    licence_start_date DATE NOT NULL,
    licence_end_date   DATE NOT NULL,
    CONSTRAINT fk_licence_equipment FOREIGN KEY (equipment_id)
        REFERENCES equipment (equipment_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_licence_software FOREIGN KEY (software_id)
        REFERENCES software (software_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_licence_dates CHECK (licence_end_date > licence_start_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. problem_type — self-referencing hierarchy, general -> specific.
--    parent_type_id NULL marks a top-level (most general) type.
-- ---------------------------------------------------------------------
CREATE TABLE problem_type (
    problem_type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_name        VARCHAR(100) NOT NULL,
    parent_type_id   INT UNSIGNED NULL,
    CONSTRAINT uq_problem_type_name UNIQUE (type_name),
    CONSTRAINT fk_problem_type_parent FOREIGN KEY (parent_type_id)
        REFERENCES problem_type (problem_type_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. helpdesk_staff — 1:1 optional extension of employee; holds
--    credentials and the application role.
-- ---------------------------------------------------------------------
CREATE TABLE helpdesk_staff (
    staff_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id    INT UNSIGNED NOT NULL,
    username       VARCHAR(60) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    staff_role     ENUM('OPERATOR', 'SPECIALIST', 'ANALYST', 'ADMIN') NOT NULL,
    is_active      TINYINT(1) NOT NULL DEFAULT 1,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_helpdesk_staff_employee UNIQUE (employee_id),
    CONSTRAINT uq_helpdesk_staff_username UNIQUE (username),
    CONSTRAINT fk_helpdesk_staff_employee FOREIGN KEY (employee_id)
        REFERENCES employee (employee_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. specialist_expertise — junction: staff <-> problem_type (M:N).
-- ---------------------------------------------------------------------
CREATE TABLE specialist_expertise (
    staff_id        INT UNSIGNED NOT NULL,
    problem_type_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (staff_id, problem_type_id),
    CONSTRAINT fk_expertise_staff FOREIGN KEY (staff_id)
        REFERENCES helpdesk_staff (staff_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_expertise_problem_type FOREIGN KEY (problem_type_id)
        REFERENCES problem_type (problem_type_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 11. problem — the helpdesk ticket. problem_id doubles as the problem
--    number quoted back to the caller (displayed as PR-{id:06d}).
-- ---------------------------------------------------------------------
CREATE TABLE problem (
    problem_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    caller_employee_id INT UNSIGNED NOT NULL,
    equipment_id       INT UNSIGNED NOT NULL,
    problem_type_id    INT UNSIGNED NOT NULL,
    status             ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')
                        NOT NULL DEFAULT 'OPEN',
    priority           ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    assigned_staff_id  INT UNSIGNED NULL,
    logged_by_staff_id INT UNSIGNED NOT NULL,
    logged_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at        DATETIME NULL,
    resolution_notes   TEXT NULL,
    minutes_to_resolve INT UNSIGNED NULL,
    CONSTRAINT fk_problem_caller FOREIGN KEY (caller_employee_id)
        REFERENCES employee (employee_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_problem_equipment FOREIGN KEY (equipment_id)
        REFERENCES equipment (equipment_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_problem_type FOREIGN KEY (problem_type_id)
        REFERENCES problem_type (problem_type_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_problem_assigned_staff FOREIGN KEY (assigned_staff_id)
        REFERENCES helpdesk_staff (staff_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_problem_logged_by FOREIGN KEY (logged_by_staff_id)
        REFERENCES helpdesk_staff (staff_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_problem_resolved_after_logged
        CHECK (resolved_at IS NULL OR resolved_at >= logged_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 12. call_log — many calls per problem: the initial report plus any
--    follow-up calls from the caller or specialist notes.
-- ---------------------------------------------------------------------
CREATE TABLE call_log (
    call_log_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    problem_id     INT UNSIGNED NOT NULL,
    staff_id       INT UNSIGNED NOT NULL,
    call_type      ENUM('INITIAL', 'FOLLOW_UP') NOT NULL,
    notes          TEXT NOT NULL,
    logged_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_call_log_problem FOREIGN KEY (problem_id)
        REFERENCES problem (problem_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_call_log_staff FOREIGN KEY (staff_id)
        REFERENCES helpdesk_staff (staff_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 13. audit_log — trigger-populated change history for problem rows.
--    Justified under M2 system security (traceability of who changed what).
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
    audit_log_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    problem_id     INT UNSIGNED NOT NULL,
    changed_field  VARCHAR(40) NOT NULL,
    old_value      VARCHAR(255) NULL,
    new_value      VARCHAR(255) NULL,
    changed_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_log_problem FOREIGN KEY (problem_id)
        REFERENCES problem (problem_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
