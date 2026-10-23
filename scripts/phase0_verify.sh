#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PYTEST_BIN="$BACKEND_DIR/.venv/bin/pytest"
PHASE0_SECRET_KEY=${PHASE0_SECRET_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/edumind-phase0.XXXXXX")
TMP_DB="$TMP_DIR/test_phase0_verify.db"

cleanup() {
    rm -rf "$TMP_DIR"
}

trap cleanup EXIT

if [[ ! -x "$PYTEST_BIN" ]]; then
    echo "Pytest no disponible en $PYTEST_BIN"
    exit 1
fi

echo "[1/3] Backend tests"
(
    cd "$BACKEND_DIR"
    env -u DEBUG \
        PYTHONPATH=. \
        SECRET_KEY="$PHASE0_SECRET_KEY" \
        RUNTIME_ENV=development \
        DATABASE_URL="sqlite:///$TMP_DB" \
        DB_AUTO_CREATE=true \
        DB_MANAGED_BY_ALEMBIC=false \
        DB_ENABLE_SQLITE_WAL=false \
        "$PYTEST_BIN" -q
)

echo ""
echo "[2/3] Frontend lint"
(
    cd "$FRONTEND_DIR"
    npm run lint
)

echo ""
echo "[3/3] Frontend build"
(
    cd "$FRONTEND_DIR"
    npm run build
)

echo ""
echo "Verificacion FASE 0 completada."
