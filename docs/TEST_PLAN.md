# Test Plan — Manzaneque Limited IT Helpdesk

Deliverable 3 (P4, M4). This document is the plan. It is executed by the developer after
this document is written; the **Actual Result**, **Pass/Fail** and **Defect Log** sections
are left blank on purpose.

Every test case in this document is written against the schema, code and seed data that
actually exist in this repository as of the commit this file was added in, not against
`ARCHITECTURE.md`'s earlier design language. Where the two disagree, this document says so
explicitly (see §5 and the notes on TC-ESC-07 and TC-REF-01/02).

---

## 1. Introduction

### Purpose

To verify that the built system meets the functional requirements traceable to the brief
and to `ARCHITECTURE.md`, that its data validation holds at every layer it claims to, and
that the database-level guarantees (constraints, triggers, referential actions, roles) work
against a live MySQL instance, not just on paper.

### Scope

Covered: authentication and RBAC, field-level validation at all three enforcement levels,
the Log a Call workflow end to end, the escalation/allocation logic (`fn_find_specialist`,
`sp_assign_least_loaded`), resolution (`sp_resolve_problem`), the audit trail triggers,
referential integrity (RESTRICT / SET NULL / CASCADE), the seven standalone P3 queries, the
four M3 reporting views, baseline security checks, the maintenance scripts, and a small
usability task set.

Not covered (see §5 for why): load/performance testing beyond `EXPLAIN` plan comparison,
formal penetration testing, browser/device compatibility matrices, accessibility audit,
and any feature `ARCHITECTURE.md` describes that was not actually built (flagged inline
where it affects a test case).

### Requirement sources

`ARCHITECTURE.md` §3.2 (constraints), §3.3 (routines), §3.7 (seed data), §4.1 (API), §4.3
(validation levels), and the assessment criteria P2/P3/M2/M3/M4 referenced throughout.

---

## 2. Test environment

| Component | Version / detail |
|---|---|
| Database | MySQL 8.0 (tested against 8.0.46, MySQL Community Server) |
| Backend runtime | Node.js (tested against v24.14.1) |
| Backend framework | Express 4, `mysql2/promise`, see `server/package.json` |
| Frontend | React 18 + Vite, served at `http://localhost:5173` in dev |
| Browser | A current Chromium or Firefox build (HTML5 `type="email"` client-side validation, used in TC-VAL-10, depends on native browser behaviour) |
| API base URL | `http://localhost:4000` (server) / proxied through `http://localhost:5173/api` (client dev server, see `client/vite.config.js`) |

### Bringing the stack up

The single supported path, documented in full in `README.md`: run `db/01_schema.sql`
through `db/07_seed.sql` in order against a database named `manzaneque_helpdesk`, then
`cd server && npm install && npm start`, then `cd client && npm install && npm run dev`.
This is the path actually used to produce the evidence this test plan cites.

### Seed data state these tests assume

A **freshly seeded** database, i.e. `db/07_seed.sql` has just been run and nothing else has
written to `problem`, `call_log` or `audit_log` yet: 6 departments, 12 job titles, 45
employees, 8 equipment types, 70 equipment items, 15 software products, 90 licences, 22
problem types, 13 helpdesk staff, 20 specialist_expertise rows, 250 problems, 448 call_log
rows, 0 audit_log rows (see `PROGRESS.md`'s Phase 3 output table for the full breakdown).
Every seeded ID cited in this document (employee IDs, equipment IDs, problem_type IDs,
staff IDs, licence IDs) refers to that fresh state.

Some test sections mutate data on purpose (escalation tie-break setup, referential
integrity SET NULL/CASCADE tests, the maintenance restore test). Those sections say so and
recommend running last, or against a disposable copy.

### Resetting between runs

```bash
mysql -u root -p -e "DROP DATABASE manzaneque_helpdesk; CREATE DATABASE manzaneque_helpdesk"
mysql -u root -p manzaneque_helpdesk < db/dump.sql
```

Run this before any test pass that depends on the exact row counts above, and always
before TC-MNT-02 (restore) and after any TC-REF or TC-ESC test that intentionally deletes
or mutates rows.

---

## 3. Test strategy

### Three validation enforcement levels

`ARCHITECTURE.md` §4.3 names three fields to demonstrate at all three levels: **serial
number format**, **email format**, and **date ordering** (`resolved_at >= logged_at`). The
three levels are:

1. **Client** — the browser form, `client/src/components/admin/*.jsx` and
   `client/src/pages/*.jsx`. Rejection here means the request never leaves the browser.
2. **Server** — Zod schemas in `server/src/validators/*.js`, applied as Express middleware
   in `server/src/validators/common.js`. Tested with `curl`, bypassing the client entirely,
   so a request can reach the server even if the browser would have blocked it.
3. **Database** — constraints in `db/01_schema.sql` (`CHECK`, `NOT NULL`, `UNIQUE`, `ENUM`,
   column length). Tested with a direct `mysql` connection as `root`, bypassing the Node
   server (and therefore the `hd_app` role grants) entirely.

**Important finding, stated here so it isn't a surprise in §4**: having read the actual
validator files, the client form, and the schema, **not all three fields have genuine
enforcement at all three levels**. This is documented honestly per field in TC-VAL rather
than glossed over:

- **Serial number format**: enforced by the server (`equipment.validators.js`'s regex,
  `/^[A-Za-z0-9-]+$/`). The client input (`EquipmentAdmin.jsx` line 70) has `required` but
  no `pattern` attribute — it only stops an empty value, not a badly-formatted one. The
  database column is `VARCHAR(60) NOT NULL UNIQUE` with no `CHECK` on character content.
  So format is a **server-only** rule; the client and database levels only enforce
  presence/length/uniqueness, not shape. TC-VAL-04 through TC-VAL-06 demonstrate this gap
  directly rather than assuming it isn't there.
- **Email format**: the client input (`EmployeesAdmin.jsx` line 71) uses
  `type="email"`, which does give real browser-level format rejection. The server enforces
  it again via Zod's `.email()`. The database again has no format `CHECK`, only
  `VARCHAR(120) NOT NULL UNIQUE`. So email genuinely has two independent enforcing levels
  (client, server) plus a database backstop that only catches presence/length/uniqueness,
  not shape.
- **Date ordering** (`resolved_at >= logged_at`): `resolved_at` is never accepted as
  request input by any endpoint — `sp_resolve_problem` always sets it to `NOW()`
  (`db/04_procedures.sql` line 184). There is therefore no client form field and no Zod
  schema field for it to violate; `resolveSchema` (`problem.validators.js` lines 34–36)
  only has `resolutionNotes`. The **only** place this rule can be violated at all is a
  direct SQL `UPDATE` that bypasses the application, which is exactly what
  `chk_problem_resolved_after_logged` (`db/01_schema.sql` line 194) exists to catch. This
  is a genuinely database-only guarantee, and TC-VAL-16 records that as the finding rather
  than inventing a client/server test that has nothing to test.

---

## 4. Test cases

Table columns for every section below: **Test ID | Requirement Ref | Objective | Data Type
| Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File**.
**Actual Result**, **Pass/Fail** are left blank. **Evidence File** is pre-filled with the
intended filename under `docs/evidence/` (see `docs/evidence/README.md` for the naming
convention).

### 4.1 TC-AUTH — Authentication and RBAC

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-AUTH-01 | ARCH §4.2 Login; `auth.controller.js` `login` | Valid login, OPERATOR | Normal | POST `/api/auth/login` `{"username":"operator1","password":"Password123!"}` | 200, `token` present, `user.role="OPERATOR"`, `user.fullName="James Smith"` | | | `docs/evidence/TC-AUTH-01_login_operator.png` |
| TC-AUTH-02 | ARCH §4.2 Login | Valid login, SPECIALIST | Normal | POST login `{"username":"specialist1","password":"Password123!"}` | 200, `user.role="SPECIALIST"` | | | `docs/evidence/TC-AUTH-02_login_specialist.png` |
| TC-AUTH-03 | ARCH §4.2 Login | Valid login, ANALYST | Normal | POST login `{"username":"analyst1","password":"Password123!"}` | 200, `user.role="ANALYST"` | | | `docs/evidence/TC-AUTH-03_login_analyst.png` |
| TC-AUTH-04 | ARCH §4.2 Login | Valid login, ADMIN | Normal | POST login `{"username":"admin1","password":"Password123!"}` | 200, `user.role="ADMIN"` | | | `docs/evidence/TC-AUTH-04_login_admin.png` |
| TC-AUTH-05 | `auth.controller.js` lines 9–15 | Wrong password rejected | Erroneous | POST login `{"username":"operator1","password":"wrongpass"}` | 401 `{"error":{"code":"UNAUTHORIZED","message":"Invalid username or password"}}` | | | `docs/evidence/TC-AUTH-05_wrong_password.png` |
| TC-AUTH-06 | `auth.controller.js` lines 11–15 (no user enumeration) | Unknown username gives the identical error to a wrong password | Erroneous | POST login `{"username":"nosuchuser","password":"anything"}`; compare byte-for-byte against TC-AUTH-05's response body | 401, identical `code` and `message` to TC-AUTH-05 — confirms the API does not reveal whether the username exists | | | `docs/evidence/TC-AUTH-06_unknown_username.png` |
| TC-AUTH-07 | `middleware/auth.js` lines 12–13 | Missing JWT rejected | Erroneous | `curl http://localhost:4000/api/problems` with no `Authorization` header | 401 `{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}` | | | `docs/evidence/TC-AUTH-07_missing_jwt.txt` |
| TC-AUTH-08 | `middleware/auth.js` lines 16–27 | Expired JWT rejected | Erroneous | Using `JWT_SECRET` from `.env`, craft a token with `exp` in the past (`node -e "console.log(require('jsonwebtoken').sign({staffId:1,employeeId:1,username:'operator1',role:'OPERATOR'}, process.env.JWT_SECRET, {expiresIn:-10}))"`); call any protected route with it | 401, same generic message as TC-AUTH-07 (the handler does not distinguish expired from malformed, per the `catch {}` on line 25) | | | `docs/evidence/TC-AUTH-08_expired_jwt.txt` |
| TC-AUTH-09 | `middleware/auth.js` lines 16–27 | Tampered JWT rejected | Erroneous | Take a valid token from TC-AUTH-01, flip one character in the signature segment, call a protected route | 401, same generic message | | | `docs/evidence/TC-AUTH-09_tampered_jwt.txt` |
| TC-AUTH-10 | `middleware/rbac.js`; `employee.routes.js` line 14 | OPERATOR blocked from an ADMIN-only route | Erroneous | Log in as `operator1`; `curl -X POST /api/employees` with a valid body and the operator's token | 403 `{"error":{"code":"FORBIDDEN","message":"Not permitted for this role"}}` | | | `docs/evidence/TC-AUTH-10_operator_forbidden.txt` |
| TC-AUTH-11 | `problem.routes.js` line 28 | ANALYST blocked from resolving a problem | Erroneous | Log in as `analyst1`; `curl -X POST /api/problems/1/resolve` with the analyst's token | 403 FORBIDDEN (ANALYST is not in `requireRole('SPECIALIST','ADMIN')` for this route) | | | `docs/evidence/TC-AUTH-11_analyst_forbidden.txt` |
| TC-AUTH-12 | `problem.routes.js` line 16 | SPECIALIST blocked from logging a new call | Erroneous | Log in as `specialist1`; `curl -X POST /api/problems` with a valid body and the specialist's token | 403 FORBIDDEN (`requireRole('OPERATOR','ADMIN')`) | | | `docs/evidence/TC-AUTH-12_specialist_forbidden.txt` |
| TC-AUTH-13 | `middleware/rateLimiter.js` | Login rate limit, 10/15 min/IP | Boundary | Send 11 consecutive login attempts (any credentials) from the same machine within 15 minutes | Attempts 1–10 return normal login responses (200 or 401 depending on credentials used); attempt 11 returns 429 `{"error":{"code":"RATE_LIMITED", ...}}` | | | `docs/evidence/TC-AUTH-13_rate_limit.txt` |

### 4.2 TC-VAL — Data validation

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-VAL-01 | `equipment.validators.js` lines 4–7 | Serial number, valid | Normal | Admin → New equipment, `serialNumber="MZQ-99-0099"` (unused), fill other required fields, save | 201, equipment created | | | `docs/evidence/TC-VAL-01_serial_normal.png` |
| TC-VAL-02 | `equipment.validators.js` line 4 (`max(60)`) | Serial number, exactly 60 characters | Boundary | POST `/api/equipment` with `serialNumber` = 60 characters of `A`-`Z`/`0`-`9`/`-` | 201, accepted at the boundary | | | `docs/evidence/TC-VAL-02_serial_boundary_60.txt` |
| TC-VAL-03 | `equipment.validators.js` line 4 | Serial number, 61 characters | Erroneous | Same as TC-VAL-02 but 61 characters | 400 BAD_REQUEST, `fields.serialNumber` present | | | `docs/evidence/TC-VAL-03_serial_over_boundary.txt` |
| TC-VAL-04 | ARCH §4.3; `EquipmentAdmin.jsx` line 70 | Serial number format, **client level** — documents the gap | Erroneous | In the Admin → New equipment form, type `serialNumber = "AB CD!"` (contains a space and `!`) and click Save | Browser does **not** block submission (no `pattern` attribute on the input) — the request reaches the server, which then rejects it. Expected finding: client only enforces non-empty, not format. | | | `docs/evidence/TC-VAL-04_serial_format_client.png` |
| TC-VAL-05 | ARCH §4.3; `equipment.validators.js` line 5 | Serial number format, **server level** | Erroneous | `curl -X POST /api/equipment -d '{"serialNumber":"AB CD!","equipmentTypeId":1,"make":"Test","model":"Test"}'` (client bypassed) | 400 BAD_REQUEST, `fields.serialNumber` = "Serial number may only contain letters, digits and hyphens" | | | `docs/evidence/TC-VAL-05_serial_format_curl.txt` |
| TC-VAL-06 | ARCH §4.3; `db/01_schema.sql` lines 78–92 | Serial number format, **database level** — documents the gap | Erroneous | Direct SQL as root (server bypassed): `INSERT INTO equipment (serial_number, equipment_type_id, make, model) VALUES ('AB CD!', 1, 'Test', 'Test')` | Succeeds — there is no `CHECK` constraint on `serial_number` content, only `VARCHAR(60) NOT NULL UNIQUE`. Expected finding: the database does not enforce format at all, only presence/length/uniqueness. Clean up the row afterward. | | | `docs/evidence/TC-VAL-06_serial_format_sql.txt` |
| TC-VAL-07 | `employee.validators.js` line 9 | Email, valid | Normal | Admin → New employee, `email="test.user@manzaneque.co.uk"` | 201 | | | `docs/evidence/TC-VAL-07_email_normal.png` |
| TC-VAL-08 | `employee.validators.js` line 9 (`max(120)`) | Email, exactly 120 characters, valid shape | Boundary | POST `/api/employees` with a 120-character valid-shaped email (e.g. a long local part before `@example.com`) | 201, accepted at the boundary | | | `docs/evidence/TC-VAL-08_email_boundary_120.txt` |
| TC-VAL-09 | `employee.validators.js` line 9 | Email, malformed | Erroneous | `email="not-an-email"` | Rejected (see TC-VAL-10/11 for which level catches it) | | | `docs/evidence/TC-VAL-09_email_erroneous.png` |
| TC-VAL-10 | ARCH §4.3; `EmployeesAdmin.jsx` line 71 | Email format, **client level** | Erroneous | In the Admin → New employee form, type `email="not-an-email"` into the `type="email"` field and click Save | Browser's native HTML5 validation blocks submission (no request sent) — this is a genuine client-level rejection, unlike the serial number case | | | `docs/evidence/TC-VAL-10_email_format_client.png` |
| TC-VAL-11 | ARCH §4.3; `employee.validators.js` line 9 | Email format, **server level** | Erroneous | `curl -X POST /api/employees -d '{"firstName":"Test","lastName":"User","email":"not-an-email","departmentId":1,"jobTitleId":1}'` | 400 BAD_REQUEST, `fields.email` present | | | `docs/evidence/TC-VAL-11_email_format_curl.txt` |
| TC-VAL-12 | ARCH §4.3; `db/01_schema.sql` line 53 | Email format, **database level** — documents the gap | Erroneous | Direct SQL as root: `INSERT INTO employee (first_name, last_name, email, department_id, job_title_id) VALUES ('Test','User','not-an-email',1,1)` | Succeeds — `email` is `VARCHAR(120) NOT NULL UNIQUE`, no format `CHECK`. Clean up the row afterward. | | | `docs/evidence/TC-VAL-12_email_format_sql.txt` |
| TC-VAL-13 | ARCH §4.3; `db/01_schema.sql` line 194 | Date ordering, normal case | Normal | Resolve any OPEN/ASSIGNED problem via `POST /api/problems/:id/resolve`; `resolved_at` is set by `sp_resolve_problem` to `NOW()`, always ≥ `logged_at` | Row written successfully, no constraint violation | | | `docs/evidence/TC-VAL-13_date_order_normal.txt` |
| TC-VAL-14 | `db/01_schema.sql` line 194 (`>=`, not `>`) | Date ordering, exact boundary | Boundary | Direct SQL: `UPDATE problem SET resolved_at = logged_at WHERE problem_id = <a disposable test problem>` (resolved_at exactly equal to logged_at) | Succeeds — the constraint is `resolved_at IS NULL OR resolved_at >= logged_at`, so equality is explicitly allowed | | | `docs/evidence/TC-VAL-14_date_order_boundary.txt` |
| TC-VAL-15 | ARCH §4.3; `db/01_schema.sql` line 194 | Date ordering, **database level** (the only level that can be exercised — see §3) | Erroneous | Direct SQL as root: `UPDATE problem SET resolved_at = DATE_SUB(logged_at, INTERVAL 1 MINUTE) WHERE problem_id = <a disposable test problem>` | Rejected: `chk_problem_resolved_after_logged` violation (MySQL error 3819, "Check constraint ... is violated") | | | `docs/evidence/TC-VAL-15_date_order_sql.txt` |
| TC-VAL-16 | ARCH §4.3 | Date ordering, client/server levels — documented as not applicable | N/A (informational) | Inspect `resolveSchema` in `problem.validators.js` (lines 34–36) and every field in `client/src/pages/ProblemDetailPage.jsx`'s resolve form | Confirm `resolvedAt` is not a field either accepts — the only user input is `resolutionNotes`. There is no client or server test to write because there is no input to submit; this is deliberately recorded as the finding, not skipped silently. | | | `docs/evidence/TC-VAL-16_date_order_not_applicable.png` |
| TC-VAL-17 | `problem.validators.js` line 10 | Priority ENUM, valid value | Normal | `POST /api/problems` with `priority="HIGH"` | 201 | | | `docs/evidence/TC-VAL-17_priority_normal.txt` |
| TC-VAL-18 | `problem.validators.js` line 10 (`.default('MEDIUM')`) | Priority ENUM, omitted (defaulting) | Boundary | `POST /api/problems` with no `priority` field at all | 201, created problem has `priority="MEDIUM"` | | | `docs/evidence/TC-VAL-18_priority_default.txt` |
| TC-VAL-19 | `problem.validators.js` line 10; `db/01_schema.sql` line 177 | Priority ENUM, invalid value at both levels | Erroneous | (a) `curl -X POST /api/problems -d '{...,"priority":"URGENT"}'` → expect 400. (b) Direct SQL: `UPDATE problem SET priority = 'URGENT' WHERE problem_id = 1` → expect MySQL to reject (strict mode rejects invalid ENUM values, error 1265 or 3819 depending on mode, not silent truncation) | (a) 400 BAD_REQUEST. (b) SQL error, row unchanged | | | `docs/evidence/TC-VAL-19_priority_invalid.txt` |
| TC-VAL-20 | `problem.validators.js` line 15; `db/01_schema.sql` line 175 | Status ENUM, invalid value at both levels | Erroneous | (a) `curl "/api/problems?status=BOGUS"` → expect 400 (query validated by `problemListQuerySchema`). (b) Direct SQL: `UPDATE problem SET status = 'BOGUS' WHERE problem_id = 1` → expect rejection | (a) 400 BAD_REQUEST. (b) SQL error, row unchanged | | | `docs/evidence/TC-VAL-20_status_invalid.txt` |
| TC-VAL-21 | `problem.validators.js` line 11 (`notes` required) | Required field omitted | Erroneous | `curl -X POST /api/problems` with no `notes` field | 400 BAD_REQUEST, `fields.notes` present | | | `docs/evidence/TC-VAL-21_notes_required.txt` |
| TC-VAL-22 | `employee.validators.js` line 9 (`email` required) | Required field omitted | Erroneous | `curl -X POST /api/employees` with no `email` field | 400 BAD_REQUEST, `fields.email` present | | | `docs/evidence/TC-VAL-22_email_required.txt` |
| TC-VAL-23 | `employee.validators.js` line 7 (`max(60)`) | String length, exactly 60 characters | Boundary | `POST /api/employees` with `firstName` = exactly 60 characters | 201, accepted | | | `docs/evidence/TC-VAL-23_firstname_boundary_60.txt` |
| TC-VAL-24 | `employee.validators.js` line 7 | String length, 61 characters | Erroneous | Same, `firstName` = 61 characters | 400 BAD_REQUEST, `fields.firstName` present | | | `docs/evidence/TC-VAL-24_firstname_over_boundary.txt` |
| TC-VAL-25 | `db/01_schema.sql` line 51 (`VARCHAR(60)`) | String length, database level | Erroneous | Direct SQL as root: `INSERT INTO employee (first_name, ...) VALUES (REPEAT('A',61), ...)` | Rejected under MySQL 8.0's default strict SQL mode: "Data too long for column 'first_name'" (not silently truncated) | | | `docs/evidence/TC-VAL-25_firstname_sql.txt` |

### 4.3 TC-LOG — Log a Call workflow

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-LOG-01 | ARCH §4.2 Log a Call; `lookup.service.js` `lookupCaller` | Caller lookup auto-fills ID, job title, department | Normal | Log a Call → enter employee id `1`, click Look up | Displays James Smith, department "IT", job title "Helpdesk Operator" (seeded row, `db/07_seed.sql` employee block) | | | `docs/evidence/TC-LOG-01_caller_lookup.png` |
| TC-LOG-02 | `lookup.controller.js` `lookupCaller` | Caller lookup, unknown ID | Erroneous | Enter employee id `46` (only 45 employees seeded) | 404 "No employee with that ID" | | | `docs/evidence/TC-LOG-02_caller_not_found.png` |
| TC-LOG-03 | ARCH §4.2 Log a Call; `lookup.service.js` `lookupEquipmentBySerial` | Serial lookup auto-fills type, make | Normal | Enter serial `MZQ-01-0001`, click Look up | Displays type "Laptop", make "Lenovo", model "Lenovo Laptop 2021", assigned to James Smith | | | `docs/evidence/TC-LOG-03_serial_lookup.png` |
| TC-LOG-04 | `lookup.controller.js` `lookupEquipment` | Serial lookup, unknown serial | Erroneous | Enter serial `MZQ-99-9999` (does not exist) | 404 "No equipment with that serial number" | | | `docs/evidence/TC-LOG-04_serial_not_found.png` |
| TC-LOG-05 | ARCH §4.2 (licence validity); `lookup.service.js` lines 34–41 | Licence validity — **valid** case | Normal | Serial lookup on `MZQ-01-0001` (equipment_id 1) | Licence "Windows 11 Pro" shown, valid 2025-11-20 to 2028-09-08, marked valid (today's date falls inside the window) | | | `docs/evidence/TC-LOG-05_licence_valid.png` |
| TC-LOG-06 | ARCH §4.2 (licence validity) | Licence validity — **expired** case | Erroneous | Serial lookup on equipment_id 39 (`db/07_seed.sql` licence_id 35: AutoCAD, 2024-06-01 to 2024-10-06) | Licence shown, marked expired/invalid | | | `docs/evidence/TC-LOG-06_licence_expired.png` |
| TC-LOG-07 | ARCH §4.2 (licence validity) | Licence validity — **missing** case | Erroneous | Serial lookup on equipment_id 9 (serial `MZQ-01-0009`, no `software_licence` rows at all) | "No licences on record" shown | | | `docs/evidence/TC-LOG-07_licence_missing.png` |
| TC-LOG-08 | ARCH §4.2 (cascading picker); `ProblemTypePicker.jsx` | Cascading problem-type picker | Normal | Select "Hardware" → confirm a second dropdown appears with its children → select "Laptop Issues" → confirm a third dropdown appears → select "Screen Damage" | Each selection reveals the next level; final `problemTypeId` = 19 | | | `docs/evidence/TC-LOG-08_cascading_picker.png` |
| TC-LOG-09 | ARCH §4.1; `sp_log_new_call` (`db/04_procedures.sql` line 94) | Submit returns the PR-{id:06d} number | Normal | Complete the form with caller 1, equipment 1, type 19, priority MEDIUM, notes "Test call", submit | Response `problemNumber` matches `^PR-\d{6}$` and its numeric part equals the new `problem_id` | | | `docs/evidence/TC-LOG-09_problem_number.png` |
| TC-LOG-10 | `sp_log_new_call` lines 91–92 | call_log row created alongside the problem row | Normal | After TC-LOG-09, direct SQL: `SELECT * FROM call_log WHERE problem_id = <new id>` | Exactly one row, `call_type = 'INITIAL'`, `notes = 'Test call'` | | | `docs/evidence/TC-LOG-10_initial_call_log.txt` |
| TC-LOG-11 | `problem.routes.js` line 19; `problem.service.js` `addFollowUpCall` | Follow-up call attaches to the existing problem, does not create a new one | Normal | On the problem from TC-LOG-09, Problem Detail → Add follow-up call → "Checked cable, still faulty" → submit | 201, response is the same `problem_id`; direct SQL confirms `call_log` now has 2 rows for that `problem_id`, no new row in `problem` | | | `docs/evidence/TC-LOG-11_followup_call.png` |

### 4.4 TC-ESC — Escalation and specialist allocation

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-ESC-01 | ARCH §3.3 `fn_find_specialist`; seed `specialist_expertise` row `(8,7)` | Direct match, single qualified specialist | Normal | Log a call with `problemTypeId = 7` ("Desktop Issues"; only staff 8 covers it directly, per `db/07_seed.sql` line 342), escalate | `assigned_staff_id = 8`, status `ASSIGNED` | | | `docs/evidence/TC-ESC-01_direct_match.png` |
| TC-ESC-02 | ARCH §3.3; `db/04_procedures.sql` lines 29–49 | One-level fallback | Normal | Log a call with `problemTypeId = 19` ("Screen Damage", no direct specialist; parent `6` "Laptop Issues" has staff 7 and 8, per seed lines 340/344), escalate. **Before escalating**, run `SELECT assigned_staff_id, COUNT(*) FROM problem WHERE status IN ('ASSIGNED','IN_PROGRESS') GROUP BY assigned_staff_id` to record each candidate's current open count. | `assigned_staff_id` is whichever of 7/8 had the lower open count just before this test ran (if tied, the one with the earlier `MAX(logged_at)` among their open problems) | | | `docs/evidence/TC-ESC-02_one_level_fallback.png` |
| TC-ESC-03 | ARCH §3.3; PROGRESS.md fallback assumption | Two-level fallback | Normal | Log a call with `problemTypeId = 22` ("Account Locked" → parent `14` "Password Issues", no specialist → grandparent `4` "Account & Access", staff 11 only, per seed line 354), escalate | `assigned_staff_id = 11` (only qualified specialist at any level of this chain) | | | `docs/evidence/TC-ESC-03_two_level_fallback.png` |
| TC-ESC-04 | ARCH §3.3 "least loaded"; seed rows `(9,11)`/`(10,11)` | Least-loaded selection among several qualified | Normal | Log a call with `problemTypeId = 11` ("Licensing Issues", staff 9 and 10 both qualify directly), escalate. Record each candidate's open count via the same query as TC-ESC-02 first. | `assigned_staff_id` is whichever of 9/10 had the lower open count | | | `docs/evidence/TC-ESC-04_least_loaded.png` |
| TC-ESC-05 | ARCH §3.3 "tie-break"; `sp_assign_least_loaded` lines 149–151 | Tie-break by earliest last assignment | Boundary | Using type 6 (staff 7 and 8): log and escalate enough disposable calls first so that `SELECT assigned_staff_id, COUNT(*) ...` shows staff 7 and 8 with an **equal** open count, noting which of the two has the earlier `MAX(logged_at)`. Then log one more type-6 call and escalate it. | The specialist with the earlier last-assignment timestamp is chosen, confirmed by comparing the pre-test query against the new `assigned_staff_id` | | | `docs/evidence/TC-ESC-05_tie_break.png` |
| TC-ESC-06 | ARCH §3.3; `sp_assign_least_loaded` lines 131–135 | No specialist anywhere in the chain | Erroneous | As `admin1`, create a brand-new top-level problem type via `POST /api/problem-types` (`typeName="Test No Specialist"`, no `parentTypeId`) — confirmed to have zero `specialist_expertise` rows since it did not exist in the seed. Log a call against it, attempt to escalate. | 409 `{"error":{"code":"NO_SPECIALIST_AVAILABLE", ...}}`; the problem remains `status = OPEN`, `assigned_staff_id = NULL`. Note: every one of the 22 *seeded* problem types resolves to a specialist somewhere in its chain (all 5 root types have direct coverage — see `specialist_expertise` seed rows), so this case can only be exercised with a newly created type, not a seeded one. | | | `docs/evidence/TC-ESC-06_no_specialist.png` |
| TC-ESC-07 | ARCH §4.1 "manual override allowed" | Manual override of the auto-assigned specialist | N/A — **not implemented** | N/A | **Gap, not a test.** `ARCHITECTURE.md` §4.1 describes `POST /api/problems/:id/assign` as "→ `sp_assign_least_loaded`, manual override allowed." The built route (`problem.routes.js` line 25 → `problem.controller.js` `assignProblem` → `problem.service.js` `assignLeastLoaded(problemId)`) takes no staff-selection parameter anywhere in the chain, and no other endpoint exists to set `assigned_staff_id` directly. There is no way to manually choose a specialist through the API as built. Recorded here so the gap is documented rather than silently untested. | | N/A | — |

### 4.5 TC-RES — Resolution

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-RES-01 | `sp_resolve_problem` lines 182–186 | Resolving sets status and resolved_at | Normal | As the assigned specialist, `POST /api/problems/:id/resolve` with `resolutionNotes="Replaced the cable"` on an ASSIGNED problem | 200, response `status="RESOLVED"`, `resolved_at` is set (non-null) | | | `docs/evidence/TC-RES-01_resolve_sets_status.png` |
| TC-RES-02 | `trg_problem_before_update` lines 21–22 | minutes_to_resolve derived correctly, verified by SQL | Normal | After TC-RES-01, direct SQL: `SELECT logged_at, resolved_at, minutes_to_resolve, TIMESTAMPDIFF(MINUTE, logged_at, resolved_at) AS expected FROM problem WHERE problem_id = <id>` | `minutes_to_resolve` exactly equals the `TIMESTAMPDIFF` computed independently in the same query — verified by SQL, not by reading the UI, per the brief | | | `docs/evidence/TC-RES-02_minutes_to_resolve_sql.txt` |
| TC-RES-03 | `problem.validators.js` line 35 (`resolutionNotes` required) | Resolution notes mandatory | Erroneous | `curl -X POST /api/problems/:id/resolve` with an empty body | 400 BAD_REQUEST, `fields.resolutionNotes` present | | | `docs/evidence/TC-RES-03_notes_required.txt` |
| TC-RES-04 | `db/01_schema.sql` line 194 | resolved_at earlier than logged_at rejected | Erroneous | Direct SQL as root on a disposable test problem: `UPDATE problem SET resolved_at = DATE_SUB(logged_at, INTERVAL 1 DAY) WHERE problem_id = <id>` | Rejected: `chk_problem_resolved_after_logged` violation (duplicate of TC-VAL-15, included here for TC-RES section completeness) | | | `docs/evidence/TC-RES-04_check_constraint.txt` |

### 4.6 TC-AUD — Audit trail

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-AUD-01 | `trg_problem_after_update` lines 36–39 | Status change writes an audit row | Normal | Resolve a problem (as in TC-RES-01); direct SQL: `SELECT * FROM audit_log WHERE problem_id = <id> AND changed_field = 'status'` | One row, `old_value` = previous status, `new_value = 'RESOLVED'` | | | `docs/evidence/TC-AUD-01_status_change.txt` |
| TC-AUD-02 | `trg_problem_after_update` lines 41–44 | Reclassification writes an audit row | Normal | `PATCH /api/problems/:id/type` with a different `problemTypeId`; direct SQL: `SELECT * FROM audit_log WHERE problem_id = <id> AND changed_field = 'problem_type_id'` | One row, `old_value`/`new_value` match the change | | | `docs/evidence/TC-AUD-02_reclassify.txt` |
| TC-AUD-03 | `trg_problem_after_update` lines 46–49 | Reassignment writes an audit row | Normal | Escalate a previously unassigned problem (as in TC-ESC-01); direct SQL: `SELECT * FROM audit_log WHERE problem_id = <id> AND changed_field = 'assigned_staff_id'` | One row, `old_value = NULL`, `new_value` = the assigned staff id | | | `docs/evidence/TC-AUD-03_reassignment.txt` |
| TC-AUD-04 | `trg_problem_after_update` fires `AFTER UPDATE` only | No audit row on INSERT | Normal | Log a brand-new call (`sp_log_new_call`); immediately, direct SQL: `SELECT COUNT(*) FROM audit_log WHERE problem_id = <new id>` | 0 — the trigger is `AFTER UPDATE`, not `AFTER INSERT` (`db/05_triggers.sql` line 33), so a freshly created problem has no audit history yet | | | `docs/evidence/TC-AUD-04_no_audit_on_insert.txt` |

### 4.7 TC-REF — Referential integrity

Deletion attempts that are expected to **fail** (RESTRICT) use real seeded rows safely,
since the row survives. Deletion attempts expected to **succeed** (SET NULL, CASCADE) use
rows created during the test itself, to avoid corrupting seed data other sections rely on.

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-REF-01 | `db/01_schema.sql` lines 60–61 (RESTRICT); note: no API DELETE exists for department | RESTRICT — department, SQL only | Erroneous | Direct SQL as root: `DELETE FROM department WHERE department_id = 6` ("Marketing", 6 employees reference it) | Rejected: FK error (errno 1451), not a silent success, not a 500 (there is no API path to even attempt this — `referenceData.routes.js` only defines GET routes) | | | `docs/evidence/TC-REF-01_department_restrict_sql.txt` |
| TC-REF-02 | `db/01_schema.sql` lines 62–63 (RESTRICT); no API DELETE for job_title | RESTRICT — job title, SQL only | Erroneous | Direct SQL as root: `DELETE FROM job_title WHERE job_title_id = 1` ("Helpdesk Operator", referenced by employees 1–6) | Rejected: FK error (errno 1451) | | | `docs/evidence/TC-REF-02_job_title_restrict_sql.txt` |
| TC-REF-03 | `db/01_schema.sql` lines 188–189 (RESTRICT); `problemType.routes.js` line 17 | RESTRICT — problem type, **API level** | Erroneous | As `admin1`, `DELETE /api/problem-types/4` ("Account & Access" — referenced directly by at least one seeded/test problem) | 409 `{"error":{"code":"CONFLICT", ...}}` (errorHandler maps MySQL's `ER_ROW_IS_REFERENCED_2` to 409, not a 500) | | | `docs/evidence/TC-REF-03_problem_type_restrict_api.png` |
| TC-REF-04 | `db/01_schema.sql` lines 188–189 | RESTRICT — problem type, **direct SQL level** | Erroneous | Direct SQL as root: `DELETE FROM problem_type WHERE problem_type_id = 4` | Rejected: FK error (errno 1451) | | | `docs/evidence/TC-REF-04_problem_type_restrict_sql.txt` |
| TC-REF-05 | `db/01_schema.sql` lines 90–91 (SET NULL) | SET NULL — equipment.assigned_employee_id | Normal | As `admin1`: create a new employee via `POST /api/employees`; assign them to an existing unassigned equipment item via `PUT /api/equipment/:id` (`assignedEmployeeId` = the new employee's id); then `DELETE /api/employees/:id` for that new employee | 204 on the delete; `GET /api/equipment/:id` afterward shows `assigned_employee_id: null`, `assigned_employee_name: null` — the equipment row itself still exists | | | `docs/evidence/TC-REF-05_equipment_set_null.png` |
| TC-REF-06 | `db/01_schema.sql` lines 131–132 (SET NULL) | SET NULL — problem_type.parent_type_id | Normal | As `admin1`: `POST /api/problem-types` a new parent (`typeName="Test Root Zeta"`); `POST /api/problem-types` a new child with `parentTypeId` = the new parent's id; `DELETE /api/problem-types/:id` the new parent | 204 on the delete; `GET /api/problem-types/:id` for the child afterward shows `parent_type_id: null` | | | `docs/evidence/TC-REF-06_problem_type_set_null.png` |
| TC-REF-07 | `db/01_schema.sql` lines 209–210 (CASCADE); no API DELETE for problem | CASCADE — call_log via problem, SQL only | Normal | Log a new test call (creates 1 `problem` row + 1 `call_log` row), add one follow-up call (2nd `call_log` row); direct SQL as root: `DELETE FROM problem WHERE problem_id = <new id>` (no API route deletes a problem — `problem.routes.js` has no `DELETE`) | Delete succeeds; `SELECT COUNT(*) FROM call_log WHERE problem_id = <id>` afterward returns 0 — both call_log rows disappeared automatically via CASCADE | | | `docs/evidence/TC-REF-07_call_log_cascade.txt` |
| TC-REF-08 | `db/01_schema.sql` lines 115–116 (CASCADE) | CASCADE — software_licence via equipment | Normal | As `admin1`, create a new equipment item via `POST /api/equipment`; direct SQL, insert one `software_licence` row for it (no API endpoint creates licences — reference data is SQL-maintained per ARCH §4.1); then `DELETE /api/equipment/:id` for that equipment item | 204 on the delete; `SELECT COUNT(*) FROM software_licence WHERE equipment_id = <id>` afterward returns 0 | | | `docs/evidence/TC-REF-08_licence_cascade.txt` |

### 4.8 TC-QRY — Query set (P3)

Query 07 mutates data (retires and deletes an equipment row) — run it last, or against a
disposable reseeded copy.

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-QRY-01 | `db/queries/01_resolved_problems_multitable_inner_join.sql` | 6-table INNER JOIN | Normal | `mysql -u root -p manzaneque_helpdesk < db/queries/01_resolved_problems_multitable_inner_join.sql` | One row per RESOLVED/CLOSED problem, newest first, no NULLs in any joined column (INNER join is correct because every resolved problem has an assigned specialist) | | | `docs/evidence/TC-QRY-01_inner_join.txt` |
| TC-QRY-02 | `db/queries/02_open_problems_with_optional_assignment.sql` | 6-table LEFT JOIN | Normal | Run the query file | One row per OPEN/ASSIGNED/IN_PROGRESS problem; `assigned_specialist_name` is NULL for OPEN rows with no assignment yet — confirms LEFT JOIN keeps them instead of dropping them | | | `docs/evidence/TC-QRY-02_left_join.txt` |
| TC-QRY-03 | `db/queries/03_overloaded_specialists.sql` | GROUP BY + HAVING against a subquery average | Normal | Run the query file | Zero or more rows, each specialist's `open_problem_count` strictly greater than the company-wide average computed by the `HAVING` subquery | | | `docs/evidence/TC-QRY-03_group_by_having.txt` |
| TC-QRY-04 | `db/queries/04_equipment_above_average_for_type.sql` | Correlated subquery | Normal | Run the query file | Equipment items whose own problem count exceeds the average for other equipment of the same `equipment_type_id`, ordered by count descending | | | `docs/evidence/TC-QRY-04_correlated_subquery.txt` |
| TC-QRY-05 | `db/queries/05_problem_type_hierarchy_walk.sql` | WITH RECURSIVE, top-down | Normal | Run the query file | Exactly 22 rows (one per seeded `problem_type`), each parent listed before its children, `path` column shows the full breadcrumb (e.g. "Hardware > Laptop Issues > Screen Damage") | | | `docs/evidence/TC-QRY-05_recursive_walk.txt` |
| TC-QRY-06 | `db/queries/06_expired_or_missing_licences.sql` | LEFT JOIN + date WHERE | Normal | Run the query file | Includes equipment_id 9 (`licence_status = 'NO LICENCE ON RECORD'`) and equipment_id 39 (`licence_status = 'EXPIRED'`, licence_id 35) among the results | | | `docs/evidence/TC-QRY-06_licence_validity.txt` |
| TC-QRY-07 | `db/queries/07_reassign_then_retire_equipment.sql` | UPDATE/DELETE referential-action pair | Normal | Run the four steps in order, against a disposable reseeded copy of the database | Step 1 UPDATE succeeds. Step 2 shows the licence count for the picked equipment before deletion. Step 3 DELETE succeeds (the picked item is confirmed unreferenced by any problem). Step 4 shows 0 rows — the equipment and its licences are both gone, proving CASCADE fired without a separate DELETE on `software_licence` | | | `docs/evidence/TC-QRY-07_update_delete_pair.txt` |

### 4.9 TC-RPT — Reports and management information (M3)

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-RPT-01 | `db/03_views.sql` line 18; `reports.routes.js` line 11 | vw_open_problems_by_age renders | Normal | Log in as `analyst1`, open Reports → "Open problems by age" | Table renders with `age_hours` column, sorted oldest first, no errors | | | `docs/evidence/TC-RPT-01_open_by_age.png` |
| TC-RPT-02 | `db/03_views.sql` line 48; `reports.routes.js` line 12 | vw_specialist_workload renders | Normal | Reports → "Specialist workload" | Table renders with `open_problem_count`, `resolved_problem_count`, `avg_minutes_to_resolve` per specialist | | | `docs/evidence/TC-RPT-02_specialist_workload.png` |
| TC-RPT-03 | `db/03_views.sql` line 68; `reports.routes.js` line 13 | vw_equipment_failure_ranking renders | Normal | Reports → "Equipment failure ranking" | Table renders, ranked by `problem_count` | | | `docs/evidence/TC-RPT-03_equipment_failures.png` |
| TC-RPT-04 | `db/03_views.sql` line 89; `reports.routes.js` line 14 | vw_problem_type_frequency renders | Normal | Reports → "Problem type frequency" | Table renders, rolled up to root type names (5 rows max, one per root problem type) | | | `docs/evidence/TC-RPT-04_type_frequency.png` |
| TC-RPT-05 | `reports.service.js` `openProblemsByAge` | Open-by-age date filter narrows results | Normal | On "Open problems by age", set `dateFrom`/`dateTo` to a narrow range (e.g. one week) | Row count visibly drops and every remaining row's `logged_at` falls inside the chosen range | | | `docs/evidence/TC-RPT-05_date_filter.png` |
| TC-RPT-06 | M3; cross-check aggregation correctness | Manual SQL cross-check of one report figure | Normal | Pick one specialist's `open_problem_count` from TC-RPT-02's table; independently run `SELECT COUNT(*) FROM problem WHERE assigned_staff_id = <that staff_id> AND status IN ('ASSIGNED','IN_PROGRESS')` | The manual count equals the view's figure exactly | | | `docs/evidence/TC-RPT-06_manual_crosscheck.txt` |

### 4.10 TC-SEC — Security

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-SEC-01 | ARCH §3.8; all SQL is parameterised | SQL injection via a text input | Erroneous | Log a Call, `notes = "'; DROP TABLE problem; --"` | Call logs successfully with that literal string stored in `notes`; `problem` table is unaffected (parameterised queries treat it as data, not SQL) | | | `docs/evidence/TC-SEC-01_injection_text_field.png` |
| TC-SEC-02 | ARCH §3.8 | SQL injection via a URL parameter | Erroneous | `curl "http://localhost:4000/api/lookup/equipment/' OR '1'='1"` (with auth header) | 404 "No equipment with that serial number" — treated as a literal (non-existent) serial, no SQL error, no data leaked | | | `docs/evidence/TC-SEC-02_injection_url_param.txt` |
| TC-SEC-03 | `db/01_schema.sql` line 143; `auth.service.js` `verifyPassword` | Passwords stored as bcrypt hashes, not plaintext | Normal | Direct SQL: `SELECT password_hash FROM helpdesk_staff WHERE username='operator1'` | Value starts with `$2b$12$`, is not `Password123!`, and is 60 characters long (a bcrypt hash) | | | `docs/evidence/TC-SEC-03_bcrypt_stored.txt` |
| TC-SEC-04 | `referenceData.service.js` `listStaff`; `auth.controller.js` `me` | password_hash never returned by any endpoint | Normal | Inspect the JSON body of `GET /api/staff` and `GET /api/auth/me` responses | Neither contains a `password_hash` field anywhere | | | `docs/evidence/TC-SEC-04_no_password_leak.txt` |
| TC-SEC-05 | `db/06_roles.sql` line 99; `.env` `DB_APP_USER` | App connects as hd_app, not root | Normal | While the server is running and holding a connection, direct SQL as root: `SELECT id, user, host FROM information_schema.processlist WHERE user != 'root'` | At least one connection shown as `hd_app@%`, matching `DB_APP_USER` in `.env` | | | `docs/evidence/TC-SEC-05_app_user.txt` |
| TC-SEC-06 | `db/06_roles.sql` lines 22–85 | Each MySQL role holds only its granted privileges | Normal | Direct SQL as root: `SHOW GRANTS FOR hd_operator`, `hd_specialist`, `hd_analyst`, `hd_admin` | Output matches `db/06_roles.sql` line for line — in particular, `hd_operator` has no grant on `helpdesk_staff`, and `hd_analyst` has no `INSERT`/`UPDATE`/`DELETE` grant anywhere | | | `docs/evidence/TC-SEC-06_role_grants.txt` |
| TC-SEC-07 | `app.js` line 10 (`helmet()`) | Helmet security headers present | Normal | `curl -I http://localhost:4000/api/health` | Response includes Helmet's default headers (e.g. `X-Content-Type-Options: nosniff`, `X-DNS-Prefetch-Control: off`) | | | `docs/evidence/TC-SEC-07_helmet_headers.txt` |
| TC-SEC-08 | `app.js` line 11; `.env` `CORS_ORIGIN` | CORS rejects a disallowed origin | Erroneous | `curl -H "Origin: http://evil.example.com" -I http://localhost:4000/api/health` | No `Access-Control-Allow-Origin: http://evil.example.com` header in the response (the configured origin is only `http://localhost:5173`) — a browser making this request would block the response from being read | | | `docs/evidence/TC-SEC-08_cors_rejected.txt` |

### 4.11 TC-MNT — Maintenance

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-MNT-01 | ARCH §3.8; `db/maintenance/backup.sh` | Backup produces a real dump file | Normal | Run `db/maintenance/backup.sh` from the repo root | A new file appears under `db/maintenance/backups/manzaneque_helpdesk_<timestamp>.sql`, non-zero size. (Already produced once during this document's preparation: `db/maintenance/backups/manzaneque_helpdesk_20260822_130628.sql`, 148,106 bytes — that file is real evidence the script works, but this test row should still be re-run and re-evidenced as part of the formal test pass.) | | | `db/maintenance/backups/manzaneque_helpdesk_20260822_130628.sql` |
| TC-MNT-02 | ARCH §3.8; `db/maintenance/restore.sh` | Restore reproduces the same row counts | Normal | Drop and recreate an empty `manzaneque_helpdesk` database; run `db/maintenance/restore.sh db/maintenance/backups/manzaneque_helpdesk_20260822_130628.sql`; re-run the row-count query from §2 against the restored database | Every table's row count matches the source database at backup time (`problem`=251, `call_log`=450, `audit_log`=3, and the 10 static/reference tables unchanged from seed — see §2) | | | `docs/evidence/TC-MNT-02_restore_row_counts.txt` |
| TC-MNT-03 | ARCH §3.8 (EXPLAIN evidence); `db/02_indexes.sql` | EXPLAIN the Problem List's status+date query, with and without indexes | Normal | `EXPLAIN SELECT ... FROM problem p WHERE p.status = 'OPEN' ORDER BY p.logged_at DESC` (the query behind `GET /api/problems?status=OPEN`) — capture the plan once on the indexed database, then again after `DROP INDEX idx_problem_status_logged_at ON problem` (and `idx_problem_status`) on a disposable copy | Indexed plan shows a range/ref access on the status(+logged_at) index; the plan without those indexes falls back to a full table scan (`type = ALL`) — both plans captured side by side | | | `docs/evidence/TC-MNT-03_explain_problem_list.txt` |
| TC-MNT-04 | ARCH §3.8; `db/02_indexes.sql` | EXPLAIN vw_specialist_workload's underlying aggregation, with and without indexes | Normal | `EXPLAIN SELECT assigned_staff_id, COUNT(*) FROM problem WHERE status IN ('ASSIGNED','IN_PROGRESS') GROUP BY assigned_staff_id` — capture with `idx_problem_assigned_status` present, then again after dropping it on a disposable copy | Indexed plan shows index use for the `GROUP BY`; without it, a full scan with a temporary table/filesort | | | `docs/evidence/TC-MNT-04_explain_workload.txt` |

### 4.12 TC-USE — Usability

No formal NFR is numbered for training time in `ARCHITECTURE.md` — the closest anchor is
the brief's own P2 criterion (evidence of a working, usable interface). This section is
included because the task brief asked for it, not because it traces to a specific
requirement ID; the Requirement Ref column says so rather than inventing one.

| Test ID | Requirement Ref | Objective | Data Type | Input / Steps | Expected Result | Actual Result | Pass/Fail | Evidence File |
|---|---|---|---|---|---|---|---|---|
| TC-USE-01 | Brief P2 (usable interface); no numbered NFR exists for this | Participant A completes the task set unassisted after ≤30 min walkthrough | Normal | Task set: (1) log a call for employee 5 / equipment 5, (2) find a past problem via Knowledge Lookup for the same equipment, (3) escalate a newly logged call, (4) resolve an assigned problem | All 4 tasks completed without the trainer intervening | | | `docs/evidence/TC-USE-01_participant_a.png` |
| TC-USE-02 | Brief P2 | Participant B, same task set | Normal | Same 4 tasks | Completed without intervention | | | `docs/evidence/TC-USE-02_participant_b.png` |
| TC-USE-03 | Brief P2 | Participant C, same task set | Normal | Same 4 tasks | Completed without intervention | | | `docs/evidence/TC-USE-03_participant_c.png` |

**Usability observation log** (supplementary to the table above — record during the session):

| Participant | Task | Time Taken | Observations / Errors | Trainer Notes |
|---|---|---|---|---|
| A | Log a call | | | |
| A | Find a past problem | | | |
| A | Escalate | | | |
| A | Resolve | | | |
| B | Log a call | | | |
| B | Find a past problem | | | |
| B | Escalate | | | |
| B | Resolve | | | |
| C | Log a call | | | |
| C | Find a past problem | | | |
| C | Escalate | | | |
| C | Resolve | | | |

---

## 5. Test data justification (M4)

### Why these boundary values, and not others

Every boundary value used in TC-VAL comes directly from a real constraint in the code, not
a round number picked for convenience. The 60-character boundary on `firstName` and
`serialNumber` (TC-VAL-02/03, TC-VAL-23/24) is `employee.validators.js` line 7's
`.max(60)` and `equipment.validators.js` line 4's `.max(60)`, which in turn mirror
`db/01_schema.sql`'s `VARCHAR(60)` columns exactly — testing at 60 and 61 characters proves
the Zod schema and the database column agree on where the line is, which is the actual
claim `ARCHITECTURE.md` §4.3 makes ("three enforcement levels"). The 120-character email
boundary (TC-VAL-08) is the same reasoning applied to `VARCHAR(120)`. The date-ordering
boundary (TC-VAL-14, `resolved_at = logged_at` exactly) targets the specific difference
between `>=` and `>` in the `CHECK` clause — a value one second later would not distinguish
the two, only exact equality does.

### Why these specific seeded IDs

The fallback tests (TC-ESC-02, TC-ESC-03) do not use arbitrary problem types picked at
random. They use `problem_type_id 19` and `22` because those are the two branches
`db/seed_generator/generate_seed.js` was deliberately built to exercise (see `PROGRESS.md`'s
Phase 3 notes) — the seed generator's own JS mirror of `fn_find_specialist` was used to
choose which types would have no direct specialist, specifically so the real MySQL
recursive CTE could be checked against an independently computed expectation. Re-deriving
the hierarchy directly from `db/07_seed.sql` (rather than trusting `PROGRESS.md`'s prose)
confirmed: type 19 "Screen Damage" has no `specialist_expertise` row and its parent, type 6
"Laptop Issues", has two (staff 7 and 8) — a genuine one-level climb. Type 22 "Account
Locked" has no row, its parent type 14 "Password Issues" has no row either, and only the
grandparent, type 4 "Account & Access", has one (staff 11) — a genuine two-level climb.
These are the only two branches in the entire 22-row hierarchy shaped this way, which is
exactly why they were picked over any other type: every other non-root type either has a
specialist directly or falls back exactly one level to a root that does.

TC-ESC-06 (no specialist anywhere) could not be built from seed data at all. Checking every
one of the 22 seeded types' full ancestor chain (done directly against `problem_type` and
`specialist_expertise`, not assumed) shows all five root types — Hardware, Software,
Network, Account & Access, Peripherals — have at least one specialist, so every seeded leaf
type resolves somewhere. The test therefore creates a disposable type through the Admin
screen instead of citing a seeded ID that does not exist. This is stated plainly rather than
quietly substituting a different, weaker test.

### Why this erroneous data, per constraint type

Each erroneous value in TC-VAL is chosen to target one specific constraint mechanism, not a
vague "bad input":

- A serial number with a space and `!` (TC-VAL-04/05/06) targets the **regex** specifically
  — it is otherwise a valid length and non-empty, so it cannot be caught by any other rule,
  isolating exactly what the format check does and does not cover at each level.
- `"not-an-email"` (TC-VAL-09–12) targets **shape**, not length or presence, for the same
  reason.
- `DATE_SUB(logged_at, INTERVAL 1 MINUTE)` (TC-VAL-15) is the smallest possible violation of
  the `CHECK` — one minute earlier is enough to prove the boundary is enforced without
  needing a large, unrealistic gap.
- `'URGENT'` and `'BOGUS'` (TC-VAL-19/20) are plausible-looking values a careless client
  might send, chosen specifically because they are not close to any real enum member (ruling
  out a typo-tolerance false pass) but are still the same data type (a short uppercase
  string), isolating the ENUM check from a type-mismatch check.
- `REPEAT('A',61)` (TC-VAL-25) targets **length** in isolation, using a character that is
  otherwise completely valid, so nothing else about the input could cause a rejection.
- The injection payloads in TC-SEC-01/02 (`'; DROP TABLE problem; --` and `' OR '1'='1`) are
  the two classic shapes — a statement-terminating payload and a tautology payload — chosen
  because parameterised queries (`mysql2`'s `?` placeholders, used throughout
  `server/src/services/*.js`) treat the entire string as a single bound value regardless of
  its content, so either payload proves the same thing: there is no string concatenation
  anywhere in the query layer for an attacker to break out of.

### What is deliberately not covered, and why that is an acceptable risk

- **Load and performance testing beyond `EXPLAIN`** (TC-MNT-03/04). The brief and
  `ARCHITECTURE.md` ask for index justification via query plans, not throughput or
  concurrency benchmarking. A coursework helpdesk for one company's internal use is not
  sized for load testing to be a meaningful use of the time available, and no NFR asks for
  it.
- **Penetration testing beyond TC-SEC-01/02.** The two injection tests demonstrate the
  parameterised-query defence works at all; a full penetration test (fuzzing every endpoint,
  timing attacks on the login comparison, header injection, etc.) is out of proportion to a
  four-person-role internal tool and to the M2 criterion, which asks for evidenced security
  practice, not a security audit.
- **Manual override of escalation (TC-ESC-07).** Recorded as a gap rather than tested,
  because the feature does not exist in the build — see §4.4. Retesting it is only possible
  after the code changes, which is out of scope for this document (see "Do not modify any
  existing schema, server or client code" in this task's own instructions).
- **Exhaustive combinatorial validation** (every field × every possible bad value). TC-VAL
  covers one representative erroneous case per distinct constraint *mechanism* (regex,
  ENUM, length, required, CHECK) rather than every field that happens to share that
  mechanism, on the reasoning that the mechanism is what is actually being tested — Zod's
  `.max()` behaves the same way whether it is applied to `firstName` or `lastName`, so
  testing both would be repetition, not additional coverage.
- **Concurrent-write race conditions** (e.g. two operators escalating the same problem
  simultaneously). `sp_assign_least_loaded` does take a `FOR UPDATE` row lock
  (`db/04_procedures.sql` line 127) specifically to prevent a double-assignment race, which
  is worth noting as a design decision, but proving it under real concurrent load would need
  a load-testing harness this plan does not otherwise justify building. This is flagged as a
  known residual risk rather than silently ignored.
- **Containerisation.** Removed from this project's scope entirely (see `PROGRESS.md`'s
  assumptions) — no P2/P3/M2/M3/M4 criterion asks for it, and it was never executed on any
  machine used to build this project. No container-based smoke test is needed.

---

## 6. Traceability matrix

| Requirement | Source | Test IDs |
|---|---|---|
| Login authenticates each of the four roles | ARCH §4.2 | TC-AUTH-01, TC-AUTH-02, TC-AUTH-03, TC-AUTH-04 |
| Login gives no information to enumerate valid usernames | `auth.controller.js` | TC-AUTH-05, TC-AUTH-06 |
| Protected routes reject missing/invalid tokens | `middleware/auth.js` | TC-AUTH-07, TC-AUTH-08, TC-AUTH-09 |
| RBAC enforced per route/role | `middleware/rbac.js`; ARCH §4.1 | TC-AUTH-10, TC-AUTH-11, TC-AUTH-12 |
| Login rate limited | `middleware/rateLimiter.js` | TC-AUTH-13 |
| Serial number format validated | ARCH §4.3; `equipment.validators.js` | TC-VAL-01–06 |
| Email format validated | ARCH §4.3; `employee.validators.js` | TC-VAL-07–12 |
| Date ordering constraint (`resolved_at >= logged_at`) | ARCH §3.2; `db/01_schema.sql` line 194 | TC-VAL-13–16, TC-RES-04 |
| ENUM values enforced (priority, status) | `db/01_schema.sql`; validators | TC-VAL-17–20 |
| Required fields enforced | validators | TC-VAL-21, TC-VAL-22 |
| String length limits enforced | schema + validators | TC-VAL-23–25 |
| Caller lookup auto-fill | ARCH §4.2 Log a Call | TC-LOG-01, TC-LOG-02 |
| Equipment/serial lookup auto-fill | ARCH §4.2 Log a Call | TC-LOG-03, TC-LOG-04 |
| Licence validity indicator (valid/expired/missing) | ARCH §4.2 Log a Call | TC-LOG-05, TC-LOG-06, TC-LOG-07 |
| Cascading problem-type picker | ARCH §4.2 Log a Call | TC-LOG-08 |
| Problem number issued to caller | ARCH §4.1; `sp_log_new_call` | TC-LOG-09 |
| Initial call recorded with the new problem | `sp_log_new_call` | TC-LOG-10 |
| Follow-up calls attach to existing problems | ARCH §4.1 | TC-LOG-11 |
| Specialist allocation, direct match | ARCH §3.3 `fn_find_specialist` | TC-ESC-01 |
| Specialist allocation, general-type fallback | ARCH §3.3; brief | TC-ESC-02, TC-ESC-03 |
| Least-loaded selection and tie-break | ARCH §3.3 `sp_assign_least_loaded` | TC-ESC-04, TC-ESC-05 |
| No specialist available handled gracefully | `sp_assign_least_loaded` | TC-ESC-06 |
| Manual escalation override | ARCH §4.1 | TC-ESC-07 (documented gap, not implemented) |
| Resolution sets status/resolved_at | ARCH §3.3 `sp_resolve_problem` | TC-RES-01 |
| minutes_to_resolve derived correctly | `trg_problem_before_update` | TC-RES-02 |
| Resolution notes mandatory | `problem.validators.js` | TC-RES-03 |
| Audit trail on status/type/assignment change | ARCH §3.4 `trg_problem_after_update` | TC-AUD-01, TC-AUD-02, TC-AUD-03 |
| Audit trail does not fire on INSERT | `db/05_triggers.sql` | TC-AUD-04 |
| RESTRICT on reference data | ARCH §3.2 | TC-REF-01, TC-REF-02, TC-REF-03, TC-REF-04 |
| SET NULL on optional assignment | ARCH §3.2 | TC-REF-05, TC-REF-06 |
| CASCADE on dependent detail | ARCH §3.2 | TC-REF-07, TC-REF-08 |
| P3 query set (7 queries, required SQL features) | ARCH §3.6; brief P3 | TC-QRY-01–07 |
| M3 management information (4 views) | ARCH §3.5; brief M3 | TC-RPT-01–04 |
| Report date filtering | ARCH §4.1 | TC-RPT-05 |
| Aggregation correctness | brief M3 | TC-RPT-06 |
| SQL injection defence | ARCH §3.8; brief M2 | TC-SEC-01, TC-SEC-02 |
| Password hashing and non-disclosure | ARCH §3.8 | TC-SEC-03, TC-SEC-04 |
| Least-privilege database connection and roles | ARCH §3.8 | TC-SEC-05, TC-SEC-06 |
| Helmet / CORS hardening | ARCH §3.8 | TC-SEC-07, TC-SEC-08 |
| Backup and restore | ARCH §3.8; brief M2 | TC-MNT-01, TC-MNT-02 |
| Index justification via EXPLAIN | ARCH §3.8 | TC-MNT-03, TC-MNT-04 |
| Usable interface, minimal training | brief P2 | TC-USE-01, TC-USE-02, TC-USE-03 |

---

## 7. Defect log

Filled in during test execution, one row per defect found.

| Defect ID | Test ID | Description | Severity | Status | Fix Commit | Retest ID |
|---|---|---|---|---|---|---|
| | | | | | | |
