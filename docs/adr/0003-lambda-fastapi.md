# ADR-0003: Lambda with FastAPI over Cloud Run, Django, or raw handlers

Date: 2026-09-03
Status: Accepted

## Context

The backend needs a compute platform and a web framework. The app must be pay-per-use with no idle cost, and it must support fast local iteration on pages and forms without deploying or simulating cloud events for every change.

## Options considered

1. **Cloud Run.** A plain container with no adapter and custom domains built in, honestly the smoother developer experience for a web app. Not chosen: the author uses AWS daily at work, so staying on Lambda means IAM, CloudWatch, and account setup cost nothing to learn. Familiarity is the reason.
2. **Fargate.** An always-running task. Rejected because an always-running task has idle cost, which conflicts with the near-zero idle cost goal.
3. **Django on Lambda.** Rejected for a heavy cold start, and because none of the ORM would be used anyway since the data store is DynamoDB, not a relational database.
4. **Raw Lambda handlers or the Powertools router.** Would work directly against Lambda events with no adapter layer. Rejected because the deciding factor is local development: neither runs under uvicorn, so pages and forms could not be iterated in a browser without deploying or simulating events.
5. **FastAPI on Lambda via Mangum.** Runs under uvicorn locally, so pages and forms can be iterated in a browser without deploying or simulating events. Chosen despite the added adapter and a slightly longer cold start.

## Decision

Lambda running FastAPI through the Mangum adapter, on Python 3.13 and arm64. FastAPI also brings Pydantic for request and content models, which the author is newer to; that is accepted as a learning cost. SnapStart is available later if cold start becomes a problem.

## Consequences

Local development stays fast: FastAPI runs under uvicorn, so routes and forms can be exercised in a browser without a deploy or an event simulator. AWS familiarity carries over directly to IAM, CloudWatch, and the rest of the account setup. What gets harder: the Mangum adapter is an extra layer between the framework and the Lambda runtime, and it adds to an already slightly longer cold start than a raw handler would have. Pydantic is new to the author, so request and content models take longer to write at first. Cold start should be revisited with SnapStart if it becomes a problem in practice.
