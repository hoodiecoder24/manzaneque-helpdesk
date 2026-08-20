#!/usr/bin/env bash
# backup.sh — timestamped mysqldump of the running database (M2 maintenance
# evidence). Run from the repo root: db/maintenance/backup.sh
# Requires the db container (or a local MySQL matching .env) to be up.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
mkdir -p "$BACKUP_DIR"

# shellcheck disable=SC1090
set -a; source "$ROOT_DIR/.env"; set +a

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/manzaneque_helpdesk_${TIMESTAMP}.sql"

if docker compose -f "$ROOT_DIR/docker-compose.yml" ps db >/dev/null 2>&1 && \
   [ "$(docker compose -f "$ROOT_DIR/docker-compose.yml" ps -q db)" != "" ]; then
    docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T db \
        mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --routines --triggers "$DB_NAME" > "$OUT_FILE"
else
    mysqldump -h "$DB_HOST" -P "$DB_PORT" -u root -p"$MYSQL_ROOT_PASSWORD" \
        --routines --triggers "$DB_NAME" > "$OUT_FILE"
fi

echo "Backup written to $OUT_FILE"
