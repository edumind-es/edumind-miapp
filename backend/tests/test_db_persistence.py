#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#

import pytest
from pydantic import ValidationError

from app.core.config import Settings


BASE_SETTINGS = {
    "_env_file": None,
    "SECRET_KEY": "a" * 48,
    "OLLAMA_URL": "http://127.0.0.1:11435/api/chat",
    "OLLAMA_DEFAULT_MODEL": "gemma4:e4b",
}


def test_settings_normalize_release_debug_to_false():
    settings = Settings(**BASE_SETTINGS, DEBUG="release")
    assert settings.DEBUG is False


def test_settings_allow_sqlite_bootstrap_in_development():
    settings = Settings(
        **BASE_SETTINGS,
        RUNTIME_ENV="development",
        DATABASE_URL="sqlite:///./edumind.db",
        DB_AUTO_CREATE=True,
        DB_MANAGED_BY_ALEMBIC=False,
    )
    assert settings.DATABASE_URL == "sqlite:///./edumind.db"


def test_settings_reject_sqlite_in_production():
    with pytest.raises(ValidationError):
        Settings(
            **BASE_SETTINGS,
            RUNTIME_ENV="production",
            DATABASE_URL="sqlite:///./edumind.db",
            DB_AUTO_CREATE=False,
            DB_MANAGED_BY_ALEMBIC=True,
        )


def test_settings_require_alembic_for_postgres():
    with pytest.raises(ValidationError):
        Settings(
            **BASE_SETTINGS,
            RUNTIME_ENV="production",
            DATABASE_URL="postgresql+psycopg://edumind:secret@127.0.0.1:5435/edumind_miapp",
            DB_AUTO_CREATE=False,
            DB_MANAGED_BY_ALEMBIC=False,
        )
