"""Submission notifications: email the candidate when a company submits its answers.

Sent from the request handler once the answers are stored, through SES (ADR-0009). The
send is best effort by design: the answers are already persisted when this runs, so every
failure here is swallowed and logged rather than raised. Off unless both TWM_NOTIFY_EMAIL
and TWM_NOTIFY_FROM are set.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

import boto3
from botocore.config import Config

from twowaymirror.links import session_link
from twowaymirror.models import Answers, QuestionSnapshot
from twowaymirror.repository import SessionRecord
from twowaymirror.settings import Settings

logger = logging.getLogger(__name__)

NOT_ANSWERED = "Not answered"

# This runs inside the request, and the function's own timeout is 10 seconds. Left at the
# botocore defaults a single unreachable SES endpoint would spend well over a minute
# retrying and take the request down with it, so: one attempt, and both waits short enough
# that the worst case (2 + 5) still fits in the budget. total_max_attempts rather than
# max_attempts: botocore reads the latter as a retry count and would turn 1 into two
# attempts, and two of these waits is 14 seconds, which is the timeout this is avoiding.
# Nothing is lost by not retrying: the answers are already stored, and a failed send is
# logged rather than raised.
SES_CONNECT_TIMEOUT_SECONDS = 2
SES_READ_TIMEOUT_SECONDS = 5

_SES_CONFIG = Config(
    connect_timeout=SES_CONNECT_TIMEOUT_SECONDS,
    read_timeout=SES_READ_TIMEOUT_SECONDS,
    retries={"mode": "standard", "total_max_attempts": 1},
)

# Milliseconds kept back for building and returning the 201 once the send comes back.
RESPONSE_RESERVE_MS = 1000

# What a send can cost at worst: one connect wait plus one read wait, plus the reserve.
# Derived from the timeouts the client is built with so the two cannot drift apart. The
# bounded client keeps a stalled SES from running away on its own, but it says nothing
# about the time already spent loading content and storing the answers; when what is left
# of the invocation cannot cover this, the send is skipped rather than started.
SEND_BUDGET_MS = (
    SES_CONNECT_TIMEOUT_SECONDS + SES_READ_TIMEOUT_SECONDS
) * 1000 + RESPONSE_RESERVE_MS

# How many characters of the token the failure log may carry (see send_answers_email).
TOKEN_LOG_PREFIX = 6


# One region per process in practice; the bound is only there so the cache can never be
# grown by anything but a configuration change.
@lru_cache(maxsize=4)
def _ses_client(region: str) -> Any:
    """One client per region, kept for the life of the process.

    Building a boto3 client costs tens of milliseconds of session and endpoint resolution,
    which is worth paying once per warm Lambda instance rather than once per submission.
    Tests that need a fresh client call `_ses_client.cache_clear()`.
    """
    return boto3.client("sesv2", region_name=region, config=_SES_CONFIG)


def _client(settings: Settings) -> Any:
    return _ses_client(settings.AWS_REGION)


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
    remaining_ms: int | None = None,
) -> bool:
    """Email the submitted answers to the configured recipient. Returns whether it sent.

    Never raises: a missing configuration returns False quietly, and anything SES throws
    is logged and returns False. The log names the company and only the first few characters
    of the token, which is enough to find the session and not enough to open it: these logs
    are readable by anyone with CloudWatch access, and the token is the only credential the
    session has.

    `remaining_ms` is what is left of the Lambda invocation, or None when that is unknown
    (local dev, tests), in which case the send goes ahead. Below SEND_BUDGET_MS the send is
    skipped: the answers are already stored, and returning the 201 matters more than a
    notification that could take the whole request past the function's timeout.
    """
    if not settings.TWM_NOTIFY_EMAIL or not settings.TWM_NOTIFY_FROM:
        return False

    if remaining_ms is not None and remaining_ms < SEND_BUDGET_MS:
        logger.warning(
            "Skipped the submission notification for %s (session %s...): %d ms left, "
            "under the %d ms the send needs",
            record.company,
            record.token[:TOKEN_LOG_PREFIX],
            remaining_ms,
            SEND_BUDGET_MS,
        )
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
        logger.exception(
            "Submission notification failed for %s (session %s...)",
            record.company,
            record.token[:TOKEN_LOG_PREFIX],
        )
        return False
    return True
