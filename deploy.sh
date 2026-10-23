#!/usr/bin/env bash

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
# ============================================================================
# EDUmind MiApp - Deploy Script
# ============================================================================
set -euo pipefail

echo "🚀 Deploying EDUmind MiApp..."

ROOT_DIR="/var/www/edumind_miapp"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

"${ROOT_DIR}/scripts/preflight_release.sh"
cd "${ROOT_DIR}"

# Frontend
if [[ -d "${FRONTEND_DIR}" ]]; then
    echo "📦 Building frontend..."
    cd "${FRONTEND_DIR}"
    npm ci
    npm run build
fi

# Backend
if [[ -d "${BACKEND_DIR}" ]]; then
    echo "🐍 Installing Python dependencies..."
    cd "${BACKEND_DIR}"
    if [[ -f ".venv/bin/activate" ]]; then
        source .venv/bin/activate
    elif [[ -f "venv/bin/activate" ]]; then
        source venv/bin/activate
    else
        python3 -m venv .venv
        source .venv/bin/activate
    fi
    pip install -r requirements.txt -q
    echo "💾 Creating backup before migrations..."
    ./scripts/backup_db.sh
    echo "🗄️ Applying database migrations..."
    python scripts/run_migrations.py upgrade head
fi

echo "🔄 Restarting runtime..."
"${ROOT_DIR}/scripts/reload_runtime_services.sh"

echo "🧪 Running post-deploy smoke..."
"${ROOT_DIR}/scripts/post_deploy_smoke.sh" --public-mode either

echo "✅ EDUmind MiApp deployed successfully!"
