#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LOCAL_BASE_URL=${PHASE2_LOCAL_BASE_URL:-http://127.0.0.1:8100}
REDIS_URL=${REDIS_URL:-redis://127.0.0.1:6379/0}

echo "[1/3] Validando checks acumulados"
"$ROOT_DIR/scripts/phase1_verify.sh"

echo ""
echo "[2/3] Validando backend de cola"
QUEUE_STATUS=$(curl -sS "$LOCAL_BASE_URL/api/v1/queue/status")
python3 - "$QUEUE_STATUS" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
backend = payload.get("backend")
if backend != "redis":
    raise SystemExit(f"Backend de cola inesperado: {backend!r}")
print(f"OK  queue backend = {backend}")
PY

echo ""
echo "[3/3] Validando Redis local"
REDIS_PING=$(redis-cli -u "$REDIS_URL" ping)
if [[ "$REDIS_PING" != "PONG" ]]; then
    echo "Fallo: Redis no respondio PONG"
    exit 1
fi
echo "OK  redis ping = $REDIS_PING"

echo ""
echo "Verificacion FASE 2 completada."
