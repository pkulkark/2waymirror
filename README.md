# 2WayMirror

Screening, both ways.

A recruiter-facing web app for a job search. When a recruiter invites the candidate to an initial conversation, the candidate creates a session and sends a link. The link gives the recruiter the candidate's answers to every standard screening question up front, and asks the company a short set of questions back, so the first call skips logistics.

## Layout

| Directory | What |
|---|---|
| `backend/` | FastAPI service on AWS Lambda. Sessions, variant content, company answers. |
| `frontend/` | React + TypeScript static app on S3 + CloudFront. |
| `infra/` | Terraform for all AWS resources. |
| `content/` | Content schema and a fictional sample candidate. Real content lives in a private repo and a private S3 bucket. |
| `docs/adr/` | Architecture decision records. |

## Develop

```sh
cd backend && uv sync && uv run uvicorn twowaymirror.main:app --reload
cd frontend && npm install && npm run dev
```

Each directory's README has the full set of check commands. CI runs the same checks on every pull request.

## Status

Foundation. Nothing is deployed yet.

## Contributing

Commits and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, with scope one of `backend`, `frontend`, `infra`, `content`, `cli`, `ci`, `docs`, `deps`. CI checks every commit on a PR and the PR title, which becomes the squash commit on merge. Coverage floors are 90% for both backend and frontend.
