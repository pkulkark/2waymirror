from __future__ import annotations

from pathlib import Path

import boto3
import pytest
from moto import mock_aws

from twowaymirror.content import (
    ContentError,
    UnknownVariantError,
    declared_variants,
    load_content,
)
from twowaymirror.settings import Settings

SAMPLE_CONTENT_DIR = Path(__file__).resolve().parents[2] / "content" / "sample"


def test_load_content_local_senior(settings: Settings) -> None:
    result = load_content(settings, variant="senior")

    assert result.candidate["name"] == "Jordan Sample"
    assert result.logistics["compensation"].startswith("EUR 70,000")

    question_ids = {question.id for question in result.company_questions}
    assert "org-scope" not in question_ids  # restricted to principal/manager

    assert [section.id for section in result.sections] == ["initial-conversation", "deep-dives"]

    why_leaving = result.sections[0].items[0]
    assert why_leaving.id == "why-leaving"
    assert why_leaving.evidence[0].url == "https://example.com/talks/platform-migrations"
    assert why_leaving.answer_md.strip().startswith("I am looking for a role")


def test_load_content_principal_variant_unlocks_question_and_extra_evidence(
    settings: Settings,
) -> None:
    result = load_content(settings, variant="principal")

    question_ids = {question.id for question in result.company_questions}
    assert "org-scope" in question_ids

    assert result.logistics["compensation"].startswith("EUR 85,000")

    deep_dive_items = {item.id: item for item in result.sections[1].items}
    assert len(deep_dive_items["oncall-incident"].evidence) == 2


def test_load_content_manager_variant_overrides_question_text(settings: Settings) -> None:
    result = load_content(settings, variant="manager")

    question_ids = {question.id for question in result.company_questions}
    assert "org-scope" in question_ids
    assert result.logistics["notice_period"] == "2 months"

    initial_items = {item.id: item for item in result.sections[0].items}
    assert initial_items["team-fit"].question.startswith("What kind of team do you want to build")


def test_load_content_answer_md_is_raw_markdown_not_rendered(settings: Settings) -> None:
    result = load_content(settings, variant="senior")
    why_leaving = result.sections[0].items[0]
    assert "<" not in why_leaving.answer_md  # nothing was rendered to HTML


def test_load_content_missing_file_raises(tmp_path: Path, settings: Settings) -> None:
    incomplete = tmp_path / "incomplete"
    incomplete.mkdir()
    # profile.yaml is missing entirely.
    broken_settings = Settings(
        TWM_TABLE_NAME=settings.TWM_TABLE_NAME,
        TWM_TENANT=settings.TWM_TENANT,
        TWM_CONTENT_SOURCE=str(incomplete),
        AWS_REGION=settings.AWS_REGION,
    )

    with pytest.raises(ContentError):
        load_content(broken_settings, variant="senior")


def test_load_content_from_s3(aws_credentials: None) -> None:
    with mock_aws():
        client = boto3.client("s3", region_name="ca-central-1")
        client.create_bucket(
            Bucket="twm-test-content",
            CreateBucketConfiguration={"LocationConstraint": "ca-central-1"},
        )
        for path in SAMPLE_CONTENT_DIR.rglob("*"):
            if path.is_file():
                key = f"sample/{path.relative_to(SAMPLE_CONTENT_DIR).as_posix()}"
                client.put_object(Bucket="twm-test-content", Key=key, Body=path.read_bytes())

        s3_settings = Settings(
            TWM_TABLE_NAME="twm-test",
            TWM_TENANT="default",
            TWM_CONTENT_SOURCE="s3://twm-test-content/sample",
            AWS_REGION="ca-central-1",
        )

        result = load_content(s3_settings, variant="senior")

        assert result.candidate["name"] == "Jordan Sample"
        assert [section.id for section in result.sections] == [
            "initial-conversation",
            "deep-dives",
        ]


def test_declared_variants_come_from_content(settings: Settings) -> None:
    assert declared_variants(settings) == ["senior", "principal", "manager"]


def test_load_content_unknown_variant_raises(settings: Settings) -> None:
    with pytest.raises(UnknownVariantError):
        load_content(settings, variant="cto")
