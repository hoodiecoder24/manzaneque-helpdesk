#!/usr/bin/env bash
# restore.sh — restores a backup produced by backup.sh into a running
# database. Usage: db/maintenance/restore.sh <path-to-backup.sql>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ $# -ne 1 ]; then
    echo "Usage: $0 <path-to-backup.sql>" >&2
    exit 1
fi
BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE" >&2
    exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ROOT_DIR/.env"; set +a

if docker compose -f "$ROOT_DIR/docker-compose.yml" ps db >/dev/null 2>&1 && \
   [ "$(docker compose -f "$ROOT_DIR/docker-compose.yml" ps -q db)" != "" ]; then
    docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T db \
        mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" < "$BACKUP_FILE"
else
    mysql -h "$DB_HOST" -P "$DB_PORT" -u root -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" < "$BACKUP_FILE"
fi

echo "Restored $BACKUP_FILE into $DB_NAME"
