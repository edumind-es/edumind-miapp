#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/var/www/edumind_miapp"
FRONTEND_DIR="${ROOT_DIR}/frontend"
DIST_DIR="${FRONTEND_DIR}/dist"

echo "== Verify WebLLM split =="

cd "${FRONTEND_DIR}"
if [[ ! -f "${DIST_DIR}/index.html" ]]; then
    npm run build >/dev/null
fi

if ! compgen -G "${DIST_DIR}/assets/webllm-*.js" >/dev/null; then
    echo "ERROR: no existe chunk webllm dedicado en dist/assets" >&2
    exit 1
fi
echo "OK  existe chunk webllm dedicado"

if rg -n "webllm-[^\"]+\\.js|webllm-[^']+\\.js" "${DIST_DIR}/index.html" >/dev/null; then
    echo "ERROR: index.html referencia el chunk webllm y penaliza la carga base" >&2
    exit 1
fi
echo "OK  index.html no precarga webllm"

echo "WebLLM split OK"
