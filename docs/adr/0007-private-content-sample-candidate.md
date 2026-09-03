# ADR-0007: Real content in a private repo and private S3 bucket; public repo ships a sample candidate

Date: 2026-09-03
Status: Accepted

## Context

The application repo is public, as part of the portfolio purpose of the project. The candidate's real content cannot live in that repo: if it did, session gating would be meaningless, since anyone could read the files directly regardless of token or expiry. A way was needed to keep the repo public and useful as a portfolio while keeping the real content genuinely private, without turning every content edit into a backend deploy.

## Options considered

1. **Store content in DynamoDB.** Fits the single-table design already in use and keeps content out of git entirely. Rejected because it needs an editor UI or awkward CLI edits to change, and loses version history and review; content like this benefits from being diffable and reviewable like code.
2. **Bundle content into the Lambda package from a private repo via a deploy key.** Keeps content versioned and reviewable in its own repo. Rejected because every content edit becomes a backend deploy, and it ties two repos into one pipeline, coupling content changes to code deploys unnecessarily.
3. **Keep the whole repo private.** Simplest way to protect the content. Rejected because it kills the portfolio purpose of the project; a private repo cannot be shown to anyone.

## Decision

The public repo contains the content schema and a fictional sample candidate, used for local development, tests, and forks. Real content lives in a separate private git repo, still versioned and reviewable, and is synced by the admin CLI to a private S3 bucket. The Lambda role has read-only access to that bucket, reads content at cold start, and caches it in memory. Content updates are an S3 sync with no backend deploy. Session gating still matters under this design: it controls which variant a given recruiter sees, not whether the content is public.

## Consequences

Content edits are decoupled from backend deploys and stay versioned and reviewable in the private repo. The public repo remains genuinely public and demonstrable without exposing real content. The downsides: two repos have to be kept in step, the sample candidate has to be maintained alongside the schema as it evolves, and a content schema change needs a coordinated update of the private repo rather than a single-repo change.
