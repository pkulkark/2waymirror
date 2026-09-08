"""Backend settings, loaded from environment variables.

Field names match the environment variable names in docs/architecture.md exactly, so no
aliasing is needed.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. See docs/architecture.md, "Backend settings"."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    TWM_TABLE_NAME: str = "2wm-dev"
    TWM_TENANT: str = "default"
    TWM_CONTENT_SOURCE: str = "../content/sample"
    TWM_DYNAMODB_ENDPOINT: str | None = None
    AWS_REGION: str = "ca-central-1"
    TWM_PUBLIC_BASE_URL: str = "http://localhost:5173"
    # How long a loaded content tree is served before it is re-read from the source. Lets a
    # content push show up on warm Lambda instances without a redeploy.
    TWM_CONTENT_CACHE_SECONDS: int = 300


def get_settings() -> Settings:
    """FastAPI dependency. Reads current environment on every call (cheap, testable)."""
    return Settings()
