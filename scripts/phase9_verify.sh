#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
PHASE9_SECRET_KEY=${PHASE9_SECRET_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/edumind-phase9.XXXXXX")
PHASE9_TEST_DB="${TMP_DIR}/test_phase9.db"
PHASE9_PROM="${TMP_DIR}/metrics.prom"

cleanup() {
    rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

echo "== FASE 9 verify =="

"${ROOT_DIR}/scripts/phase8_verify.sh"

cd "${BACKEND_DIR}"
env -u DEBUG \
    PYTHONPATH=. \
    SECRET_KEY="${PHASE9_SECRET_KEY}" \
    RUNTIME_ENV=development \
    DATABASE_URL="sqlite:///${PHASE9_TEST_DB}" \
    DB_AUTO_CREATE=true \
    DB_MANAGED_BY_ALEMBIC=false \
    DB_ENABLE_SQLITE_WAL=false \
    ./.venv/bin/pytest -q tests/test_api.py tests/test_normative_and_telemetry.py tests/test_metrics_service.py
echo "OK  backend observability tests"

curl -fsS http://127.0.0.1:8100/api/v1/health/public >/dev/null
echo "OK  health/public local"

curl -fsS http://127.0.0.1:8100/api/v1/health/dependencies >/dev/null
echo "OK  health/dependencies local"

curl -fsS http://127.0.0.1:8100/api/v1/health/internal >/dev/null
echo "OK  health/internal local"

curl -fsS http://127.0.0.1:8100/api/v1/metrics/prometheus > "${PHASE9_PROM}"
grep -q 'edumind_uptime_seconds' "${PHASE9_PROM}"
grep -q 'edumind_navigation_invalid_by_referrer_total' "${PHASE9_PROM}"
echo "OK  metrics/prometheus expone series observables"

"${ROOT_DIR}/scripts/synthetic_edge_checks.sh"

cd "${FRONTEND_DIR}"
npm run lint >/dev/null
echo "OK  npm run lint"

npm run build >/dev/null
echo "OK  npm run build"

echo "FASE 9 verificada"
