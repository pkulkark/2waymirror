"""Repository over the single DynamoDB table described in docs/architecture.md.

Key schema:
    Session  PK=TENANT#<tenant>  SK=SESSION#<token>           company, contact, variant,
                                                                created_at, expires_at, ttl, revoked
    Answers  PK=TENANT#<tenant>  SK=SESSION#<token>#ANSWERS   submitted_at, answers
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import boto3
from botocore.exceptions import ClientError
from pydantic import BaseModel

from twowaymirror.models import Answers, QuestionSnapshot, Session, Variant
from twowaymirror.settings import Settings

TOKEN_BYTES = 16


def new_token() -> str:
    """URL-safe session token that never starts with '-' or '_'.

    token_urlsafe can begin with either, and a leading '-' makes the token look like a
    command-line option to any CLI it is passed to.
    """
    while True:
        token = secrets.token_urlsafe(TOKEN_BYTES)
        if token[0].isalnum():
            return token


DEFAULT_SESSION_LIFETIME_DAYS = 7

# expires_at ends recruiter access and is checked in code. ttl is retention: DynamoDB deletes
# the session and its answers this long after expiry, so a company's response outlives the
# link by a comfortable margin but does not linger forever.
RETENTION_DAYS_AFTER_EXPIRY = 180

_ANSWERS_SK_SUFFIX = "#ANSWERS"


class SessionRecord(BaseModel):
    """Full session record, including fields the API never returns to a client."""

    token: str
    company: str
    contact: str
    variant: Variant
    created_at: datetime
    expires_at: datetime
    ttl: int
    revoked: bool

    @property
    def is_available(self) -> bool:
        return not self.revoked and self.expires_at > datetime.now(UTC)

    def to_session(self, *, answers: Answers | None) -> Session:
        return Session(
            company=self.company,
            contact=self.contact,
            variant=self.variant,
            created_at=self.created_at,
            expires_at=self.expires_at,
            answers_submitted=answers is not None,
            submitted_at=answers.submitted_at if answers else None,
            answers=answers.answers if answers else None,
            questions=answers.questions if answers else None,
        )


def _client(settings: Settings) -> Any:
    return boto3.client(
        "dynamodb",
        region_name=settings.AWS_REGION,
        endpoint_url=settings.TWM_DYNAMODB_ENDPOINT,
    )


def ensure_table(settings: Settings) -> bool:
    """Create the table if it does not already exist. Returns True if it was created.

    Used by backend/scripts/seed.py; safe to call against DynamoDB Local or real DynamoDB.
    """
    client = _client(settings)
    try:
        client.describe_table(TableName=settings.TWM_TABLE_NAME)
        return False
    except client.exceptions.ResourceNotFoundException:
        pass

    client.create_table(
        TableName=settings.TWM_TABLE_NAME,
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )
    client.get_waiter("table_exists").wait(TableName=settings.TWM_TABLE_NAME)
    client.update_time_to_live(
        TableName=settings.TWM_TABLE_NAME,
        TimeToLiveSpecification={"Enabled": True, "AttributeName": "ttl"},
    )
    return True


class DynamoDBSessionRepository:
    """Session and answers access, scoped to one tenant partition."""

    def __init__(self, settings: Settings) -> None:
        self._tenant = settings.TWM_TENANT
        resource = boto3.resource(
            "dynamodb",
            region_name=settings.AWS_REGION,
            endpoint_url=settings.TWM_DYNAMODB_ENDPOINT,
        )
        self._table = resource.Table(settings.TWM_TABLE_NAME)

    def _pk(self) -> str:
        return f"TENANT#{self._tenant}"

    @staticmethod
    def _session_sk(token: str) -> str:
        return f"SESSION#{token}"

    @staticmethod
    def _answers_sk(token: str) -> str:
        return f"SESSION#{token}{_ANSWERS_SK_SUFFIX}"

    def get_session(self, token: str) -> SessionRecord | None:
        response = self._table.get_item(Key={"PK": self._pk(), "SK": self._session_sk(token)})
        item = response.get("Item")
        if item is None:
            return None
        return _session_record_from_item(token, item)

    def create_session(
        self,
        *,
        company: str,
        contact: str,
        variant: Variant,
        lifetime_days: int = DEFAULT_SESSION_LIFETIME_DAYS,
    ) -> SessionRecord:
        token = new_token()
        now = datetime.now(UTC)
        expires_at = now + timedelta(days=lifetime_days)
        item: dict[str, Any] = {
            "PK": self._pk(),
            "SK": self._session_sk(token),
            "company": company,
            "contact": contact,
            "variant": variant,
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "ttl": int((expires_at + timedelta(days=RETENTION_DAYS_AFTER_EXPIRY)).timestamp()),
            "revoked": False,
        }
        self._table.put_item(Item=item)
        return _session_record_from_item(token, item)

    def list_sessions(self) -> list[SessionRecord]:
        records: list[SessionRecord] = []
        query_kwargs: dict[str, Any] = {
            "KeyConditionExpression": "PK = :pk AND begins_with(SK, :sk_prefix)",
            "ExpressionAttributeValues": {":pk": self._pk(), ":sk_prefix": "SESSION#"},
        }
        while True:
            response = self._table.query(**query_kwargs)
            for item in response.get("Items", []):
                sk = str(item["SK"])
                if sk.endswith(_ANSWERS_SK_SUFFIX):
                    continue
                token = sk.removeprefix("SESSION#")
                records.append(_session_record_from_item(token, item))
            last_key = response.get("LastEvaluatedKey")
            if last_key is None:
                break
            query_kwargs["ExclusiveStartKey"] = last_key
        return records

    def revoke_session(self, token: str) -> bool:
        try:
            self._table.update_item(
                Key={"PK": self._pk(), "SK": self._session_sk(token)},
                UpdateExpression="SET revoked = :true",
                ConditionExpression="attribute_exists(PK)",
                ExpressionAttributeValues={":true": True},
            )
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return False
            raise

    def get_answers(self, token: str) -> Answers | None:
        response = self._table.get_item(Key={"PK": self._pk(), "SK": self._answers_sk(token)})
        item: dict[str, Any] | None = response.get("Item")
        if item is None:
            return None
        return Answers(
            submitted_at=item["submitted_at"],
            answers=dict(item["answers"]),
            questions=[QuestionSnapshot(**q) for q in item.get("questions", [])],
        )

    def put_answers(
        self,
        token: str,
        answers: dict[str, str],
        *,
        questions: list[QuestionSnapshot] | None = None,
        ttl: int | None = None,
    ) -> Answers:
        """Store the answers, replacing any earlier submission for this session.

        Answers stay editable until the link expires, so a second submit overwrites the
        first and refreshes the question snapshot. `questions` is the snapshot of the
        company questions as the company saw them. `ttl` should be the session's ttl so
        the two items are retained together.
        """
        now = datetime.now(UTC)
        snapshot = questions or []
        item: dict[str, Any] = {
            "PK": self._pk(),
            "SK": self._answers_sk(token),
            "submitted_at": now.isoformat(),
            "answers": answers,
            "questions": [q.model_dump() for q in snapshot],
        }
        if ttl is not None:
            item["ttl"] = ttl
        self._table.put_item(Item=item)
        return Answers(submitted_at=now, answers=answers, questions=snapshot)


def _session_record_from_item(token: str, item: dict[str, Any]) -> SessionRecord:
    return SessionRecord(
        token=token,
        company=item["company"],
        contact=item["contact"],
        variant=item["variant"],
        created_at=item["created_at"],
        expires_at=item["expires_at"],
        ttl=int(item["ttl"]),
        revoked=bool(item["revoked"]),
    )
