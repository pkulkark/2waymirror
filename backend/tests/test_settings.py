from __future__ import annotations

import pytest

from twowaymirror.settings import Settings, get_settings

ENV_VARS = [
    "TWM_TABLE_NAME",
    "TWM_TENANT",
    "TWM_CONTENT_SOURCE",
    "TWM_DYNAMODB_ENDPOINT",
    "AWS_REGION",
    "TWM_PUBLIC_BASE_URL",
]


def test_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for var in ENV_VARS:
        monkeypatch.delenv(var, raising=False)

    settings = Settings(_env_file=None)

    assert settings.TWM_TABLE_NAME == "2wm-dev"
    assert settings.TWM_TENANT == "default"
    assert settings.TWM_CONTENT_SOURCE == "../content/sample"
    assert settings.TWM_DYNAMODB_ENDPOINT is None
    assert settings.AWS_REGION == "ca-central-1"
    assert settings.TWM_PUBLIC_BASE_URL == "http://localhost:5173"


def test_overrides_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TWM_TABLE_NAME", "custom-table")
    monkeypatch.setenv("TWM_TENANT", "acme")
    monkeypatch.setenv("TWM_CONTENT_SOURCE", "s3://bucket/prefix")
    monkeypatch.setenv("TWM_DYNAMODB_ENDPOINT", "http://localhost:8000")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("TWM_PUBLIC_BASE_URL", "https://example.com")

    settings = Settings(_env_file=None)

    assert settings.TWM_TABLE_NAME == "custom-table"
    assert settings.TWM_TENANT == "acme"
    assert settings.TWM_CONTENT_SOURCE == "s3://bucket/prefix"
    assert settings.TWM_DYNAMODB_ENDPOINT == "http://localhost:8000"
    assert settings.AWS_REGION == "us-east-1"
    assert settings.TWM_PUBLIC_BASE_URL == "https://example.com"


def test_get_settings_returns_a_settings_instance() -> None:
    assert isinstance(get_settings(), Settings)
