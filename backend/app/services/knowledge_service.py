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
Knowledge Service - Document retrieval for prompt enrichment.
Provides access to legislative documents, methodologies, and educational resources.
"""
from pathlib import Path
from typing import List, Optional, Dict
import re

class KnowledgeDocument:
    """Represents a knowledge document."""
    def __init__(self, path: Path, category: str):
        self.path = path
        self.category = category
        self.name = path.stem
        self._content: Optional[str] = None
    
    @property
    def content(self) -> str:
        if self._content is None:
            self._content = self.path.read_text(encoding='utf-8')
        return self._content
    
    def get_section(self, section_title: str) -> Optional[str]:
        """Extract a specific section by title."""
        pattern = rf"(##?\s*{re.escape(section_title)}.*?)(?=\n##|\Z)"
        match = re.search(pattern, self.content, re.DOTALL | re.IGNORECASE)
        return match.group(1).strip() if match else None
    
    def get_summary(self, max_chars: int = 500) -> str:
        """Get a summary (first N characters)."""
        return self.content[:max_chars] + "..." if len(self.content) > max_chars else self.content


class KnowledgeService:
    """
    Simple document retrieval service for RAG-style prompt enrichment.
    """
    
    KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent.parent / "knowledge"
    
    CATEGORIES = {
        "legislacion": "Documentos legislativos (LOMLOE, Reales Decretos)",
        "metodologias": "Metodologías pedagógicas (DUA, ABP, STEAM...)",
        "recursos": "Recursos educativos (Competencias, Evaluación...)"
    }
    
    @classmethod
    def _ensure_dir(cls):
        """Ensure knowledge directory exists."""
        cls.KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)
        for cat in cls.CATEGORIES:
            (cls.KNOWLEDGE_DIR / cat).mkdir(exist_ok=True)
    
    @classmethod
    def list_categories(cls) -> Dict[str, str]:
        """List available knowledge categories."""
        return cls.CATEGORIES
    
    @classmethod
    def list_documents(cls, category: Optional[str] = None) -> List[KnowledgeDocument]:
        """List all documents, optionally filtered by category."""
        cls._ensure_dir()
        documents = []
        
        categories = [category] if category else cls.CATEGORIES.keys()
        
        for cat in categories:
            cat_path = cls.KNOWLEDGE_DIR / cat
            if cat_path.exists():
                for file_path in cat_path.glob("*.md"):
                    documents.append(KnowledgeDocument(file_path, cat))
        
        return documents
    
    @classmethod
    def get_document(cls, name: str, category: Optional[str] = None) -> Optional[KnowledgeDocument]:
        """Get a specific document by name."""
        documents = cls.list_documents(category)
        for doc in documents:
            if doc.name.lower() == name.lower():
                return doc
        return None
    
    @classmethod
    def get_legislation(cls, topic: str = "lomloe") -> str:
        """
        Retrieve legislation content for prompt enrichment.
        
        Args:
            topic: Document name (e.g., 'lomloe', 'rd_primaria')
        
        Returns:
            Formatted legislation snippet for inclusion in prompts.
        """
        doc = cls.get_document(topic, "legislacion")
        if not doc:
            return ""
        
        # Return key sections for prompt context
        return f"""
--- REFERENCIA NORMATIVA ({doc.name.upper()}) ---
{doc.get_summary(2000)}
--- FIN REFERENCIA NORMATIVA ---
"""
    
    @classmethod
    def get_methodology(cls, method: str) -> str:
        """
        Retrieve methodology description for prompt enrichment.
        
        Args:
            method: Methodology name (e.g., 'dua', 'abp')
        
        Returns:
            Formatted methodology description for inclusion in prompts.
        """
        doc = cls.get_document(method, "metodologias")
        if not doc:
            return ""
        
        return f"""
--- METODOLOGÍA ({doc.name.upper()}) ---
{doc.get_summary(1500)}
--- FIN METODOLOGÍA ---
"""
    
    @classmethod
    def get_resource(cls, resource: str) -> str:
        """
        Retrieve educational resource for prompt enrichment.
        
        Args:
            resource: Resource name (e.g., 'competencias_clave')
        
        Returns:
            Formatted resource content for inclusion in prompts.
        """
        doc = cls.get_document(resource, "recursos")
        if not doc:
            return ""
        
        return f"""
--- RECURSO EDUCATIVO ({doc.name.upper()}) ---
{doc.get_summary(1500)}
--- FIN RECURSO ---
"""
    
    @classmethod
    def search(cls, query: str, category: Optional[str] = None) -> List[Dict]:
        """
        Simple full-text search across knowledge base.
        
        Args:
            query: Search term
            category: Optional category filter
        
        Returns:
            List of matching document snippets with metadata.
        """
        results = []
        query_lower = query.lower()
        
        for doc in cls.list_documents(category):
            if query_lower in doc.content.lower():
                # Find context around match
                idx = doc.content.lower().find(query_lower)
                start = max(0, idx - 100)
                end = min(len(doc.content), idx + len(query) + 200)
                snippet = doc.content[start:end]
                
                results.append({
                    "name": doc.name,
                    "category": doc.category,
                    "snippet": f"...{snippet}...",
                    "path": str(doc.path)
                })
        
        return results
    
    @classmethod
    def get_context_for_prompt(cls, 
                                include_lomloe: bool = True,
                                methodology: Optional[str] = None,
                                include_competencias: bool = False) -> str:
        """
        Build a complete context block for prompt enrichment.
        
        Args:
            include_lomloe: Include LOMLOE legislation summary
            methodology: Specific methodology to include (e.g., 'dua', 'abp')
            include_competencias: Include competencias clave reference
        
        Returns:
            Combined context string for prompt injection.
        """
        context_parts = []
        
        if include_lomloe:
            lomloe = cls.get_legislation("lomloe")
            if lomloe:
                context_parts.append(lomloe)
        
        if methodology:
            method_content = cls.get_methodology(methodology)
            if method_content:
                context_parts.append(method_content)
        
        if include_competencias:
            competencias = cls.get_resource("competencias_clave")
            if competencias:
                context_parts.append(competencias)
        
        if context_parts:
            return "\n\n".join(context_parts)
        
        return ""
