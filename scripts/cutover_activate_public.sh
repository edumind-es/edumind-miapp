#!/usr/bin/env bash
set -euo pipefail

NGINX_LINK="/etc/nginx/sites-enabled/edumind-ai-pro"
NGINX_LIVE="/etc/nginx/sites-available/edumind-ai-pro"
REPO_NGINX_TEMPLATE="/var/www/edumind_miapp/ops/nginx/edumind-ai-pro.conf"
DRY_RUN=0

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=1
elif [[ $# -gt 0 ]]; then
    echo "Uso: $0 [--dry-run]" >&2
    exit 1
fi

run_privileged() {
    if [[ "${DRY_RUN}" -eq 1 ]]; then
        echo "DRY-RUN  $*"
        return 0
    fi

    if [[ "$(id -u)" -eq 0 ]]; then
        "$@"
        return 0
    fi

    if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
        sudo -n "$@"
        return 0
    fi

    echo "ERROR: se requieren privilegios para ejecutar: $*" >&2
    echo "Ejecuta manualmente:" >&2
    if [[ -f "${REPO_NGINX_TEMPLATE}" ]]; then
        echo "  sudo cp ${REPO_NGINX_TEMPLATE} ${NGINX_LIVE}" >&2
    fi
    echo "  sudo ln -sfn ${NGINX_LIVE} ${NGINX_LINK}" >&2
    echo "  sudo nginx -t" >&2
    echo "  sudo systemctl reload nginx" >&2
    exit 1
}

echo "== Activar edge publico =="
if [[ -f "${REPO_NGINX_TEMPLATE}" ]]; then
    run_privileged cp "${REPO_NGINX_TEMPLATE}" "${NGINX_LIVE}"
fi
run_privileged ln -sfn "${NGINX_LIVE}" "${NGINX_LINK}"
run_privileged nginx -t
run_privileged systemctl reload nginx
echo "Edge publico activado"
