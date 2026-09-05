from __future__ import annotations

import pytest
from moto import mock_aws

from twowaymirror.repository import (
    AnswersAlreadySubmittedError,
    DynamoDBSessionRepository,
    ensure_table,
)
from twowaymirror.settings import Settings


def test_ensure_table_creates_once_then_is_a_no_op(
    settings: Settings, aws_credentials: None
) -> None:
    with mock_aws():
        assert ensure_table(settings) is True
        assert ensure_table(settings) is False


def test_create_and_get_session(repository: DynamoDBSessionRepository) -> None:
    record = repository.create_session(company="Acme Robotics", contact="Sam", variant="senior")

    fetched = repository.get_session(record.token)

    assert fetched is not None
    assert fetched.token == record.token
    assert fetched.company == "Acme Robotics"
    assert fetched.contact == "Sam"
    assert fetched.variant == "senior"
    assert fetched.revoked is False
    assert fetched.is_available is True


def test_get_session_missing_returns_none(repository: DynamoDBSessionRepository) -> None:
    assert repository.get_session("does-not-exist") is None


def test_created_session_token_is_url_safe_and_unique(
    repository: DynamoDBSessionRepository,
) -> None:
    first = repository.create_session(company="A", contact="a", variant="senior")
    second = repository.create_session(company="B", contact="b", variant="principal")

    assert first.token != second.token
    assert len(first.token) == 22  # secrets.token_urlsafe(16) -> 22 chars


def test_list_sessions_excludes_answers_items(repository: DynamoDBSessionRepository) -> None:
    a = repository.create_session(company="A", contact="a", variant="senior")
    b = repository.create_session(company="B", contact="b", variant="principal")
    repository.put_answers(a.token, {"q1": "an answer"})

    sessions = repository.list_sessions()

    assert {s.token for s in sessions} == {a.token, b.token}


def test_revoke_session_marks_unavailable(repository: DynamoDBSessionRepository) -> None:
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    assert repository.revoke_session(record.token) is True

    fetched = repository.get_session(record.token)
    assert fetched is not None
    assert fetched.revoked is True
    assert fetched.is_available is False


def test_revoke_session_missing_returns_false(repository: DynamoDBSessionRepository) -> None:
    assert repository.revoke_session("does-not-exist") is False


def test_session_expired_is_not_available(repository: DynamoDBSessionRepository) -> None:
    record = repository.create_session(
        company="Acme", contact="Sam", variant="senior", lifetime_days=-1
    )

    fetched = repository.get_session(record.token)

    assert fetched is not None
    assert fetched.is_available is False


def test_get_answers_missing_returns_none(repository: DynamoDBSessionRepository) -> None:
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    assert repository.get_answers(record.token) is None


def test_put_and_get_answers(repository: DynamoDBSessionRepository) -> None:
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    result = repository.put_answers(record.token, {"team-structure": "We ship in small teams."})

    assert result.answers == {"team-structure": "We ship in small teams."}

    fetched = repository.get_answers(record.token)
    assert fetched is not None
    assert fetched.answers == {"team-structure": "We ship in small teams."}
    assert fetched.submitted_at == result.submitted_at


def test_put_answers_twice_raises(repository: DynamoDBSessionRepository) -> None:
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    repository.put_answers(record.token, {"team-structure": "first submit"})

    with pytest.raises(AnswersAlreadySubmittedError):
        repository.put_answers(record.token, {"team-structure": "second submit"})
