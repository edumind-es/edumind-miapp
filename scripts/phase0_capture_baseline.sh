#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUTPUT_FILE=""

usage() {
    cat <<'EOF'
Usage:
  scripts/phase0_capture_baseline.sh [--output <path>] [--default-output]

Options:
  --output <path>     Write the Markdown report to the given file.
  --default-output    Write the report under docs/remediacion/baselines/generated/.
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --output)
            [[ $# -ge 2 ]] || { usage; exit 1; }
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --default-output)
            stamp=$(date -u +%Y%m%dT%H%M%SZ)
            OUTPUT_FILE="$ROOT_DIR/docs/remediacion/baselines/generated/phase0_${stamp}.md"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            usage
            exit 1
            ;;
    esac
done

if [[ -n "$OUTPUT_FILE" ]]; then
    mkdir -p "$(dirname "$OUTPUT_FILE")"
    exec >"$OUTPUT_FILE"
fi

run_block() {
    local cmd="$1"
    echo '```text'
    bash -lc "$cmd" 2>&1 || true
    printf '\n'
    echo '```'
}

print_env_keys() {
    local file_path="$1"
    if [[ -f "$file_path" ]]; then
        awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' "$file_path" | sort
    else
        echo "File not found: $file_path"
    fi
}

timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
hostname_value=$(hostname 2>/dev/null || echo "unknown")
branch=$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
commit=$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
status_total=$(git -C "$ROOT_DIR" status --short | wc -l | tr -d ' ')
status_modified=$(git -C "$ROOT_DIR" status --short | grep -E '^[ MARCUD]' -c || true)
status_untracked=$(git -C "$ROOT_DIR" status --short | grep -E '^\?\?' -c || true)

cat <<EOF
# Fase 0 - Baseline operativo

- Generado en: ${timestamp}
- Host: ${hostname_value}
- Repo: /var/www/edumind_miapp
- Rama: ${branch}
- Commit: ${commit}
- Cambios detectados: ${status_total} (${status_modified} modificados, ${status_untracked} no seguidos)

## Estado git
EOF
run_block "cd '$ROOT_DIR' && git status --short | sed -n '1,60p'"

cat <<'EOF'
## Servicio backend del sistema
EOF
run_block "systemctl status edumind-miapp.service --no-pager --lines=15"

cat <<'EOF'
## Servicios de usuario
EOF
run_block "systemctl --user --no-pager --type=service --all | rg 'edumind|ollama'"

cat <<'EOF'
## Runtime contenedores relacionados
EOF
run_block "docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' | rg 'edumind-miapp-postgres|redis|liga-edumind-db-prod|liga-edumind-redis-prod'"

cat <<'EOF'
## Inventario de variables (.env)
EOF
echo '```text'
print_env_keys "$ROOT_DIR/.env"
echo '```'

cat <<'EOF'
## Inventario de variables (backend/.env)
EOF
echo '```text'
print_env_keys "$ROOT_DIR/backend/.env"
echo '```'

cat <<'EOF'
## Health backend
EOF
run_block "curl -fsS --max-time 4 'http://127.0.0.1:8100/api/v1/health?include_checks=true'"

cat <<'EOF'
## Revision de migraciones activa
EOF
run_block "cd '$ROOT_DIR/backend' && env -u DEBUG PYTHONPATH=. ./.venv/bin/python scripts/run_migrations.py current"

cat <<'EOF'
## Runtime policy
EOF
run_block "curl -fsS --max-time 4 'http://127.0.0.1:8100/api/v1/config/runtime-policy'"

cat <<'EOF'
## Frontend build actual
EOF
run_block "cd '$ROOT_DIR/frontend' && if [[ -d dist ]]; then du -sh dist && find dist/assets -maxdepth 1 -type f -printf '%s %p\n' | sort -nr | head -n 10; else echo 'dist no existe'; fi"

cat <<'EOF'
## Huella de almacenamiento backend
EOF
run_block "cd '$ROOT_DIR/backend' && du -sh .venv uploads dataset knowledge modelos_lora 2>/dev/null"

cat <<'EOF'
## Comandos recomendados de verificacion

```text
scripts/phase0_verify.sh
scripts/phase0_capture_baseline.sh --default-output
```
EOF
