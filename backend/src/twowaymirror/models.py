"""Pydantic models for the API's response and request shapes.

`Session`, `Answers`, and `Content` mirror docs/architecture.md exactly: the "Session as
returned", the DynamoDB "Answers" item, and "Content as returned" respectively. The rest are
the substructures the contract spells out for `Content`, plus the request/response bodies for
the answers endpoint.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, model_validator

# Variant ids are declared by the content (variants.yaml), never by code.
Variant = str

EvidenceType = Literal["repo", "pr", "talk", "writeup", "other"]


class Evidence(BaseModel):
    label: str
    url: str
    type: EvidenceType | None = None


class Session(BaseModel):
    """Session as returned by the API. Never carries tenant, ttl, or revoked."""

    company: str
    contact: str
    variant: Variant
    created_at: datetime
    expires_at: datetime
    answers_submitted: bool


class QuestionSnapshot(BaseModel):
    """A company question as it read at submission time, stored with the answers so that
    later edits to the content cannot change what an answer was a response to."""

    id: str
    question: str
    required: bool


class Answers(BaseModel):
    """The Answers item as stored: submitted_at, the question id to answer text map, and the
    questions as they were when the company answered (empty for submissions that predate
    snapshots)."""

    submitted_at: datetime
    answers: dict[str, str]
    questions: list[QuestionSnapshot] = []


# DynamoDB items are capped at 400 KiB. Keep the stored answers map well under that so the
# limit is reported to the client as a 422 rather than surfacing as a storage error.
MAX_ANSWER_CHARS = 5000
MAX_ANSWERS = 50
MAX_ANSWERS_BYTES = 200_000


class AnswersSubmitRequest(BaseModel):
    """POST /api/sessions/{token}/answers request body."""

    answers: Annotated[
        dict[
            Annotated[str, Field(max_length=100)],
            Annotated[str, Field(max_length=MAX_ANSWER_CHARS)],
        ],
        Field(max_length=MAX_ANSWERS),
    ]

    @model_validator(mode="after")
    def _bound_total_size(self) -> AnswersSubmitRequest:
        size = len(json.dumps(self.answers, ensure_ascii=False).encode("utf-8"))
        if size > MAX_ANSWERS_BYTES:
            raise ValueError(f"answers exceed {MAX_ANSWERS_BYTES} bytes when serialized")
        return self


class SubmitAnswersResponse(BaseModel):
    """POST /api/sessions/{token}/answers success response."""

    submitted_at: datetime


class SectionItem(BaseModel):
    id: str
    question: str
    summary: str | None = None
    answer_md: str
    evidence: list[Evidence] = []


class Section(BaseModel):
    id: str
    title: str
    items: list[SectionItem]


class CompanyQuestion(BaseModel):
    id: str
    question: str
    required: bool


class LogisticsItem(BaseModel):
    label: str
    value: str


class Content(BaseModel):
    """Content as returned, already merged for the session's variant."""

    candidate: dict[str, Any]
    logistics: list[LogisticsItem]
    sections: list[Section]
    company_questions: list[CompanyQuestion]


class SessionContentResponse(BaseModel):
    """GET /api/sessions/{token} success response."""

    session: Session
    content: Content
