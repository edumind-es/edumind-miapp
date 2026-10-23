#!/usr/bin/env python3
#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
#

from __future__ import annotations

import argparse
import os
from pathlib import Path

from alembic import command
from alembic.config import Config


BACKEND_DIR = Path(__file__).resolve().parents[1]


def build_config() -> Config:
    os.chdir(BACKEND_DIR)
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    return config


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Alembic migrations for EDUmind MiApp.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    upgrade_parser = subparsers.add_parser("upgrade")
    upgrade_parser.add_argument("revision", nargs="?", default="head")

    downgrade_parser = subparsers.add_parser("downgrade")
    downgrade_parser.add_argument("revision")

    stamp_parser = subparsers.add_parser("stamp")
    stamp_parser.add_argument("revision")

    revision_parser = subparsers.add_parser("revision")
    revision_parser.add_argument("-m", "--message", required=True)
    revision_parser.add_argument(
        "--autogenerate",
        action="store_true",
        help="Autogenerate migration operations from SQLModel metadata.",
    )

    subparsers.add_parser("current")

    args = parser.parse_args()
    config = build_config()

    if args.command == "upgrade":
        command.upgrade(config, args.revision)
    elif args.command == "downgrade":
        command.downgrade(config, args.revision)
    elif args.command == "stamp":
        command.stamp(config, args.revision)
    elif args.command == "revision":
        command.revision(
            config,
            message=args.message,
            autogenerate=args.autogenerate,
        )
    elif args.command == "current":
        command.current(config)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
