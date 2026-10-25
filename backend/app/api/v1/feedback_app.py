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
from sqlmodel import Session
from app.db import get_session
from app.models import AppFeedback, User
from app.api.v1.auth import get_current_user_optional
from pydantic import BaseModel, Field
from app.core.rate_limit import limiter

router = APIRouter()



class FeedbackCreate(BaseModel):
    content: str = Field(min_length=2, max_length=4000)
    rating: int = Field(default=5, ge=1, le=5)
    context: str = Field(default="general", max_length=80)

@router.post("/", response_model=AppFeedback)
@limiter.limit("30/minute")
async def create_app_feedback(
    request: Request,
    feedback: FeedbackCreate,
    session: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional)
):
    user_id = current_user.id if current_user else None
    
    db_feedback = AppFeedback(
        content=feedback.content,
        rating=feedback.rating,
        context=feedback.context,
        user_id=user_id
    )
    session.add(db_feedback)
    session.commit()
    session.refresh(db_feedback)
    return db_feedback
