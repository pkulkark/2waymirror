# backend

FastAPI service that runs on AWS Lambda behind API Gateway. Owns sessions, variant content, and
company answers. See `docs/architecture.md` for the API contract and DynamoDB key schema, and
`src/twowaymirror/settings.py` for the environment variables.

## Local development

From the repo root, start DynamoDB Local:

```sh
docker compose up -d
```

Then, from `backend/`:

```sh
uv sync
export TWM_DYNAMODB_ENDPOINT=http://127.0.0.1:8000   # point the app at DynamoDB Local
uv run python scripts/seed.py    # creates the table and one sample session, prints the link
uv run uvicorn twowaymirror.main:app --reload --port 8080
```

`seed.py` always defaults to DynamoDB Local. The app does not: without `TWM_DYNAMODB_ENDPOINT`
set, boto3 resolves the real AWS endpoint for the configured region, so export it before
starting uvicorn.

The backend runs on port 8080 (not the uvicorn default of 8000) so it does not collide with
DynamoDB Local, which listens on 8000. `TWM_CONTENT_SOURCE` defaults to `../content/sample`, the
fictional sample candidate checked into this repo, so the app runs end to end with no further
setup.

```sh
curl http://127.0.0.1:8080/api/health
curl http://127.0.0.1:8080/api/sessions/<token-from-seed.py>
```

The frontend dev server proxies `/api` to `127.0.0.1:8080`.

## CLI

The `2wm` console script is the admin CLI: create and manage sessions, sync content, draft
replies, and export answers. It reads the same environment variables as the API
(`TWM_TABLE_NAME`, `TWM_TENANT`, `TWM_CONTENT_SOURCE`, `TWM_DYNAMODB_ENDPOINT`, `AWS_REGION`)
plus `TWM_PUBLIC_BASE_URL` (default `http://localhost:5173`, used to build the session link) and
`TWM_CONTENT_CACHE_SECONDS` (default `300`, how long loaded content is served before it is re-read).
Run `uv run 2wm --help` or `uv run 2wm <command> --help` for full option lists.

| Command | What |
|---|---|
| `2wm create --company TEXT --contact TEXT --variant TEXT [--days INT]` | Create a session, print its details and link. Exits 1 on an undeclared variant. |
| `2wm list [--all]` | List sessions (token, company, contact, variant, created, expires, status, answers). Hides expired/revoked unless `--all`. |
| `2wm revoke TOKEN` | Revoke a session. Idempotent; exits 1 on an unknown token. |
| `2wm pull TOKEN [--out DIR]` | Export a session and its submitted answers to a YAML file. Exits 1 if answers are not yet submitted. See "CLI export schema" below. |
| `2wm content push SOURCE_DIR --bucket NAME [--prefix P] [--prune]` | Upload the content files in a directory to S3 with matching relative keys, skipping hidden files and anything outside the content layout (a `.git` directory, a README, templates); `--prune` deletes remote keys no longer present locally. Refuses to run without a `variants.yaml` in `SOURCE_DIR`. |
| `2wm content check SOURCE_DIR` | Load `SOURCE_DIR` through the content loader for every declared variant; reports OK or the first error. |

### CLI export schema

`2wm pull` writes `<out>/<company-slug>-<token-prefix>.yaml` (the token prefix is its first 8
characters). This is the export contract for downstream tooling:

```yaml
session:
  token: string
  company: string
  contact: string
  variant: string
  created_at: string    # ISO 8601
  expires_at: string    # ISO 8601
submitted_at: string     # ISO 8601
answers:
  - id: string
    question: string
    required: bool
    answer: string | null   # null for an unanswered optional question
```

`answers` lists every company question as it read when the company submitted (a snapshot stored with the answers), in the order shown to them, including unanswered
optional questions (`answer: null`); a required question is never null once answers exist,
since the API rejects a submission missing one.

## Checks

```sh
uv sync
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest --cov=twowaymirror --cov-report=term-missing --cov-fail-under=90
```

## Layout

| Path | What |
|---|---|
| `src/twowaymirror/settings.py` | `pydantic-settings` config, env vars from `docs/architecture.md` |
| `src/twowaymirror/models.py` | Pydantic models for the API request/response shapes |
| `src/twowaymirror/repository.py` | DynamoDB access: sessions and answers |
| `src/twowaymirror/content.py` | Content loader: local path or `s3://`, variant merge, module-level cache |
| `src/twowaymirror/routes.py` | `GET /api/sessions/{token}`, `POST /api/sessions/{token}/answers` |
| `src/twowaymirror/main.py` | FastAPI app factory, `/api/health` |
| `src/twowaymirror/handler.py` | Lambda entry point (Mangum) |
| `src/twowaymirror/cli.py` | `2wm` admin CLI: see "CLI" above |
| `scripts/seed.py` | Local dev seed: create the table, one sample session |
