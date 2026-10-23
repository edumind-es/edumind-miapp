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

from fastapi import APIRouter, Depends, Request
from app.core.queue_manager import queue_manager, QueueStatus
from app.core.security import get_client_ip
from app.api.v1.auth import get_current_user_optional, require_admin_from_vpn
from app.models import User, UserRole

router = APIRouter()

@router.get("/status", response_model=QueueStatus)
async def get_queue_status(
    request: Request,
    current_user: User | None = Depends(get_current_user_optional)
):
    """
    Returns the current user's position in the queue.
    Identifies user by DB ID (if logged in) or IP address.
    """
    # Identify User
    if current_user:
        user_id = f"user_{current_user.id}"
        is_admin = (current_user.role == UserRole.ADMIN)
    else:
        user_id = f"ip_{get_client_ip(request)}"
        is_admin = False

    return await queue_manager.peek_status(user_id, is_admin)


@router.get("/runtime")
async def get_queue_runtime(
    _admin: User = Depends(require_admin_from_vpn),
):
    """Queue runtime diagnostics (admin only)."""
    return await queue_manager.get_runtime_status()
