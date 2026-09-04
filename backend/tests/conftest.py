from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from moto import mock_aws

from twowaymirror import content as content_module
from twowaymirror.repository import DynamoDBSessionRepository, ensure_table
from twowaymirror.settings import Settings

SAMPLE_CONTENT_DIR = Path(__file__).resolve().parents[2] / "content" / "sample"


@pytest.fixture(autouse=True)
def _clear_content_cache() -> Iterator[None]:
    """The content loader caches at module level; keep tests isolated from one another."""
    content_module.clear_cache()
    yield
    content_module.clear_cache()


@pytest.fixture
def aws_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    """Dummy credentials so boto3 never tries to resolve real ones under moto."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")


@pytest.fixture
def settings(monkeypatch: pytest.MonkeyPatch) -> Settings:
    monkeypatch.setenv("TWM_TABLE_NAME", "twm-test")
    monkeypatch.setenv("TWM_TENANT", "default")
    monkeypatch.setenv("TWM_CONTENT_SOURCE", str(SAMPLE_CONTENT_DIR))
    monkeypatch.setenv("AWS_REGION", "ca-central-1")
    monkeypatch.delenv("TWM_DYNAMODB_ENDPOINT", raising=False)
    return Settings(_env_file=None)


@pytest.fixture
def repository(settings: Settings, aws_credentials: None) -> Iterator[DynamoDBSessionRepository]:
    with mock_aws():
        ensure_table(settings)
        yield DynamoDBSessionRepository(settings)
