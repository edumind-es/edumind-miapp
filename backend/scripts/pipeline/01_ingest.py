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
import json
import glob
import os
import argparse

# Configuration
RAW_DIR = "dataset/raw"
PROCESSED_DIR = "dataset/processed"
OUTPUT_FILE = os.path.join(PROCESSED_DIR, "01_normalized.parquet")

def ingest_data():
    """
    Reads all JSON files from RAW_DIR, normalizes columns, clean basic issues,
    and saves to Parquet.
    """
    print(f"[*] Starting Phase 1: Ingestion from {RAW_DIR}")
    
    # 1. Load Files
    files = glob.glob(os.path.join(RAW_DIR, "*.json"))
    if not files:
        print("[!] No JSON files found in raw directory.")
        return

    data_list = []
    print(f"[*] Found {len(files)} files. Processing...")

    for file in files:
        try:
            with open(file, 'r') as f:
                content = json.load(f)
                
                # Handle list of items or single item
                items = content if isinstance(content, list) else [content]
                
                for item in items:
                    entry = {
                        "instruction": item.get("prompt") or item.get("input") or item.get("instruction") or item.get("input_text"),
                        "output": item.get("response") or item.get("answer") or item.get("output") or item.get("completion"),
                        "source_model": item.get("model_name", "unknown"),
                        "original_file": os.path.basename(file)
                    }
                    data_list.append(entry)
        except Exception as e:
            print(f"[!] Error reading {file}: {e}")

    # 2. Create DataFrame
    df = pd.DataFrame(data_list)
    print(f"[*] Total loaded rows: {len(df)}")

    # 3. Basic Cleaning
    # Drop rows where instruction or output is null
    initial_count = len(df)
    df = df.dropna(subset=['instruction', 'output'])
    
    # Drop rows with empty strings or too short
    df = df[df['output'].str.len() > 10]
    df = df[df['instruction'].str.len() > 5]
    
    final_count = len(df)
    print(f"[*] Dropped {initial_count - final_count} bad rows (nulls or too short).")

    # 4. Save to Parquet
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    df.to_parquet(OUTPUT_FILE)
    print(f"[+] Saved normalized data to {OUTPUT_FILE}")

if __name__ == "__main__":
    ingest_data()
