# Progress

Resume point for a fresh session: read this, then `ARCHITECTURE.md` and `CLAUDE.md`.

## Environment note

The build environment has neither Docker nor a MySQL client installed, so SQL has been
written and hand-reviewed for MySQL 8.0 correctness but **not executed**. Execution and the
Phase 3 checkpoint output (row counts, query results) depend on the user running
`docker-compose up` (or a local MySQL + the scripts) and reporting back, or granting access
to an environment where this session can run MySQL directly.

## Assumptions in force (ARCHITECTURE.md was silent on these)

1. `problem.equipment_id` is `NOT NULL` — every problem ties to a specific equipment item,
   consistent with Log a Call being built around serial lookup.
2. There is no separate `problem_number` column. The problem's number *is* `problem_id`,
   displayed to the operator as `PR-{id:06d}` (see `sp_log_new_call`'s `p_problem_number` OUT
   param, which just formats the PK).
3. `CLOSED` status has no app-driven transition into it (no endpoint transitions a problem to
   CLOSED) — it exists in the ENUM and will appear in seed data only, representing tickets
   archived after the app's tracked lifecycle. `IN_PROGRESS` is likewise not automated by any
   trigger or procedure; `sp_assign_least_loaded` sets `ASSIGNED`, `sp_resolve_problem` sets
   `RESOLVED` directly. Seed data will include some `IN_PROGRESS` rows for realism only.
4. Seeded 13 `helpdesk_staff` rows, not the 12 itemised in §3.7 (6 operators, 5 specialists,
   1 analyst) — added one `ADMIN` account (`employee_id` 13), since the Admin screen/role in
   §4.2 needs a working login and none was allocated in the volume count.

## Phase 3 output (seed + queries)

Seed data is **generated**, not hand-written: `db/seed_generator/generate_seed.js` is a
deterministic Node script (fixed PRNG seed `20260220`) that writes `db/07_seed.sql`. Re-running
it reproduces the file byte-for-byte. Row counts from the last generation:

| Table | Rows |
|---|---|
| department | 6 |
| job_title | 12 |
| employee | 45 |
| equipment_type | 8 |
| equipment | 70 |
| software | 15 |
| software_licence | 90 |
| problem_type | 22 |
| helpdesk_staff | 13 (see assumption 4) |
| specialist_expertise | 20 |
| problem | 250 (18 OPEN / 11 ASSIGNED / 8 IN_PROGRESS / 33 RESOLVED / 180 CLOSED) |
| call_log | 448 |
| audit_log | 0 (trigger-populated only; INSERT does not fire AFTER UPDATE) |

Fallback and least-loaded logic: the generator contains a JS mirror of
`fn_find_specialist`/`sp_assign_least_loaded` (same walk-up-the-hierarchy, same
fewest-open-problems-then-earliest-last-assignment tie-break) so the seed data's
`assigned_staff_id` values are internally consistent with what the real SQL routines should
produce. Two deliberate no-specialist-at-this-level branches are seeded to exercise the
fallback: `problem_type_id 19` ("Screen Damage", 1-level fallback to parent `6` "Laptop
Issues") and `problem_type_id 22` ("Account Locked", 2-level fallback to root `4` "Account &
Access"). Confirmed by inspection of the generated SQL: problems of type 19 are assigned to
staff 7 (who covers type 6), problems of type 22 are assigned to staff 11 (who covers type 4).

**This is evidence the algorithm is internally consistent, not proof the live MySQL
`fn_find_specialist`/`sp_assign_least_loaded` produce the same result** — that requires
actually running them, which this environment cannot do (see Environment note above).

Seven queries in `db/queries/`, covering: multi-table INNER JOIN (6 tables), multi-table LEFT
JOIN (6 tables), GROUP BY + HAVING, a correlated subquery, `WITH RECURSIVE` (a second,
independent recursive walk — top-down tree rendering — distinct from `fn_find_specialist`'s
bottom-up walk), a LEFT-JOIN licence-validity query, and an UPDATE/DELETE pair demonstrating
CASCADE (software_licence) vs RESTRICT (problem) referential actions.

- [x] Phase 1 — Scaffold and schema (`db/01_schema.sql`, `db/02_indexes.sql`) — committed
- [x] Phase 2 — Routines and roles (`db/03_views.sql`, `db/04_procedures.sql`,
      `db/05_triggers.sql`, `db/06_roles.sql`) — committed
- [x] Phase 3 — Seed data and queries — SQL written and generator-verified; **awaiting
      user's live-DB run for the actual checkpoint proof**
- [x] Phase 4 — Backend foundation — Express app, JWT auth, RBAC middleware, Zod
      validation, central error handler, connection pool against `hd_app` — committed
- [x] Phase 5 — Reference data and lookups — departments/job-titles/equipment-types/
      software/staff reads, employee/equipment/problem-type CRUD, caller/equipment
      lookup for Log a Call — committed
- [x] Phase 6 — Problem workflow and reports — `sp_log_new_call`/`sp_assign_least_loaded`/
      `sp_resolve_problem` wired end-to-end, knowledge lookup, four report endpoints over
      the views — **CHECKPOINT — awaiting live-DB verification, see below**
- [x] Phase 7 — Frontend — seven screens (Login, Log a Call, Problem List, Problem Detail
      + escalation modal, Knowledge Lookup, Reports, Admin), React Router, role-gated nav
      — committed; client builds clean (`npm run build`)
- [x] Phase 8 — Hardening, maintenance, packaging — Helmet/CORS allowlist/login rate
      limit already in Phase 4; added `db/maintenance/{backup,restore}.sh`, `db/dump.sql`
      (concatenated 01–07, regenerate via `cat db/0[1-7]_*.sql > db/dump.sql`), Dockerfiles
      for `server`/`client`, `docker-compose.yml` extended with `server`+`web` services,
      root `README.md` — **FINAL CHECKPOINT — awaiting live-DB and browser verification,
      see below**

## What is verified vs. not (this environment has no Docker and no MySQL client)

Verified in this session:
- `server` boots cleanly (`node src/app.js` loads with no errors) and its HTTP layer works
  correctly *without* a database: health check, 401 on missing auth, 400 with field errors
  on bad login body, and RBAC/validation middleware ordering, all checked with live `curl`
  requests against a running instance.
- `client` installs and `npm run build` produces a clean production bundle with no
  compile/import errors.
- The seed password hash (`db/seed_generator/generate_seed.js`) verifies against
  `bcryptjs.compare('Password123!', hash)` — login will work once the seed data is loaded.
- `docker compose config` was **not** run (no Docker in this environment) — the compose
  file, both Dockerfiles and `client/nginx.conf` are hand-reviewed but not executed.

**Not verified — needs the user to run it**: every endpoint that touches MySQL (all of
Phase 5/6's actual behaviour), the full `docker compose up --build` path end-to-end, and
the app in a browser (README §"Logging in" walks through all four roles). This is the same
gap noted for Phase 3 — nothing in Phases 4–8 changes that; it compounds it, since the
whole backend is now new code that has only been syntax/route-checked, never run against
real rows.

## Suggested verification pass (for whoever has Docker/MySQL)

1. `docker compose up --build`, wait for `server` to report listening.
2. Log in as `operator1` / `Password123!`, log a call end-to-end (caller lookup, serial
   lookup showing licence validity, cascading problem-type picker, submit, read back the
   problem number).
3. Log in as `operator1` again on a fresh/unassigned problem, escalate via the modal —
   confirm it lands on the seeded no-specialist-at-this-level fallback cases (problem types
   19 and 22, per the Phase 3 seed notes above) and assigns correctly.
3a. As `specialist1..5`, confirm the Problem List defaults to that specialist's own
   `ASSIGNED` queue, and resolve a problem.
4. As `analyst1`, check all four report tabs render and the open-by-age date filter works.
5. As `admin1`, CRUD an employee, an equipment item and a problem type; confirm deleting a
   referenced row 409s (FK RESTRICT) rather than 500ing.
6. `db/maintenance/backup.sh` then `restore.sh` against the backup it produces — capture
   both as evidence per ARCHITECTURE.md §3.8.
7. `EXPLAIN` the two heaviest report queries before/after `db/02_indexes.sql`'s indexes —
   this still needs a live database and has not been done in any session so far.

## Design notes for whoever resumes

- Schema: 13 tables per §3.1, FK actions per §3.2 (RESTRICT reference data, SET NULL optional
  assignment, CASCADE dependent detail).
- `fn_find_specialist` uses `WITH RECURSIVE` walking `parent_type_id` upward from the given
  type (depth 0 = itself), returning the shallowest ancestor (including itself) that has at
  least one active specialist in `specialist_expertise`.
- `sp_assign_least_loaded` calls `fn_find_specialist`, then ranks qualified specialists by
  open (`ASSIGNED`/`IN_PROGRESS`) problem count ascending, ties broken by earliest last
  assignment (`MAX(logged_at)` among their open problems, ascending — i.e. whoever has gone
  longest without a fresh assignment among the tied group). If no ancestor type has a
  specialist, `p_assigned_staff_id` is set NULL and the problem is left unassigned/OPEN — the
  API layer should surface this so the operator can escalate manually.
- Triggers: `trg_problem_before_update` derives `minutes_to_resolve`; `trg_problem_after_update`
  writes `audit_log` rows for status/type/assignment changes.
- Roles: `hd_operator`, `hd_specialist`, `hd_analyst`, `hd_admin` (least privilege), all
  granted to the single `hd_app` connection user. MySQL-level privilege is defence in depth;
  the API's own RBAC middleware (Phase 4) is the primary enforcement point.
- `db/06_roles.sql`'s `hd_app` password is a placeholder (`change_me_app`) that must match
  `.env`'s `DB_APP_PASSWORD`.
