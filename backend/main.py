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
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
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
    return {"message": "Welcome to EDUMind MiApp API", "docs": "/docs"}

from app.api.v1.api import api_router
app.include_router(api_router, prefix=settings.API_V1_STR)
