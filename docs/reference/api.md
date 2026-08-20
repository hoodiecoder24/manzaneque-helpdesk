# API reference

Source: `server/src/routes/`, `server/src/controllers/`, `server/src/validators/`. All routes are mounted under `/api`. All routes except `/api/health` and `/api/auth/login` require a Bearer JWT in the Authorization header, checked by `requireAuth`. Role checks are done by `requireRole`, listed per endpoint below.

Every error response has this shape:

```json
{ "error": { "code": "...", "message": "...", "fields": { } } }
```

`fields` is only present on validation errors.

## Error codes

| Code | HTTP status | When it happens |
|---|---|---|
| BAD_REQUEST | 400 | Request body, query string, or URL parameter failed validation. |
| UNAUTHORIZED | 401 | Missing or invalid Bearer token, or wrong username or password on login. |
| FORBIDDEN | 403 | Valid token, but the role is not allowed to call this route. |
| NOT_FOUND | 404 | The requested resource does not exist, or the route itself does not exist. |
| CONFLICT | 409 | A database foreign key or unique constraint was violated, or (see below) no specialist could be found. |
| NO_SPECIALIST_AVAILABLE | 409 | Returned only by POST /api/problems/:id/assign, when no ancestor problem type has a qualified specialist. |
| RATE_LIMITED | 429 | More than 10 login attempts from the same IP address in 15 minutes. |
| INTERNAL_ERROR | 500 | Any other unhandled error. |

## Health

### GET /api/health

No authentication. Returns `{ "status": "ok" }`.

## Auth

### POST /api/auth/login

No authentication required to call this route. Rate limited to 10 attempts per 15 minutes per IP.

Body:

| Field | Type | Required |
|---|---|---|
| username | string, 1 to 60 characters | yes |
| password | string, 1 to 255 characters | yes |

Returns 200 with:

```json
{ "token": "...", "user": { "staffId": 1, "username": "operator1", "role": "OPERATOR", "fullName": "James Smith" } }
```

Returns 401 UNAUTHORIZED with the message "Invalid username or password" for both a wrong username and a wrong password. The two cases are not distinguished.

### GET /api/auth/me

Roles: any authenticated user.

No body or query. Returns the current user, read fresh from the database:

```json
{ "staffId": 1, "username": "operator1", "role": "OPERATOR", "fullName": "James Smith" }
```

## Reference data

All read only. Roles: any authenticated user.

| Method | Path | Returns |
|---|---|---|
| GET | /api/departments | Array of `{ department_id, department_name }`. |
| GET | /api/job-titles | Array of `{ job_title_id, title_name }`. |
| GET | /api/equipment-types | Array of `{ equipment_type_id, type_name }`. |
| GET | /api/software | Array of `{ software_id, software_name, vendor }`. |
| GET | /api/staff | Array of `{ staff_id, username, staff_role, is_active, full_name }`. |

## Employees

Reads: OPERATOR, SPECIALIST, ANALYST, ADMIN. Writes: ADMIN only.

### GET /api/employees

Array of employees, each `{ employee_id, first_name, last_name, email, phone_extension, department_id, department_name, job_title_id, title_name, is_active }`.

### GET /api/employees/:id

Same shape as one row above. 404 if the id does not exist.

### POST /api/employees

Body:

| Field | Type | Required |
|---|---|---|
| firstName | string, 1 to 60 characters | yes |
| lastName | string, 1 to 60 characters | yes |
| email | string, valid email, up to 120 characters | yes |
| phoneExtension | string, up to 10 characters | no |
| departmentId | positive integer | yes |
| jobTitleId | positive integer | yes |
| isActive | boolean | no, defaults to true |

Returns 201 with the created employee.

### PUT /api/employees/:id

Same fields as POST, all optional. Only the fields sent are updated. 404 if the id does not exist. Returns 200 with the updated employee.

### DELETE /api/employees/:id

404 if the id does not exist. Returns 204 with no body. Returns 409 CONFLICT if the employee is still referenced elsewhere (for example as a problem caller).

## Equipment

Reads: OPERATOR, SPECIALIST, ANALYST, ADMIN. Writes: ADMIN only.

### GET /api/equipment

Array of `{ equipment_id, serial_number, equipment_type_id, equipment_type_name, make, model, purchase_date, assigned_employee_id, assigned_employee_name, is_retired }`.

### GET /api/equipment/:id

Same shape as one row above. 404 if the id does not exist.

### POST /api/equipment

Body:

| Field | Type | Required |
|---|---|---|
| serialNumber | string, 1 to 60 characters, letters digits and hyphens only | yes |
| equipmentTypeId | positive integer | yes |
| make | string, 1 to 80 characters | yes |
| model | string, 1 to 80 characters | yes |
| purchaseDate | date string (YYYY-MM-DD) | no |
| assignedEmployeeId | positive integer | no |
| isRetired | boolean | no, defaults to false |

Returns 201 with the created equipment item.

### PUT /api/equipment/:id

Same fields as POST, all optional. 404 if the id does not exist. Returns 200 with the updated item.

### DELETE /api/equipment/:id

404 if the id does not exist. Returns 204 with no body. Returns 409 CONFLICT if the item is still referenced elsewhere.

## Problem types

Reads: OPERATOR, SPECIALIST, ANALYST, ADMIN. Writes: ADMIN only.

### GET /api/problem-types

Flat array of `{ problem_type_id, type_name, parent_type_id }`, sorted by name.

### GET /api/problem-types/tree

Nested array. Each node is `{ problem_type_id, type_name, parent_type_id, children: [...] }`. Top level nodes are the ones with `parent_type_id` null. Built in the service layer from the flat list, not a database query on its own.

### GET /api/problem-types/:id

One row, same shape as the flat list. 404 if the id does not exist.

### POST /api/problem-types

Body:

| Field | Type | Required |
|---|---|---|
| typeName | string, 1 to 100 characters | yes |
| parentTypeId | positive integer | no |

Returns 201 with the created problem type.

### PUT /api/problem-types/:id

Same fields as POST, all optional. 404 if the id does not exist. Returns 200 with the updated row.

### DELETE /api/problem-types/:id

404 if the id does not exist. Returns 204 with no body. Returns 409 CONFLICT if the type is still referenced elsewhere, for example by a child type or a problem.

## Problems

### GET /api/problems

Roles: OPERATOR, SPECIALIST, ANALYST, ADMIN.

Query string, all optional:

| Field | Type |
|---|---|
| status | one of OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED |
| problemTypeId | positive integer |
| callerEmployeeId | positive integer |
| equipmentId | positive integer |
| assignedStaffId | positive integer |
| dateFrom | date string (YYYY-MM-DD) |
| dateTo | date string (YYYY-MM-DD) |
| page | positive integer, defaults to 1 |
| pageSize | positive integer up to 100, defaults to 20 |

Returns `{ rows: [...], total, page, pageSize }`. Each row has `{ problem_id, status, priority, logged_at, resolved_at, minutes_to_resolve, caller_employee_id, caller_name, equipment_id, serial_number, problem_type_id, problem_type_name, assigned_staff_id, assigned_staff_name, logged_by_staff_id }`.

### GET /api/problems/:id

Roles: OPERATOR, SPECIALIST, ANALYST, ADMIN.

Same fields as one row of the list above, plus a `calls` array. Each call is `{ call_log_id, call_type, notes, logged_at, staff_id, staff_name }`, oldest first. 404 if the id does not exist.

### POST /api/problems

Roles: OPERATOR, ADMIN. Calls `sp_log_new_call`.

Body:

| Field | Type | Required |
|---|---|---|
| callerEmployeeId | positive integer | yes |
| equipmentId | positive integer | yes |
| problemTypeId | positive integer | yes |
| priority | one of LOW, MEDIUM, HIGH, CRITICAL | no, defaults to MEDIUM |
| notes | string, 1 to 5000 characters | yes |

Returns 201 with `{ problemId, problemNumber }`. `problemNumber` is the id formatted as PR followed by 6 digits, for example PR-000251.

### POST /api/problems/:id/calls

Roles: OPERATOR, SPECIALIST, ADMIN. Adds a follow up row to call_log, does not call a stored procedure.

Body:

| Field | Type | Required |
|---|---|---|
| notes | string, 1 to 5000 characters | yes |

Returns 201 with the full updated problem, same shape as GET /api/problems/:id. 404 if the problem id does not exist.

### PATCH /api/problems/:id/type

Roles: OPERATOR, SPECIALIST, ADMIN. Runs a direct UPDATE on problem_type_id, does not call a stored procedure.

Body:

| Field | Type | Required |
|---|---|---|
| problemTypeId | positive integer | yes |

Returns 200 with the full updated problem. 404 if the problem id does not exist.

### POST /api/problems/:id/assign

Roles: OPERATOR, ADMIN. Calls `sp_assign_least_loaded`. No body.

Returns 200 with the full updated problem if a specialist was assigned. Returns 409 NO_SPECIALIST_AVAILABLE if `fn_find_specialist` could not find a qualified specialist at this type or any ancestor type. 404 if the problem id does not exist.

### POST /api/problems/:id/resolve

Roles: SPECIALIST, ADMIN. Calls `sp_resolve_problem`.

Body:

| Field | Type | Required |
|---|---|---|
| resolutionNotes | string, 1 to 5000 characters | yes |

Returns 200 with the full updated problem. 404 if the problem id does not exist.

## Lookup

Used by the Log a Call screen for auto fill. Roles: OPERATOR, SPECIALIST, ADMIN.

### GET /api/lookup/caller/:employeeId

Returns `{ employee_id, first_name, last_name, email, department_id, department_name, job_title_id, title_name, is_active }`. 404 if the employee id does not exist.

### GET /api/lookup/equipment/:serial

Returns `{ equipment_id, serial_number, equipment_type_id, equipment_type_name, make, model, assigned_employee_id, assigned_employee_name, is_retired, licences: [...] }`. Each licence is `{ licence_id, software_name, licence_start_date, licence_end_date, is_valid }`. `is_valid` is true only if today's date falls between the start and end date. 404 if no equipment has that serial number.

## Knowledge

Roles: OPERATOR, ADMIN. All three return an array of resolved or closed problems, most recently resolved first, capped at 50 rows. Each row is `{ problem_id, status, priority, logged_at, resolved_at, minutes_to_resolve, resolution_notes, caller_name, serial_number, problem_type_name, resolved_by_name }`.

| Method | Path | Query or param |
|---|---|---|
| GET | /api/knowledge/similar | Query: problemTypeId, positive integer, required. |
| GET | /api/knowledge/by-equipment/:id | Param: equipment id. |
| GET | /api/knowledge/by-caller/:id | Param: caller employee id. |

## Reports

Roles: ANALYST, ADMIN. Each reads from one of the four views in `db/03_views.sql`.

### GET /api/reports/open-by-age

Query, both optional: dateFrom, dateTo (date strings, filter on logged_at). Returns the rows of `vw_open_problems_by_age`, oldest first.

### GET /api/reports/specialist-workload

No query. Returns the rows of `vw_specialist_workload`, most open problems first.

### GET /api/reports/equipment-failures

No query. Returns the rows of `vw_equipment_failure_ranking`, worst equipment first.

### GET /api/reports/type-frequency

No query. Returns the rows of `vw_problem_type_frequency`, most frequent root type first.
