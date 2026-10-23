#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${APP_DIR}/backend"
ENV_FILE="${BACKEND_DIR}/.env"
BACKUP_FILE=""
DRY_RUN=0
FORCE=0
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

usage() {
    cat <<'EOF'
Uso:
  restore_db.sh --backup-file <ruta> [--dry-run]
  restore_db.sh --backup-file <ruta> --force

Opciones:
  --backup-file   fichero .sql, .sql.gz, .db o .db.gz a restaurar
  --dry-run       valida compatibilidad sin tocar la base de datos
  --force         ejecuta una restauracion destructiva sobre la base configurada
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --backup-file)
            BACKUP_FILE="${2:-}"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        --force)
            FORCE=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "ERROR: argumento no reconocido: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

if [[ -z "${BACKUP_FILE}" ]]; then
    echo "ERROR: debes indicar --backup-file" >&2
    usage >&2
    exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ERROR: falta ${ENV_FILE}" >&2
    exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
    echo "ERROR: backup no encontrado: ${BACKUP_FILE}" >&2
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
echo "== Restore DB =="
echo "Backup: ${BACKUP_FILE}"
echo "Backend: ${DATABASE_URL%%:*}"

if [[ "${BACKUP_FILE}" == *.sql || "${BACKUP_FILE}" == *.sql.gz ]]; then
    BACKUP_KIND="postgres"
elif [[ "${BACKUP_FILE}" == *.db || "${BACKUP_FILE}" == *.db.gz ]]; then
    BACKUP_KIND="sqlite"
else
    echo "ERROR: formato de backup no soportado" >&2
    exit 1
fi

if [[ "${DATABASE_URL}" == sqlite:///* ]]; then
    TARGET_KIND="sqlite"
else
    TARGET_KIND="postgres"
fi

if [[ "${BACKUP_KIND}" != "${TARGET_KIND}" ]]; then
    echo "ERROR: el backup ${BACKUP_KIND} no coincide con la base configurada ${TARGET_KIND}" >&2
    exit 1
fi

if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "OK  dry-run valido para ${TARGET_KIND}"
    exit 0
fi

if [[ "${FORCE}" -ne 1 ]]; then
    echo "ERROR: restaurar requiere --force" >&2
    exit 1
fi

if [[ "${TARGET_KIND}" == "sqlite" ]]; then
    DB_PATH="${DATABASE_URL#sqlite:///}"
    if [[ "${DB_PATH}" != /* ]]; then
        DB_PATH="${BACKEND_DIR}/${DB_PATH#./}"
    fi

    if [[ -f "${DB_PATH}" ]]; then
        cp "${DB_PATH}" "${DB_PATH}.restore-pre-${TIMESTAMP}"
        echo "OK  copia previa creada en ${DB_PATH}.restore-pre-${TIMESTAMP}"
    fi

    if [[ "${BACKUP_FILE}" == *.gz ]]; then
        gzip -dc "${BACKUP_FILE}" > "${DB_PATH}"
    else
        cp "${BACKUP_FILE}" "${DB_PATH}"
    fi
    echo "Restore SQLite completado"
    exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
    if ! command -v docker >/dev/null 2>&1; then
        echo "ERROR: ni psql ni docker estan disponibles" >&2
        exit 1
    fi
fi

parse_postgres_url
DB_CONTAINER="$(find_postgres_container || true)"
if [[ -n "${DB_CONTAINER}" ]]; then
    docker exec -e PGPASSWORD="${DB_PASSWORD}" "${DB_CONTAINER}" \
        psql -v ON_ERROR_STOP=1 -U "${DB_USER}" "${DB_NAME}" \
        -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
    if [[ "${BACKUP_FILE}" == *.gz ]]; then
        gzip -dc "${BACKUP_FILE}" | docker exec -i -e PGPASSWORD="${DB_PASSWORD}" "${DB_CONTAINER}" \
            psql -v ON_ERROR_STOP=1 -U "${DB_USER}" "${DB_NAME}"
    else
        docker exec -i -e PGPASSWORD="${DB_PASSWORD}" "${DB_CONTAINER}" \
            psql -v ON_ERROR_STOP=1 -U "${DB_USER}" "${DB_NAME}" < "${BACKUP_FILE}"
    fi
else
    psql "${LIBPQ_DATABASE_URL}" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
    if [[ "${BACKUP_FILE}" == *.gz ]]; then
        gzip -dc "${BACKUP_FILE}" | psql "${LIBPQ_DATABASE_URL}" -v ON_ERROR_STOP=1
    else
        psql "${LIBPQ_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${BACKUP_FILE}"
    fi
fi
echo "Restore PostgreSQL completado"
