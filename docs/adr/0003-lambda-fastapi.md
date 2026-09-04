# ADR-0003: Lambda with FastAPI over Cloud Run, Django, or raw handlers

Date: 2026-09-03
Status: Accepted

## Context

The backend needs a compute platform and a web framework. The app must be pay-per-use with no idle cost, and it must support fast local iteration on pages and forms without deploying or simulating cloud events for every change.

## Options considered

1. **Cloud Run.** Google Cloud's serverless container service: a plain container with no adapter, scale to zero, and custom domains built in. Cost is not a differentiator: it also bills per request, and at dozens of visits a month both sit inside their free tiers. Not chosen for two reasons. First, coherence: every other part of the system (DynamoDB, S3, CloudFront, ACM, IAM, OIDC federation for CI) is on AWS, and Cloud Run would mean either moving the whole stack to Google Cloud or running two clouds with two Terraform providers and two credential setups. Second, the author already operates AWS daily, so IAM, CloudWatch, and account setup carry no learning cost, while a second cloud would spend time on things that are not the project.
2. **Fargate.** An always-running task. Rejected because an always-running task has idle cost, which conflicts with the near-zero idle cost goal.
3. **Django on Lambda.** Rejected for a heavy cold start, and because none of the ORM would be used anyway since the data store is DynamoDB, not a relational database.
4. **Raw Lambda handlers or the Powertools router.** Would work directly against Lambda events with no adapter layer. Rejected because the deciding factor is local development: neither runs under uvicorn, so pages and forms could not be iterated in a browser without deploying or simulating events.
5. **FastAPI on Lambda via Mangum.** Runs under uvicorn locally, so pages and forms can be iterated in a browser without deploying or simulating events. Chosen despite the added adapter and a slightly longer cold start.

## Decision

Lambda running FastAPI through the Mangum adapter, on Python 3.13 and arm64. SnapStart is available later if cold start becomes a problem.

## Consequences

Local development stays fast: FastAPI runs under uvicorn, so routes and forms can be exercised in a browser without a deploy or an event simulator. The whole system stays in one cloud under one Terraform provider and one set of credentials, and existing AWS familiarity carries over directly to IAM, CloudWatch, and the rest of the account setup. What gets harder: the Mangum adapter is an extra layer between the framework and the Lambda runtime, and it adds to an already slightly longer cold start than a raw handler would have. Cold start should be revisited with SnapStart if it becomes a problem in practice.
