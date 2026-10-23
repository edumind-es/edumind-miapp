#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${ROOT_DIR}/backend"
ENV_FILE="${BACKEND_DIR}/.env"
REQUESTS="${REQUESTS:-24}"
CONCURRENCY="${CONCURRENCY:-6}"

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ERROR: falta ${ENV_FILE}" >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

LIBPQ_DATABASE_URL="${DATABASE_URL:-}"
LIBPQ_DATABASE_URL="${LIBPQ_DATABASE_URL/postgresql+psycopg:\/\//postgresql://}"
LIBPQ_DATABASE_URL="${LIBPQ_DATABASE_URL/postgresql+psycopg2:\/\//postgresql://}"

echo "== Load smoke local =="

seq "${REQUESTS}" | xargs -I{} -n1 -P"${CONCURRENCY}" curl -fsS http://127.0.0.1:8100/api/v1/health/public >/dev/null
echo "OK  ${REQUESTS} requests concurrentes a health/public"

seq "${REQUESTS}" | xargs -I{} -n1 -P"${CONCURRENCY}" curl -fsS http://127.0.0.1:8100/api/v1/auth/config >/dev/null
echo "OK  ${REQUESTS} requests concurrentes a auth/config"

if [[ -n "${REDIS_URL:-}" ]] && command -v redis-cli >/dev/null 2>&1; then
    redis-cli -u "${REDIS_URL}" PING >/dev/null
    echo "OK  redis responde PING"
else
    echo "OK  smoke redis omitido"
fi

if [[ "${DATABASE_URL:-}" == postgresql* ]] && command -v psql >/dev/null 2>&1; then
    psql "${LIBPQ_DATABASE_URL}" -Atqc "select 1" | grep -qx "1"
    echo "OK  postgres responde select 1"
else
    echo "OK  smoke postgres omitido"
fi

pgrep -f '/var/www/edumind_miapp/backend/scripts/background_task_worker.py' >/dev/null
echo "OK  background worker presente"

pgrep -f '/var/www/edumind_miapp/backend/scripts/training_worker.py' >/dev/null
echo "OK  training worker presente"

echo "Load smoke local OK"
