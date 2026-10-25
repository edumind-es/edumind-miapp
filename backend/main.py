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

import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.security import get_client_ip
from app.core.anonymous_session import ensure_anonymous_cookie
from app.db import init_db
from app.services.metrics_service import metrics

# Rate Limiter
def _limit_key(request):
    return get_client_ip(request)


limiter = Limiter(key_func=_limit_key, default_limits=["200/minute"])

# Create App
# La documentación interactiva y el esquema OpenAPI solo se sirven en
# desarrollo: en producción publicarían todas las rutas, incluidas las de admin.
_expose_api_docs = settings.RUNTIME_ENV == "development"
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if _expose_api_docs else None,
    docs_url="/docs" if _expose_api_docs else None,
    redoc_url="/redoc" if _expose_api_docs else None,
)

# Attach limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
elif settings.DEBUG:
    # Development-only convenience.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.on_event("startup")
def on_startup():
    init_db()
    _purge_old_activity_logs()


def _purge_old_activity_logs():
    """Aplica la política de retención al arrancar; un fallo aquí no impide servir."""
    try:
        from sqlmodel import Session

        from app.db import engine
        from app.services.retention_service import purge_activity_log

        with Session(engine) as session:
            purge_activity_log(session)
    except Exception:  # pragma: no cover - solo registro
        import logging

        logging.getLogger(__name__).exception("No se pudo aplicar la retención de ActivityLog")


@app.middleware("http")
async def metrics_middleware(request, call_next):
    start = time.time()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        duration_ms = (time.time() - start) * 1000
        metrics.record_request(request.url.path, duration_ms, status)


@app.middleware("http")
async def anonymous_session_middleware(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith(f"{settings.API_V1_STR}/"):
        ensure_anonymous_cookie(request, response)
    return response

@app.get("/")
def root():
    return {"message": "Welcome to EDUMind MiApp API", "docs": "/docs" if _expose_api_docs else None}

from app.api.v1.api import api_router
app.include_router(api_router, prefix=settings.API_V1_STR)
