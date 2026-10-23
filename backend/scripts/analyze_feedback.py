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

import os
import requests
import sqlite3
from datetime import datetime, timedelta

# Configuration
DB_PATH = "edumind.db"
OLLAMA_URL = os.getenv("OLLAMA_GENERATE_URL", "http://127.0.0.1:11435/api/generate")
MODEL_NAME = os.getenv("OLLAMA_DEFAULT_MODEL", "gemma4:e4b")

def fetch_feedback():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    one_week_ago = datetime.utcnow() - timedelta(days=7)
    
    query = "SELECT content, rating, context FROM appfeedback WHERE created_at > ?"
    cursor.execute(query, (one_week_ago,))
    rows = cursor.fetchall()
    conn.close()
    return rows

def analyze_and_report(feedback_rows):
    if not feedback_rows:
        print("[*] No new feedback this week.")
        return

    # Prepare Analysis Prompt
    feedback_text = "\n".join([f"- Rating {r}/5: {c} (Context: {ctx})" for c, r, ctx in feedback_rows])
    
    prompt = f"""You are a Product Manager for 'EDUmind AI'.
Weekly Feedback Data:
{feedback_text}

Task:
1. Identify top 3 technical issues.
2. Identify top 3 feature requests.
3. Calculate sentiment trend.
4. Write a concise weekly report for the engineering team.

Report:"""

    print(f"[*] Generating Weekly Report with {MODEL_NAME}...")
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False
        })
        if resp.status_code == 200:
            report = resp.json()['response']
            
            # Save Report
            filename = f"reports/weekly_{datetime.now().strftime('%Y-%m-%d')}.md"
            os.makedirs("reports", exist_ok=True)
            with open(filename, "w") as f:
                f.write(report)
            print(f"[+] Report saved to {filename}")
            print(report)
        else:
            print(f"[!] Ollama Error: {resp.status_code}")

    except Exception as e:
        print(f"[!] Analysis failed: {e}")

if __name__ == "__main__":
    rows = fetch_feedback()
    analyze_and_report(rows)
