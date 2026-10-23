#!/usr/bin/env python3
#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
#

"""Execute a single claimed background job."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.background_task_queue_service import process_background_job_payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Process a single EDUmind background job")
    parser.add_argument("--job-id", type=int, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = process_background_job_payload(args.job_id)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
