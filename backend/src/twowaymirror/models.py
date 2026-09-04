"""Pydantic models for the API's response and request shapes.

`Session`, `Answers`, and `Content` mirror docs/architecture.md exactly: the "Session as
returned", the DynamoDB "Answers" item, and "Content as returned" respectively. The rest are
the substructures the contract spells out for `Content`, plus the request/response bodies for
the answers endpoint.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

Variant = Literal["senior", "staff", "lead"]


class Evidence(BaseModel):
    label: str
    url: str


class Session(BaseModel):
    """Session as returned by the API. Never carries tenant, ttl, or revoked."""

    company: str
    contact: str
    variant: Variant
    created_at: datetime
    expires_at: datetime
    answers_submitted: bool


class Answers(BaseModel):
    """The Answers item as stored: submitted_at plus the question id to answer text map."""

    submitted_at: datetime
    answers: dict[str, str]


class AnswersSubmitRequest(BaseModel):
    """POST /api/sessions/{token}/answers request body."""

    answers: dict[str, str]


class SubmitAnswersResponse(BaseModel):
    """POST /api/sessions/{token}/answers success response."""

    submitted_at: datetime


class SectionItem(BaseModel):
    id: str
    question: str
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


class Content(BaseModel):
    """Content as returned, already merged for the session's variant."""

    candidate: dict[str, Any]
    logistics: dict[str, Any]
    sections: list[Section]
    company_questions: list[CompanyQuestion]


class SessionContentResponse(BaseModel):
    """GET /api/sessions/{token} success response."""

    session: Session
    content: Content
