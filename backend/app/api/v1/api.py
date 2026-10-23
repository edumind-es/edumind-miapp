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

from fastapi import APIRouter
from app.api.v1 import (
    admin,
    auth,
    chat,
    config,
    dataset,
    export,
    feedback,
    feedback_app,
    generators,
    health,
    knowledge,
    normative,
    queue,
    telemetry,
    training,
)
from app.api.v1 import classroom, planner, resources

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(training.router, prefix="/training", tags=["training"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(dataset.router, prefix="/dataset", tags=["dataset"])
api_router.include_router(generators.router, prefix="/generators", tags=["generators"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(queue.router, prefix="/queue", tags=["queue"])
api_router.include_router(feedback_app.router, prefix="/app-feedback", tags=["app-feedback"])
api_router.include_router(config.router, prefix="/config", tags=["config"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(normative.router, prefix="/normative", tags=["normative"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"])

# Teacher Premium - Gestión de Clases
api_router.include_router(classroom.router, prefix="/classroom", tags=["classroom"])
api_router.include_router(planner.router, prefix="/planner", tags=["planner"])
api_router.include_router(resources.router, prefix="/resources", tags=["resources"])
