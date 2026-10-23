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

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator, model_validator
from pathlib import Path
from sqlalchemy.engine import make_url

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "EDUMind MiApp"
    RUNTIME_ENV: str = "development"  # development | staging | production
    APP_BASE_URL: Optional[AnyHttpUrl] = None
    
    # Security
    SECRET_KEY: Optional[str] = None
    DEBUG: bool = False
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    ADMIN_PASSWORD: Optional[str] = None
    TRUSTED_PROXIES: List[str] = ["127.0.0.1", "::1"]
    MAX_UPLOAD_SIZE_MB: int = 10
    AUTH_COOKIE_NAME: str = "edumind_access_token"
    CSRF_COOKIE_NAME: str = "edumind_csrf_token"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"
    SESSION_COOKIE_SECURE: bool = True
    SESSION_COOKIE_SAMESITE: str = "lax"
    SESSION_COOKIE_DOMAIN: Optional[str] = None
    ADMIN_PORTAL_PATH: str = "/portal-ops-7f3d9a"
    AUTH_MODE: str = "local"  # local | authentik
    AUTH_LOCAL_LOGIN_ENABLED: Optional[bool] = None
    AUTHENTIK_ISSUER_URL: Optional[AnyHttpUrl] = None
    AUTHENTIK_CLIENT_ID: Optional[str] = None
    AUTHENTIK_CLIENT_SECRET: Optional[str] = None
    AUTHENTIK_SCOPES: str = "openid profile email"
    AUTHENTIK_ROLE_CLAIM: str = "groups"
    AUTHENTIK_USERNAME_CLAIM: str = "preferred_username"
    AUTHENTIK_EMAIL_CLAIM: str = "email"
    AUTHENTIK_ADMIN_MATCHES: str = "edumind-admin"
    AUTHENTIK_TEACHER_PREMIUM_MATCHES: str = "edumind-teacher-premium"
    AUTHENTIK_DEFAULT_ROLE: str = "docente"
    AUTHENTIK_REDIRECT_PATH: str = "/api/v1/auth/sso/callback"
    AUTHENTIK_POST_LOGOUT_PATH: str = "/login"
    AUTHENTIK_ALLOWED_RETURN_ORIGINS: str = ""
    ANON_SESSION_COOKIE_NAME: str = "edumind_anon_session"
    ANON_SESSION_COOKIE_MAX_AGE_SECONDS: int = 60 * 60 * 24 * 30  # 30 days
    
    # Database
    DATABASE_URL: str = "sqlite:///./edumind.db"
    DB_AUTO_CREATE: bool = True
    DB_MANAGED_BY_ALEMBIC: bool = False
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT_SECONDS: int = 30
    DB_POOL_RECYCLE_SECONDS: int = 1800
    DB_CONNECT_TIMEOUT_SECONDS: int = 5
    DB_ENABLE_SQLITE_WAL: bool = True
    DB_ENABLE_SQLITE_FOREIGN_KEYS: bool = True
    BACKGROUND_TASK_MAX_ATTEMPTS: int = 3
    BACKGROUND_TASK_RETRY_BASE_SECONDS: int = 30
    BACKGROUND_TASK_DOCUMENT_TIMEOUT_SECONDS: int = 120
    BACKGROUND_TASK_ALERT_TIMEOUT_SECONDS: int = 6
    BACKGROUND_TASK_CIRCUIT_BREAKER_THRESHOLD: int = 3
    BACKGROUND_TASK_CIRCUIT_BREAKER_OPEN_SECONDS: int = 120
    BACKGROUND_TASK_REDIS_PREFIX: str = "edumind:background:v1"
    
    # AI Keys (System Level)
    DEEPSEEK_API_KEY: Optional[str] = None
    CLAUDE_API_KEY: Optional[str] = None
    MISTRAL_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    OLLAMA_URL: str = "http://127.0.0.1:11435/api/chat"
    OLLAMA_GENERATE_URL: Optional[str] = None
    OLLAMA_DEFAULT_MODEL: str = "gemma4:e4b"
    
    # Core
    EDUMIND_CORE_URL: Optional[str] = None
    EDUMIND_CORE_TOKEN: Optional[str] = None

    # Cache / Redis
    REDIS_URL: Optional[str] = None
    NORMATIVE_CACHE_BACKEND: str = "auto"  # auto | redis | memory
    NORMATIVE_CACHE_TTL_SECONDS: int = 600
    NORMATIVE_CACHE_MAX_ENTRIES: int = 200
    NORMATIVE_CACHE_PREFIX: str = "edumind:normative:search:v1"

    # Queue backend
    QUEUE_BACKEND: str = "auto"  # auto | redis | memory
    QUEUE_MAX_CONCURRENT_USERS: int = 5
    QUEUE_TIMEOUT_SECONDS: int = 300
    QUEUE_REDIS_PREFIX: str = "edumind:queue:v1"

    # Admission backend
    ADMISSION_BACKEND: str = "auto"  # auto | redis | memory
    ADMISSION_REDIS_PREFIX: str = "edumind:admission:v1"

    # SLO targets
    SLO_TARGET_AVAILABILITY: float = 99.5
    SLO_TARGET_P95_MS: int = 1200

    # Admission control (open app sustainability)
    ADMISSION_MANAGED_PUBLIC_ENABLED: bool = True
    ADMISSION_ANON_WINDOW_SECONDS: int = 900
    ADMISSION_ANON_MAX_REQUESTS: int = 20
    ADMISSION_ANON_COOLDOWN_SECONDS: int = 600
    ADMISSION_ANON_MAX_INPUT_CHARS: int = 8000
    ADMISSION_LOAD_SHED_ENABLED: bool = True
    ADMISSION_LOAD_SHED_QUEUE_UTILIZATION: float = 0.9
    ADMISSION_LOAD_SHED_MIN_ACTIVE: int = 4
    ADMISSION_ABUSE_WINDOW_SECONDS: int = 600
    ADMISSION_ABUSE_CHALLENGE_THRESHOLD: int = 5
    ADMISSION_CONFIG_CACHE_SECONDS: int = 5
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATASET_DIR: Path = BASE_DIR / "dataset"
    UPLOADS_DIR: Path = BASE_DIR / "uploads"
    TRAINING_DIR: Path = BASE_DIR / "training"
    # Índice de matrices curriculares (generado por scripts/importar_matrices_idoceo.py)
    CURRICULUM_INDEX_PATH: Path = BASE_DIR / "curriculo" / "matrices_idoceo.json.gz"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("DEBUG", mode="before")
    @classmethod
    def normalize_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production", "false", "0", "no", "off"}:
                return False
            if normalized in {"debug", "dev", "development", "true", "1", "yes", "on"}:
                return True
        return value

    @field_validator("RUNTIME_ENV", mode="before")
    @classmethod
    def normalize_runtime_env(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("AUTH_MODE", mode="before")
    @classmethod
    def normalize_auth_mode(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("ADMIN_PORTAL_PATH", mode="before")
    @classmethod
    def normalize_admin_portal_path(cls, value):
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return "/portal-ops-7f3d9a"
            if not raw.startswith("/"):
                raw = f"/{raw}"
            if raw != "/" and raw.endswith("/"):
                raw = raw.rstrip("/")
            return raw
        return value

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def validate_security(self):
        if not self.SECRET_KEY:
            raise ValueError("Missing required env: SECRET_KEY")
        insecure_secret_defaults = {
            "change-me-in-production-please-secret-key-123",
            "changeme",
            "secret",
            "test-secret",
        }
        if (self.SECRET_KEY in insecure_secret_defaults or len(self.SECRET_KEY) < 32) and not self.DEBUG:
            raise ValueError(
                "Insecure SECRET_KEY detected. Configure a strong SECRET_KEY (>=32 chars) in .env for production."
            )
        if self.RUNTIME_ENV not in {"development", "staging", "production"}:
            raise ValueError("RUNTIME_ENV must be one of: development, staging, production")
        if self.AUTH_MODE not in {"local", "authentik"}:
            raise ValueError("AUTH_MODE must be one of: local, authentik")
        if self.ADMIN_PORTAL_PATH in {"/", "/admin", "/login"} or self.ADMIN_PORTAL_PATH.startswith("/api/"):
            raise ValueError("ADMIN_PORTAL_PATH must be a non-public application path distinct from /admin, /login and /api/*")
        if self.MAX_UPLOAD_SIZE_MB < 1:
            raise ValueError("MAX_UPLOAD_SIZE_MB must be >= 1")
        if self.SESSION_COOKIE_SAMESITE.lower() not in {"lax", "strict", "none"}:
            raise ValueError("SESSION_COOKIE_SAMESITE must be one of: lax, strict, none")
        if self.SESSION_COOKIE_SAMESITE.lower() == "none" and not self.SESSION_COOKIE_SECURE:
            raise ValueError("SESSION_COOKIE_SECURE must be true when SESSION_COOKIE_SAMESITE is 'none'")
        if self.ANON_SESSION_COOKIE_MAX_AGE_SECONDS < 60:
            raise ValueError("ANON_SESSION_COOKIE_MAX_AGE_SECONDS must be >= 60")
        if self.NORMATIVE_CACHE_BACKEND.lower() not in {"auto", "redis", "memory"}:
            raise ValueError("NORMATIVE_CACHE_BACKEND must be one of: auto, redis, memory")
        if self.NORMATIVE_CACHE_TTL_SECONDS < 1:
            raise ValueError("NORMATIVE_CACHE_TTL_SECONDS must be >= 1")
        if self.NORMATIVE_CACHE_MAX_ENTRIES < 1:
            raise ValueError("NORMATIVE_CACHE_MAX_ENTRIES must be >= 1")
        if self.QUEUE_BACKEND.lower() not in {"auto", "redis", "memory"}:
            raise ValueError("QUEUE_BACKEND must be one of: auto, redis, memory")
        if self.QUEUE_MAX_CONCURRENT_USERS < 1:
            raise ValueError("QUEUE_MAX_CONCURRENT_USERS must be >= 1")
        if self.QUEUE_TIMEOUT_SECONDS < 10:
            raise ValueError("QUEUE_TIMEOUT_SECONDS must be >= 10")
        if self.ADMISSION_BACKEND.lower() not in {"auto", "redis", "memory"}:
            raise ValueError("ADMISSION_BACKEND must be one of: auto, redis, memory")
        if not self.OLLAMA_URL.startswith(("http://", "https://")):
            raise ValueError("OLLAMA_URL must start with http:// or https://")
        if not self.OLLAMA_DEFAULT_MODEL.strip():
            raise ValueError("OLLAMA_DEFAULT_MODEL must not be empty")
        if not (50 <= self.SLO_TARGET_AVAILABILITY <= 100):
            raise ValueError("SLO_TARGET_AVAILABILITY must be between 50 and 100")
        if self.SLO_TARGET_P95_MS < 1:
            raise ValueError("SLO_TARGET_P95_MS must be >= 1")
        if self.ADMISSION_ANON_WINDOW_SECONDS < 30:
            raise ValueError("ADMISSION_ANON_WINDOW_SECONDS must be >= 30")
        if self.ADMISSION_ANON_MAX_REQUESTS < 1:
            raise ValueError("ADMISSION_ANON_MAX_REQUESTS must be >= 1")
        if self.ADMISSION_ANON_COOLDOWN_SECONDS < 1:
            raise ValueError("ADMISSION_ANON_COOLDOWN_SECONDS must be >= 1")
        if self.ADMISSION_ANON_MAX_INPUT_CHARS < 256:
            raise ValueError("ADMISSION_ANON_MAX_INPUT_CHARS must be >= 256")
        if not (0.5 <= self.ADMISSION_LOAD_SHED_QUEUE_UTILIZATION <= 1.0):
            raise ValueError("ADMISSION_LOAD_SHED_QUEUE_UTILIZATION must be between 0.5 and 1.0")
        if self.ADMISSION_LOAD_SHED_MIN_ACTIVE < 1:
            raise ValueError("ADMISSION_LOAD_SHED_MIN_ACTIVE must be >= 1")
        if self.ADMISSION_ABUSE_WINDOW_SECONDS < 30:
            raise ValueError("ADMISSION_ABUSE_WINDOW_SECONDS must be >= 30")
        if self.ADMISSION_ABUSE_CHALLENGE_THRESHOLD < 1:
            raise ValueError("ADMISSION_ABUSE_CHALLENGE_THRESHOLD must be >= 1")
        if self.ADMISSION_CONFIG_CACHE_SECONDS < 1:
            raise ValueError("ADMISSION_CONFIG_CACHE_SECONDS must be >= 1")
        if self.AUTH_MODE == "authentik":
            if not self.AUTHENTIK_ISSUER_URL:
                raise ValueError("AUTHENTIK_ISSUER_URL is required when AUTH_MODE=authentik")
            if not self.AUTHENTIK_CLIENT_ID:
                raise ValueError("AUTHENTIK_CLIENT_ID is required when AUTH_MODE=authentik")
            if not self.AUTHENTIK_CLIENT_SECRET:
                raise ValueError("AUTHENTIK_CLIENT_SECRET is required when AUTH_MODE=authentik")
            if not self.APP_BASE_URL:
                raise ValueError("APP_BASE_URL is required when AUTH_MODE=authentik")
        if self.AUTHENTIK_DEFAULT_ROLE not in {"admin", "teacher_premium", "docente", "opositor", "centro"}:
            raise ValueError("AUTHENTIK_DEFAULT_ROLE must be a valid UserRole value")
        if not self.AUTHENTIK_REDIRECT_PATH.startswith("/"):
            raise ValueError("AUTHENTIK_REDIRECT_PATH must start with /")
        if not self.AUTHENTIK_POST_LOGOUT_PATH.startswith("/"):
            raise ValueError("AUTHENTIK_POST_LOGOUT_PATH must start with /")
        parsed_db_url = make_url(self.DATABASE_URL)
        backend_name = parsed_db_url.get_backend_name()
        if backend_name not in {"sqlite", "postgresql"}:
            raise ValueError("DATABASE_URL must use sqlite or postgresql")
        if self.DB_POOL_SIZE < 1:
            raise ValueError("DB_POOL_SIZE must be >= 1")
        if self.DB_MAX_OVERFLOW < 0:
            raise ValueError("DB_MAX_OVERFLOW must be >= 0")
        if self.DB_POOL_TIMEOUT_SECONDS < 1:
            raise ValueError("DB_POOL_TIMEOUT_SECONDS must be >= 1")
        if self.DB_POOL_RECYCLE_SECONDS < 30:
            raise ValueError("DB_POOL_RECYCLE_SECONDS must be >= 30")
        if self.DB_CONNECT_TIMEOUT_SECONDS < 1:
            raise ValueError("DB_CONNECT_TIMEOUT_SECONDS must be >= 1")
        if self.BACKGROUND_TASK_MAX_ATTEMPTS < 1:
            raise ValueError("BACKGROUND_TASK_MAX_ATTEMPTS must be >= 1")
        if self.BACKGROUND_TASK_RETRY_BASE_SECONDS < 1:
            raise ValueError("BACKGROUND_TASK_RETRY_BASE_SECONDS must be >= 1")
        if self.BACKGROUND_TASK_DOCUMENT_TIMEOUT_SECONDS < 5:
            raise ValueError("BACKGROUND_TASK_DOCUMENT_TIMEOUT_SECONDS must be >= 5")
        if self.BACKGROUND_TASK_ALERT_TIMEOUT_SECONDS < 1:
            raise ValueError("BACKGROUND_TASK_ALERT_TIMEOUT_SECONDS must be >= 1")
        if self.BACKGROUND_TASK_CIRCUIT_BREAKER_THRESHOLD < 1:
            raise ValueError("BACKGROUND_TASK_CIRCUIT_BREAKER_THRESHOLD must be >= 1")
        if self.BACKGROUND_TASK_CIRCUIT_BREAKER_OPEN_SECONDS < 5:
            raise ValueError("BACKGROUND_TASK_CIRCUIT_BREAKER_OPEN_SECONDS must be >= 5")
        if self.DB_MANAGED_BY_ALEMBIC and self.DB_AUTO_CREATE:
            raise ValueError("DB_AUTO_CREATE must be false when DB_MANAGED_BY_ALEMBIC is enabled")
        if backend_name == "postgresql":
            if parsed_db_url.username is None or parsed_db_url.password is None:
                raise ValueError("PostgreSQL DATABASE_URL must include username and password")
            if self.DB_AUTO_CREATE:
                raise ValueError("DB_AUTO_CREATE must be false for PostgreSQL deployments")
            if not self.DB_MANAGED_BY_ALEMBIC:
                raise ValueError("DB_MANAGED_BY_ALEMBIC must be true for PostgreSQL deployments")
        if self.RUNTIME_ENV in {"staging", "production"} and backend_name == "sqlite":
            raise ValueError("SQLite is not allowed when RUNTIME_ENV is staging or production")
        return self

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

# Ensure directories exist
settings.DATASET_DIR.mkdir(parents=True, exist_ok=True)
settings.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
settings.TRAINING_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_ENGINES = ["chatgpt", "deepseek", "claude", "gemini", "edumind", "ollama", "mistral"]
