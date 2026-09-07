# Architecture and contracts

Working reference for how the pieces fit. Decisions and their reasoning live in [adr/](adr/). This file is the contract every part of the system builds against; change it in the same PR as the code that changes the contract.

## Runtime topology

```
browser ──► CloudFront
              ├── default  ──► S3 web bucket (private, origin access control)   static React build
              └── /api/*   ──► API Gateway HTTP API ──► Lambda (FastAPI via Mangum)
                                                           ├── DynamoDB table (sessions and answers)
                                                           └── S3 content bucket (read-only)
```

CloudFront rewrites S3 403/404 to `/index.html` with status 200 so client-side routes resolve. `/api/*` is never cached. The backend is deployed as a zip built by `backend/scripts/build_lambda.sh`.

## DynamoDB single table

| Item | PK | SK | Attributes |
|---|---|---|---|
| Session | `TENANT#<tenant>` | `SESSION#<token>` | `company`, `contact`, `variant`, `created_at` (ISO 8601), `expires_at` (ISO 8601), `ttl` (epoch seconds, DynamoDB TTL attribute), `revoked` (bool) |
| Answers | `TENANT#<tenant>` | `SESSION#<token>#ANSWERS` | `submitted_at`, `answers` (map of question id to string), `questions` (snapshot of id, question, required as shown at submission), `ttl` (same value as the session's) |

Tenant is `default` for now (ADR-0002). Sessions last 7 days by default. `expires_at` ends recruiter access and is checked in code. `ttl` is retention, set 180 days after `expires_at` on both the session and its answers, so a company's response outlives the link but the pair is deleted together. Exports use the question snapshot stored with the answers, never the current content. Tokens are 22 characters, URL-safe, generated with `secrets.token_urlsafe(16)`. Listing sessions is a query on PK with SK `begins_with SESSION#`.

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

Directory layout, identical whether the source is a local directory or an S3 prefix:

```
profile.yaml                # name, headline, links, location
logistics.yaml              # base facts; may contain per-variant overrides under `variants:`
company_questions.yaml      # list; each may carry `variants:` to restrict which variants ask it
sections/<section>.yaml     # id, title, ordered list of answer ids
answers/<id>.md             # YAML front matter: question, evidence (list of label/url), variants (optional emphasis overrides); body is the answer in Markdown
```

Variant merge rule: base value, then `variants.<variant>` overrides key by key. Loaded once at cold start and cached in memory. The public repo ships `content/sample/` (a fictional candidate). Real content lives elsewhere (ADR-0007).

## Frontend

- Single Vite build; API calls are relative to the origin (`/api/...`).
- The dev server proxies `/api` to the local backend.
- Routes: `/` landing, `/s/:token` session page, `/how-i-built-it`.
- Session page states: loading skeleton, not found, expired, live, submitted.

## Admin CLI

Session creation and everything else the candidate does is a local command, `2wm`, installed with the backend package and run with the candidate's own AWS credentials. It never goes through the public API. Commands: `create`, `list`, `revoke`, `pull` (exports a company's answers as YAML), and `content push` / `content check` for the private content tree. Links are built from a configurable public base URL.

## Local development

- `docker compose up` at the repo root starts DynamoDB Local on port 8000.
- `backend/scripts/seed.py` creates the table and one session for the sample candidate and prints the link.
- The backend runs under uvicorn on port 8080 so it does not collide with DynamoDB Local.
- The frontend dev server proxies `/api` to the backend.

## CI/CD

- On every pull request: lint, type checks, tests with coverage floors, dependency audits, Terraform format and validation, and a Terraform plan for review.
- On merge to `main`: package the backend, apply the Terraform plan, build the frontend, publish it to the web bucket, and invalidate the CDN cache.
- GitHub Actions authenticates to AWS with short-lived credentials via OIDC federation. No long-lived keys are stored anywhere.
