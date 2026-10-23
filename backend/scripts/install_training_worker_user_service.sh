#!/usr/bin/env bash
set -euo pipefail

UNIT_SRC="/var/www/edumind_miapp/deploy/systemd-user/edumind-miapp-training-worker.service"
UNIT_DIR="$HOME/.config/systemd/user"
UNIT_DST="$UNIT_DIR/edumind-miapp-training-worker.service"

if [[ ! -f "$UNIT_SRC" ]]; then
  echo "Unit file not found: $UNIT_SRC" >&2
  exit 1
fi

mkdir -p "$UNIT_DIR"
cp "$UNIT_SRC" "$UNIT_DST"
systemctl --user daemon-reload
systemctl --user enable --now edumind-miapp-training-worker.service
systemctl --user status edumind-miapp-training-worker.service --no-pager -l

echo "Installed and started user service: edumind-miapp-training-worker.service"
