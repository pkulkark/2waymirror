from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

from twowaymirror.main import create_app
from twowaymirror.repository import DynamoDBSessionRepository, ensure_table
from twowaymirror.settings import Settings


@pytest.fixture
def api(
    settings: Settings, aws_credentials: None
) -> Iterator[tuple[TestClient, DynamoDBSessionRepository]]:
    with mock_aws():
        ensure_table(settings)
        app = create_app()
        yield TestClient(app), DynamoDBSessionRepository(settings)


def _required_answers(client: TestClient, token: str) -> dict[str, str]:
    content = client.get(f"/api/sessions/{token}").json()["content"]
    return {
        q["id"]: f"Answer for {q['id']}." for q in content["company_questions"] if q["required"]
    }


def test_get_session_success(api: tuple[TestClient, DynamoDBSessionRepository]) -> None:
    client, repository = api
    record = repository.create_session(company="Acme Robotics", contact="Sam", variant="senior")

    response = client.get(f"/api/sessions/{record.token}")

    assert response.status_code == 200
    body = response.json()
    assert body["session"]["company"] == "Acme Robotics"
    assert body["session"]["contact"] == "Sam"
    assert body["session"]["variant"] == "senior"
    assert body["session"]["answers_submitted"] is False
    assert body["session"]["answers"] is None
    assert body["session"]["submitted_at"] is None
    assert "tenant" not in body["session"]
    assert "ttl" not in body["session"]
    assert "revoked" not in body["session"]
    assert body["content"]["candidate"]["name"] == "Jordan Sample"
    question_ids = {q["id"] for q in body["content"]["company_questions"]}
    assert "org-scope" not in question_ids


def test_get_session_reflects_submitted_answers(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    repository.put_answers(record.token, {"team-structure": "We work in small squads."})

    response = client.get(f"/api/sessions/{record.token}")

    assert response.status_code == 200
    session = response.json()["session"]
    assert session["answers_submitted"] is True
    assert session["answers"] == {"team-structure": "We work in small squads."}
    assert session["submitted_at"] is not None
    assert session["questions"] == []


def test_get_session_returns_the_question_snapshot_as_answered(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers = _required_answers(client, record.token)
    client.post(f"/api/sessions/{record.token}/answers", json={"answers": answers})

    session = client.get(f"/api/sessions/{record.token}").json()["session"]

    snapshot = {q["id"]: q for q in session["questions"]}
    assert set(answers) <= set(snapshot)
    assert all(q["required"] for q in snapshot.values() if q["id"] in answers)
    assert all(q["question"] for q in snapshot.values())


def test_get_session_unknown_token_is_404(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, _ = api

    response = client.get("/api/sessions/does-not-exist")

    assert response.status_code == 404


def test_get_session_expired_is_410(api: tuple[TestClient, DynamoDBSessionRepository]) -> None:
    client, repository = api
    record = repository.create_session(
        company="Acme", contact="Sam", variant="senior", lifetime_days=-1
    )

    response = client.get(f"/api/sessions/{record.token}")

    assert response.status_code == 410
    body = response.json()
    assert body["detail"] == "Session expired or revoked."
    assert body["candidate"] == {"name": "Jordan Sample", "email": "jordan@example.com"}
    assert body["expires_at"] == record.expires_at.isoformat()


def test_get_session_revoked_is_410(api: tuple[TestClient, DynamoDBSessionRepository]) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    repository.revoke_session(record.token)

    response = client.get(f"/api/sessions/{record.token}")

    assert response.status_code == 410
    assert response.json()["candidate"]["email"] == "jordan@example.com"


def test_get_session_gone_with_undeclared_variant_still_has_the_profile(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="nope")
    repository.revoke_session(record.token)

    response = client.get(f"/api/sessions/{record.token}")

    assert response.status_code == 410
    assert response.json()["candidate"] == {"name": "Jordan Sample", "email": "jordan@example.com"}


def test_get_session_gone_survives_a_broken_content_tree(
    api: tuple[TestClient, DynamoDBSessionRepository],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The 410 must not depend on anything but profile.yaml being readable."""
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    repository.revoke_session(record.token)
    (tmp_path / "profile.yaml").write_text("name: Only Profile\nemail: only@example.com\n")
    monkeypatch.setenv("TWM_CONTENT_SOURCE", str(tmp_path))

    response = client.get(f"/api/sessions/{record.token}")

    assert response.status_code == 410
    assert response.json()["candidate"] == {"name": "Only Profile", "email": "only@example.com"}


def test_get_session_gone_with_unreadable_profile_has_no_candidate(
    api: tuple[TestClient, DynamoDBSessionRepository],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    repository.revoke_session(record.token)
    monkeypatch.setenv("TWM_CONTENT_SOURCE", str(tmp_path))

    response = client.get(f"/api/sessions/{record.token}")

    assert response.status_code == 410
    assert response.json()["candidate"] == {"name": None, "email": None}


def test_submit_answers_success(api: tuple[TestClient, DynamoDBSessionRepository]) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    response = client.post(
        f"/api/sessions/{record.token}/answers",
        json={"answers": _required_answers(client, record.token)},
    )

    assert response.status_code == 201
    assert "submitted_at" in response.json()


def test_submit_answers_unknown_token_is_404(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, _ = api

    response = client.post(
        "/api/sessions/does-not-exist/answers",
        json={"answers": {"team-structure": "text"}},
    )

    assert response.status_code == 404


def test_submit_answers_expired_is_410(api: tuple[TestClient, DynamoDBSessionRepository]) -> None:
    client, repository = api
    record = repository.create_session(
        company="Acme", contact="Sam", variant="senior", lifetime_days=-1
    )

    response = client.post(
        f"/api/sessions/{record.token}/answers",
        json={"answers": {"team-structure": "text"}},
    )

    assert response.status_code == 410


def test_submit_answers_twice_replaces(api: tuple[TestClient, DynamoDBSessionRepository]) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers = _required_answers(client, record.token)
    first = client.post(f"/api/sessions/{record.token}/answers", json={"answers": answers})
    first_id = next(iter(answers))
    answers[first_id] = "Revised answer."
    second = client.post(f"/api/sessions/{record.token}/answers", json={"answers": answers})

    assert first.status_code == 201
    assert second.status_code == 201
    session = client.get(f"/api/sessions/{record.token}").json()["session"]
    assert session["answers"][first_id] == "Revised answer."


def test_submit_answers_unknown_question_id_is_422(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    response = client.post(
        f"/api/sessions/{record.token}/answers",
        json={"answers": {"not-a-real-question": "text"}},
    )

    assert response.status_code == 422


def test_submit_answers_restricted_question_for_variant_is_422(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    # org-scope is restricted to principal/manager; answering it in a senior session is unknown.
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    response = client.post(
        f"/api/sessions/{record.token}/answers",
        json={"answers": {"org-scope": "text"}},
    )

    assert response.status_code == 422


def test_submit_answers_empty_text_is_422(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    response = client.post(
        f"/api/sessions/{record.token}/answers",
        json={"answers": {"team-structure": "   "}},
    )

    assert response.status_code == 422


def test_submit_answers_no_answers_is_422(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    response = client.post(f"/api/sessions/{record.token}/answers", json={"answers": {}})

    assert response.status_code == 422


def test_submit_answers_missing_required_is_422(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers = _required_answers(client, record.token)
    dropped = next(iter(answers))
    del answers[dropped]

    response = client.post(f"/api/sessions/{record.token}/answers", json={"answers": answers})

    assert response.status_code == 422
    assert dropped in response.json()["detail"]


def test_submit_answers_oversized_answer_is_422(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers = _required_answers(client, record.token)
    first = next(iter(answers))
    answers[first] = "x" * 410_000

    response = client.post(f"/api/sessions/{record.token}/answers", json={"answers": answers})

    assert response.status_code == 422


def test_submit_answers_too_many_answers_is_422(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    answers = {f"q{i}": "text" for i in range(60)}

    response = client.post(f"/api/sessions/{record.token}/answers", json={"answers": answers})

    assert response.status_code == 422


def test_submit_answers_total_size_is_bounded() -> None:
    from pydantic import ValidationError

    from twowaymirror.models import MAX_ANSWER_CHARS, AnswersSubmitRequest

    with pytest.raises(ValidationError):
        AnswersSubmitRequest(answers={f"q{i}": "x" * MAX_ANSWER_CHARS for i in range(45)})


def test_get_session_with_undeclared_variant_is_404(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="cto")

    response = client.get(f"/api/sessions/{record.token}")

    assert response.status_code == 404


def test_site_returns_the_feedback_email_from_the_profile(
    api: tuple[TestClient, DynamoDBSessionRepository],
) -> None:
    client, _ = api

    response = client.get("/api/site")

    assert response.status_code == 200
    assert response.json() == {"feedback_email": "jordan@example.com"}


def test_site_prefers_a_dedicated_feedback_email(
    api: tuple[TestClient, DynamoDBSessionRepository],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = api
    (tmp_path / "profile.yaml").write_text(
        "name: Only Profile\nemail: only@example.com\nfeedback_email: feedback@example.com\n"
    )
    monkeypatch.setenv("TWM_CONTENT_SOURCE", str(tmp_path))

    response = client.get("/api/site")

    assert response.json() == {"feedback_email": "feedback@example.com"}


def test_site_without_a_readable_profile_has_no_email(
    api: tuple[TestClient, DynamoDBSessionRepository],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = api
    monkeypatch.setenv("TWM_CONTENT_SOURCE", str(tmp_path))

    response = client.get("/api/site")

    assert response.status_code == 200
    assert response.json() == {"feedback_email": None}
