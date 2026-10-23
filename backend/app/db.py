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

import logging

from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_sqlite_url(database_url: str) -> bool:
    return make_url(database_url).get_backend_name() == "sqlite"


def build_engine(database_url: str):
    engine_kwargs = {"echo": False}

    if _is_sqlite_url(database_url):
        engine_kwargs["connect_args"] = {
            "check_same_thread": False,
            "timeout": settings.DB_CONNECT_TIMEOUT_SECONDS,
        }
    else:
        engine_kwargs.update(
            {
                "pool_size": settings.DB_POOL_SIZE,
                "max_overflow": settings.DB_MAX_OVERFLOW,
                "pool_timeout": settings.DB_POOL_TIMEOUT_SECONDS,
                "pool_recycle": settings.DB_POOL_RECYCLE_SECONDS,
                "pool_pre_ping": True,
                "connect_args": {
                    "connect_timeout": settings.DB_CONNECT_TIMEOUT_SECONDS,
                },
            }
        )

    engine = create_engine(database_url, **engine_kwargs)

    if _is_sqlite_url(database_url):
        @event.listens_for(engine, "connect")
        def _configure_sqlite(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            try:
                if settings.DB_ENABLE_SQLITE_FOREIGN_KEYS:
                    cursor.execute("PRAGMA foreign_keys=ON")
                if settings.DB_ENABLE_SQLITE_WAL:
                    cursor.execute("PRAGMA journal_mode=WAL")
                    cursor.execute("PRAGMA synchronous=NORMAL")
                cursor.execute(
                    f"PRAGMA busy_timeout={settings.DB_CONNECT_TIMEOUT_SECONDS * 1000}"
                )
            finally:
                cursor.close()

    return engine


engine = build_engine(settings.DATABASE_URL)


def init_db():
    if settings.DB_MANAGED_BY_ALEMBIC:
        logger.info("DB schema managed by Alembic; startup bootstrap disabled.")
        return
    if not settings.DB_AUTO_CREATE:
        logger.info("DB auto-create disabled by configuration.")
        return
    if not _is_sqlite_url(settings.DATABASE_URL):
        raise RuntimeError(
            "DB_AUTO_CREATE is only supported for SQLite development databases."
        )
    logger.info("Bootstrapping SQLite schema via SQLModel metadata for development.")
    SQLModel.metadata.create_all(engine)
    logger.info("SQLite schema bootstrap finished.")

def get_session():
    with Session(engine) as session:
        yield session
