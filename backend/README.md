# backend

FastAPI service that runs on AWS Lambda behind API Gateway. Owns sessions, variant content, and
company answers. See `docs/architecture.md` for the API contract, DynamoDB key schema, and
settings.

## Local development

From the repo root, start DynamoDB Local:

```sh
docker compose up -d
```

Then, from `backend/`:

```sh
uv sync
uv run python scripts/seed.py    # creates the table and one sample session, prints the link
uv run uvicorn twowaymirror.main:app --reload --port 8080
```

The backend runs on port 8080 (not the uvicorn default of 8000) so it does not collide with
DynamoDB Local, which listens on 8000. `TWM_CONTENT_SOURCE` defaults to `../content/sample`, the
fictional sample candidate checked into this repo, so the app runs end to end with no further
setup.

```sh
curl http://127.0.0.1:8080/api/health
curl http://127.0.0.1:8080/api/sessions/<token-from-seed.py>
```

The frontend dev server proxies `/api` to `127.0.0.1:8080`.

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
| `scripts/seed.py` | Local dev seed: create the table, one sample session |
