# Manzaneque Limited — IT Helpdesk Management System
## Architecture Plan (Deliverable 2)

Scope is set by the assessment criteria: **P2** (working system with UI, output and validation, querying across multiple tables), **P3** (query language implemented), **M2** (fully functional, including system security and database maintenance), **M3** (meaningful data extracted as management information). Nothing here exists for any other reason.

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Database | MySQL 8.0 | Recursive CTEs for the problem-type hierarchy, CHECK constraints, roles. All three are needed. |
| DB access | `mysql2/promise`, parameterised only | SQL injection defence — M2 security. |
| Backend | Node 20 + Express 4 | Thin API. Business logic stays in the database. |
| Auth | JWT + bcrypt (cost 12) | M2 security. |
| Validation | Zod (server) + React (client) + DB constraints | Three enforcement levels — P2 asks for validation evidence. |
| Frontend | React 18 + Vite, plain CSS | No framework overhead. |
| Packaging | A plain SQL dump | The assessor must be able to run it against their own MySQL 8.0 + Node install. |

**Stance:** aggregation goes in views, multi-step operations go in stored procedures, derived values come from triggers. Pulling rows into JavaScript and computing there forfeits the marks this build exists to earn.

---

## 2. Repository structure

```
manzaneque-helpdesk/
├── CLAUDE.md                # build rules
├── ARCHITECTURE.md          # this file
├── README.md                # assessor setup instructions
├── .env.example
│
├── db/
│   ├── 01_schema.sql        # 13 tables, PK/FK, CHECK, UNIQUE, ENUM
│   ├── 02_indexes.sql       # FK + report filter columns, each justified in a comment
│   ├── 03_views.sql         # 4 reporting views
│   ├── 04_procedures.sql    # 3 procedures + 1 function
│   ├── 05_triggers.sql      # 2 triggers
│   ├── 06_roles.sql         # 4 MySQL roles, least-privilege GRANTs
│   ├── 07_seed.sql
│   ├── queries/             # 7 documented queries (P3)
│   ├── dump.sql             # full schema + data, for the assessor
│   └── maintenance/         # backup.sh, restore.sh
│
├── server/src/
│   ├── db/                  # pool, transaction helper
│   ├── middleware/          # auth, RBAC, error handler
│   ├── validators/          # Zod schemas
│   ├── services/            # calls procedures and views
│   ├── controllers/ routes/
│   └── app.js
│
├── client/src/
│   ├── api/ context/ components/ pages/ styles/
│
└── docs/
    ├── evidence/            # screenshots captured during the build
    └── diagrams/
```

---

## 3. Database

### 3.1 Tables

| # | Table | Role |
|---|---|---|
| 1 | `department` | Reference |
| 2 | `job_title` | Reference |
| 3 | `employee` | Personnel register (the caller lookup) |
| 4 | `equipment_type` | Reference |
| 5 | `equipment` | Serial-numbered assets, optionally assigned to an employee |
| 6 | `software` | Software catalogue |
| 7 | `software_licence` | Licence per equipment, with validity dates |
| 8 | `problem_type` | **Self-referencing** `parent_type_id` — general → specific |
| 9 | `helpdesk_staff` | 1:1 optional extension of `employee`; role OPERATOR / SPECIALIST / ANALYST / ADMIN; holds credentials |
| 10 | `specialist_expertise` | Junction: staff ↔ problem_type (M:N) |
| 11 | `problem` | Problem number, caller, equipment, type, status, assignment, resolution |
| 12 | `call_log` | Many calls per problem — initial report plus follow-ups |
| 13 | `audit_log` | Trigger-populated change history — justified under M2 security |

### 3.2 Constraints in DDL

- Referential actions: `RESTRICT` on reference data, `SET NULL` on optional assignment (equipment→employee, problem_type parent), `CASCADE` on dependent detail (call_log, specialist_expertise, software_licence).
- `CHECK (resolved_at IS NULL OR resolved_at >= logged_at)`
- `CHECK (licence_end_date > licence_start_date)`
- `UNIQUE` on equipment serial number; `UNIQUE (employee_id)` on helpdesk_staff; `UNIQUE (staff_id, problem_type_id)` on expertise.
- `ENUM` for problem status (OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED) and priority.
- Every FK column indexed.

### 3.3 Procedures and function

Each implements a specific line in the brief.

| Routine | Brief requirement |
|---|---|
| `sp_log_new_call` | Transaction: create problem (if new) + call_log row, return the problem number to quote to the caller. |
| `fn_find_specialist(problem_type_id)` | *"If there is no specialist listed for a more specific problem type, then a specialist from the more general problem type will be used"* — `WITH RECURSIVE` walks `parent_type_id` upward until a match is found. |
| `sp_assign_least_loaded(problem_id)` | *"the specialist who is currently the least loaded can be allocated"* — fewest open problems among qualified specialists. |
| `sp_resolve_problem(...)` | Sets `resolved_at`, transitions status, stores resolution notes. |

### 3.4 Triggers

| Trigger | Purpose |
|---|---|
| `trg_problem_after_update` | Audit row on any status, type or assignment change. |
| `trg_problem_before_update` | Derives `minutes_to_resolve` when `resolved_at` is set. |

### 3.5 Views — management information (M3)

Four, mapping onto the three questions the brief actually asks.

| View | Question |
|---|---|
| `vw_open_problems_by_age` | What is outstanding, and for how long? |
| `vw_specialist_workload` | Are specialists sufficiently resourced? (open count, average resolution time) |
| `vw_equipment_failure_ranking` | How is the equipment performing overall? |
| `vw_problem_type_frequency` | Where is employee training needed? (rolls specific types up to parent) |

### 3.6 Query set (P3)

Seven standalone commented queries in `db/queries/`, each stating its purpose and expected output. Coverage: multi-table INNER and LEFT JOINs (4+ tables in at least two), aggregate with `GROUP BY` and `HAVING`, a correlated subquery, the `WITH RECURSIVE` hierarchy walk, and an `UPDATE`/`DELETE` pair demonstrating referential action behaviour.

### 3.7 Seed data

Generated, so volume is free — and reports on ten rows look like a prototype.

6 departments · 12 job titles · 45 employees · 8 equipment types · 70 equipment items (some unassigned) · 15 software products · 90 licences (mix of valid, expired, one missing) · 22 problem types across 3 levels · 12 helpdesk staff (6 operators, 5 specialists with overlapping expertise, 1 analyst) · ~250 problems over 6 months (~70% closed, 15% resolved, 15% open) · ~400 call log entries.

Deterministic, not random — the test plan references specific IDs. Include one hierarchy branch with no specialist at the specific level, so the fallback path is exercised.

### 3.8 Security and maintenance (M2)

**Security**
- Four MySQL roles with least-privilege GRANTs: `hd_operator`, `hd_specialist`, `hd_analyst`, `hd_admin`. The app connects as a restricted user, never root.
- bcrypt (cost 12); passwords never stored or logged in plain text.
- JWT with role claim; RBAC middleware on every protected route.
- Parameterised queries throughout.
- Helmet, CORS allowlist, rate limit on login, generic auth errors (no user enumeration).
- `.env` gitignored; `.env.example` documents the variables.

**Maintenance**
- `backup.sh` (timestamped `mysqldump`) and `restore.sh`, with one verified backup→restore cycle captured as evidence.
- Index justification: `EXPLAIN` before and after on the two heaviest report queries, output saved to evidence.

---

## 4. Application

### 4.1 API

```
POST /api/auth/login          GET /api/auth/me

CRUD /api/employees  /api/equipment  /api/problem-types   # problem-types has a tree endpoint
GET  /api/departments  /api/job-titles  /api/equipment-types  /api/software  /api/staff

GET   /api/problems                     # filter: status, type, caller, equipment, dates
POST  /api/problems                     # → sp_log_new_call
GET   /api/problems/:id                 # includes full call history
POST  /api/problems/:id/calls           # follow-up call
PATCH /api/problems/:id/type            # reclassification
POST  /api/problems/:id/assign          # → sp_assign_least_loaded, manual override allowed
POST  /api/problems/:id/resolve         # → sp_resolve_problem

GET /api/lookup/caller/:employeeId      # ID, job title, department
GET /api/lookup/equipment/:serial       # type, make, assigned user, licence validity
GET /api/knowledge/similar?problemTypeId=   # previous problems of same type + resolutions
GET /api/knowledge/by-equipment/:id
GET /api/knowledge/by-caller/:id

GET /api/reports/{open-by-age|specialist-workload|equipment-failures|type-frequency}
```

Every route: authenticated, role-checked, Zod-validated, central error handler returning `{ error: { code, message, fields? } }`.

Reference data not listed as CRUD is seeded and maintained in SQL — the interface criterion is about evidencing a working UI with validation, not an admin panel for thirteen tables.

### 4.2 Screens

Seven screens. Six trace to a line in the brief; Login and Admin are justified by the criteria rather than the scenario, and that reasoning goes in the evaluation report.

| Screen | Role | Justification |
|---|---|---|
| Login | all | M2 system security — roles are meaningless without authentication |
| Log a Call | operator | Brief: caller/operator/time/serial logged, registers checked, licence validated, problem number issued, notes and reason recorded, problem type allocated. Caller lookup auto-fills ID/job/department; serial lookup auto-fills type/make and shows licence validity; cascading problem-type picker; problem number displayed prominently on submit for the operator to read back |
| Problem List | operator, specialist | Brief: "log and **track** the helpdesk queries". Filter, sort, paginate. Each role lands here on login, pre-filtered to their own work |
| Problem Detail | operator, specialist | Brief: problem type "may be altered later"; resolution date/time, how resolved, time taken. Call history, reclassify, add follow-up call, resolve — plus the escalation modal below |
| — escalation modal | operator | Brief: look up which specialist to refer to, general-type fallback, current load shown so the least loaded is allocated. A modal on Problem Detail, not a separate page — escalation is an action on a problem already open in front of you |
| Knowledge Lookup | operator | Brief: look up previous problems of the same type, same equipment, or same caller, and how they were resolved |
| Reports | analyst, admin | Brief: analysts see equipment performance, specialist resourcing, training needs. The four views with date filters |
| Admin | admin | P2 evidence of interface + data validation. The brief presupposes a personnel register, equipment register and problem-type list but never says who maintains them. CRUD for employees, equipment and problem types only |

No dashboard. Nothing in the scenario asks for one and no criterion rewards it — each role lands directly on the screen they work in.

### 4.3 Validation

Three levels, all demonstrable. Pick three fields (serial number format, email, date ordering) and evidence each rejecting bad input: client-side in the browser, server-side via curl with the client bypassed, database-level via direct SQL with the server bypassed. Most submissions only show the first.

---

## 5. Build order

Database complete and verified → backend → frontend → security hardening and maintenance scripts → evidence and documentation.

Capture evidence during the build, not after. Screenshot every screen, every validation rejection, every `EXPLAIN`, the backup run — into `docs/evidence/` with consistent filenames. Reconstructing evidence at the end is where these assignments lose marks.
