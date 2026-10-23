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

"""
Smart model routing for EDUmind AI.

Routes between:
- Gemma 4 E4B (Ollama): general local assistant for server-side flows
- EDUmind Core: higher-latency managed path for richer educational output

Routing algorithm based on:
1. Task type complexity
2. Content length requirement
3. Educational structure needs
"""

from enum import Enum
from typing import Tuple

from app.core.config import settings

class ModelTier(Enum):
    FAST = "gemma4_e4b"     # Ollama Gemma 4 E4B - local default
    QUALITY = "edumind_v2"  # EDUmind Core - managed high quality route


# Task complexity classification
COMPLEX_TASKS = {
    "situation",      # Situación de Aprendizaje - needs full structure
    "planning",       # Planificación - detailed curriculum
    "stem",           # STEM projects - complex interdisciplinary
    "topic",          # Tema de oposición - extensive development
    "defense",        # Defensa oral - structured argumentation
    "case",           # Supuesto práctico - normative analysis
    "institution_doc",# Documentación institucional - formal
    "reinforcement_plan",  # Plan de refuerzo - analisis y estructura normativa
}

SIMPLE_TASKS = {
    "idea",           # Quick consultation
    "session",        # Single session (can be shortened)
    "minutes",        # Meeting minutes - structured but simple
    "diversity",      # Can be quick assessment
}


def estimate_response_time(model: ModelTier, task_type: str) -> int:
    """Estimate response time in seconds."""
    if model == ModelTier.FAST:
        return 8  # Gemma 4 E4B remains local but is heavier than Phi3

    # EDUmind Core times by task type
    time_estimates = {
        "situation": 120,
        "planning": 150,
        "stem": 120,
        "topic": 180,
        "defense": 100,
        "case": 120,
        "institution_doc": 90,
        "reinforcement_plan": 100,
        "idea": 60,
        "session": 80,
        "minutes": 70,
        "diversity": 80,
    }
    return time_estimates.get(task_type, 90)


def should_use_quality_model(task_type: str, content_hints: dict = None) -> bool:
    """
    Determine if the task requires the quality model.
    
    Args:
        task_type: Type of educational content being generated
        content_hints: Optional dict with fields like:
            - expected_length: "short", "medium", "long"
            - requires_normative: bool (needs legal references)
            - requires_structure: bool (needs tables, sections)
            - user_preference: "fast" or "quality"
    
    Returns:
        True if EDUmind Core should be used
    """
    # Check user explicit preference
    if content_hints:
        if content_hints.get("user_preference") == "fast":
            return False
        if content_hints.get("user_preference") == "quality":
            return True
    
    # Complex tasks always use quality model
    if task_type in COMPLEX_TASKS:
        return True
    
    # Check content-based hints
    if content_hints:
        if content_hints.get("requires_normative"):
            return True
        if content_hints.get("expected_length") == "long":
            return True
        if content_hints.get("requires_structure"):
            return True
    
    # Simple tasks use fast model by default
    return task_type not in SIMPLE_TASKS


def select_model(task_type: str, content_hints: dict = None) -> Tuple[ModelTier, int]:
    """
    Select the appropriate model and return estimated time.
    
    Returns:
        Tuple of (ModelTier, estimated_seconds)
    """
    use_quality = should_use_quality_model(task_type, content_hints)
    model = ModelTier.QUALITY if use_quality else ModelTier.FAST
    eta = estimate_response_time(model, task_type)
    
    return model, eta


def get_model_config(model: ModelTier) -> dict:
    """Get configuration for the selected model."""
    if model == ModelTier.FAST:
        return {
            "provider": "ollama",
            "model": settings.OLLAMA_DEFAULT_MODEL,
            "endpoint": settings.OLLAMA_URL.replace("/api/chat", ""),
            "timeout": 60,
        }
    else:
        return {
            "provider": "edumind",
            "model": None,
            "endpoint": settings.EDUMIND_CORE_URL,
            "timeout": 300,  # 5 minutes max
        }
