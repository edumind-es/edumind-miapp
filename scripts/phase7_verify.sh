#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "== FASE 7 verify =="

AUTH_CONFIG="$(curl -fsS http://127.0.0.1:8100/api/v1/auth/config)"
echo "$AUTH_CONFIG" | grep -q '"auth_mode":"authentik"'
echo "$AUTH_CONFIG" | grep -q '"sso_enabled":true'
echo "OK  auth config en modo authentik"

SSO_HEADERS="$(curl -k -sS -D - -o /tmp/phase7_sso_body "https://miapp.edumind.es/api/v1/auth/sso/login?next=/admin")"
if echo "$SSO_HEADERS" | grep -qi "location: https://auth.edumind.es/application/o/authorize/"; then
  echo "$SSO_HEADERS" | grep -q "scope=openid+profile+email"
  echo "OK  arranque SSO Authentik válido"
else
  echo "$SSO_HEADERS" | grep -q "^HTTP/.* 503 "
  grep -q "temporarily unavailable for maintenance" /tmp/phase7_sso_body
  echo "OK  despliegue publico en mantenimiento: SSO exterior bloqueado intencionalmente"
fi
rm -f /tmp/phase7_sso_body

if rg -n 'alert\(|confirm\(' "$FRONTEND_DIR/src" -g '!dist' >/tmp/phase7_alerts.txt; then
  echo "ERROR: quedan alert/confirm en frontend"
  cat /tmp/phase7_alerts.txt
  exit 1
fi
echo "OK  frontend sin alert/confirm heredados"

(cd "$FRONTEND_DIR" && npm run lint >/dev/null)
echo "OK  npm run lint"

(cd "$FRONTEND_DIR" && npm run build >/dev/null)
echo "OK  npm run build"

echo "FASE 7 verificada"
