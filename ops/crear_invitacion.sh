#!/usr/bin/env bash
# crear_invitacion.sh — Genera un enlace de invitación único para registrarse en EDUmind
#
# Uso:
#   ./ops/crear_invitacion.sh [--expires DIAS] [--label "Nombre o motivo"] [--multi]
#
# Opciones:
#   --expires DIAS   Días hasta que expire la invitación (por defecto: 7)
#   --label  TEXTO   Etiqueta descriptiva (por defecto: "Invitación manual")
#   --multi          Si se pasa, la invitación NO es de un solo uso (por defecto: single-use)
#
# Ejemplos:
#   ./ops/crear_invitacion.sh
#   ./ops/crear_invitacion.sh --expires 30 --label "Docente IES Rosalía"
#   ./ops/crear_invitacion.sh --expires 1 --multi --label "Demo acceso múltiple"

set -euo pipefail

EXPIRES_DAYS=7
LABEL="Invitación manual"
SINGLE_USE=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expires) EXPIRES_DAYS="$2"; shift 2 ;;
    --label)   LABEL="$2";        shift 2 ;;
    --multi)   SINGLE_USE=0;      shift ;;
    *) echo "Opción desconocida: $1"; exit 1 ;;
  esac
done

PYTHON_CODE="
import json, os
from datetime import datetime, timedelta, timezone
from authentik.stages.invitation.models import Invitation
from authentik.flows.models import Flow
from authentik.core.models import User

expires_days = int(os.environ['INV_DAYS'])
label        = os.environ['INV_LABEL']
single_use   = os.environ['INV_SINGLE'] == '1'

flow    = Flow.objects.get(slug='edumind-invitation-enrollment')
creator = User.objects.exclude(username='AnonymousUser').order_by('pk').first()

expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)
inv = Invitation.objects.create(
    name=label,
    flow=flow,
    expires=expires_at,
    single_use=single_use,
    created_by=creator,
)
token = str(inv.pk)
url   = f'https://auth.edumind.es/if/flow/edumind-invitation-enrollment/?itoken={token}'
print('RESULT:' + json.dumps({'token': token, 'url': url,
                              'expires': expires_at.isoformat(), 'single_use': single_use}))
"

RESULT=$(docker exec \
  -e INV_DAYS="$EXPIRES_DAYS" \
  -e INV_LABEL="$LABEL" \
  -e INV_SINGLE="$SINGLE_USE" \
  authentik-server ak shell -c "$PYTHON_CODE" 2>/dev/null | grep '^RESULT:' | sed 's/^RESULT://')

if [[ -z "$RESULT" ]]; then
  echo "ERROR: No se pudo crear la invitación."
  echo "  - Comprueba que el contenedor authentik-server está en ejecución."
  echo "  - Comprueba que el flujo 'edumind-invitation-enrollment' existe en Authentik."
  exit 1
fi

URL=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")
EXP=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['expires'][:19].replace('T',' '))")
SU=$(echo  "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('sí' if d['single_use'] else 'no')")

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Invitación EDUmind generada correctamente             ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║ Etiqueta   : %s\n" "$LABEL"
printf "║ Expira     : %s UTC  (en %s días)\n" "$EXP" "$EXPIRES_DAYS"
printf "║ Un solo uso: %s\n" "$SU"
echo  "║"
echo  "║ Enlace de registro:"
printf "║   %s\n" "$URL"
echo  "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Comparte este enlace con la persona que debe registrarse."
[[ "$SU" == "sí" ]] && echo "Una vez usada quedará invalidada automáticamente."
