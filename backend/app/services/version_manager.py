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

"""Version Manager - Track and manage EDUmind model versions."""
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from app.core.config import settings


class VersionManager:
    """Manages model version tracking and auto-numbering."""
    
    def __init__(self):
        self.models_dir = settings.BASE_DIR / "modelos_lora"
        self.versions_file = self.models_dir / "versions.json"
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self._load_versions()
    
    def _load_versions(self):
        """Load versions from JSON file."""
        if self.versions_file.exists():
            with open(self.versions_file, 'r', encoding='utf-8') as f:
                self.versions = json.load(f)
        else:
            self.versions = {
                "current_version": "0.0",
                "models": []
            }
            self._save_versions()
    
    def _save_versions(self):
        """Save versions to JSON file."""
        with open(self.versions_file, 'w', encoding='utf-8') as f:
            json.dump(self.versions, f, ensure_ascii=False, indent=2)
    
    def get_next_version(self, major: bool = False) -> str:
        """Generate next version number."""
        current = self.versions.get("current_version", "0.0")
        parts = current.split(".")
        
        if len(parts) == 2:
            major_v = int(parts[0])
            minor_v = int(parts[1])
        else:
            major_v = 0
            minor_v = 0
        
        if major:
            major_v += 1
            minor_v = 0
        else:
            minor_v += 1
        
        return f"{major_v}.{minor_v}"
    
    def register_model(
        self,
        version: str,
        dataset_path: str,
        model_path: str,
        example_count: int,
        base_model: str,
        epochs: int,
        learning_rate: float,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Register a new model version."""
        model_info = {
            "version": version,
            "version_name": f"edumind-v{version}",
            "dataset_path": dataset_path,
            "model_path": model_path,
            "example_count": example_count,
            "base_model": base_model,
            "epochs": epochs,
            "learning_rate": learning_rate,
            "created_at": datetime.utcnow().isoformat(),
            "notes": notes
        }
        
        self.versions["current_version"] = version
        self.versions["models"].append(model_info)
        self._save_versions()
        
        return model_info
    
    def get_all_versions(self) -> List[Dict[str, Any]]:
        """Get all registered model versions."""
        return self.versions.get("models", [])
    
    def get_latest_version(self) -> Optional[Dict[str, Any]]:
        """Get the latest model version."""
        models = self.versions.get("models", [])
        if models:
            return models[-1]
        return None
    
    def get_version(self, version: str) -> Optional[Dict[str, Any]]:
        """Get a specific version."""
        for model in self.versions.get("models", []):
            if model["version"] == version:
                return model
        return None


# Singleton instance
version_manager = VersionManager()
