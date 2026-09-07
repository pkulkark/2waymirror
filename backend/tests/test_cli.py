from __future__ import annotations

import shutil
from collections.abc import Iterator
from pathlib import Path

import boto3
import pytest
import yaml
from moto import mock_aws
from typer.testing import CliRunner

from twowaymirror import content as content_module
from twowaymirror.cli import app
from twowaymirror.content import load_content
from twowaymirror.models import QuestionSnapshot
from twowaymirror.repository import DynamoDBSessionRepository, ensure_table
from twowaymirror.settings import Settings

SAMPLE_CONTENT_DIR = Path(__file__).resolve().parents[2] / "content" / "sample"


def _submit(
    repository: DynamoDBSessionRepository, settings: Settings, token: str, answers: dict[str, str]
) -> None:
    record = repository.get_session(token)
    assert record is not None
    content = load_content(settings, variant=record.variant)
    repository.put_answers(
        token,
        answers,
        questions=[
            QuestionSnapshot(id=q.id, question=q.question, required=q.required)
            for q in content.company_questions
        ],
        ttl=record.ttl,
    )


@pytest.fixture
def cli(
    settings: Settings, aws_credentials: None
) -> Iterator[tuple[CliRunner, DynamoDBSessionRepository]]:
    with mock_aws():
        ensure_table(settings)
        yield CliRunner(), DynamoDBSessionRepository(settings)


def test_create_success(cli: tuple[CliRunner, DynamoDBSessionRepository]) -> None:
    runner, repository = cli

    result = runner.invoke(
        app,
        ["create", "--company", "Acme Robotics", "--contact", "Sam", "--variant", "senior"],
    )

    assert result.exit_code == 0
    assert "Acme Robotics" in result.output
    assert "Sam" in result.output
    assert "senior" in result.output
    assert "http://localhost:5173/s/" in result.output

    [record] = repository.list_sessions()
    assert record.company == "Acme Robotics"
    assert record.variant == "senior"


def test_create_respects_days_option(cli: tuple[CliRunner, DynamoDBSessionRepository]) -> None:
    runner, repository = cli

    result = runner.invoke(
        app,
        [
            "create",
            "--company",
            "Acme",
            "--contact",
            "Sam",
            "--variant",
            "senior",
            "--days",
            "1",
        ],
    )

    assert result.exit_code == 0
    [record] = repository.list_sessions()
    assert (record.expires_at - record.created_at).days == 1


def test_create_unknown_variant_exits_nonzero(
    cli: tuple[CliRunner, DynamoDBSessionRepository],
) -> None:
    runner, repository = cli

    result = runner.invoke(
        app,
        ["create", "--company", "Acme", "--contact", "Sam", "--variant", "cto"],
    )

    assert result.exit_code == 1
    assert "unknown variant" in result.output
    assert "senior" in result.output  # declared variants are listed
    assert repository.list_sessions() == []


def test_list_hides_expired_and_revoked_by_default(
    cli: tuple[CliRunner, DynamoDBSessionRepository],
) -> None:
    runner, repository = cli
    live = repository.create_session(company="Live Co", contact="A", variant="senior")
    expired = repository.create_session(
        company="Expired Co", contact="B", variant="senior", lifetime_days=-1
    )
    revoked = repository.create_session(company="Revoked Co", contact="C", variant="senior")
    repository.revoke_session(revoked.token)

    result = runner.invoke(app, ["list"])

    assert result.exit_code == 0
    assert live.token in result.output
    assert expired.token not in result.output
    assert revoked.token not in result.output


def test_list_all_includes_expired_and_revoked(
    cli: tuple[CliRunner, DynamoDBSessionRepository],
) -> None:
    runner, repository = cli
    expired = repository.create_session(
        company="Expired Co", contact="B", variant="senior", lifetime_days=-1
    )
    revoked = repository.create_session(company="Revoked Co", contact="C", variant="senior")
    repository.revoke_session(revoked.token)

    result = runner.invoke(app, ["list", "--all"])

    assert result.exit_code == 0
    assert "expired" in result.output
    assert "revoked" in result.output
    assert expired.token in result.output
    assert revoked.token in result.output


def test_list_shows_answers_column(cli: tuple[CliRunner, DynamoDBSessionRepository]) -> None:
    runner, repository = cli
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    repository.put_answers(record.token, {"team-structure": "A small team."})

    result = runner.invoke(app, ["list"])

    lines = [line for line in result.output.splitlines() if record.token in line]
    assert len(lines) == 1
    assert lines[0].strip().endswith("yes")


def test_list_empty_prints_message(cli: tuple[CliRunner, DynamoDBSessionRepository]) -> None:
    runner, _repository = cli

    result = runner.invoke(app, ["list"])

    assert result.exit_code == 0
    assert "no sessions" in result.output


def test_revoke_success(cli: tuple[CliRunner, DynamoDBSessionRepository]) -> None:
    runner, repository = cli
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    result = runner.invoke(app, ["revoke", record.token])

    assert result.exit_code == 0
    assert "Acme" in result.output
    fetched = repository.get_session(record.token)
    assert fetched is not None
    assert fetched.revoked is True


def test_revoke_is_idempotent(cli: tuple[CliRunner, DynamoDBSessionRepository]) -> None:
    runner, repository = cli
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    first = runner.invoke(app, ["revoke", record.token])
    second = runner.invoke(app, ["revoke", record.token])

    assert first.exit_code == 0
    assert second.exit_code == 0
    fetched = repository.get_session(record.token)
    assert fetched is not None
    assert fetched.revoked is True


def test_revoke_unknown_token_exits_nonzero(
    cli: tuple[CliRunner, DynamoDBSessionRepository],
) -> None:
    runner, _repository = cli

    result = runner.invoke(app, ["revoke", "does-not-exist"])

    assert result.exit_code == 1
    assert "unknown session token" in result.output


def test_pull_writes_expected_schema(
    cli: tuple[CliRunner, DynamoDBSessionRepository], settings: Settings, tmp_path: Path
) -> None:
    runner, repository = cli
    record = repository.create_session(company="Gamma Corp", contact="Lee", variant="senior")
    _submit(
        repository,
        settings,
        record.token,
        {"team-structure": "A small platform team.", "tech-stack": "Python and TypeScript."},
    )

    result = runner.invoke(app, ["pull", record.token, "--out", str(tmp_path)])

    assert result.exit_code == 0
    output_path = Path(result.output.strip())
    assert output_path.exists()
    assert output_path.parent == tmp_path
    assert output_path.name.startswith("gamma-corp-")
    assert output_path.name.endswith(".yaml")

    data = yaml.safe_load(output_path.read_text())
    assert data["session"]["token"] == record.token
    assert data["session"]["company"] == "Gamma Corp"
    assert data["session"]["contact"] == "Lee"
    assert data["session"]["variant"] == "senior"
    assert "submitted_at" in data

    answers_by_id = {row["id"]: row for row in data["answers"]}
    assert answers_by_id["team-structure"]["answer"] == "A small platform team."
    assert answers_by_id["team-structure"]["required"] is True
    assert answers_by_id["oncall-expectations"]["answer"] is None
    assert answers_by_id["growth-path"]["required"] is False
    # question order follows the content, not the order answers were submitted
    assert [row["id"] for row in data["answers"]] == [
        "team-structure",
        "oncall-expectations",
        "growth-path",
        "tech-stack",
        "decision-making",
    ]


def test_pull_unknown_token_exits_nonzero(
    cli: tuple[CliRunner, DynamoDBSessionRepository], tmp_path: Path
) -> None:
    runner, _repository = cli

    result = runner.invoke(app, ["pull", "does-not-exist", "--out", str(tmp_path)])

    assert result.exit_code == 1
    assert "unknown session token" in result.output


def test_pull_before_submission_exits_nonzero(
    cli: tuple[CliRunner, DynamoDBSessionRepository], tmp_path: Path
) -> None:
    runner, repository = cli
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")

    result = runner.invoke(app, ["pull", record.token, "--out", str(tmp_path)])

    assert result.exit_code == 1
    assert "not yet submitted" in result.output


def test_content_check_ok() -> None:
    result = CliRunner().invoke(app, ["content", "check", str(SAMPLE_CONTENT_DIR)])

    assert result.exit_code == 0
    assert "OK" in result.output
    assert "senior" in result.output


def test_content_check_missing_variants_file(tmp_path: Path) -> None:
    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()

    result = CliRunner().invoke(app, ["content", "check", str(empty_dir)])

    assert result.exit_code == 1
    assert "variants.yaml" in result.output


def test_content_check_reports_first_error(tmp_path: Path) -> None:
    incomplete = tmp_path / "incomplete"
    incomplete.mkdir()
    (incomplete / "variants.yaml").write_text("- id: senior\n")
    # profile.yaml is missing entirely.

    result = CliRunner().invoke(app, ["content", "check", str(incomplete)])

    assert result.exit_code == 1
    assert "profile.yaml" in result.output


def test_content_push_uploads_every_file(aws_credentials: None) -> None:
    with mock_aws():
        client = boto3.client("s3", region_name="ca-central-1")
        client.create_bucket(
            Bucket="twm-content-test",
            CreateBucketConfiguration={"LocationConstraint": "ca-central-1"},
        )

        result = CliRunner().invoke(
            app,
            [
                "content",
                "push",
                str(SAMPLE_CONTENT_DIR),
                "--bucket",
                "twm-content-test",
                "--prefix",
                "sample",
            ],
        )

        assert result.exit_code == 0
        local_file_count = sum(1 for path in SAMPLE_CONTENT_DIR.rglob("*") if path.is_file())
        assert f"uploaded {local_file_count} file" in result.output

        keys = {obj["Key"] for obj in client.list_objects_v2(Bucket="twm-content-test")["Contents"]}
        assert "sample/variants.yaml" in keys
        assert "sample/answers/why-leaving.md" in keys
        assert len(keys) == local_file_count


def test_content_push_prune_removes_stale_keys(aws_credentials: None) -> None:
    with mock_aws():
        client = boto3.client("s3", region_name="ca-central-1")
        client.create_bucket(
            Bucket="twm-content-test",
            CreateBucketConfiguration={"LocationConstraint": "ca-central-1"},
        )
        client.put_object(Bucket="twm-content-test", Key="sample/stale.yaml", Body=b"stale")

        result = CliRunner().invoke(
            app,
            [
                "content",
                "push",
                str(SAMPLE_CONTENT_DIR),
                "--bucket",
                "twm-content-test",
                "--prefix",
                "sample",
                "--prune",
            ],
        )

        assert result.exit_code == 0
        assert "pruned 1 file" in result.output
        keys = {obj["Key"] for obj in client.list_objects_v2(Bucket="twm-content-test")["Contents"]}
        assert "sample/stale.yaml" not in keys
        assert "sample/variants.yaml" in keys


def test_content_push_without_prune_keeps_stale_keys(aws_credentials: None) -> None:
    with mock_aws():
        client = boto3.client("s3", region_name="ca-central-1")
        client.create_bucket(
            Bucket="twm-content-test",
            CreateBucketConfiguration={"LocationConstraint": "ca-central-1"},
        )
        client.put_object(Bucket="twm-content-test", Key="stale.yaml", Body=b"stale")

        result = CliRunner().invoke(
            app, ["content", "push", str(SAMPLE_CONTENT_DIR), "--bucket", "twm-content-test"]
        )

        assert result.exit_code == 0
        keys = {obj["Key"] for obj in client.list_objects_v2(Bucket="twm-content-test")["Contents"]}
        assert "stale.yaml" in keys


def test_content_push_refuses_wrong_directory(tmp_path: Path) -> None:
    not_content = tmp_path / "not-content"
    not_content.mkdir()
    (not_content / "readme.txt").write_text("hello")

    result = CliRunner().invoke(
        app, ["content", "push", str(not_content), "--bucket", "any-bucket"]
    )

    assert result.exit_code == 1
    assert "variants.yaml" in result.output


def test_content_push_missing_bucket_exits_nonzero(aws_credentials: None) -> None:
    with mock_aws():
        result = CliRunner().invoke(
            app, ["content", "push", str(SAMPLE_CONTENT_DIR), "--bucket", "does-not-exist"]
        )

    assert result.exit_code == 1
    assert "upload to s3://does-not-exist failed" in result.output


def test_content_push_prune_refuses_nearly_empty_source(
    aws_credentials: None, tmp_path: Path
) -> None:
    (tmp_path / "variants.yaml").write_text("- id: senior\n")
    with mock_aws():
        client = boto3.client("s3", region_name="ca-central-1")
        client.create_bucket(
            Bucket="twm-content-test",
            CreateBucketConfiguration={"LocationConstraint": "ca-central-1"},
        )
        result = CliRunner().invoke(
            app, ["content", "push", str(tmp_path), "--bucket", "twm-content-test", "--prune"]
        )

    assert result.exit_code == 1
    assert "refusing to prune" in result.output


def test_pull_reports_content_errors(
    cli: tuple[CliRunner, DynamoDBSessionRepository], monkeypatch: pytest.MonkeyPatch
) -> None:
    runner, repository = cli
    record = repository.create_session(company="Acme", contact="Sam", variant="senior")
    repository.put_answers(record.token, {"team-structure": "x"})
    monkeypatch.setenv("TWM_CONTENT_SOURCE", "/nonexistent/content")
    content_module.clear_cache()

    result = runner.invoke(app, ["pull", record.token])

    assert result.exit_code == 1
    assert "error" in result.output.lower()


def test_pull_exports_questions_as_they_were_at_submission(
    cli: tuple[CliRunner, DynamoDBSessionRepository],
    settings: Settings,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: content edited after a submission must not change the export."""
    runner, repository = cli
    record = repository.create_session(company="Gamma Corp", contact="Lee", variant="senior")
    _submit(
        repository,
        settings,
        record.token,
        {"team-structure": "A small platform team.", "tech-stack": "Python and TypeScript."},
    )

    # Now the content changes: team-structure is removed, another question is reworded,
    # and a new required question appears.
    edited = tmp_path / "content"
    shutil.copytree(SAMPLE_CONTENT_DIR, edited)
    questions = yaml.safe_load((edited / "company_questions.yaml").read_text())
    questions = [q for q in questions if q["id"] != "team-structure"]
    for q in questions:
        if q["id"] == "tech-stack":
            q["question"] = "Reworded question"
    questions.append({"id": "brand-new", "question": "New required question?", "required": True})
    (edited / "company_questions.yaml").write_text(yaml.safe_dump(questions))
    monkeypatch.setenv("TWM_CONTENT_SOURCE", str(edited))
    content_module.clear_cache()

    result = runner.invoke(app, ["pull", record.token, "--out", str(tmp_path / "out")])

    assert result.exit_code == 0
    assert "warning" not in result.output
    data = yaml.safe_load(Path(result.output.strip()).read_text())
    by_id = {row["id"]: row for row in data["answers"]}
    assert by_id["team-structure"]["answer"] == "A small platform team."
    assert by_id["tech-stack"]["question"].startswith("What is the current backend stack")
    assert "brand-new" not in by_id


def test_pull_warns_and_uses_current_content_for_old_submissions(
    cli: tuple[CliRunner, DynamoDBSessionRepository], tmp_path: Path
) -> None:
    runner, repository = cli
    record = repository.create_session(company="Gamma Corp", contact="Lee", variant="senior")
    repository.put_answers(record.token, {"team-structure": "Old-style submission."})

    result = runner.invoke(app, ["pull", record.token, "--out", str(tmp_path)])

    assert result.exit_code == 0
    assert "predates question snapshots" in result.output
