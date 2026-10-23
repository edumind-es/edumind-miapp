#!/bin/bash
#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# EDUmind MiApp - Database Backup Script
# Cron: 0 3 * * * /var/www/edumind_miapp/backend/scripts/backup_db.sh
#

set -e

# Configuration
APP_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${APP_DIR}/backend"
BACKUP_DIR="/var/www/edumind_miapp/backend/backups"
ENV_FILE="${BACKEND_DIR}/.env"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if not exists
mkdir -p "${BACKUP_DIR}"

if [ ! -f "${ENV_FILE}" ]; then
    echo "❌ Environment file not found: ${ENV_FILE}"
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

DATABASE_URL="${DATABASE_URL:-sqlite:///./edumind.db}"
LIBPQ_DATABASE_URL="${DATABASE_URL/postgresql+psycopg:\/\//postgresql://}"
LIBPQ_DATABASE_URL="${LIBPQ_DATABASE_URL/postgresql+psycopg2:\/\//postgresql://}"

parse_postgres_url() {
    local stripped auth host_db host_port
    stripped="${LIBPQ_DATABASE_URL#postgresql://}"
    auth="${stripped%@*}"
    host_db="${stripped#*@}"
    host_port="${host_db%%/*}"
    DB_NAME="${host_db#*/}"
    DB_USER="${auth%%:*}"
    DB_PASSWORD="${auth#*:}"
    DB_HOST="${host_port%%:*}"
    DB_PORT="${host_port##*:}"
    if [[ "${DB_HOST}" == "${host_port}" ]]; then
        DB_PORT="5432"
    fi
}

find_postgres_container() {
    docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | \
        awk -v port="${DB_PORT}" '$0 ~ ("127.0.0.1:" port "->5432/tcp") {print $1; exit}'
}

if [[ "${DATABASE_URL}" == sqlite:///* ]]; then
    DB_PATH="${DATABASE_URL#sqlite:///}"
    if [[ "${DB_PATH}" != /* ]]; then
        DB_PATH="${BACKEND_DIR}/${DB_PATH#./}"
    fi
    BACKUP_FILE="${BACKUP_DIR}/edumind_${TIMESTAMP}.db"

    if [ ! -f "${DB_PATH}" ]; then
        echo "❌ Database file not found: ${DB_PATH}"
        exit 1
    fi

    echo "📦 Creating SQLite backup: ${BACKUP_FILE}"
    sqlite3 "${DB_PATH}" ".backup '${BACKUP_FILE}'"
elif [[ "${DATABASE_URL}" == postgresql* ]]; then
    BACKUP_FILE="${BACKUP_DIR}/edumind_${TIMESTAMP}.sql"

    parse_postgres_url

    echo "📦 Creating PostgreSQL backup: ${BACKUP_FILE}"
    DB_CONTAINER="$(find_postgres_container || true)"
    if [[ -n "${DB_CONTAINER}" ]]; then
        docker exec -e PGPASSWORD="${DB_PASSWORD}" "${DB_CONTAINER}" \
            pg_dump -U "${DB_USER}" "${DB_NAME}" > "${BACKUP_FILE}"
    else
        if ! command -v pg_dump >/dev/null 2>&1; then
            echo "❌ pg_dump not found in PATH"
            exit 1
        fi
        pg_dump "${LIBPQ_DATABASE_URL}" > "${BACKUP_FILE}"
    fi
else
    echo "❌ Unsupported DATABASE_URL backend: ${DATABASE_URL}"
    exit 1
fi

echo "🔧 Compressing backup..."
gzip "${BACKUP_FILE}"

# Verify backup was created
if [ -f "${BACKUP_FILE}.gz" ]; then
    SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
    echo "✅ Backup created: ${BACKUP_FILE}.gz (${SIZE})"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Remove old backups (older than RETENTION_DAYS)
echo "🧹 Removing backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" \( -name "edumind_*.db.gz" -o -name "edumind_*.sql.gz" \) -type f -mtime +${RETENTION_DAYS} -delete

# List current backups
echo ""
echo "📁 Current backups:"
ls -lh "${BACKUP_DIR}"/edumind_*.gz 2>/dev/null || echo "No backups found"

echo ""
echo "✅ Backup complete!"
