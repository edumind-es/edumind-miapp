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

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select
from app.db import engine, init_db
from app.models import User, UserRole
from app.core.config import settings
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init():
    if not settings.ADMIN_PASSWORD:
        raise RuntimeError("ADMIN_PASSWORD is not configured. Set ADMIN_PASSWORD in .env before creating admin.")

    init_db()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == "admin")).first()
        if not user:
            print("Creating admin user...")
            admin = User(
                username="admin",
                email="admin@edumind.es",
                role=UserRole.ADMIN,
                hashed_password=pwd_context.hash(settings.ADMIN_PASSWORD),
                is_active=True
            )
            session.add(admin)
            session.commit()
            print("Admin created.")
        else:
            print("Admin already exists.")

if __name__ == "__main__":
    init()
