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
from twowaymirror.models import Content, Evidence
from twowaymirror.settings import Settings

SAMPLE_CONTENT_DIR = Path(__file__).resolve().parents[2] / "content" / "sample"


def _logistics_by_label(result: Content) -> dict[str, str]:
    return {item.label: item.value for item in result.logistics}


def test_load_content_local_senior(settings: Settings) -> None:
    result = load_content(settings, variant="senior")

    assert result.candidate["name"] == "Jordan Sample"
    assert _logistics_by_label(result)["Compensation"].startswith("EUR 70,000")
    assert [item.label for item in result.logistics] == [
        "Availability",
        "Compensation",
        "Work authorization",
        "Location preference",
        "Notice period",
    ]

    question_ids = {question.id for question in result.company_questions}
    assert "org-scope" not in question_ids  # restricted to principal/manager

    assert [section.id for section in result.sections] == ["initial-conversation", "deep-dives"]

    why_leaving = result.sections[0].items[0]
    assert why_leaving.id == "why-leaving"
    assert why_leaving.summary == "Looking for end-to-end ownership of a backend platform."
    assert why_leaving.evidence[0].url == "https://example.com/talks/platform-migrations"
    assert why_leaving.evidence[0].type == "talk"
    assert why_leaving.answer_md.strip().startswith("I am looking for a role")


def test_load_content_summary_is_none_when_front_matter_omits_it(settings: Settings) -> None:
    result = load_content(settings, variant="senior")
    team_fit = result.sections[0].items[1]

    assert team_fit.id == "team-fit"
    assert team_fit.summary is None
    assert team_fit.evidence[0].type == "writeup"


def test_evidence_type_defaults_to_none_when_absent(settings: Settings) -> None:
    # An evidence link with no `type` key still validates and comes back untyped.
    evidence = Evidence(label="Some link", url="https://example.com/x")
    assert evidence.type is None


def test_load_content_principal_variant_unlocks_question_and_extra_evidence(
    settings: Settings,
) -> None:
    result = load_content(settings, variant="principal")

    question_ids = {question.id for question in result.company_questions}
    assert "org-scope" in question_ids

    assert _logistics_by_label(result)["Compensation"].startswith("EUR 85,000")

    deep_dive_items = {item.id: item for item in result.sections[1].items}
    assert len(deep_dive_items["oncall-incident"].evidence) == 2


def test_load_content_manager_variant_overrides_question_text(settings: Settings) -> None:
    result = load_content(settings, variant="manager")

    question_ids = {question.id for question in result.company_questions}
    assert "org-scope" in question_ids
    assert _logistics_by_label(result)["Notice period"] == "2 months"

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


def test_cache_rereads_after_max_age(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, settings: Settings
) -> None:
    import shutil

    from twowaymirror import content as content_module

    source = tmp_path / "content"
    shutil.copytree(SAMPLE_CONTENT_DIR, source)
    monkeypatch.setenv("TWM_CONTENT_SOURCE", str(source))
    monkeypatch.setenv("TWM_CONTENT_CACHE_SECONDS", "300")
    fresh = Settings(_env_file=None)
    content_module.clear_cache()

    clock = {"now": 1000.0}
    monkeypatch.setattr(content_module, "_now", lambda: clock["now"])

    assert load_content(fresh, variant="senior").candidate["name"] == "Jordan Sample"

    profile = source / "profile.yaml"
    profile.write_text(profile.read_text().replace("Jordan Sample", "Jordan Updated"))

    clock["now"] += 299
    assert load_content(fresh, variant="senior").candidate["name"] == "Jordan Sample"

    clock["now"] += 2
    assert load_content(fresh, variant="senior").candidate["name"] == "Jordan Updated"
    content_module.clear_cache()
