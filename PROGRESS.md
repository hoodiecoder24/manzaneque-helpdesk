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
      user's live-DB run for the actual checkpoint proof** before Phase 4 starts
- [ ] Phase 4 — Backend foundation
- [ ] Phase 5 — Reference data and lookups
- [ ] Phase 6 — Problem workflow and reports — **CHECKPOINT**
- [ ] Phase 7 — Frontend
- [ ] Phase 8 — Hardening, maintenance, packaging — **FINAL CHECKPOINT**

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
