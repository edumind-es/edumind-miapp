#!/usr/bin/env bash
set -euo pipefail

PUBLIC_MODE="either"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --public-mode)
            PUBLIC_MODE="${2:-}"
            shift 2
            ;;
        *)
            echo "Uso: $0 [--public-mode maintenance|live|either]" >&2
            exit 1
            ;;
    esac
done

echo "== Post deploy smoke =="

curl -fsS http://127.0.0.1:8100/api/v1/health/public >/dev/null
echo "OK  health/public local"

curl -fsS http://127.0.0.1:8100/api/v1/auth/config >/dev/null
echo "OK  auth/config local"

curl -fsS http://127.0.0.1:8100/api/v1/metrics/prometheus >/dev/null
echo "OK  metrics/prometheus local"

pgrep -f '/var/www/edumind_miapp/backend/scripts/background_task_worker.py' >/dev/null
echo "OK  background worker activo"

pgrep -f '/var/www/edumind_miapp/backend/scripts/training_worker.py' >/dev/null
echo "OK  training worker activo"

"/var/www/edumind_miapp/scripts/synthetic_edge_checks.sh" --public-mode "${PUBLIC_MODE}"

echo "Post deploy smoke OK"
