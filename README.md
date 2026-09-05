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

Run `npm install` at the repo root once after cloning. Its `prepare` script points git at `.githooks/`, so every `git commit` lints the commit message locally with the same rule set CI enforces, before it ever reaches a PR.

## CI/CD

- Every PR runs `backend`, `frontend`, and `infra` jobs (`.github/workflows/ci.yml`). The `infra` job always runs `terraform fmt -check -recursive`, `terraform init -backend=false`, and `terraform validate`; it also posts a `terraform plan` as a PR comment once the AWS deploy role and Terraform state bucket are configured (see below).
- A push to `main` runs `.github/workflows/deploy.yml`: build the Lambda package, `terraform apply`, build the frontend, sync it to the web S3 bucket, and invalidate CloudFront.
- AWS access from GitHub Actions is via OIDC, never long-lived keys. Configure these repository variables (Settings > Secrets and variables > Actions > Variables) once the AWS side (ADR-0004, `infra/`) exists:

  | Variable | Purpose |
  |---|---|
  | `AWS_PLAN_ROLE_ARN` | ARN of the read-only IAM role that pull request workflows assume via OIDC to run `terraform plan`. |
  | `AWS_DEPLOY_ROLE_ARN` | ARN of the IAM role that workflows on `main` assume via OIDC to apply and deploy. |
  | `TF_BACKEND_BUCKET` | S3 bucket holding Terraform state, used to render `infra/backend.hcl` at CI time. |
  | `AWS_REGION` | Defaults to `ca-central-1` if unset. |

  Until `AWS_PLAN_ROLE_ARN` and `TF_BACKEND_BUCKET` are set, the PR `infra` job still runs fmt/init/validate and simply skips the plan and comment steps.
