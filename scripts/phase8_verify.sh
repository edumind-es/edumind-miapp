#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
PHASE8_SECRET_KEY=${PHASE8_SECRET_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/edumind-phase8.XXXXXX")
PHASE8_TEST_DB="${TMP_DIR}/test_phase8.db"
PHASE8_RENDER_JSON="${TMP_DIR}/render_inspection.json"

cleanup() {
    rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

echo "== FASE 8 verify =="

cd "${BACKEND_DIR}"
env -u DEBUG \
    PYTHONPATH=. \
    SECRET_KEY="${PHASE8_SECRET_KEY}" \
    RUNTIME_ENV=development \
    DATABASE_URL="sqlite:///${PHASE8_TEST_DB}" \
    DB_AUTO_CREATE=true \
    DB_MANAGED_BY_ALEMBIC=false \
    DB_ENABLE_SQLITE_WAL=false \
    ./.venv/bin/pytest -q tests/test_generators.py
echo "OK  backend generadores endurecidos"

curl -fsS \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"tipo_documento":"informe_tecnico","ambito":"Convivencia","demanda_inspeccion":"Revision del protocolo del centro","hallazgos":"Incidencias reiteradas en recreos","actuaciones_previas":"Seguimiento tutorial","evidencias":"Actas y registros","plazo_respuesta":"10 dias habiles","normativa_aplicable":"Ley 4/2011 y Decreto 8/2015","provider":"webgpu"}' \
    http://127.0.0.1:8100/api/v1/generators/render/inspection_report > "${PHASE8_RENDER_JSON}"

python3 - <<'PY' "${PHASE8_RENDER_JSON}"
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
assert payload["response_format"] == "json"
assert payload["output_schema"] is not None
assert payload["output_schema"]["properties"]["requiere_revision_humana"]["type"] == "boolean"
assert payload["local_prompt_mode"] == "safe_client_template_v1"
assert "prompt_text" not in payload
assert payload["sanitized_payload"]["demanda_inspeccion"] == "Revision del protocolo del centro"
assert "provider" not in payload["sanitized_payload"]
print("OK  render inspection_report devuelve contrato estructurado")
PY

cd "${FRONTEND_DIR}"
npm run lint >/dev/null
echo "OK  npm run lint"

npm run build >/dev/null
echo "OK  npm run build"

echo "FASE 8 verificada"
