#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

import pandas as pd
import os
import json

# Configuration
INPUT_FILE = "dataset/processed/02_qualified.parquet"
OUTPUT_DIR = "dataset/ready"
JSONL_FILE = os.path.join(OUTPUT_DIR, "training_data.jsonl")
ALPACA_FILE = os.path.join(OUTPUT_DIR, "alpaca_data.json")

def export_data():
    print(f"[*] Starting Phase 3: Export & Transformation")

    if not os.path.exists(INPUT_FILE):
        print(f"[!] Input file {INPUT_FILE} not found. Run Phase 2 first.")
        return

    df = pd.read_parquet(INPUT_FILE)
    print(f"[*] Loaded {len(df)} qualified rows.")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Export JSONL (Standard)
    # Format: {"instruction": "...", "output": "..."}
    df[['instruction', 'output']].to_json(JSONL_FILE, orient='records', lines=True, force_ascii=False)
    print(f"[+] Exported JSONL to {JSONL_FILE}")

    # 2. Export Alpaca (JSON Array)
    # Format: [{"instruction": "...", "input": "", "output": "..."}, ...]
    alpaca_records = []
    for _, row in df.iterrows():
        alpaca_records.append({
            "instruction": row['instruction'],
            "input": "", # We can map context here if available
            "output": row['output']
        })
    
    with open(ALPACA_FILE, 'w', encoding='utf-8') as f:
        json.dump(alpaca_records, f, indent=2, ensure_ascii=False)
    print(f"[+] Exported Alpaca Format to {ALPACA_FILE}")

    print("[*] Pipeline Complete!")

if __name__ == "__main__":
    export_data()
