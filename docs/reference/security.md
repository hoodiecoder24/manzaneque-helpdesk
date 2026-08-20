# Security reference

Source: `db/06_roles.sql`, `server/src/app.js`, `server/src/middleware/`, `server/src/controllers/auth.controller.js`, `server/src/services/auth.service.js`.

## MySQL roles

Four roles exist at the database level, created with `CREATE ROLE hd_operator, hd_specialist, hd_analyst, hd_admin`. Each is granted a fixed set of privileges. No person logs in as one of these roles directly. They exist as a second layer of enforcement behind the application's own role check.

### hd_operator

```sql
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
```

Can read most tables and create new problems and call log entries. Cannot update or delete a problem. Cannot resolve a problem, there is no grant to execute `sp_resolve_problem`. Cannot touch helpdesk_staff, specialist_expertise, or audit_log at all, no grant exists for those tables.

### hd_specialist

```sql
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
```

Can update a problem directly (used for reclassification) and read audit_log. Cannot insert a new problem, there is no INSERT grant on the problem table. Cannot touch helpdesk_staff or employee beyond SELECT, no write grants exist for those.

### hd_analyst

```sql
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
```

Read only, across the four reporting views and their source tables. No INSERT, UPDATE, or DELETE grant exists anywhere for this role. Cannot execute any procedure or function, no EXECUTE grant exists for this role.

### hd_admin

```sql
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
```

Gets every grant from hd_operator, hd_specialist, and hd_analyst by role membership, plus full CRUD on the tables the Admin screen manages: employee, equipment, problem_type, department, job_title, equipment_type, software, software_licence, helpdesk_staff, specialist_expertise. No grant gives this role DDL rights such as CREATE or DROP.

## The hd_app connection user

```sql
CREATE USER 'hd_app'@'%' IDENTIFIED BY 'change_me_app';
GRANT hd_operator, hd_specialist, hd_analyst, hd_admin TO 'hd_app'@'%';
SET DEFAULT ROLE ALL TO 'hd_app'@'%';
```

The Express app connects to MySQL as `hd_app`, never as root. This one user holds all four roles at once. The database connection itself is not the layer that decides what a given request can do. That decision is made by the application's RBAC middleware, described below. The MySQL grants exist as a backstop, so that even if the RBAC middleware were bypassed, the database connection still could not, for example, run DDL or read a table no role was granted access to.

The `hd_app` password in `db/06_roles.sql` is a placeholder. It must match `DB_APP_PASSWORD` in `.env`. Changing one without the other breaks the app's database connection.

## Login flow

1. The client sends username and password to `POST /api/auth/login`. This route has no auth requirement and is the only one rate limited, see below.
2. `server/src/validators/auth.validators.js` checks the body with Zod: username 1 to 60 characters, password 1 to 255 characters.
3. `server/src/services/auth.service.js`, `findActiveStaffByUsername`, looks up the row in helpdesk_staff where username matches and is_active is 1.
4. If no row is found, the controller returns 401 with the message "Invalid username or password".
5. If a row is found, `bcrypt.compare` checks the submitted password against `password_hash`. If it does not match, the controller returns the same 401 message as step 4. The two failure cases are deliberately not distinguished, so a caller cannot tell whether a username exists.
6. If the password matches, `jwt.sign` creates a token containing `staffId`, `employeeId`, `username`, and `role`, signed with `JWT_SECRET`, expiring after `JWT_EXPIRES_IN` (default 8 hours).
7. The token and a small user object are returned to the client.

Passwords are hashed with bcrypt at cost 12 (`BCRYPT_COST` in `.env`). The plain password is never stored, logged, or returned by any endpoint.

## RBAC middleware

`server/src/middleware/auth.js`, `requireAuth`, reads the Authorization header, expects the format `Bearer <token>`, and verifies it with `jwt.verify` using `JWT_SECRET`. On success it attaches `req.user = { staffId, employeeId, username, role }`. On any failure, missing header, wrong scheme, expired or invalid token, it returns 401 with the generic message "Authentication required". It does not say which of those reasons caused the failure.

`server/src/middleware/rbac.js`, `requireRole(...roles)`, runs after `requireAuth`. It checks whether `req.user.role` is in the list of roles passed to it. If `req.user` is missing it returns 401. If the role is not in the list it returns 403 with the message "Not permitted for this role".

Every protected route in `server/src/routes/` chains `requireAuth` then `requireRole` with the specific roles that route allows, then any Zod validation, then the controller. The full role list per route is documented in `docs/reference/api.md`.

## Rate limiting

`server/src/middleware/rateLimiter.js`, `loginRateLimiter`, is applied only to `POST /api/auth/login` in `server/src/routes/auth.routes.js`. It allows 10 requests per 15 minutes per IP address. Once exceeded, the route returns 429 with code RATE_LIMITED. No other route is rate limited.

## CORS and Helmet

Both are set up in `server/src/app.js`, before any route is mounted.

```js
app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
```

Helmet is used with its default settings, which set a number of standard security headers. CORS is restricted to a single allowed origin, read from `CORS_ORIGIN` in `.env`. Requests from any other origin are rejected by the browser's CORS check.
