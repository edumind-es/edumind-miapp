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

from sqlmodel import Session, select
from app.db import engine
from app.models import User, UserRole
from app.api.v1.auth import get_password_hash
from app.core.config import settings

def create_admin():
    if not settings.ADMIN_PASSWORD:
        raise RuntimeError("ADMIN_PASSWORD is not configured. Set ADMIN_PASSWORD in .env before running create_admin.")

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == "admin")).first()
        if not user:
            print("Creating admin user from environment...")
            admin = User(
                username="admin",
                email="admin@edumind.es",
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True
            )
            session.add(admin)
            session.commit()
            print("Admin created successfully.")
        else:
            print("Admin already exists.")

if __name__ == "__main__":
    create_admin()
