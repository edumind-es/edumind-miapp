#!/bin/bash

set -euo pipefail

ROOT_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${ROOT_DIR}/backend"
PHASE6_SECRET_KEY=${PHASE6_SECRET_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/edumind-phase6.XXXXXX")
PHASE6_FULL_TEST_DB="${TMP_DIR}/test_phase6_full.db"

cleanup() {
    rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

echo "==> Verificando fases acumuladas 0-5"
"${ROOT_DIR}/scripts/phase5_verify.sh"

echo "==> Verificando backend completo con FASE 6"
cd "${BACKEND_DIR}"
env -u DEBUG \
    PYTHONPATH=. \
    SECRET_KEY="${PHASE6_SECRET_KEY}" \
    RUNTIME_ENV=development \
    DATABASE_URL="sqlite:///${PHASE6_FULL_TEST_DB}" \
    DB_AUTO_CREATE=true \
    DB_MANAGED_BY_ALEMBIC=false \
    DB_ENABLE_SQLITE_WAL=false \
    ./.venv/bin/pytest -q

echo "==> Verificando migration runtime y config de auth"
env -u DEBUG PYTHONPATH=. ./.venv/bin/python scripts/run_migrations.py current
curl -fsS http://127.0.0.1:8100/api/v1/auth/config >/tmp/edumind_phase6_auth_config.json
python3 - <<'PY'
import json
from pathlib import Path

payload = json.loads(Path("/tmp/edumind_phase6_auth_config.json").read_text())
assert "auth_mode" in payload
assert "local_login_enabled" in payload
assert "sso_enabled" in payload
print("OK  auth config endpoint responde:", payload)
PY
rm -f /tmp/edumind_phase6_auth_config.json

echo "Verificacion FASE 6 completada."
