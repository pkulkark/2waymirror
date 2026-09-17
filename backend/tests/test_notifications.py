from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

import boto3
import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

from twowaymirror import notifications
from twowaymirror.main import create_app
from twowaymirror.repository import DynamoDBSessionRepository, ensure_table
from twowaymirror.settings import Settings

NOTIFY_FROM = "no-reply@example.com"
NOTIFY_TO = "candidate@example.com"
BASE_URL = "https://2wm.example.com"


class _RecordingClient:
    """Wraps the moto-backed sesv2 client so a test can read back what was sent.

    The call still goes through botocore and moto, so an unverified identity or a
    malformed request fails here exactly as it would against SES.
    """

    def __init__(self, inner: Any, sent: list[dict[str, Any]]) -> None:
        self._inner = inner
        self._sent = sent

    def send_email(self, **kwargs: Any) -> Any:
        self._sent.append(kwargs)
        return self._inner.send_email(**kwargs)


@pytest.fixture
def notify_settings(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> Settings:
    """The conftest settings with notifications switched on."""
    monkeypatch.setenv("TWM_NOTIFY_FROM", NOTIFY_FROM)
    monkeypatch.setenv("TWM_NOTIFY_EMAIL", NOTIFY_TO)
    monkeypatch.setenv("TWM_PUBLIC_BASE_URL", BASE_URL)
    return Settings(_env_file=None)


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    mailbox: list[dict[str, Any]] = []

    def recording_client(settings: Settings) -> Any:
        return _RecordingClient(boto3.client("sesv2", region_name=settings.AWS_REGION), mailbox)

    monkeypatch.setattr(notifications, "_client", recording_client)
    return mailbox


@pytest.fixture
def api(
    notify_settings: Settings, aws_credentials: None
) -> Iterator[tuple[TestClient, DynamoDBSessionRepository]]:
    with mock_aws():
        ensure_table(notify_settings)
        ses = boto3.client("sesv2", region_name=notify_settings.AWS_REGION)
        # Sandbox SES refuses unverified identities; verify both so send_email succeeds.
        ses.create_email_identity(EmailIdentity=NOTIFY_FROM)
        ses.create_email_identity(EmailIdentity=NOTIFY_TO)
        yield TestClient(create_app()), DynamoDBSessionRepository(notify_settings)


def _required_answers(client: TestClient, token: str) -> dict[str, str]:
    content = client.get(f"/api/sessions/{token}").json()["content"]
    return {
        q["id"]: f"Answer for {q['id']}." for q in content["company_questions"] if q["required"]
    }


def _subject(message: dict[str, Any]) -> str:
    return str(message["Content"]["Simple"]["Subject"]["Data"])


def _text(message: dict[str, Any]) -> str:
    return str(message["Content"]["Simple"]["Body"]["Text"]["Data"])


def test_first_submission_sends_the_answers(
    api: tuple[TestClient, DynamoDBSessionRepository], sent: list[dict[str, Any]]
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme Robotics", contact="Sam", variant="senior")

    response = client.post(
        f"/api/sessions/{record.token}/answers",
        json={"answers": _required_answers(client, record.token)},
    )

    assert response.status_code == 201
    assert len(sent) == 1
    message = sent[0]
    assert message["FromEmailAddress"] == NOTIFY_FROM
    assert message["Destination"]["ToAddresses"] == [NOTIFY_TO]
    assert _subject(message) == "Answers from Acme Robotics"
    body = _text(message)
    assert "Acme Robotics" in body
    assert "Sam" in body
    assert "senior" in body
    # Same instant as the response, written with the +00:00 offset rather than JSON's "Z".
    assert response.json()["submitted_at"].removesuffix("Z") in body
    assert f"{BASE_URL}/s/{record.token}" in body
    assert "How is the engineering team structured" in body
    assert "Answer for team-structure." in body
    # growth-path is optional and was not answered.
    assert "What does a promotion path look like" in body
    assert notifications.NOT_ANSWERED in body
    assert f"2wm pull {record.token}" in body


def test_second_submission_sends_an_update(
    api: tuple[TestClient, DynamoDBSessionRepository], sent: list[dict[str, Any]]
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme Robotics", contact="Sam", variant="senior")
    answers = _required_answers(client, record.token)
    client.post(f"/api/sessions/{record.token}/answers", json={"answers": answers})
    first_id = next(iter(answers))
    answers[first_id] = "Revised answer."

    response = client.post(f"/api/sessions/{record.token}/answers", json={"answers": answers})

    assert response.status_code == 201
    assert len(sent) == 2
    assert _subject(sent[0]) == "Answers from Acme Robotics"
    assert _subject(sent[1]) == "Answers updated from Acme Robotics"
    assert "Revised answer." in _text(sent[1])


@pytest.mark.parametrize(
    ("notify_from", "notify_to"),
    [("", ""), (NOTIFY_FROM, ""), ("", NOTIFY_TO)],
)
def test_no_send_when_a_notification_setting_is_empty(
    api: tuple[TestClient, DynamoDBSessionRepository],
    sent: list[dict[str, Any]],
    monkeypatch: pytest.MonkeyPatch,
    notify_from: str,
    notify_to: str,
) -> None:
    client, repository = api
    monkeypatch.setenv("TWM_NOTIFY_FROM", notify_from)
    monkeypatch.setenv("TWM_NOTIFY_EMAIL", notify_to)
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    response = client.post(
        f"/api/sessions/{record.token}/answers",
        json={"answers": _required_answers(client, record.token)},
    )

    assert response.status_code == 201
    assert sent == []


def test_submission_succeeds_and_logs_the_token_when_the_send_raises(
    api: tuple[TestClient, DynamoDBSessionRepository],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    client, repository = api

    class _BrokenClient:
        def send_email(self, **kwargs: Any) -> Any:
            raise RuntimeError("SES is having a day")

    monkeypatch.setattr(notifications, "_client", lambda settings: _BrokenClient())
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers = _required_answers(client, record.token)

    with caplog.at_level(logging.ERROR, logger=notifications.__name__):
        response = client.post(f"/api/sessions/{record.token}/answers", json={"answers": answers})

    assert response.status_code == 201
    # The answers are stored whatever the send did.
    assert client.get(f"/api/sessions/{record.token}").json()["session"]["answers"] == answers
    assert record.token in caplog.text
    assert "SES is having a day" in caplog.text


def test_send_is_a_no_op_without_settings(
    api: tuple[TestClient, DynamoDBSessionRepository], sent: list[dict[str, Any]]
) -> None:
    _, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers = repository.put_answers(record.token, {"team-structure": "Squads."})
    off = Settings(_env_file=None, TWM_NOTIFY_EMAIL="", TWM_NOTIFY_FROM="")

    assert (
        notifications.send_answers_email(off, record=record, answers=answers, first_submission=True)
        is False
    )
    assert sent == []


def test_send_lists_answers_that_predate_the_question_snapshot(
    api: tuple[TestClient, DynamoDBSessionRepository],
    notify_settings: Settings,
    sent: list[dict[str, Any]],
) -> None:
    """Older submissions carry no snapshot; the email still names what was answered."""
    _, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers = repository.put_answers(record.token, {"team-structure": "Squads."})

    assert answers.questions == []
    assert notifications.send_answers_email(
        notify_settings, record=record, answers=answers, first_submission=True
    )
    body = _text(sent[0])
    assert "team-structure" in body
    assert "Squads." in body


def test_session_link_does_not_double_the_slash() -> None:
    settings = Settings(_env_file=None, TWM_PUBLIC_BASE_URL="https://2wm.example.com/")

    assert notifications.session_link(settings, "abc") == "https://2wm.example.com/s/abc"
