# backend

FastAPI service that runs on AWS Lambda behind API Gateway. Owns sessions, variant content, and company answers.

```sh
uv sync
uv run uvicorn twowaymirror.main:app --reload --port 8080   # http://127.0.0.1:8080/api/health
uv run pytest
uv run ruff check . && uv run ruff format --check . && uv run mypy
```
