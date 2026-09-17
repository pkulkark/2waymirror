"""Admin CLI for 2WayMirror.

Exposed as the `2wm` console script (see pyproject.toml, `[project.scripts]`). Every command
reads its configuration from the same environment variables as the API: `TWM_TABLE_NAME`,
`TWM_TENANT`, `TWM_CONTENT_SOURCE`, `TWM_DYNAMODB_ENDPOINT`, `AWS_REGION`, and
`TWM_PUBLIC_BASE_URL` (see settings.py). Output is plain text, one
record per line, so it stays greppable; nothing here renders with `rich`.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated, Any

import boto3
import typer
import yaml
from boto3.exceptions import S3UploadFailedError
from botocore.exceptions import ClientError

from twowaymirror import content as content_module
from twowaymirror.content import (
    ContentError,
    declared_variants,
    load_content,
)
from twowaymirror.links import session_link
from twowaymirror.repository import (
    DEFAULT_SESSION_LIFETIME_DAYS,
    DynamoDBSessionRepository,
    SessionRecord,
)
from twowaymirror.settings import Settings, get_settings

app = typer.Typer(add_completion=False, no_args_is_help=True, help="Admin CLI for 2WayMirror.")
content_app = typer.Typer(
    add_completion=False, no_args_is_help=True, help="Sync and validate the content tree."
)
app.add_typer(content_app, name="content")


def _fail(message: str) -> typer.Exit:
    """Print a one-line error to stderr and return an Exit(1) for the caller to raise."""
    typer.echo(f"error: {message}", err=True)
    return typer.Exit(code=1)


def _print_table(headers: list[str], rows: list[list[str]]) -> None:
    widths = [len(header) for header in headers]
    for row in rows:
        for index, cell in enumerate(row):
            widths[index] = max(widths[index], len(cell))

    def _format_row(cells: list[str]) -> str:
        return "  ".join(cell.ljust(widths[index]) for index, cell in enumerate(cells))

    typer.echo(_format_row(headers))
    for row in rows:
        typer.echo(_format_row(row))


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "session"


def _status(record: SessionRecord) -> str:
    if record.revoked:
        return "revoked"
    if not record.is_available:
        return "expired"
    return "live"


@app.command()
def create(
    company: Annotated[str, typer.Option(help="Company name shown to the candidate.")],
    contact: Annotated[str, typer.Option(help="Recruiter or contact name.")],
    variant: Annotated[str, typer.Option(help="Content variant id, from content/variants.yaml.")],
    days: Annotated[
        int, typer.Option(help="Session lifetime in days.")
    ] = DEFAULT_SESSION_LIFETIME_DAYS,
) -> None:
    """Create a session and print its link."""
    settings = get_settings()
    variants = declared_variants(settings)
    if variant not in variants:
        raise _fail(f"unknown variant {variant!r}; declared variants: {', '.join(variants)}")

    repository = DynamoDBSessionRepository(settings)
    record = repository.create_session(
        company=company, contact=contact, variant=variant, lifetime_days=days
    )

    _print_table(
        ["company", "contact", "variant", "expires"],
        [[record.company, record.contact, record.variant, record.expires_at.isoformat()]],
    )
    typer.echo(session_link(settings, record.token))


@app.command("list")
def list_sessions(
    show_all: Annotated[
        bool, typer.Option("--all", help="Include expired and revoked sessions.")
    ] = False,
) -> None:
    """List sessions for the tenant, newest first."""
    settings = get_settings()
    repository = DynamoDBSessionRepository(settings)
    records = sorted(repository.list_sessions(), key=lambda record: record.created_at, reverse=True)

    rows: list[list[str]] = []
    for record in records:
        status = _status(record)
        if not show_all and status in {"expired", "revoked"}:
            continue
        answered = repository.get_answers(record.token) is not None
        rows.append(
            [
                record.token,
                record.company,
                record.contact,
                record.variant,
                record.created_at.isoformat(),
                record.expires_at.isoformat(),
                status,
                "yes" if answered else "no",
            ]
        )

    if not rows:
        typer.echo("no sessions")
        return

    _print_table(
        ["token", "company", "contact", "variant", "created", "expires", "status", "answers"],
        rows,
    )


@app.command()
def revoke(token: Annotated[str, typer.Argument(help="Session token to revoke.")]) -> None:
    """Revoke a session. Idempotent: revoking an already-revoked session just confirms it."""
    settings = get_settings()
    repository = DynamoDBSessionRepository(settings)
    record = repository.get_session(token)
    if record is None:
        raise _fail(f"unknown session token {token!r}")

    repository.revoke_session(token)
    typer.echo(f"revoked session for {record.company} ({token})")


@app.command()
def pull(
    token: Annotated[str, typer.Argument(help="Session token to export.")],
    out: Annotated[Path, typer.Option("--out", help="Output directory.")] = Path("."),
) -> None:
    """Export a session and its submitted answers to a YAML file.

    See backend/README.md, "CLI export schema", for the file format.
    """
    settings = get_settings()
    repository = DynamoDBSessionRepository(settings)
    record = repository.get_session(token)
    if record is None:
        raise _fail(f"unknown session token {token!r}")

    answers = repository.get_answers(token)
    if answers is None:
        raise _fail(f"answers not yet submitted for session {token!r}")

    if answers.questions:
        questions = [(q.id, q.question, q.required) for q in answers.questions]
    else:
        # Submissions from before question snapshots existed. Current content is the best
        # available record, but it may have changed since the company answered.
        typer.echo(
            "warning: submission predates question snapshots; exported against current content",
            err=True,
        )
        try:
            content = load_content(settings, variant=record.variant)
        except ContentError as exc:
            raise _fail(str(exc)) from exc
        questions = [(q.id, q.question, q.required) for q in content.company_questions]
    answer_rows: list[dict[str, Any]] = [
        {"id": qid, "question": text, "required": required, "answer": answers.answers.get(qid)}
        for qid, text, required in questions
    ]

    data: dict[str, Any] = {
        "session": {
            "token": token,
            "company": record.company,
            "contact": record.contact,
            "variant": record.variant,
            "created_at": record.created_at.isoformat(),
            "expires_at": record.expires_at.isoformat(),
        },
        "submitted_at": answers.submitted_at.isoformat(),
        "answers": answer_rows,
    }

    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{_slugify(record.company)}-{token[:8]}.yaml"
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    typer.echo(str(path))


CONTENT_FILES = ("variants.yaml", "profile.yaml", "logistics.yaml", "company_questions.yaml")
CONTENT_DIRS = ("sections", "answers")


def _is_content_path(relpath: str) -> bool:
    """Only the files the loader reads are content. Everything else in a checkout (a `.git`
    directory, a README, templates) stays local."""
    parts = relpath.split("/")
    if any(part.startswith(".") for part in parts):
        return False
    if len(parts) == 1:
        return parts[0] in CONTENT_FILES
    return len(parts) == 2 and parts[0] in CONTENT_DIRS


def _local_content_files(source_dir: Path) -> tuple[dict[str, Path], list[str]]:
    """(content files by relative path, relative paths that were skipped)."""
    files: dict[str, Path] = {}
    skipped: list[str] = []
    for path in sorted(source_dir.rglob("*")):
        if not path.is_file():
            continue
        relpath = path.relative_to(source_dir).as_posix()
        if _is_content_path(relpath):
            files[relpath] = path
        else:
            skipped.append(relpath)
    return files, skipped


def _remote_keys(client: Any, bucket: str, prefix: str) -> set[str]:
    keys: set[str] = set()
    paginator = client.get_paginator("list_objects_v2")
    kwargs: dict[str, str] = {"Bucket": bucket}
    if prefix:
        kwargs["Prefix"] = f"{prefix}/"
    for page in paginator.paginate(**kwargs):
        for obj in page.get("Contents", []):
            keys.add(str(obj["Key"]))
    return keys


@content_app.command("push")
def content_push(
    source_dir: Annotated[Path, typer.Argument(help="Local content directory to upload.")],
    bucket: Annotated[str, typer.Option(help="Destination S3 bucket.")],
    prefix: Annotated[str, typer.Option(help="Key prefix under the bucket.")] = "",
    prune: Annotated[
        bool,
        typer.Option(
            "--prune", help="Delete remote keys under the prefix that are not in SOURCE_DIR."
        ),
    ] = False,
) -> None:
    """Upload the content files under SOURCE_DIR to s3://bucket/prefix with matching relative
    keys. Hidden files and anything outside the content layout are skipped."""
    if not (source_dir / "variants.yaml").is_file():
        raise _fail(f"{source_dir} does not look like a content directory (missing variants.yaml)")

    settings = get_settings()
    client: Any = boto3.client("s3", region_name=settings.AWS_REGION)
    clean_prefix = prefix.strip("/")

    local_files, skipped = _local_content_files(source_dir)
    for relpath in skipped:
        typer.echo(f"skipping {relpath}", err=True)
    keys_by_relpath = {
        relpath: f"{clean_prefix}/{relpath}" if clean_prefix else relpath for relpath in local_files
    }

    try:
        for relpath, path in local_files.items():
            client.upload_file(str(path), bucket, keys_by_relpath[relpath])
    except (ClientError, S3UploadFailedError) as exc:
        raise _fail(f"upload to s3://{bucket} failed: {exc}") from exc

    destination = f"s3://{bucket}/{clean_prefix}" if clean_prefix else f"s3://{bucket}"
    typer.echo(f"uploaded {len(local_files)} file(s) to {destination}")

    if prune:
        # Prune is destructive. Say what will go before it goes, and never wipe a
        # prefix because the local tree happened to be nearly empty.
        if len(local_files) < 2:
            raise _fail("refusing to prune: SOURCE_DIR has fewer than two files")
        try:
            existing_keys = _remote_keys(client, bucket, clean_prefix)
            stale_keys = sorted(existing_keys - set(keys_by_relpath.values()))
            for key in stale_keys:
                typer.echo(f"pruning {key}")
            if stale_keys:
                client.delete_objects(
                    Bucket=bucket,
                    Delete={"Objects": [{"Key": key} for key in stale_keys]},
                )
        except ClientError as exc:
            raise _fail(f"prune on s3://{bucket} failed: {exc}") from exc
        typer.echo(f"pruned {len(stale_keys)} file(s)")


@content_app.command("check")
def content_check(
    source_dir: Annotated[Path, typer.Argument(help="Local content directory to validate.")],
) -> None:
    """Load SOURCE_DIR for every declared variant; report OK or the first error."""
    settings = Settings(TWM_CONTENT_SOURCE=str(source_dir))
    content_module.clear_cache()
    try:
        variants = declared_variants(settings)
        for variant in variants:
            load_content(settings, variant=variant)
    except ContentError as exc:
        raise _fail(str(exc)) from exc
    finally:
        content_module.clear_cache()

    typer.echo(f"OK: {len(variants)} variant(s) checked ({', '.join(variants)})")


if __name__ == "__main__":
    app()
