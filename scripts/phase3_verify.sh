#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
PYTEST_BIN="$BACKEND_DIR/.venv/bin/pytest"
PHASE3_SECRET_KEY=${PHASE3_SECRET_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}

echo "[1/2] Validando fases acumuladas"
"$ROOT_DIR/scripts/phase2_verify.sh"

echo ""
echo "[2/2] Validando dominio teacher_premium"
(
    cd "$BACKEND_DIR"
    env -u DEBUG PYTHONPATH=. SECRET_KEY="$PHASE3_SECRET_KEY" \
        "$PYTEST_BIN" -q tests/test_teacher_premium_domains.py
)

echo ""
echo "Verificacion FASE 3 completada."
