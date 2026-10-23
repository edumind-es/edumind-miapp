#!/usr/bin/env python3
#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
#

"""Distributed background worker entrypoint."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.background_task_queue_service import run_worker_loop


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run EDUmind background task worker",
    )
    parser.add_argument(
        "--worker-id",
        type=str,
        default=None,
        help="Worker identifier (default: hostname-timestamp)",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=2.0,
        help="Polling interval in seconds while queue is empty",
    )
    parser.add_argument(
        "--max-jobs",
        type=int,
        default=None,
        help="Stop worker after processing this number of jobs",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Process at most one queued job and exit",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    processed = run_worker_loop(
        worker_id=args.worker_id,
        poll_interval_seconds=args.poll_interval,
        max_jobs=args.max_jobs,
        once=args.once,
    )
    print(f"background_task_worker_processed_jobs={processed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
