#!/usr/bin/env python
#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Aplica la política de retención (ActivityLog) fuera del arranque, p. ej. desde cron.

Uso: cd backend && .venv/bin/python scripts/purge_retention.py [--days N]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlmodel import Session  # noqa: E402

from app.db import engine  # noqa: E402
from app.services.retention_service import purge_activity_log  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Purga registros de actividad antiguos")
    parser.add_argument("--days", type=int, default=None, help="Plazo en días (por defecto, ACTIVITY_LOG_RETENTION_DAYS)")
    args = parser.parse_args()
    with Session(engine) as session:
        deleted = purge_activity_log(session, args.days)
    print(f"Registros de actividad eliminados: {deleted}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
