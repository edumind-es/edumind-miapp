#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LOCAL_BASE_URL=${PHASE1_LOCAL_BASE_URL:-http://127.0.0.1:8100}
PUBLIC_BASE_URL=${PHASE1_PUBLIC_BASE_URL:-https://miapp.edumind.es}

assert_http_code() {
    local expected=$1
    local url=$2
    shift 2

    local code
    code=$(curl -k -sS -o /dev/null -w '%{http_code}' "$@" "$url")
    if [[ "$code" != "$expected" ]]; then
        echo "Fallo: $url devolvio $code y se esperaba $expected"
        exit 1
    fi
    echo "OK  $expected  $url"
}

assert_http_code_in() {
    local accepted_csv=$1
    local url=$2
    shift 2

    local code
    code=$(curl -k -sS -o /dev/null -w '%{http_code}' "$@" "$url")
    IFS=',' read -r -a accepted_codes <<<"$accepted_csv"
    for expected in "${accepted_codes[@]}"; do
        if [[ "$code" == "$expected" ]]; then
            echo "OK  $code  $url"
            return 0
        fi
    done
    echo "Fallo: $url devolvio $code y se esperaba uno de [$accepted_csv]"
    exit 1
}

echo "[1/3] Validando checks base"
"$ROOT_DIR/scripts/phase0_verify.sh"

echo ""
echo "[2/3] Validando acceso local controlado"
assert_http_code 200 "$LOCAL_BASE_URL/api/v1/config/runtime-policy"
assert_http_code 403 "$LOCAL_BASE_URL/api/v1/config/runtime-policy" -H "X-Real-IP: 8.8.8.8"
assert_http_code 403 "$LOCAL_BASE_URL/api/v1/health/providers" -H "X-Real-IP: 8.8.8.8"
assert_http_code 403 "$LOCAL_BASE_URL/api/v1/knowledge/categories" -H "X-Real-IP: 8.8.8.8"
assert_http_code 403 "$LOCAL_BASE_URL/api/v1/knowledge/documents" -H "X-Real-IP: 8.8.8.8"
assert_http_code 403 "$LOCAL_BASE_URL/api/v1/knowledge/search?query=lomloe" -H "X-Real-IP: 8.8.8.8"
assert_http_code 403 "$LOCAL_BASE_URL/api/v1/knowledge/document/legislacion/lomloe" -H "X-Real-IP: 8.8.8.8"
assert_http_code 403 "$LOCAL_BASE_URL/api/v1/normative/status" -H "X-Real-IP: 8.8.8.8"
assert_http_code 403 "$LOCAL_BASE_URL/api/v1/generators/prompt-contracts" -H "X-Real-IP: 8.8.8.8"
# La cabecera CF-Connecting-IP declarada por el cliente no debe dar acceso VPN
assert_http_code 403 "$LOCAL_BASE_URL/api/v1/config/runtime-policy" -H "X-Real-IP: 8.8.8.8" -H "CF-Connecting-IP: 10.8.0.1"
assert_http_code 403 "$LOCAL_BASE_URL/api/v1/health/providers" -H "X-Real-IP: 8.8.8.8" -H "CF-Connecting-IP: 10.8.0.1"

echo ""
echo "[3/3] Validando exposicion publica"
if [[ -n "$PUBLIC_BASE_URL" ]]; then
    assert_http_code_in "403,503" "$PUBLIC_BASE_URL/api/v1/config/runtime-policy"
    assert_http_code_in "403,503" "$PUBLIC_BASE_URL/api/v1/health/providers"
    assert_http_code_in "403,503" "$PUBLIC_BASE_URL/api/v1/knowledge/categories"
    assert_http_code_in "403,503" "$PUBLIC_BASE_URL/api/v1/knowledge/documents"
    assert_http_code_in "403,503" "$PUBLIC_BASE_URL/api/v1/knowledge/search?query=lomloe"
    assert_http_code_in "403,503" "$PUBLIC_BASE_URL/api/v1/knowledge/document/legislacion/lomloe"
    assert_http_code_in "403,503" "$PUBLIC_BASE_URL/api/v1/normative/status"
    assert_http_code_in "403,503" "$PUBLIC_BASE_URL/api/v1/generators/prompt-contracts"
else
    echo "PHASE1_PUBLIC_BASE_URL vacio, se omiten checks publicos."
fi

echo ""
echo "Verificacion FASE 1 completada."
