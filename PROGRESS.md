# Progress

Resume point for a fresh session: read this, then `ARCHITECTURE.md` and `CLAUDE.md`.

## Environment note (updated — see below, this section is partly historical)

The original build sessions had neither Docker nor a MySQL client installed, so SQL was
written and hand-reviewed for MySQL 8.0 correctness but not executed at first. That gap is
now closed for the local-MySQL path: MySQL 8.0.46 Community Server was installed on the
build machine, all seven `db/0*.sql` scripts were run against it in order, and the app was
exercised live end to end (see "Live-DB verification" below). Docker itself remains
unexercised — Docker Desktop cannot start on this machine because BIOS virtualisation
(Intel VT-x) is disabled, which is a firmware setting outside this session's reach. Anyone
with a working Docker install should still do at least a smoke-test run of that path (see
`docs/TEST_PLAN.md` §5, "What is deliberately not covered").

## Live-DB verification (done)

The database has been run live and the application exercised against it end to end,
across two separate sessions:

- **First pass**: MySQL 8.0.46 installed locally, `.env` configured, all seven `db/0*.sql`
  scripts run in order with zero errors. Row counts after seeding matched the Phase 3 table
  below exactly (45 employees, 70 equipment, 250 problems, 448 call_log, 0 audit_log, etc).
  The server was started against this live database and the full workflow was driven
  through the real HTTP API: login (`operator1`), caller lookup, equipment/licence lookup,
  `sp_log_new_call` (produced `PR-000251`), `sp_assign_least_loaded` (correctly assigned
  staff 11 for problem type 4, matching the seed generator's independent prediction),
  `sp_resolve_problem`, and the `audit_log` trigger (3 rows, matching the 3 tracked field
  changes on that one problem). All four `vw_*` report views returned real, sensible data
  through `GET /api/reports/*`.
- **Second pass**: further manual/browser testing after the first pass added more rows.
  `db/maintenance/backup.sh` was run for real and produced
  `db/maintenance/backups/manzaneque_helpdesk_20260822_130628.sql` (148,106 bytes) — a
  genuine `mysqldump` output, not a placeholder. At the time of that backup, the live
  database held 251 problems, 450 call_log rows, and 3 audit_log rows (250/448/0 seed plus
  the cumulative effect of both testing passes), confirmed by direct SQL row counts, not by
  reading the UI. Every reference/static table (department, job_title, employee,
  equipment_type, equipment, software, software_licence, problem_type, helpdesk_staff,
  specialist_expertise) still matched its exact seeded count.

This supersedes the "awaiting user's live-DB run" language that used to sit against
Phases 3, 6 and 8 below — those phases' checkpoints are now backed by a real run, not just
generator-side self-consistency checks.

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
- [x] Phase 3 — Seed data and queries — SQL written and generator-verified, **now also
      confirmed by a live run** — row counts matched exactly, see "Live-DB verification"
      above
- [x] Phase 4 — Backend foundation — Express app, JWT auth, RBAC middleware, Zod
      validation, central error handler, connection pool against `hd_app` — committed
- [x] Phase 5 — Reference data and lookups — departments/job-titles/equipment-types/
      software/staff reads, employee/equipment/problem-type CRUD, caller/equipment
      lookup for Log a Call — committed
- [x] Phase 6 — Problem workflow and reports — `sp_log_new_call`/`sp_assign_least_loaded`/
      `sp_resolve_problem` wired end-to-end, knowledge lookup, four report endpoints over
      the views — **CHECKPOINT — live-DB verified**, see "Live-DB verification" above
- [x] Phase 7 — Frontend — seven screens (Login, Log a Call, Problem List, Problem Detail
      + escalation modal, Knowledge Lookup, Reports, Admin), React Router, role-gated nav
      — committed; client builds clean (`npm run build`)
- [x] Phase 8 — Hardening, maintenance, packaging — Helmet/CORS allowlist/login rate
      limit already in Phase 4; added `db/maintenance/{backup,restore}.sh`, `db/dump.sql`
      (concatenated 01–07, regenerate via `cat db/0[1-7]_*.sql > db/dump.sql`), Dockerfiles
      for `server`/`client`, `docker-compose.yml` extended with `server`+`web` services,
      root `README.md` — **FINAL CHECKPOINT — live-DB verified, `backup.sh` run for real**,
      see "Live-DB verification" above. Docker path itself still unexercised (see
      Environment note).
- [x] Phase 9 — Testing document (Deliverable 3, P4/M4) — `docs/TEST_PLAN.md` written
      against the actual built schema, validators and routes (not the earlier design
      document); ~100 test cases across authentication/RBAC, three-level validation,
      Log a Call, escalation, resolution, audit, referential integrity, the P3 query set,
      M3 reports, security, maintenance and usability, plus a traceability matrix and an
      M4 test-data-justification section. `docs/evidence/README.md` sets the evidence
      filename convention. Documents one real implementation gap found while writing it:
      `ARCHITECTURE.md` §4.1 describes "manual override" on the escalation endpoint, but
      the built route accepts no staff-selection parameter — see `TEST_PLAN.md` TC-ESC-07.
      **Not yet executed** — the document is the plan; results are filled in by the user
      during the actual test pass.

## What is verified vs. not

Verified, against a live local MySQL 8.0.46 database (see "Live-DB verification" above):
login for at least one account per role, caller/equipment lookup, licence validity display,
`sp_log_new_call`, `sp_assign_least_loaded` (including a real fallback resolution to staff
11), `sp_resolve_problem`, the `trg_problem_before_update`/`trg_problem_after_update`
triggers, all four report views, the restricted `hd_app` connection user, and
`db/maintenance/backup.sh` producing a real dump file. `client` builds cleanly
(`npm run build`) and was driven through the Vite dev server during this testing.

**Still not verified**: the Docker path end-to-end (blocked by this machine's BIOS
virtualisation setting, not by anything in the code — see Environment note), `restore.sh`
(the backup exists but has not yet been restored into a clean database and row-count
checked), `EXPLAIN` plan comparisons with/without `db/02_indexes.sql`, and the bulk of the
Admin CRUD screens (employee/equipment/problem-type create/update/delete, and the
RESTRICT/SET NULL/CASCADE referential-action behaviours specifically). `docs/TEST_PLAN.md`
now has a concrete, numbered test case for every one of these (TC-MNT-02, TC-MNT-03/04,
TC-REF-01 through TC-REF-08) — that document is the path to closing this list, not a
repeat of this section.

## Suggested verification pass

Superseded by `docs/TEST_PLAN.md` — that document is the actual, numbered test plan
(TC-AUTH, TC-VAL, TC-LOG, TC-ESC, TC-RES, TC-AUD, TC-REF, TC-QRY, TC-RPT, TC-SEC, TC-MNT,
TC-USE) and should be used instead of this list from here on. §2 of that document repeats
the environment setup steps in more detail (including how to reset seed data between runs)
and §6 is a traceability matrix confirming nothing here is left uncovered.

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
