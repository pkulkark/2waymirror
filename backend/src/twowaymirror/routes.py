"""Session and answers routes. See docs/architecture.md, "API"."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from twowaymirror.content import UnknownVariantError, load_candidate_profile, load_content
from twowaymirror.models import (
    AnswersSubmitRequest,
    Content,
    QuestionSnapshot,
    SessionContentResponse,
    SubmitAnswersResponse,
)
from twowaymirror.notifications import send_answers_email
from twowaymirror.repository import DynamoDBSessionRepository, SessionRecord
from twowaymirror.settings import Settings, get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


def get_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> DynamoDBSessionRepository:
    return DynamoDBSessionRepository(settings)


SettingsDep = Annotated[Settings, Depends(get_settings)]
RepositoryDep = Annotated[DynamoDBSessionRepository, Depends(get_repository)]


class SessionGoneError(Exception):
    """The session exists but is expired or revoked. Answered with a 410 that carries the
    candidate's name and email so the page can offer a way to ask for a new link."""

    def __init__(self, record: SessionRecord) -> None:
        super().__init__(record.token)
        self.record = record


def session_gone_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, SessionGoneError)
    candidate: dict[str, str | None] = {"name": None, "email": None}
    try:
        profile = load_candidate_profile(get_settings(), variant=exc.record.variant)
        candidate = {"name": profile.get("name"), "email": profile.get("email")}
    except Exception:
        logger.exception("Could not load the candidate profile for an expired session")
    return JSONResponse(
        status_code=status.HTTP_410_GONE,
        content={
            "detail": "Session expired or revoked.",
            "candidate": candidate,
            "expires_at": exc.record.expires_at.isoformat(),
        },
    )


def _get_available_session(repository: DynamoDBSessionRepository, token: str) -> SessionRecord:
    record = repository.get_session(token)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown session token.")
    if not record.is_available:
        raise SessionGoneError(record)
    return record


def _content_for(settings: Settings, variant: str) -> Content:
    try:
        return load_content(settings, variant=variant)
    except UnknownVariantError as exc:
        # The session points at a variant the deployed content does not declare.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session content unavailable."
        ) from exc


@router.get("/sessions/{token}", response_model=SessionContentResponse)
def get_session(
    token: str, repository: RepositoryDep, settings: SettingsDep
) -> SessionContentResponse:
    record = _get_available_session(repository, token)
    answers = repository.get_answers(token)
    content = _content_for(settings, record.variant)
    return SessionContentResponse(session=record.to_session(answers=answers), content=content)


@router.post(
    "/sessions/{token}/answers",
    response_model=SubmitAnswersResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_answers(
    token: str,
    body: AnswersSubmitRequest,
    repository: RepositoryDep,
    settings: SettingsDep,
) -> SubmitAnswersResponse:
    record = _get_available_session(repository, token)
    content = _content_for(settings, record.variant)
    known_ids = {question.id for question in content.company_questions}

    if not body.answers:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="No answers submitted."
        )
    for question_id, text in body.answers.items():
        if question_id not in known_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Unknown question id: {question_id}",
            )
        if not text.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Answer for {question_id} is empty.",
            )

    missing = [
        question.id
        for question in content.company_questions
        if question.required and question.id not in body.answers
    ]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Required questions unanswered: {', '.join(missing)}",
        )

    # One extra read, only to tell the notification whether this is the first submission or
    # an edit. Answers stay editable until the link expires, so both happen.
    first_submission = repository.get_answers(token) is None

    result = repository.put_answers(
        token,
        body.answers,
        questions=[
            QuestionSnapshot(id=q.id, question=q.question, required=q.required)
            for q in content.company_questions
        ],
        ttl=record.ttl,
    )

    # After the store, and never able to fail it: send_answers_email swallows its own errors.
    send_answers_email(settings, record=record, answers=result, first_submission=first_submission)
    return SubmitAnswersResponse(submitted_at=result.submitted_at)
