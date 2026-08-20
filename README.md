# Manzaneque Limited — IT Helpdesk Management System

Coursework build. See `ARCHITECTURE.md` for the full design and `PROGRESS.md` for build
status and assumptions made where the brief was silent.

## Prerequisites

Pick **one** path.

- **Docker path**: Docker Desktop (or Docker Engine + Compose plugin). Nothing else.
- **Local path**: MySQL 8.0 and Node.js 20+.

## 1. Configure environment

```bash
cp .env.example .env
```

Defaults work as-is for both paths. If you change `MYSQL_ROOT_PASSWORD` or `DB_APP_PASSWORD`,
see the note in `db/06_roles.sql` — that script only runs automatically on the database
container's *first* initialisation, so a later `.env` edit alone will not update the
`hd_app` MySQL user's password; re-run `06_roles.sql`'s `CREATE USER`/`ALTER USER` by hand
against the running database if you change it after first boot.

## 2. Docker path (recommended)

```bash
docker compose up --build
```

This starts four containers:

| Service | URL | Purpose |
|---|---|---|
| `db` | `localhost:3306` | MySQL 8.0. `./db/*.sql` runs automatically on first init, in filename order (schema → indexes → views → procedures → triggers → roles → seed). |
| `adminer` | http://localhost:8080 | Browse the database. Server: `db`, matching credentials from `.env`. |
| `server` | http://localhost:4000 | The API. `GET /api/health` should return `{"status":"ok"}`. |
| `web` | http://localhost:5173 | The React app. |

First boot takes longer while MySQL initialises and runs the seed scripts — `server` waits
for the database healthcheck before starting. Open http://localhost:5173 once it's up.

To reset entirely (drop all data and re-seed from scratch):

```bash
docker compose down -v
docker compose up --build
```

## 3. Local path (MySQL + Node, no Docker)

```bash
# 1. Create the database and run the SQL in order (root/admin privileges needed
#    for 06_roles.sql, which creates the hd_app user and roles).
mysql -u root -p -e "CREATE DATABASE manzaneque_helpdesk"
mysql -u root -p manzaneque_helpdesk < db/01_schema.sql
mysql -u root -p manzaneque_helpdesk < db/02_indexes.sql
mysql -u root -p manzaneque_helpdesk < db/03_views.sql
mysql -u root -p manzaneque_helpdesk < db/04_procedures.sql
mysql -u root -p manzaneque_helpdesk < db/05_triggers.sql
mysql -u root -p manzaneque_helpdesk < db/06_roles.sql
mysql -u root -p manzaneque_helpdesk < db/07_seed.sql

# or, equivalently, all at once:
mysql -u root -p manzaneque_helpdesk < db/dump.sql

# 2. Backend
cd server && npm install && npm start   # http://localhost:4000

# 3. Frontend (separate terminal)
cd client && npm install && npm run dev # http://localhost:5173
```

`.env`'s `DB_HOST=localhost` / `DB_PORT=3306` already target a local MySQL install — no
changes needed for this path (the Docker path overrides these two at the container level;
see `docker-compose.yml`).

## Logging in

Every seed account uses the password **`Password123!`**. Usernames:

| Role | Usernames |
|---|---|
| Operator | `operator1` … `operator6` |
| Specialist | `specialist1` … `specialist5` |
| Analyst | `analyst1` |
| Admin | `admin1` |

Each role lands directly on the screen it works in — there is no dashboard (see
`ARCHITECTURE.md` §4.2).

## Regenerating seed data

`db/07_seed.sql` is generated, not hand-written:

```bash
node db/seed_generator/generate_seed.js
```

Deterministic (fixed PRNG seed) — re-running reproduces the file byte-for-byte. If you
change the schema or the generator, regenerate `db/dump.sql` too:

```bash
cat db/0[1-7]_*.sql > db/dump.sql
```

## Database maintenance

```bash
db/maintenance/backup.sh                    # timestamped mysqldump -> db/maintenance/backups/
db/maintenance/restore.sh <path-to-backup>   # restore a backup
```

Both scripts detect whether the Docker `db` container is running and target it, or fall
back to `.env`'s `DB_HOST`/`DB_PORT` for a local install.

## Running the query set (P3 evidence)

The seven standalone queries in `db/queries/` are meant to be run and inspected individually
against the seeded database, e.g.:

```bash
mysql -u root -p manzaneque_helpdesk < db/queries/01_resolved_problems_multitable_inner_join.sql
```

## Project layout

See `ARCHITECTURE.md` §2 for the full repository structure and §4.1 for the API surface.

## Security notes (M2)

- The app connects to MySQL as the restricted `hd_app` user (see `db/06_roles.sql`), never
  root. Four least-privilege MySQL roles back the API's own RBAC middleware as defence in
  depth.
- Passwords are hashed with bcrypt (cost 12) and never logged or returned by any endpoint.
- JWT-authenticated; every protected route is role-checked
  (`server/src/middleware/rbac.js`) and Zod-validated on input.
- Helmet, a CORS allowlist (`CORS_ORIGIN`), and a rate limit on `/api/auth/login` (10
  attempts / 15 min / IP) are applied globally — see `server/src/app.js`.
- All SQL is parameterised — no string-concatenated queries anywhere, including the seed
  generator.
