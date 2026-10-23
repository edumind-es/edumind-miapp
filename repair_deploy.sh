#!/bin/bash

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

# 1. Fix Systemd Service (Use simplified environment)
echo "Fixing Systemd Service..."
sudo tee /etc/systemd/system/edumind-miapp.service <<EOF
[Unit]
Description=EDUMind MiApp Backend API
After=network.target

[Service]
User=nuevoadmin
Group=www-data
WorkingDirectory=/var/www/edumind_miapp/backend
# Point directly to the python binary in venv
ExecStart=/var/www/edumind_miapp/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 3
EnvironmentFile=/var/www/edumind_miapp/backend/.env
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl restart edumind-miapp

echo "Checking Service Status..."
sudo systemctl status edumind-miapp --no-pager

# 2. Fix Nginx Conflicts
echo "Fixing Nginx..."
# Remove the problematic old config causing the certificate error
if [ -f /etc/nginx/sites-enabled/miapp.losmundosedufis.com ]; then
    echo "Disabling conflicting site: miapp.losmundosedufis.com"
    sudo rm /etc/nginx/sites-enabled/miapp.losmundosedufis.com
fi

# Reload Nginx
sudo nginx -t && sudo systemctl reload nginx

# 3. Certbot
echo "Running Certbot..."
sudo certbot --nginx -d app.edumind.es
