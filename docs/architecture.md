# Architecture and contracts

Working reference for how the pieces fit. Decisions and their reasoning live in [adr/](adr/). This file is the contract every part of the system builds against; change it in the same PR as the code that changes the contract.

## Environments and naming

- Region: `ca-central-1`. Account has one environment for now, `dev`. `prod` is added at launch with the custom domain.
- Every AWS resource is named `2wm-<env>-<thing>` and tagged `Project=2waymirror`, `Env=<env>`.
- Terraform: `infra/bootstrap/` (state bucket only, applied once by hand) and `infra/` (everything else, `var.env`). State in S3 with `use_lockfile = true`, no DynamoDB lock table.

## Runtime topology

```
browser ──► CloudFront (2wm-<env>)
              ├── default  ──► S3 bucket 2wm-<env>-web (OAC, private)    static React build
              └── /api/*   ──► API Gateway HTTP API ──► Lambda 2wm-<env>-api (FastAPI via Mangum)
                                                           ├── DynamoDB table 2wm-<env>
                                                           └── S3 bucket 2wm-<env>-content (read-only)
```

CloudFront rewrites S3 403/404 to `/index.html` with status 200 so client-side routes resolve. `/api/*` is never cached.

## DynamoDB single table `2wm-<env>`

| Item | PK | SK | Attributes |
|---|---|---|---|
| Session | `TENANT#<tenant>` | `SESSION#<token>` | `company`, `contact`, `variant` (`senior`/`staff`/`lead`), `created_at` (ISO 8601), `expires_at` (ISO 8601), `ttl` (epoch seconds, DynamoDB TTL attribute), `revoked` (bool) |
| Answers | `TENANT#<tenant>` | `SESSION#<token>#ANSWERS` | `submitted_at`, `answers` (map of question id to string) |

Tenant is `default` for now (ADR-0002). Sessions last 30 days by default; `expires_at` and `ttl` are set at creation and can be overridden per session. Tokens are 22 characters, URL-safe, generated with `secrets.token_urlsafe(16)`. Listing sessions is a query on PK with SK `begins_with SESSION#`.

## API

All responses JSON. Errors use `{"detail": "..."}` (FastAPI default).

| Method and path | Success | Errors |
|---|---|---|
| `GET /api/health` | `200 {"status":"ok","version":"x.y.z"}` | |
| `GET /api/sessions/{token}` | `200 {"session": Session, "content": Content}` | `404` unknown token, `410` expired or revoked |
| `POST /api/sessions/{token}/answers` body `{"answers": {"<question_id>": "<text>"}}` | `201 {"submitted_at": "..."}` | `404`, `410`, `409` already submitted, `422` unknown question id, empty answer, or a required question missing |

`Session` as returned: `{"company", "contact", "variant", "created_at", "expires_at", "answers_submitted": bool}`. Never returns tenant, ttl, or revoked.

`Content` as returned: `{"candidate": {...profile...}, "logistics": {...}, "sections": [{"id", "title", "items": [{"id", "question", "answer_md", "evidence": [{"label", "url"}]}]}], "company_questions": [{"id", "question", "required": bool}]}`. Everything is already merged for the session's variant; the frontend never sees other variants.

## Content

Directory layout, identical whether on disk (`TWM_CONTENT_SOURCE=/path`) or in S3 (`TWM_CONTENT_SOURCE=s3://bucket/prefix`):

```
profile.yaml                # name, headline, links, location
logistics.yaml              # base facts; may contain per-variant overrides under `variants:`
company_questions.yaml      # list; each may carry `variants: [senior, lead]` to restrict
sections/<section>.yaml     # id, title, ordered list of answer ids
answers/<id>.md             # YAML front matter: question, evidence (list of label/url), variants (optional emphasis overrides); body is the answer in Markdown
```

Variant merge rule: base value, then `variants.<variant>` overrides key by key. Loaded once at cold start and cached in memory. The public repo ships `content/sample/` (a fictional candidate). Real content lives elsewhere (ADR-0007).

## Backend settings (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `TWM_TABLE_NAME` | `2wm-dev` | DynamoDB table |
| `TWM_TENANT` | `default` | Tenant partition |
| `TWM_CONTENT_SOURCE` | `../content/sample` | Local path or `s3://` URI |
| `TWM_DYNAMODB_ENDPOINT` | unset | Set to `http://localhost:8000` for DynamoDB Local |
| `AWS_REGION` | `ca-central-1` | |

## Frontend

Single Vite build. `fetch('/api/...')` relative to origin; the dev server proxies to `127.0.0.1:8080`. Routes: `/` landing, `/s/:token` session page, `/how-i-built-it`. Session page states: loading skeleton, not found, expired, live, submitted.

## Local development

`docker compose up` at repo root starts DynamoDB Local on port 8000. `backend/scripts/seed.py` creates the table and one session for the sample candidate and prints the link. Backend runs under uvicorn on port 8080 so it does not collide with DynamoDB Local. Frontend dev server proxies `/api` to `127.0.0.1:8080`.

## CI/CD

- PR: existing checks plus `terraform fmt -check`, `terraform validate`, and `terraform plan` (read-only role).
- Merge to `main`: build Lambda zip (arm64, Python 3.13), `terraform apply`, build frontend, `aws s3 sync` to the web bucket, CloudFront invalidation.
- AWS access from GitHub Actions via OIDC federation, role `2wm-<env>-github-deploy`, trust limited to `repo:pkulkark/2waymirror`.

## Lambda packaging

`uv export --no-dev` to a requirements file, `pip install --platform manylinux2014_aarch64 --python-version 3.13 --only-binary=:all: --target build/`, copy `src/twowaymirror`, zip. Handler `twowaymirror.handler.handler`.
