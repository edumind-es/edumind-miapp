#!/usr/bin/env bash
# Copyright (C) 2024-2025 EDUmind
# Deployment Script for miapp.edumind.es

set -euo pipefail

ROOT_DIR="/var/www/edumind_miapp"
ACTIVATE_PUBLIC=0

if [[ "${1:-}" == "--activate-public" ]]; then
    ACTIVATE_PUBLIC=1
elif [[ $# -gt 0 ]]; then
    echo "Uso: $0 [--activate-public]" >&2
    exit 1
fi

"${ROOT_DIR}/deploy.sh"

if [[ "${ACTIVATE_PUBLIC}" -eq 1 ]]; then
    echo "[cutover] Activando edge publico..."
    "${ROOT_DIR}/scripts/cutover_activate_public.sh"
    "${ROOT_DIR}/scripts/post_deploy_smoke.sh" --public-mode live
else
    echo "[cutover] Edge publico permanece en mantenimiento controlado."
    echo "[cutover] Para abrirlo cuando proceda: ./deploy_pro.sh --activate-public"
fi

echo "[SUCCESS] Deployed successfully to https://miapp.edumind.es"
