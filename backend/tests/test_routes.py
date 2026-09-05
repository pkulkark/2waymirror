from __future__ import annotations

from collections.abc import Iterator

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
    assert response.json()["session"]["answers_submitted"] is True


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


def test_get_session_revoked_is_410(api: tuple[TestClient, DynamoDBSessionRepository]) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    repository.revoke_session(record.token)

    response = client.get(f"/api/sessions/{record.token}")

    assert response.status_code == 410


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


def test_submit_answers_twice_is_409(api: tuple[TestClient, DynamoDBSessionRepository]) -> None:
    client, repository = api
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    payload = {"answers": _required_answers(client, record.token)}

    first = client.post(f"/api/sessions/{record.token}/answers", json=payload)
    second = client.post(f"/api/sessions/{record.token}/answers", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409


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
