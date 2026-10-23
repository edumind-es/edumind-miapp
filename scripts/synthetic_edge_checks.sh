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

case "${PUBLIC_MODE}" in
    maintenance|live|either)
        ;;
    *)
        echo "ERROR: public mode no soportado: ${PUBLIC_MODE}" >&2
        exit 1
        ;;
esac

assert_http_code_in() {
    local url="$1"
    shift
    local expected=("$@")
    local tmp_body
    tmp_body="$(mktemp)"
    local code
    code="$(curl -k -sS -o "$tmp_body" -w "%{http_code}" "$url")"

    local matched=1
    for candidate in "${expected[@]}"; do
        if [[ "$code" == "$candidate" ]]; then
            matched=0
            break
        fi
    done

    if [[ "$matched" -ne 0 ]]; then
        echo "ERROR: $url devolvio $code (esperado: ${expected[*]})"
        cat "$tmp_body"
        rm -f "$tmp_body"
        exit 1
    fi

    echo "OK  $code  $url"
    rm -f "$tmp_body"
}

echo "== Synthetic edge checks =="

assert_http_code_in "http://127.0.0.1:8100/api/v1/health/public" 200
assert_http_code_in "http://127.0.0.1:8100/api/v1/health/dependencies" 200
assert_http_code_in "http://127.0.0.1:8100/api/v1/health/internal" 200

case "${PUBLIC_MODE}" in
    maintenance)
        assert_http_code_in "https://miapp.edumind.es/" 200
        assert_http_code_in "https://miapp.edumind.es/api/v1/health/public" 503
        assert_http_code_in "https://app.edumind.es/" 301 302 503
        ;;
    live)
        assert_http_code_in "https://miapp.edumind.es/" 200
        assert_http_code_in "https://miapp.edumind.es/api/v1/health/public" 200
        assert_http_code_in "https://app.edumind.es/" 301 302 200
        ;;
    either)
        assert_http_code_in "https://miapp.edumind.es/" 200 503
        assert_http_code_in "https://miapp.edumind.es/api/v1/health/public" 200 503
        assert_http_code_in "https://app.edumind.es/" 200 301 302 503
        ;;
esac

echo "Synthetic edge checks OK"
