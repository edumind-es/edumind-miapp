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
Normative Retrieval Service.

Server-side indexed retrieval for Galicia convivencia normativa.
Supports distributed cache with Redis (multi-worker) and memory fallback.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import threading
import time
import unicodedata
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import settings

try:
    from redis import Redis
except Exception:  # pragma: no cover - optional dependency fallback
    Redis = None


def _normalize_text(text: str) -> str:
    lowered = (text or "").lower()
    normalized = unicodedata.normalize("NFD", lowered)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _tokenize(text: str) -> list[str]:
    normalized = _normalize_text(text)
    return [term for term in re.findall(r"[a-z0-9]+", normalized) if len(term) > 2]


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


@dataclass(frozen=True)
class NormativeEntry:
    document_id: str
    document_type: str
    category: str
    section_kind: str
    section_label: str
    title: str
    content: str
    normalized_content: str
    normalized_metadata: str
    type_weight: float


@dataclass
class CachedSearch:
    expires_at: float
    results: list[dict[str, Any]]


class NormativeRetrievalService:
    _lock = threading.Lock()
    _loaded = False
    _source_path: Path | None = None
    _loaded_at: float | None = None
    _last_error: str | None = None
    _entries: list[NormativeEntry] = []
    _document_count = 0
    _category_count = 0

    # Local fallback cache
    _cache: OrderedDict[str, CachedSearch] = OrderedDict()

    # Redis cache shared across workers
    _redis_client: Redis | None = None
    _redis_state: str = "not_initialized"
    _redis_last_error: str | None = None

    _TYPE_WEIGHTS = {
        "leyes": 2.0,
        "decretos": 2.0,
        "ordenes": 1.5,
        "protocolos": 1.2,
        "documentos_apoyo": 0.6,
    }

    _SYNONYMS = {
        "movil": ["mobil", "telefono", "dispositivo", "electronico"],
        "telefono": ["movil", "mobil", "dispositivo"],
        "tablet": ["dispositivo", "ordenador", "electronico"],
        "recreo": ["lecer", "descanso", "patio"],
        "clase": ["aula", "periodo", "lectivo"],
        "falta": ["ausencia", "inasistencia", "conducta"],
        "agresion": ["violencia", "acoso", "fisica", "psiquica"],
        "expulsion": ["suspension", "asistencia"],
        "acoso": ["ciberacoso", "hostigamiento", "intimidacion"],
    }

    @classmethod
    def _cache_ttl_seconds(cls) -> int:
        return settings.NORMATIVE_CACHE_TTL_SECONDS

    @classmethod
    def _cache_max_entries(cls) -> int:
        return settings.NORMATIVE_CACHE_MAX_ENTRIES

    @classmethod
    def _cache_backend(cls) -> str:
        return settings.NORMATIVE_CACHE_BACKEND.lower().strip()

    @classmethod
    def _cache_prefix(cls) -> str:
        return settings.NORMATIVE_CACHE_PREFIX.strip() or "edumind:normative:search:v1"

    @classmethod
    def _redis_index_key(cls) -> str:
        return f"{cls._cache_prefix()}:index"

    @classmethod
    def _hash_cache_key(cls, cache_key: str) -> str:
        return hashlib.sha256(cache_key.encode("utf-8")).hexdigest()

    @classmethod
    def _redis_item_key(cls, cache_key: str) -> str:
        return f"{cls._cache_prefix()}:item:{cls._hash_cache_key(cache_key)}"

    @classmethod
    def _candidate_paths(cls) -> list[Path]:
        project_root = settings.BASE_DIR.parent
        return [
            project_root / "docs" / "base_datos_convivencia_galicia.json",
            project_root / "frontend" / "public" / "data" / "base_datos_convivencia_galicia.json",
            settings.DATASET_DIR / "base_datos_convivencia_galicia.json",
        ]

    @classmethod
    def _resolve_source_path(cls) -> Path:
        for path in cls._candidate_paths():
            if path.exists():
                return path
        searched = ", ".join(str(path) for path in cls._candidate_paths())
        raise FileNotFoundError(f"Normative dataset not found. Paths checked: {searched}")

    @classmethod
    def _expand_terms(cls, terms: list[str]) -> list[str]:
        expanded: set[str] = set(terms)
        for term in list(expanded):
            for synonym in cls._SYNONYMS.get(term, []):
                expanded.add(synonym)
            for key, synonyms in cls._SYNONYMS.items():
                if term in synonyms:
                    expanded.add(key)
        return sorted(expanded)

    @classmethod
    def _weight_for_type(cls, document_type: str, category: str) -> float:
        normalized_type = _normalize_text(document_type).replace(" ", "_")
        normalized_category = _normalize_text(category).replace(" ", "_")
        return cls._TYPE_WEIGHTS.get(normalized_type) or cls._TYPE_WEIGHTS.get(normalized_category) or 1.0

    @classmethod
    def _build_metadata_block(cls, document: dict[str, Any]) -> str:
        keywords = document.get("palabras_clave") or []
        semantic_index = document.get("indice_semantico") or {}
        concepts = semantic_index.get("conceptos_principales") or []
        related_topics = semantic_index.get("temas_relacionados") or []

        merged = [
            _safe_str(document.get("id")),
            _safe_str(document.get("tipo_documento")),
            " ".join(_safe_str(item) for item in keywords),
            " ".join(_safe_str(item) for item in concepts),
            " ".join(_safe_str(item) for item in related_topics),
        ]
        return " ".join(part for part in merged if part)

    @classmethod
    def _parse_entries(cls, raw_payload: dict[str, Any]) -> tuple[list[NormativeEntry], int, int]:
        hierarchy = raw_payload.get("jerarquia_legal")
        if not isinstance(hierarchy, dict):
            raise ValueError("Invalid normative dataset format: missing 'jerarquia_legal'")

        entries: list[NormativeEntry] = []
        categories_seen: set[str] = set()
        documents_seen: set[str] = set()

        for category, documents in hierarchy.items():
            categories_seen.add(_safe_str(category) or "desconocido")
            if not isinstance(documents, list):
                continue

            for document in documents:
                if not isinstance(document, dict):
                    continue
                document_id = _safe_str(document.get("id")) or "SIN_ID"
                document_type = _safe_str(document.get("tipo_documento")) or _safe_str(category) or "DOC"
                documents_seen.add(document_id)

                metadata_block = cls._build_metadata_block(document)
                normalized_metadata = _normalize_text(metadata_block)
                weight = cls._weight_for_type(document_type, _safe_str(category))

                for article in document.get("articulos") or []:
                    if not isinstance(article, dict):
                        continue
                    article_number = _safe_str(article.get("numero")) or "?"
                    content = _safe_str(article.get("texto_completo"))
                    if not content:
                        continue
                    section_label = f"Art. {article_number}"
                    title = f"[{document_type}] {section_label} - {document_id}"
                    entries.append(
                        NormativeEntry(
                            document_id=document_id,
                            document_type=document_type,
                            category=_safe_str(category) or "desconocido",
                            section_kind="article",
                            section_label=section_label,
                            title=title,
                            content=content,
                            normalized_content=_normalize_text(content),
                            normalized_metadata=normalized_metadata,
                            type_weight=weight,
                        )
                    )

                for phase in document.get("fases_protocolo") or []:
                    if not isinstance(phase, dict):
                        continue
                    phase_number = _safe_str(phase.get("numero")) or "?"
                    phase_title = _safe_str(phase.get("titulo"))
                    phase_description = _safe_str(phase.get("descripcion"))
                    phase_content = " ".join(part for part in [phase_title, phase_description] if part)
                    if not phase_content:
                        continue
                    section_label = f"Fase {phase_number}"
                    title = f"[{document_type}] {section_label} - {document_id}"
                    entries.append(
                        NormativeEntry(
                            document_id=document_id,
                            document_type=document_type,
                            category=_safe_str(category) or "desconocido",
                            section_kind="phase",
                            section_label=section_label,
                            title=title,
                            content=phase_content,
                            normalized_content=_normalize_text(phase_content),
                            normalized_metadata=normalized_metadata,
                            type_weight=weight,
                        )
                    )

        return entries, len(documents_seen), len(categories_seen)

    @classmethod
    def _load_index(cls):
        source_path = cls._resolve_source_path()
        with source_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)

        entries, document_count, category_count = cls._parse_entries(payload)
        if not entries:
            raise ValueError("Normative dataset loaded but no indexable entries were found")

        with cls._lock:
            cls._entries = entries
            cls._document_count = document_count
            cls._category_count = category_count
            cls._source_path = source_path
            cls._loaded_at = time.time()
            cls._last_error = None
            cls._loaded = True
            cls._cache.clear()

    @classmethod
    def ensure_loaded(cls):
        with cls._lock:
            if cls._loaded:
                return
        try:
            cls._load_index()
        except Exception as exc:
            with cls._lock:
                cls._last_error = str(exc)
            raise

    @classmethod
    def _score_entry(cls, entry: NormativeEntry, terms: list[str], patterns: dict[str, re.Pattern[str]]) -> float:
        metadata_score = 0.0
        content_score = 0.0

        for term in terms:
            pattern = patterns[term]
            if term in entry.normalized_metadata:
                metadata_score += 1.0
            metadata_score += len(pattern.findall(entry.normalized_metadata)) * 2.5

            if term in entry.normalized_content:
                content_score += 1.0
            content_score += len(pattern.findall(entry.normalized_content)) * 2.5

        return (content_score + (metadata_score * 0.75)) * entry.type_weight

    @classmethod
    def _entry_to_result(cls, entry: NormativeEntry, score: float) -> dict[str, Any]:
        return {
            "document_id": entry.document_id,
            "document_type": entry.document_type,
            "category": entry.category,
            "section_kind": entry.section_kind,
            "section_label": entry.section_label,
            "title": entry.title,
            "content": entry.content,
            "score": round(float(score), 2),
        }

    @classmethod
    def _compute_search(cls, query: str) -> list[dict[str, Any]]:
        terms = _tokenize(query)
        if not terms:
            return []

        expanded_terms = cls._expand_terms(terms)
        patterns = {
            term: re.compile(rf"\b{re.escape(term)}\b", flags=re.IGNORECASE)
            for term in expanded_terms
        }

        scored: list[tuple[float, NormativeEntry]] = []
        for entry in cls._entries:
            score = cls._score_entry(entry, expanded_terms, patterns)
            if score > 0:
                scored.append((score, entry))

        scored.sort(key=lambda item: item[0], reverse=True)
        return [cls._entry_to_result(entry, score) for score, entry in scored]

    @classmethod
    def _cache_key(cls, query: str) -> str:
        return " ".join(cls._expand_terms(_tokenize(query)))

    @classmethod
    def _use_redis_cache(cls) -> bool:
        backend = cls._cache_backend()
        if backend == "memory":
            return False
        if backend == "redis":
            return True
        return bool(settings.REDIS_URL)

    @classmethod
    def _get_redis_client(cls) -> Redis | None:
        if not cls._use_redis_cache():
            cls._redis_state = "disabled"
            return None

        if Redis is None:
            cls._redis_state = "unavailable"
            cls._redis_last_error = "redis package not installed"
            return None

        with cls._lock:
            if cls._redis_client is not None:
                return cls._redis_client

        try:
            client = Redis.from_url(settings.REDIS_URL or "", decode_responses=True)
            client.ping()
            with cls._lock:
                cls._redis_client = client
                cls._redis_state = "connected"
                cls._redis_last_error = None
            return client
        except Exception as exc:  # pragma: no cover - depends on external service
            with cls._lock:
                cls._redis_state = "error"
                cls._redis_last_error = str(exc)
                cls._redis_client = None
            return None

    @classmethod
    def _fetch_from_redis_cache(cls, cache_key: str) -> tuple[list[dict[str, Any]] | None, bool]:
        client = cls._get_redis_client()
        if client is None:
            return None, False

        item_key = cls._redis_item_key(cache_key)
        try:
            payload = client.get(item_key)
            if not payload:
                return None, False
            parsed = json.loads(payload)
            if not isinstance(parsed, list):
                return None, False
            client.zadd(cls._redis_index_key(), {item_key: time.time()})
            return parsed, True
        except Exception as exc:  # pragma: no cover - depends on external service
            cls._redis_state = "error"
            cls._redis_last_error = str(exc)
            return None, False

    @classmethod
    def _store_redis_cache(cls, cache_key: str, results: list[dict[str, Any]]):
        client = cls._get_redis_client()
        if client is None:
            return

        item_key = cls._redis_item_key(cache_key)
        ttl = cls._cache_ttl_seconds()
        max_entries = cls._cache_max_entries()
        now_ts = time.time()

        try:
            payload = json.dumps(results, ensure_ascii=True)
            client.setex(item_key, ttl, payload)
            index_key = cls._redis_index_key()
            client.zadd(index_key, {item_key: now_ts})

            count = int(client.zcard(index_key))
            overflow = count - max_entries
            if overflow > 0:
                old_keys = client.zrange(index_key, 0, overflow - 1)
                if old_keys:
                    client.delete(*old_keys)
                    client.zrem(index_key, *old_keys)
        except Exception as exc:  # pragma: no cover - depends on external service
            cls._redis_state = "error"
            cls._redis_last_error = str(exc)

    @classmethod
    def _fetch_from_memory_cache(cls, cache_key: str) -> tuple[list[dict[str, Any]] | None, bool]:
        now = time.time()
        with cls._lock:
            cached = cls._cache.get(cache_key)
            if not cached:
                return None, False
            if cached.expires_at <= now:
                cls._cache.pop(cache_key, None)
                return None, False
            cls._cache.move_to_end(cache_key)
            return cached.results, True

    @classmethod
    def _store_memory_cache(cls, cache_key: str, results: list[dict[str, Any]]):
        expires_at = time.time() + cls._cache_ttl_seconds()
        with cls._lock:
            cls._cache[cache_key] = CachedSearch(expires_at=expires_at, results=results)
            cls._cache.move_to_end(cache_key)
            while len(cls._cache) > cls._cache_max_entries():
                cls._cache.popitem(last=False)

    @classmethod
    def _fetch_from_cache(cls, cache_key: str) -> tuple[list[dict[str, Any]] | None, bool]:
        redis_results, redis_hit = cls._fetch_from_redis_cache(cache_key)
        if redis_results is not None:
            return redis_results, redis_hit
        return cls._fetch_from_memory_cache(cache_key)

    @classmethod
    def _store_cache(cls, cache_key: str, results: list[dict[str, Any]]):
        cls._store_redis_cache(cache_key, results)
        cls._store_memory_cache(cache_key, results)

    @classmethod
    def _build_context(cls, results: list[dict[str, Any]], max_chars_per_item: int = 900) -> str:
        chunks: list[str] = []
        for item in results:
            excerpt = _safe_str(item.get("content"))
            if len(excerpt) > max_chars_per_item:
                excerpt = excerpt[:max_chars_per_item].rstrip() + "..."
            chunks.append(
                f"--- DOCUMENTO: {_safe_str(item.get('title'))} (Relevancia: {float(item.get('score', 0.0)):.1f}) ---\n{excerpt}"
            )
        return "\n\n".join(chunks)

    @classmethod
    def search(cls, query: str, page: int = 1, page_size: int = 5) -> dict[str, Any]:
        cls.ensure_loaded()

        clean_query = (query or "").strip()
        cache_key = cls._cache_key(clean_query)
        if not cache_key:
            return {
                "query": clean_query,
                "page": 1,
                "page_size": page_size,
                "total_results": 0,
                "total_pages": 0,
                "cache_hit": False,
                "results": [],
                "context": "",
            }

        cached_results, cache_hit = cls._fetch_from_cache(cache_key)
        results = cached_results if cached_results is not None else cls._compute_search(clean_query)
        if cached_results is None:
            cls._store_cache(cache_key, results)

        total_results = len(results)
        if total_results == 0:
            return {
                "query": clean_query,
                "page": 1,
                "page_size": page_size,
                "total_results": 0,
                "total_pages": 0,
                "cache_hit": cache_hit,
                "results": [],
                "context": "",
            }

        total_pages = math.ceil(total_results / page_size)
        page = min(max(page, 1), total_pages)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_results = results[start_idx:end_idx]

        return {
            "query": clean_query,
            "page": page,
            "page_size": page_size,
            "total_results": total_results,
            "total_pages": total_pages,
            "cache_hit": cache_hit,
            "results": page_results,
            "context": cls._build_context(page_results),
        }

    @classmethod
    def get_status(cls) -> dict[str, Any]:
        try:
            cls.ensure_loaded()
        except Exception:
            pass

        with cls._lock:
            loaded_at_iso = None
            if cls._loaded_at:
                loaded_at_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(cls._loaded_at))
            return {
                "loaded": cls._loaded,
                "source_path": str(cls._source_path) if cls._source_path else None,
                "loaded_at": loaded_at_iso,
                "indexed_sections": len(cls._entries),
                "indexed_documents": cls._document_count,
                "indexed_categories": cls._category_count,
                "cache_backend": cls._cache_backend(),
                "cache_entries": len(cls._cache),
                "cache_ttl_seconds": cls._cache_ttl_seconds(),
                "cache_max_entries": cls._cache_max_entries(),
                "redis_state": cls._redis_state,
                "redis_last_error": cls._redis_last_error,
                "last_error": cls._last_error,
            }
