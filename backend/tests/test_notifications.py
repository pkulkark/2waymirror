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
from twowaymirror.routes import get_remaining_ms
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


def _budget(client: TestClient, remaining_ms: int | None) -> None:
    """Answer the invocation-budget dependency with a fixed value for this client."""
    client.app.dependency_overrides[get_remaining_ms] = lambda: remaining_ms  # type: ignore[attr-defined]


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


def test_submission_succeeds_and_logs_a_truncated_token_when_the_send_raises(
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
    # Enough of the token to find the session, not enough to open it.
    assert record.token not in caplog.text
    assert f"{record.token[: notifications.TOKEN_LOG_PREFIX]}..." in caplog.text
    assert "Acme" in caplog.text
    assert "SES is having a day" in caplog.text


def test_send_is_a_no_op_without_settings(
    api: tuple[TestClient, DynamoDBSessionRepository], sent: list[dict[str, Any]]
) -> None:
    _, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers, _ = repository.put_answers(record.token, {"team-structure": "Squads."})
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
    answers, _ = repository.put_answers(record.token, {"team-structure": "Squads."})

    assert answers.questions == []
    assert notifications.send_answers_email(
        notify_settings, record=record, answers=answers, first_submission=True
    )
    body = _text(sent[0])
    assert "team-structure" in body
    assert "Squads." in body


def test_ses_client_is_cached_per_region_and_cannot_outlast_the_lambda(
    aws_credentials: None,
) -> None:
    """One client per region, and timeouts well inside the function's 10 second budget."""
    settings = Settings(_env_file=None, AWS_REGION="ca-central-1")
    notifications._ses_client.cache_clear()
    try:
        client = notifications._ses_client("ca-central-1")

        assert notifications._client(settings) is client
        assert notifications._ses_client("us-east-1") is not client
        assert client.meta.config.connect_timeout == 2
        assert client.meta.config.read_timeout == 5
        # One attempt in total, so the worst case is 7 seconds, not a multiple of it.
        assert client.meta.config.retries == {"mode": "standard", "total_max_attempts": 1}
    finally:
        notifications._ses_client.cache_clear()


def test_a_budget_under_the_send_cost_stores_the_answers_and_skips_the_send(
    api: tuple[TestClient, DynamoDBSessionRepository],
    sent: list[dict[str, Any]],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A slow request leaves too little of the invocation to risk an SES call."""
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers = _required_answers(client, record.token)
    _budget(client, 500)

    with caplog.at_level(logging.WARNING, logger=notifications.__name__):
        response = client.post(f"/api/sessions/{record.token}/answers", json={"answers": answers})

    assert response.status_code == 201
    assert sent == []
    # The answers are stored whatever the send did.
    assert client.get(f"/api/sessions/{record.token}").json()["session"]["answers"] == answers
    assert "Acme" in caplog.text
    assert record.token not in caplog.text
    assert f"{record.token[: notifications.TOKEN_LOG_PREFIX]}..." in caplog.text
    assert "500 ms left" in caplog.text


def test_a_budget_over_the_send_cost_sends(
    api: tuple[TestClient, DynamoDBSessionRepository], sent: list[dict[str, Any]]
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    _budget(client, notifications.SEND_BUDGET_MS + 1_000)

    response = client.post(
        f"/api/sessions/{record.token}/answers",
        json={"answers": _required_answers(client, record.token)},
    )

    assert response.status_code == 201
    assert len(sent) == 1


def test_an_unknown_budget_sends(
    api: tuple[TestClient, DynamoDBSessionRepository], sent: list[dict[str, Any]]
) -> None:
    """Outside Lambda there is no budget to respect, so the send goes ahead."""
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    _budget(client, None)

    response = client.post(
        f"/api/sessions/{record.token}/answers",
        json={"answers": _required_answers(client, record.token)},
    )

    assert response.status_code == 201
    assert len(sent) == 1


@pytest.mark.parametrize(
    ("remaining_ms", "expected"),
    [(notifications.SEND_BUDGET_MS, True), (notifications.SEND_BUDGET_MS - 1, False)],
)
def test_the_send_budget_boundary(
    api: tuple[TestClient, DynamoDBSessionRepository],
    notify_settings: Settings,
    sent: list[dict[str, Any]],
    remaining_ms: int,
    expected: bool,
) -> None:
    """Exactly the budget is enough; one millisecond less is not."""
    _, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers, _ = repository.put_answers(record.token, {"team-structure": "Squads."})

    sent_it = notifications.send_answers_email(
        notify_settings,
        record=record,
        answers=answers,
        first_submission=True,
        remaining_ms=remaining_ms,
    )

    assert sent_it is expected
    assert len(sent) == (1 if expected else 0)


def test_the_send_budget_is_derived_from_the_client_timeouts() -> None:
    """The threshold and the client's waits are the same numbers, so they cannot drift."""
    assert (
        notifications.SEND_BUDGET_MS
        == (notifications.SES_CONNECT_TIMEOUT_SECONDS + notifications.SES_READ_TIMEOUT_SECONDS)
        * 1000
        + notifications.RESPONSE_RESERVE_MS
    )
