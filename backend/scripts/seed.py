"""Seed local dev data: create the table if missing, then one session for the sample candidate.

Usage (from backend/, with DynamoDB Local running on :8000):

    uv run python scripts/seed.py
"""

from __future__ import annotations

import os

from twowaymirror.links import session_link
from twowaymirror.repository import DynamoDBSessionRepository, ensure_table
from twowaymirror.settings import Settings

LOCAL_DYNAMODB_ENDPOINT = "http://127.0.0.1:8000"


def main() -> None:
    # This script is a local-development tool. Default to DynamoDB Local so it can never touch
    # a real table by accident; set TWM_DYNAMODB_ENDPOINT explicitly to point elsewhere.
    endpoint = os.environ.get("TWM_DYNAMODB_ENDPOINT", LOCAL_DYNAMODB_ENDPOINT)
    settings = Settings(TWM_DYNAMODB_ENDPOINT=endpoint)
    print(f"Using DynamoDB at {endpoint}")
    if ensure_table(settings):
        print(f"Created table {settings.TWM_TABLE_NAME}")
    else:
        print(f"Table {settings.TWM_TABLE_NAME} already exists")

    repository = DynamoDBSessionRepository(settings)
    record = repository.create_session(
        company="Acme Robotics",
        contact="Priya Recruiter",
        variant="senior",
    )
    print(f"Created session for {record.company} ({record.variant})")
    print(session_link(settings, record.token))


if __name__ == "__main__":
    main()
