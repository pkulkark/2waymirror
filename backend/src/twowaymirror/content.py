"""Content loader.

Reads the directory layout described in docs/architecture.md, from a local path or an
`s3://bucket/prefix` URI, applies the variant merge rule, and validates the result with
Pydantic into a `Content` model. Nothing is rendered: `answer_md` stays raw Markdown for the
frontend to render.

The unmerged tree is cached at module level, keyed by content source, so a cold start pays
the I/O once; the (cheap, in-memory) variant merge runs on every call.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlparse

import boto3
import yaml
from pydantic import BaseModel

from twowaymirror.models import (
    CompanyQuestion,
    Content,
    Evidence,
    LogisticsItem,
    Section,
    SectionItem,
    Variant,
)
from twowaymirror.settings import Settings

_SECTIONS_DIR = "sections"
_ANSWERS_DIR = "answers"


class ContentError(Exception):
    """The content tree is missing a file or is shaped incorrectly."""


class UnknownVariantError(ContentError):
    """The requested variant is not declared in the content's variants.yaml."""


class _RawContent(BaseModel):
    """The content tree as read from disk/S3, before variant resolution."""

    variants: list[str]
    profile: dict[str, Any]
    logistics: list[dict[str, Any]]
    company_questions: list[dict[str, Any]]
    sections: list[dict[str, Any]]
    answer_front_matter: dict[str, dict[str, Any]]
    answer_bodies: dict[str, str]


class _ContentSource(Protocol):
    """Reads text files and lists a directory's files, for a local path or S3."""

    def read_text(self, relative_path: str) -> str: ...

    def list_dir(self, relative_dir: str) -> list[str]:
        """Non-recursive, sorted file names (not full paths) directly under relative_dir."""
        ...


class _LocalContentSource:
    def __init__(self, base: Path) -> None:
        self._base = base

    def read_text(self, relative_path: str) -> str:
        path = self._base / relative_path
        try:
            return path.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise ContentError(f"missing content file: {relative_path}") from exc

    def list_dir(self, relative_dir: str) -> list[str]:
        directory = self._base / relative_dir
        if not directory.is_dir():
            raise ContentError(f"missing content directory: {relative_dir}")
        return sorted(p.name for p in directory.iterdir() if p.is_file())


class _S3ContentSource:
    def __init__(self, bucket: str, prefix: str, region: str) -> None:
        self._bucket = bucket
        self._prefix = prefix.strip("/")
        self._client = boto3.client("s3", region_name=region)

    def _key(self, relative_path: str) -> str:
        return f"{self._prefix}/{relative_path}" if self._prefix else relative_path

    def read_text(self, relative_path: str) -> str:
        try:
            obj = self._client.get_object(Bucket=self._bucket, Key=self._key(relative_path))
        except self._client.exceptions.NoSuchKey as exc:
            raise ContentError(f"missing content file: {relative_path}") from exc
        body: bytes = obj["Body"].read()
        return body.decode("utf-8")

    def list_dir(self, relative_dir: str) -> list[str]:
        prefix = self._key(relative_dir.rstrip("/") + "/")
        names: list[str] = []
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix, Delimiter="/"):
            for obj in page.get("Contents", []):
                name = obj["Key"][len(prefix) :]
                if name and "/" not in name:
                    names.append(name)
        return sorted(names)


def _make_source(source: str, region: str) -> _ContentSource:
    parsed = urlparse(source)
    if parsed.scheme == "s3":
        return _S3ContentSource(bucket=parsed.netloc, prefix=parsed.path, region=region)
    return _LocalContentSource(Path(source))


def _parse_front_matter(text: str) -> tuple[dict[str, Any], str]:
    """Split a Markdown file into its YAML front matter and Markdown body."""
    if not text.startswith("---"):
        raise ContentError("answer file is missing YAML front matter")
    parts = text.split("---", 2)
    if len(parts) != 3:
        raise ContentError("answer file front matter is not closed with ---")
    _, header, body = parts
    data = yaml.safe_load(header) or {}
    return data, body.lstrip("\n")


def _load_raw(source: _ContentSource) -> _RawContent:
    declared = yaml.safe_load(source.read_text("variants.yaml")) or []
    variants = [str(entry["id"]) if isinstance(entry, dict) else str(entry) for entry in declared]
    if not variants:
        raise ContentError("variants.yaml must declare at least one variant id")
    profile = yaml.safe_load(source.read_text("profile.yaml")) or {}
    logistics = yaml.safe_load(source.read_text("logistics.yaml")) or []
    company_questions = yaml.safe_load(source.read_text("company_questions.yaml")) or []

    # list_dir returns sorted file names, so section order follows file naming
    # (e.g. numeric prefixes like "01-initial-conversation.yaml").
    sections: list[dict[str, Any]] = [
        yaml.safe_load(source.read_text(f"{_SECTIONS_DIR}/{name}")) or {}
        for name in source.list_dir(_SECTIONS_DIR)
        if name.endswith(".yaml")
    ]

    answer_ids: set[str] = set()
    for section in sections:
        answer_ids.update(section.get("items", []))

    front_matter: dict[str, dict[str, Any]] = {}
    bodies: dict[str, str] = {}
    for answer_id in answer_ids:
        text = source.read_text(f"{_ANSWERS_DIR}/{answer_id}.md")
        front_matter[answer_id], bodies[answer_id] = _parse_front_matter(text)

    return _RawContent(
        variants=variants,
        profile=profile,
        logistics=logistics,
        company_questions=company_questions,
        sections=sections,
        answer_front_matter=front_matter,
        answer_bodies=bodies,
    )


def _merge_overrides(base: dict[str, Any], variant: str) -> dict[str, Any]:
    """Base value, then variants.<variant> overrides key by key (shallow)."""
    merged = {key: value for key, value in base.items() if key != "variants"}
    overrides = base.get("variants") or {}
    merged.update(overrides.get(variant, {}))
    return merged


def _visible_for_variant(question: dict[str, Any], variant: str) -> bool:
    """A question with no `variants` list is visible to every variant."""
    restriction = question.get("variants")
    return restriction is None or variant in restriction


def _resolve(raw: _RawContent, variant: Variant) -> Content:
    candidate = _merge_overrides(raw.profile, variant)
    logistics = [LogisticsItem(**_merge_overrides(item, variant)) for item in raw.logistics]

    company_questions = [
        CompanyQuestion(
            id=question["id"],
            question=question["question"],
            required=bool(question.get("required", False)),
        )
        for question in raw.company_questions
        if _visible_for_variant(question, variant)
    ]

    sections: list[Section] = []
    for section in raw.sections:
        items: list[SectionItem] = []
        for answer_id in section.get("items", []):
            merged = _merge_overrides(raw.answer_front_matter[answer_id], variant)
            items.append(
                SectionItem(
                    id=answer_id,
                    question=merged["question"],
                    summary=merged.get("summary"),
                    answer_md=raw.answer_bodies[answer_id],
                    evidence=[Evidence(**item) for item in merged.get("evidence", [])],
                )
            )
        sections.append(Section(id=section["id"], title=section["title"], items=items))

    return Content(
        candidate=candidate,
        logistics=logistics,
        sections=sections,
        company_questions=company_questions,
    )


_raw_content_cache: dict[str, tuple[float, _RawContent]] = {}
_now = time.monotonic


def _get_raw_content(source: str, region: str, max_age_seconds: int) -> _RawContent:
    """The raw tree for `source`, re-read once the cached copy is older than `max_age_seconds`.

    A warm Lambda instance keeps its module state between invocations, so without an expiry a
    content push would only show up after the instance was recycled.
    """
    cached = _raw_content_cache.get(source)
    if cached is not None and _now() - cached[0] < max_age_seconds:
        return cached[1]
    raw = _load_raw(_make_source(source, region))
    _raw_content_cache[source] = (_now(), raw)
    return raw


def load_content(settings: Settings, *, variant: Variant) -> Content:
    raw = _get_raw_content(
        settings.TWM_CONTENT_SOURCE, settings.AWS_REGION, settings.TWM_CONTENT_CACHE_SECONDS
    )
    if variant not in raw.variants:
        raise UnknownVariantError(variant)
    return _resolve(raw, variant)


def declared_variants(settings: Settings) -> list[str]:
    """Variant ids the loaded content declares, in declaration order."""
    raw = _get_raw_content(
        settings.TWM_CONTENT_SOURCE, settings.AWS_REGION, settings.TWM_CONTENT_CACHE_SECONDS
    )
    return list(raw.variants)


def clear_cache() -> None:
    """Test helper: drop the module-level cache so a test can load a different source."""
    _raw_content_cache.clear()
