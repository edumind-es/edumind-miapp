#!/bin/bash

set -euo pipefail

ROOT_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${ROOT_DIR}/backend"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/edumind-phase4.XXXXXX")
TMP_MIGRATION_DB="${TMP_DIR}/test_phase4_migrations.db"
PHASE4_SECRET_KEY=${PHASE4_SECRET_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}
PHASE4_TARGET_REVISION=${PHASE4_TARGET_REVISION:-20260405_0002}

cleanup() {
    rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

echo "==> Verificando fases acumuladas 0-3"
"${ROOT_DIR}/scripts/phase3_verify.sh"

echo "==> Verificando lifecycle de migraciones en SQLite efimera"
cd "${BACKEND_DIR}"
env -u DEBUG \
    PYTHONPATH=. \
    SECRET_KEY="${PHASE4_SECRET_KEY}" \
    RUNTIME_ENV=development \
    DATABASE_URL="sqlite:///${TMP_MIGRATION_DB}" \
    DB_AUTO_CREATE=false \
    DB_MANAGED_BY_ALEMBIC=true \
    DB_ENABLE_SQLITE_WAL=false \
    ./.venv/bin/python scripts/run_migrations.py upgrade "${PHASE4_TARGET_REVISION}"
env -u DEBUG \
    PYTHONPATH=. \
    SECRET_KEY="${PHASE4_SECRET_KEY}" \
    RUNTIME_ENV=development \
    DATABASE_URL="sqlite:///${TMP_MIGRATION_DB}" \
    DB_AUTO_CREATE=false \
    DB_MANAGED_BY_ALEMBIC=true \
    DB_ENABLE_SQLITE_WAL=false \
    ./.venv/bin/python scripts/run_migrations.py downgrade base
env -u DEBUG \
    PYTHONPATH=. \
    SECRET_KEY="${PHASE4_SECRET_KEY}" \
    RUNTIME_ENV=development \
    DATABASE_URL="sqlite:///${TMP_MIGRATION_DB}" \
    DB_AUTO_CREATE=false \
    DB_MANAGED_BY_ALEMBIC=true \
    DB_ENABLE_SQLITE_WAL=false \
    ./.venv/bin/python scripts/run_migrations.py upgrade "${PHASE4_TARGET_REVISION}"

echo "==> Verificando revision actual en PostgreSQL runtime"
env -u DEBUG PYTHONPATH=. ./.venv/bin/python scripts/run_migrations.py current

echo "Verificacion FASE 4 completada."
