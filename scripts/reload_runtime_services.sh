#!/usr/bin/env bash
set -euo pipefail

restart_user_service_if_present() {
    local unit="$1"
    if systemctl --user list-unit-files --type=service 2>/dev/null | grep -q "^${unit}"; then
        systemctl --user restart "${unit}"
        echo "OK  reiniciado user service ${unit}"
        return 0
    fi
    return 1
}

restart_system_service_if_present() {
    local unit="$1"
    if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^${unit}"; then
        if systemctl restart "${unit}" 2>/dev/null; then
            echo "OK  reiniciado system service ${unit}"
            return 0
        fi
        if command -v sudo >/dev/null 2>&1 && sudo -n systemctl restart "${unit}" 2>/dev/null; then
            echo "OK  reiniciado system service ${unit} con sudo"
            return 0
        fi
    fi
    return 1
}

restart_api_with_fallback() {
    if restart_system_service_if_present "edumind-miapp.service"; then
        return 0
    fi

    local current_pid
    current_pid="$(pgrep -f '/var/www/edumind_miapp/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8100' | head -n1 || true)"
    if [[ -z "${current_pid}" ]]; then
        echo "ERROR: no se encontro el proceso uvicorn de miapp para reinicio fallback" >&2
        return 1
    fi

    kill -TERM "${current_pid}"
    echo "OK  enviado SIGTERM a uvicorn PID ${current_pid}; esperando autorestart"

    for _ in $(seq 1 30); do
        sleep 1
        if curl -fsS http://127.0.0.1:8100/api/v1/health/public >/dev/null 2>&1; then
            echo "OK  api reiniciada via autorestart"
            return 0
        fi
    done

    echo "ERROR: la API no volvio tras el reinicio fallback" >&2
    return 1
}

echo "== Reload runtime services =="

restart_api_with_fallback

restart_system_service_if_present "edumind-miapp-training-worker@1.service" || \
restart_user_service_if_present "edumind-miapp-training-worker.service" || \
echo "OK  training worker sin reinicio explicito"

restart_system_service_if_present "edumind-miapp-background-worker@1.service" || \
restart_user_service_if_present "edumind-miapp-background-worker.service" || \
echo "OK  background worker sin reinicio explicito"

echo "Runtime services reload OK"
