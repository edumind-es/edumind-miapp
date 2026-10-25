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

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.db import get_session
from app.models import TrainingItem, TrainingItemSource, User
from pydantic import BaseModel, Field
from app.api.v1.auth import get_current_user
from app.services.dataset_privacy import scrub_personal_data

router = APIRouter()

class FeedbackRequest(BaseModel):
    instruction: str = Field(min_length=3, max_length=12000)
    output: str = Field(min_length=3, max_length=80000)
    source: str = Field(default="chat", min_length=2, max_length=50)
    quality_score: int = Field(ge=1, le=5)
    # Consentimiento explícito: el texto pasa a un dataset de entrenamiento revisado por humanos.
    consent: bool = False

@router.post("")
async def save_feedback(
    feedback: FeedbackRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not feedback.consent:
        raise HTTPException(
            status_code=422,
            detail="Para guardar esta respuesta en el dataset hace falta tu consentimiento explícito.",
        )

    instruction, _ = scrub_personal_data(feedback.instruction)
    output, _ = scrub_personal_data(feedback.output)

    try:
        source_map = {
            "chat": TrainingItemSource.CHAT,
            "chat_log": TrainingItemSource.CHAT,
            "manual": TrainingItemSource.MANUAL,
            "pdf_extract": TrainingItemSource.PDF,
        }
        source_enum = source_map.get(feedback.source.lower(), TrainingItemSource.CHAT)

        item = TrainingItem(
            instruction=instruction,
            output=output,
            source=source_enum,
            quality_score=feedback.quality_score,
            is_verified=False,
            creator_id=current_user.id,
        )

        session.add(item)
        session.commit()
        session.refresh(item)

        return {"status": "success", "id": item.id}
    except Exception as exc:
        print(f"Feedback save error: {exc}")
        raise HTTPException(status_code=500, detail="Could not save feedback.")
