"""Submission notifications: email the candidate when a company submits its answers.

Sent from the request handler once the answers are stored, through SES (ADR-0009). The
send is best effort by design: the answers are already persisted when this runs, so every
failure here is swallowed and logged with the session token rather than raised. Off unless
both TWM_NOTIFY_EMAIL and TWM_NOTIFY_FROM are set.
"""

from __future__ import annotations

import logging
from typing import Any

import boto3

from twowaymirror.models import Answers, QuestionSnapshot
from twowaymirror.repository import SessionRecord
from twowaymirror.settings import Settings

logger = logging.getLogger(__name__)

NOT_ANSWERED = "Not answered"


def _client(settings: Settings) -> Any:
    return boto3.client("sesv2", region_name=settings.AWS_REGION)


def session_link(settings: Settings, token: str) -> str:
    """The company-facing link, the same shape the CLI prints."""
    return f"{settings.TWM_PUBLIC_BASE_URL.rstrip('/')}/s/{token}"


def _questions_for(answers: Answers) -> list[QuestionSnapshot]:
    """The snapshot as answered, or a stand-in built from the answer keys.

    Submissions made before snapshots existed carry no questions, and the email should
    still list what was answered.
    """
    if answers.questions:
        return answers.questions
    return [
        QuestionSnapshot(id=question_id, question=question_id, required=False)
        for question_id in answers.answers
    ]


def _body(settings: Settings, record: SessionRecord, answers: Answers) -> str:
    lines = [
        f"Company:   {record.company}",
        f"Contact:   {record.contact}",
        f"Variant:   {record.variant}",
        f"Submitted: {answers.submitted_at.isoformat()}",
        f"Link:      {session_link(settings, record.token)}",
        "",
        "Answers",
        "-------",
    ]
    for question in _questions_for(answers):
        text = answers.answers.get(question.id, "").strip() or NOT_ANSWERED
        lines += ["", question.question, "", text]
    lines += [
        "",
        "Export them with:",
        "",
        f"  2wm pull {record.token}",
        "",
    ]
    return "\n".join(lines)


def send_answers_email(
    settings: Settings,
    *,
    record: SessionRecord,
    answers: Answers,
    first_submission: bool,
) -> bool:
    """Email the submitted answers to the configured recipient. Returns whether it sent.

    Never raises: a missing configuration returns False quietly, and anything SES throws
    is logged with the token and returns False.
    """
    if not settings.TWM_NOTIFY_EMAIL or not settings.TWM_NOTIFY_FROM:
        return False

    verb = "Answers from" if first_submission else "Answers updated from"
    subject = f"{verb} {record.company}"
    try:
        _client(settings).send_email(
            FromEmailAddress=settings.TWM_NOTIFY_FROM,
            Destination={"ToAddresses": [settings.TWM_NOTIFY_EMAIL]},
            Content={
                "Simple": {
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Text": {"Data": _body(settings, record, answers), "Charset": "UTF-8"}
                    },
                }
            },
        )
    except Exception:
        logger.exception("Submission notification failed for session %s", record.token)
        return False
    return True
