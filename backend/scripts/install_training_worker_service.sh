#!/usr/bin/env bash
set -euo pipefail

UNIT_SRC="/var/www/edumind_miapp/deploy/systemd/edumind-miapp-training-worker@.service"
UNIT_DST="/etc/systemd/system/edumind-miapp-training-worker@.service"
INSTANCE="${1:-1}"

if [[ ! -f "$UNIT_SRC" ]]; then
  echo "Unit file not found: $UNIT_SRC" >&2
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "Run as root (or with sudo)." >&2
  exit 1
fi

cp "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload
systemctl enable --now "edumind-miapp-training-worker@${INSTANCE}.service"
systemctl status "edumind-miapp-training-worker@${INSTANCE}.service" --no-pager -l

echo "Installed and started edumind-miapp-training-worker@${INSTANCE}.service"
