#!/bin/bash

set -euo pipefail

ROOT_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${ROOT_DIR}/backend"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/edumind-phase5.XXXXXX")
TMP_MIGRATION_DB="${TMP_DIR}/test_phase5_migrations.db"
PHASE5_SECRET_KEY=${PHASE5_SECRET_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}
PHASE5_BACKGROUND_WORKER_UNIT=${PHASE5_BACKGROUND_WORKER_UNIT:-edumind-miapp-background-worker.service}

cleanup() {
    rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

echo "==> Verificando fases acumuladas 0-4"
"${ROOT_DIR}/scripts/phase4_verify.sh"

echo "==> Verificando lifecycle de migraciones hasta head"
cd "${BACKEND_DIR}"
env -u DEBUG \
    PYTHONPATH=. \
    SECRET_KEY="${PHASE5_SECRET_KEY}" \
    RUNTIME_ENV=development \
    DATABASE_URL="sqlite:///${TMP_MIGRATION_DB}" \
    DB_AUTO_CREATE=false \
    DB_MANAGED_BY_ALEMBIC=true \
    DB_ENABLE_SQLITE_WAL=false \
    ./.venv/bin/python scripts/run_migrations.py upgrade head
env -u DEBUG \
    PYTHONPATH=. \
    SECRET_KEY="${PHASE5_SECRET_KEY}" \
    RUNTIME_ENV=development \
    DATABASE_URL="sqlite:///${TMP_MIGRATION_DB}" \
    DB_AUTO_CREATE=false \
    DB_MANAGED_BY_ALEMBIC=true \
    DB_ENABLE_SQLITE_WAL=false \
    ./.venv/bin/python scripts/run_migrations.py downgrade base
env -u DEBUG \
    PYTHONPATH=. \
    SECRET_KEY="${PHASE5_SECRET_KEY}" \
    RUNTIME_ENV=development \
    DATABASE_URL="sqlite:///${TMP_MIGRATION_DB}" \
    DB_AUTO_CREATE=false \
    DB_MANAGED_BY_ALEMBIC=true \
    DB_ENABLE_SQLITE_WAL=false \
    ./.venv/bin/python scripts/run_migrations.py upgrade head

echo "==> Verificando revision runtime y worker de background"
env -u DEBUG PYTHONPATH=. ./.venv/bin/python scripts/run_migrations.py current
if systemctl --user list-unit-files 2>/dev/null | grep -q "${PHASE5_BACKGROUND_WORKER_UNIT}"; then
    systemctl --user is-active --quiet "${PHASE5_BACKGROUND_WORKER_UNIT}"
    echo "OK  background worker activo: ${PHASE5_BACKGROUND_WORKER_UNIT}"
else
    echo "Aviso: ${PHASE5_BACKGROUND_WORKER_UNIT} no está instalado en este usuario."
fi

echo "Verificacion FASE 5 completada."
