"""Session and answers routes. See docs/architecture.md, "API"."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from twowaymirror.content import UnknownVariantError, load_content
from twowaymirror.models import (
    AnswersSubmitRequest,
    Content,
    QuestionSnapshot,
    SessionContentResponse,
    SubmitAnswersResponse,
)
from twowaymirror.repository import (
    AnswersAlreadySubmittedError,
    DynamoDBSessionRepository,
    SessionRecord,
)
from twowaymirror.settings import Settings, get_settings

router = APIRouter(prefix="/api")


def get_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> DynamoDBSessionRepository:
    return DynamoDBSessionRepository(settings)


SettingsDep = Annotated[Settings, Depends(get_settings)]
RepositoryDep = Annotated[DynamoDBSessionRepository, Depends(get_repository)]


def _get_available_session(repository: DynamoDBSessionRepository, token: str) -> SessionRecord:
    record = repository.get_session(token)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown session token.")
    if not record.is_available:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session expired or revoked.")
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
    return SessionContentResponse(
        session=record.to_session(answers_submitted=answers is not None),
        content=content,
    )


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

    try:
        result = repository.put_answers(
            token,
            body.answers,
            questions=[
                QuestionSnapshot(id=q.id, question=q.question, required=q.required)
                for q in content.company_questions
            ],
            ttl=record.ttl,
        )
    except AnswersAlreadySubmittedError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Answers already submitted."
        ) from exc

    return SubmitAnswersResponse(submitted_at=result.submitted_at)
