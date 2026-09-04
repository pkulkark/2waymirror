"""Seed local dev data: create the table if missing, then one session for the sample candidate.

Usage (from backend/, with DynamoDB Local running on :8000):

    uv run python scripts/seed.py
"""

from __future__ import annotations

from twowaymirror.repository import DynamoDBSessionRepository, ensure_table
from twowaymirror.settings import Settings

FRONTEND_DEV_ORIGIN = "http://localhost:5173"


def main() -> None:
    settings = Settings()
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
    print(f"{FRONTEND_DEV_ORIGIN}/s/{record.token}")


if __name__ == "__main__":
    main()
