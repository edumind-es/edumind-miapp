#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
ENV_FILE="${BACKEND_DIR}/.env"

echo "== FASE 10 verify =="

"${ROOT_DIR}/scripts/phase9_verify.sh"

bash -n \
    "${ROOT_DIR}/deploy.sh" \
    "${ROOT_DIR}/deploy_pro.sh" \
    "${ROOT_DIR}/scripts/preflight_release.sh" \
    "${ROOT_DIR}/scripts/reload_runtime_services.sh" \
    "${ROOT_DIR}/scripts/post_deploy_smoke.sh" \
    "${ROOT_DIR}/scripts/cutover_activate_public.sh" \
    "${ROOT_DIR}/scripts/cutover_enable_maintenance.sh" \
    "${ROOT_DIR}/scripts/verify_webllm_split.sh" \
    "${ROOT_DIR}/scripts/load_smoke_local.sh" \
    "${ROOT_DIR}/scripts/synthetic_edge_checks.sh" \
    "${BACKEND_DIR}/scripts/restore_db.sh"
echo "OK  sintaxis de scripts"

"${ROOT_DIR}/scripts/preflight_release.sh"
"${ROOT_DIR}/scripts/verify_webllm_split.sh"
"${ROOT_DIR}/scripts/load_smoke_local.sh"
"${ROOT_DIR}/scripts/post_deploy_smoke.sh" --public-mode either

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

if [[ "${DATABASE_URL:-}" == postgresql* ]]; then
    BACKUP_GLOB='edumind_*.sql.gz'
else
    BACKUP_GLOB='edumind_*.db.gz'
fi

if ! compgen -G "${BACKEND_DIR}/backups/${BACKUP_GLOB}" >/dev/null; then
    "${BACKEND_DIR}/scripts/backup_db.sh" >/dev/null
    echo "OK  backup compatible generado para restore dry-run"
fi

LATEST_BACKUP="$(find "${BACKEND_DIR}/backups" -maxdepth 1 -type f -name "${BACKUP_GLOB}" | sort | tail -n1 || true)"
if [[ -n "${LATEST_BACKUP}" ]]; then
    "${BACKEND_DIR}/scripts/restore_db.sh" --dry-run --backup-file "${LATEST_BACKUP}"
    echo "OK  restore_db dry-run"
else
    echo "OK  restore_db dry-run omitido (sin backups previos)"
fi

test -f "${ROOT_DIR}/.github/workflows/ci.yml"
echo "OK  workflow CI presente"

cd "${FRONTEND_DIR}"
npm run lint >/dev/null
echo "OK  npm run lint"

npm run build >/dev/null
echo "OK  npm run build"

test -f "${FRONTEND_DIR}/dist/admin/index.html"
echo "OK  bundle admin separado generado"

if find "${FRONTEND_DIR}/dist/assets" -maxdepth 1 -type f -name '*.js' ! -name 'admin-*.js' -print0 \
    | xargs -0 rg -n 'portal-ops-7f3d9a' >/dev/null 2>&1; then
    echo "ERROR: el bundle publico sigue exponiendo la ruta interna admin" >&2
    exit 1
fi
echo "OK  bundle publico sin ruta interna admin"

echo "FASE 10 verificada"
