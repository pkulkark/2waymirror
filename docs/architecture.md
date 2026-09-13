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
| `GET /api/sessions/{token}` | `200 {"session": Session, "content": Content}` | `404` unknown token, `410` expired or revoked, body `{"detail", "candidate": {"name", "email"}, "expires_at"}` so the page can offer the candidate's contact; the profile is read on its own for this, so a broken answer file cannot turn the 410 into a 500 |
| `POST /api/sessions/{token}/answers` body `{"answers": {"<question_id>": "<text>"}}` | `201 {"submitted_at": "..."}`; a later submit replaces the stored answers and refreshes the question snapshot | `404`, `410` (same body as above), `422` unknown question id, empty answer, or a required question missing |

`Session` as returned: `{"company", "contact", "variant", "created_at", "expires_at", "answers_submitted": bool, "submitted_at": str | null, "answers": {"<question_id>": "<text>"} | null, "questions": [{"id", "question", "required"}] | null}`. Answers are editable until the link expires, so the stored answers come back with the session for the page to show and prefill, together with the question snapshot they answered; the page pairs answers with that snapshot, not with the current `company_questions`, and treats any difference as a question that changed since. Never returns tenant, ttl, or revoked.

`Content` as returned: `{"candidate": {...profile...}, "logistics": [{"label", "value"}], "sections": [{"id", "title", "items": [{"id", "question", "summary": str | null, "answer_md", "evidence": [{"label", "url", "type": str | null}]}]}], "company_questions": [{"id", "question", "required": bool}]}`. `logistics` is an ordered list, not a map. `summary` and evidence `type` are optional and `null` when the content omits them; `type` is one of `repo`, `pr`, `talk`, `writeup`, or `other`. Everything is already merged for the session's variant; the frontend never sees other variants.

## Content

Directory layout, identical whether the source is a local directory or an S3 prefix:

```
profile.yaml                # name, email, headline, links, location
logistics.yaml              # ordered list of items (label, value); each may carry per-variant overrides under `variants:`
company_questions.yaml      # list; each may carry `variants:` to restrict which variants ask it
sections/<section>.yaml     # id, title, ordered list of answer ids
answers/<id>.md             # YAML front matter: question, summary (optional one-line lead), evidence (list of label, url, and an optional type of repo/pr/talk/writeup/other), variants (optional emphasis overrides); body is the answer in Markdown
```

Variant merge rule: base value, then `variants.<variant>` overrides key by key. For `logistics.yaml`, this runs per list item, so an item's `variants` map only overrides that item's own fields. Loaded at cold start and cached in memory; re-read once the cached copy is older than a configurable interval (five minutes by default), so a content push reaches warm instances without a redeploy. The public repo ships `content/sample/` (a fictional candidate). Real content lives elsewhere (ADR-0007).

## Frontend

- Single Vite build; API calls are relative to the origin (`/api/...`).
- The dev server proxies `/api` to the local backend.
- Routes: `/` is the public project story and build write-up; `/how-i-built-it` redirects to `/`. `/s/:token` and its section routes serve the private session experience.
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
