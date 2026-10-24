#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
ENV_FILE="${BACKEND_DIR}/.env"
BACKUP_SCRIPT="${BACKEND_DIR}/scripts/backup_db.sh"
MIGRATIONS_SCRIPT="${BACKEND_DIR}/scripts/run_migrations.py"
PYTHON_BIN="${BACKEND_DIR}/.venv/bin/python"
NGINX_LINK="/etc/nginx/sites-enabled/edumind-ai-pro"
NGINX_LIVE="/etc/nginx/sites-available/edumind-ai-pro"
NGINX_MAINT="/etc/nginx/sites-available/edumind-ai-pro-mantenimiento"
PHASE10_SECRET_KEY="${PHASE10_SECRET_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"

echo "== FASE 10 preflight =="

for required in "${ROOT_DIR}" "${BACKEND_DIR}" "${FRONTEND_DIR}" "${ENV_FILE}" "${BACKUP_SCRIPT}" "${MIGRATIONS_SCRIPT}" "${PYTHON_BIN}"; do
    if [[ ! -e "${required}" ]]; then
        echo "ERROR: falta recurso requerido: ${required}" >&2
        exit 1
    fi
done

latest_target="$(readlink -f "${NGINX_LINK}" 2>/dev/null || true)"
if [[ "${latest_target}" == "${NGINX_LIVE}" ]]; then
    echo "OK  edge publico en modo live"
elif [[ "${latest_target}" == "${NGINX_MAINT}" ]]; then
    echo "OK  edge publico en modo mantenimiento"
else
    echo "ERROR: symlink nginx no esperado: ${latest_target:-<sin destino>}" >&2
    exit 1
fi

mkdir -p "${BACKEND_DIR}/backups"
touch "${BACKEND_DIR}/backups/.phase10-write-check"
rm -f "${BACKEND_DIR}/backups/.phase10-write-check"
echo "OK  directorio de backups escribible"

current_revision="$(
    cd "${BACKEND_DIR}" && \
    env -u DEBUG \
        PYTHONPATH=. \
        SECRET_KEY="${PHASE10_SECRET_KEY}" \
        "${PYTHON_BIN}" scripts/run_migrations.py current 2>&1
)"
echo "${current_revision}"
if ! grep -q "(head)" <<<"${current_revision}"; then
    echo "ERROR: la base de datos no esta en head" >&2
    exit 1
fi
echo "OK  migraciones en head"

curl -fsS http://127.0.0.1:8100/api/v1/health/public >/dev/null
echo "OK  health/public local"

curl -fsS http://127.0.0.1:8100/api/v1/auth/config >/dev/null
echo "OK  auth/config local"

curl -fsS http://127.0.0.1:8100/api/v1/metrics/prometheus >/dev/null

# Las cabeceras de seguridad deben llegar en la SPA y en los assets (herencia add_header)
PUBLIC_HOST="${PUBLIC_HOST:-miapp.edumind.es}"
for ruta in / /index.html /assets/; do
    if ! curl -ksSI --max-time 10 -H "Host: ${PUBLIC_HOST}" "https://127.0.0.1${ruta}" | grep -qi '^content-security-policy:'; then
        echo "FALTA Content-Security-Policy en ${ruta} (revisar include miapp-security-headers.inc)" >&2
        exit 1
    fi
done
echo "OK  metrics/prometheus local"

if [[ -f "${FRONTEND_DIR}/dist/index.html" ]]; then
    echo "OK  frontend/dist disponible"
else
    echo "OK  frontend/dist aun no generado; se construira en deploy"
fi

echo "FASE 10 preflight OK"
