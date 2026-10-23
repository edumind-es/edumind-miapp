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
import requests
import os
import time
from concurrent.futures import ThreadPoolExecutor
import argparse

# Configuration
INPUT_FILE = "dataset/processed/01_normalized.parquet"
OUTPUT_FILE = "dataset/processed/02_qualified.parquet"
OLLAMA_URL = os.getenv("OLLAMA_GENERATE_URL", "http://127.0.0.1:11435/api/generate")
MODEL_NAME = os.getenv("OLLAMA_DEFAULT_MODEL", "gemma4:e4b")

def evaluate_quality(instruction, output):
    """
    Sends a pair to Ollama to evaluate quality.
    """
    prompt = f"""Task: Evaluate the quality of the following AI interaction.
Criteria: The response must be helpful, accurate, and safe. It must directly answer the instruction.
Reply ONLY with 'KEEP' or 'DISCARD'.

Instruction: {instruction}
Response: {output}

Verdict:"""

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.0,
                "num_predict": 10
            }
        })
        if resp.status_code == 200:
            verdict = resp.json()['response'].strip().upper()
            if "KEEP" in verdict:
                return "KEEP"
            return "DISCARD"
        return "ERROR"
    except Exception as e:
        print(f"[!] Evaluation error: {e}")
        return "ERROR"

def process_batch(df_chunk):
    results = []
    # Using ThreadPool for concurrency since Ollama handles requests sequentially but network IO benefits from threads
    # Or purely sequential if Ollama is CPU bound on single request.
    # Let's do sequential for safety on local hardware unless specifically parallelized.
    for index, row in df_chunk.iterrows():
        verdict = evaluate_quality(row['instruction'], row['output'])
        results.append(verdict)
        if index % 10 == 0:
            print(f".", end="", flush=True)
    return results

def filter_data():
    print(f"[*] Starting Phase 2: Semantic Filtering using {MODEL_NAME}")
    
    if not os.path.exists(INPUT_FILE):
        print(f"[!] Input file {INPUT_FILE} not found. Run Phase 1 first.")
        return

    df = pd.read_parquet(INPUT_FILE)
    print(f"[*] Loaded {len(df)} rows for evaluation.")

    # 1. Deduplication (Text based for speed)
    initial_count = len(df)
    df = df.drop_duplicates(subset=['instruction'])
    print(f"[*] Removed {initial_count - len(df)} exact duplicates.")

    # 2. LLM Evaluation
    print(f"[*] Starting LLM Judge (This may take time)...")
    
    # For demo purposes/speed, let's limit to 50 rows if dataset is huge, 
    # but for production removed limit. 
    # We will process all.
    
    t_start = time.time()
    
    # Adding a quality column
    # Use apply with simple progress indication
    # Note: iterating rows is slow but fine for batch jobs in background
    
    results = []
    total = len(df)
    for i, (index, row) in enumerate(df.iterrows()):
        res = evaluate_quality(row['instruction'], row['output'])
        results.append(res)
        if i % 5 == 0:
            print(f"[{i}/{total}] {res}")

    df['judge_verdict'] = results
    
    t_end = time.time()
    print(f"\n[*] Evaluation complete in {t_end - t_start:.2f} seconds.")

    # 3. Filter
    df_clean = df[df['judge_verdict'] == 'KEEP'].copy()
    discarded = len(df) - len(df_clean)
    
    print(f"[*] Keep: {len(df_clean)} | Discarded: {discarded}")

    # 4. Save
    df_clean.to_parquet(OUTPUT_FILE)
    print(f"[+] Saved qualified data to {OUTPUT_FILE}")

if __name__ == "__main__":
    filter_data()
