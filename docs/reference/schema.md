# Schema reference

Source: `db/01_schema.sql`. 13 tables, InnoDB, `utf8mb4`.

## department

Holds the list of organisational departments that employees belong to.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| department_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the department. |
| department_name | VARCHAR(80) | NOT NULL, UNIQUE | none | Name of the department. |

No foreign keys.

## job_title

Holds the list of job titles that employees can hold.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| job_title_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the job title. |
| title_name | VARCHAR(80) | NOT NULL, UNIQUE | none | Name of the job title. |

No foreign keys.

## employee

Holds the personnel register. Every caller who logs a problem is a row here. Some rows also have a matching row in `helpdesk_staff`, which is a 1:1 optional extension, not a subtype table.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| employee_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the employee. |
| first_name | VARCHAR(60) | NOT NULL | none | First name. |
| last_name | VARCHAR(60) | NOT NULL | none | Last name. |
| email | VARCHAR(120) | NOT NULL, UNIQUE | none | Email address. |
| phone_extension | VARCHAR(10) | NULL allowed | none | Internal phone extension. Optional. |
| department_id | INT UNSIGNED | NOT NULL, FK | none | Department the employee belongs to. |
| job_title_id | INT UNSIGNED | NOT NULL, FK | none | Job title the employee holds. |
| is_active | TINYINT(1) | NOT NULL | 1 | Whether the employee record is active. |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | When the row was created. |

Foreign keys:
- `fk_employee_department` (department_id to department.department_id): ON UPDATE CASCADE, ON DELETE RESTRICT.
- `fk_employee_job_title` (job_title_id to job_title.job_title_id): ON UPDATE CASCADE, ON DELETE RESTRICT.

## equipment_type

Holds the list of equipment categories, such as laptop or monitor.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| equipment_type_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the equipment type. |
| type_name | VARCHAR(80) | NOT NULL, UNIQUE | none | Name of the equipment type. |

No foreign keys.

## equipment

Holds every serial numbered asset. An item can be assigned to one employee or left unassigned.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| equipment_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the equipment item. |
| serial_number | VARCHAR(60) | NOT NULL, UNIQUE | none | Serial number printed on the asset. |
| equipment_type_id | INT UNSIGNED | NOT NULL, FK | none | Category of the equipment. |
| make | VARCHAR(80) | NOT NULL | none | Manufacturer. |
| model | VARCHAR(80) | NOT NULL | none | Model name. |
| purchase_date | DATE | NULL allowed | none | Date the item was purchased. Optional. |
| assigned_employee_id | INT UNSIGNED | NULL allowed, FK | none | Employee the item is assigned to. Null if unassigned. |
| is_retired | TINYINT(1) | NOT NULL | 0 | Whether the item has been retired from use. |

Foreign keys:
- `fk_equipment_type` (equipment_type_id to equipment_type.equipment_type_id): ON UPDATE CASCADE, ON DELETE RESTRICT.
- `fk_equipment_assigned_employee` (assigned_employee_id to employee.employee_id): ON UPDATE CASCADE, ON DELETE SET NULL.

## software

Holds the software product catalogue.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| software_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the software product. |
| software_name | VARCHAR(100) | NOT NULL, UNIQUE | none | Name of the product. |
| vendor | VARCHAR(100) | NULL allowed | none | Vendor name. Optional. |

No foreign keys.

## software_licence

Holds one licence record per equipment and software pairing, with a start and end date.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| licence_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the licence record. |
| equipment_id | INT UNSIGNED | NOT NULL, FK | none | Equipment the licence is installed on. |
| software_id | INT UNSIGNED | NOT NULL, FK | none | Software product the licence is for. |
| licence_key | VARCHAR(120) | NOT NULL | none | Licence key or activation code. |
| licence_start_date | DATE | NOT NULL | none | Date the licence becomes valid. |
| licence_end_date | DATE | NOT NULL | none | Date the licence stops being valid. |

Check constraint: `chk_licence_dates`, licence_end_date must be greater than licence_start_date.

Foreign keys:
- `fk_licence_equipment` (equipment_id to equipment.equipment_id): ON UPDATE CASCADE, ON DELETE CASCADE.
- `fk_licence_software` (software_id to software.software_id): ON UPDATE CASCADE, ON DELETE RESTRICT.

## problem_type

Holds the hierarchy of problem types, from general to specific. This table is self referencing. `parent_type_id` points back at another row in the same table. A row with `parent_type_id` set to null is a top level, most general type. A row with `parent_type_id` set to another type's id is a more specific child of that type.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| problem_type_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the problem type. |
| type_name | VARCHAR(100) | NOT NULL, UNIQUE | none | Name of the problem type. |
| parent_type_id | INT UNSIGNED | NULL allowed, FK, self referencing | none | The more general type this one sits under. Null for a top level type. |

Foreign keys:
- `fk_problem_type_parent` (parent_type_id to problem_type.problem_type_id): ON UPDATE CASCADE, ON DELETE SET NULL.

## helpdesk_staff

Holds login credentials and the application role for staff who use the system. This table has a 1:1 optional link to `employee`. Not every employee has a row here, but every row here has exactly one matching employee, enforced by the unique constraint on `employee_id`.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| staff_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the staff account. |
| employee_id | INT UNSIGNED | NOT NULL, UNIQUE, FK | none | The employee this account belongs to. Unique, so each employee has at most one staff account. |
| username | VARCHAR(60) | NOT NULL, UNIQUE | none | Login username. |
| password_hash | VARCHAR(255) | NOT NULL | none | Bcrypt hash of the password. Never stores plain text. |
| staff_role | ENUM('OPERATOR','SPECIALIST','ANALYST','ADMIN') | NOT NULL | none | Application role used for access control. |
| is_active | TINYINT(1) | NOT NULL | 1 | Whether the account can log in. |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | When the row was created. |

Foreign keys:
- `fk_helpdesk_staff_employee` (employee_id to employee.employee_id): ON UPDATE CASCADE, ON DELETE RESTRICT.

## specialist_expertise

Junction table linking staff to the problem types they can be assigned. Many to many between `helpdesk_staff` and `problem_type`.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| staff_id | INT UNSIGNED | NOT NULL, part of composite PK, FK | none | The specialist. |
| problem_type_id | INT UNSIGNED | NOT NULL, part of composite PK, FK | none | The problem type they can handle. |

Primary key is the pair (staff_id, problem_type_id).

Foreign keys:
- `fk_expertise_staff` (staff_id to helpdesk_staff.staff_id): ON UPDATE CASCADE, ON DELETE CASCADE.
- `fk_expertise_problem_type` (problem_type_id to problem_type.problem_type_id): ON UPDATE CASCADE, ON DELETE CASCADE.

## problem

Holds the helpdesk ticket. `problem_id` also serves as the problem number shown to the caller, formatted as PR followed by the id padded to 6 digits.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| problem_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the problem, also the problem number. |
| caller_employee_id | INT UNSIGNED | NOT NULL, FK | none | Employee who reported the problem. |
| equipment_id | INT UNSIGNED | NOT NULL, FK | none | Equipment the problem is about. |
| problem_type_id | INT UNSIGNED | NOT NULL, FK | none | Type of the problem. Can be changed later. |
| status | ENUM('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED') | NOT NULL | 'OPEN' | Current status of the ticket. |
| priority | ENUM('LOW','MEDIUM','HIGH','CRITICAL') | NOT NULL | 'MEDIUM' | Priority of the ticket. |
| assigned_staff_id | INT UNSIGNED | NULL allowed, FK | none | Specialist currently assigned. Null if not yet assigned. |
| logged_by_staff_id | INT UNSIGNED | NOT NULL, FK | none | Staff member who logged the call. |
| logged_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | When the problem was logged. |
| resolved_at | DATETIME | NULL allowed | none | When the problem was resolved. Null until resolved. |
| resolution_notes | TEXT | NULL allowed | none | Notes on how the problem was resolved. |
| minutes_to_resolve | INT UNSIGNED | NULL allowed | none | Minutes between logged_at and resolved_at. Set by a trigger, not by the application. |

Check constraint: `chk_problem_resolved_after_logged`, resolved_at must be null or greater than or equal to logged_at.

Foreign keys:
- `fk_problem_caller` (caller_employee_id to employee.employee_id): ON UPDATE CASCADE, ON DELETE RESTRICT.
- `fk_problem_equipment` (equipment_id to equipment.equipment_id): ON UPDATE CASCADE, ON DELETE RESTRICT.
- `fk_problem_type` (problem_type_id to problem_type.problem_type_id): ON UPDATE CASCADE, ON DELETE RESTRICT.
- `fk_problem_assigned_staff` (assigned_staff_id to helpdesk_staff.staff_id): ON UPDATE CASCADE, ON DELETE SET NULL.
- `fk_problem_logged_by` (logged_by_staff_id to helpdesk_staff.staff_id): ON UPDATE CASCADE, ON DELETE RESTRICT.

## call_log

Holds every call recorded against a problem. The first row for a problem is the initial report. Later rows are follow up calls.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| call_log_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the call log entry. |
| problem_id | INT UNSIGNED | NOT NULL, FK | none | Problem this call relates to. |
| staff_id | INT UNSIGNED | NOT NULL, FK | none | Staff member who logged this call. |
| call_type | ENUM('INITIAL','FOLLOW_UP') | NOT NULL | none | Whether this is the first call or a follow up. |
| notes | TEXT | NOT NULL | none | Notes recorded for this call. |
| logged_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | When this call was logged. |

Foreign keys:
- `fk_call_log_problem` (problem_id to problem.problem_id): ON UPDATE CASCADE, ON DELETE CASCADE.
- `fk_call_log_staff` (staff_id to helpdesk_staff.staff_id): ON UPDATE CASCADE, ON DELETE RESTRICT.

## audit_log

Holds change history for problem rows. Populated only by triggers, never written to directly by the application.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| audit_log_id | INT UNSIGNED | PK, AUTO_INCREMENT | none | Id for the audit entry. |
| problem_id | INT UNSIGNED | NOT NULL, FK | none | Problem the change was made to. |
| changed_field | VARCHAR(40) | NOT NULL | none | Name of the field that changed. |
| old_value | VARCHAR(255) | NULL allowed | none | Value before the change. |
| new_value | VARCHAR(255) | NULL allowed | none | Value after the change. |
| changed_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | When the change was recorded. |

Foreign keys:
- `fk_audit_log_problem` (problem_id to problem.problem_id): ON UPDATE CASCADE, ON DELETE CASCADE.
