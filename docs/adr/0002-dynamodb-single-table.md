# ADR-0002: DynamoDB single table over a relational database

Date: 2026-09-03
Status: Accepted

## Context

The app's access patterns are few and fixed: get a session by token, list sessions for the admin, save and fetch a company's answers for a session, and expire sessions by date. There are no joins, no reporting needs, and a single admin user. The goal is near-zero idle cost, since traffic is dozens of visits a month, and the compute layer is serverless (Lambda), so the data store should not force always-on infrastructure next to it.

## Options considered

1. **Postgres via RDS.** More familiar to the author, who has a Django ORM background. Rejected because RDS costs money at idle, needs a VPC and connection pooling to sit next to Lambda, and its relational flexibility (joins, ad hoc queries) would go unused given how few and fixed the access patterns are.
2. **SQLite.** Attractive for its simplicity and zero operational overhead. Rejected because the Lambda filesystem is ephemeral, so there is no durable place to keep the file between invocations.
3. **DynamoDB on-demand.** Pay per request with no idle cost and no ops to manage. Fits the fixed, known access patterns directly. Chosen.

## Decision

Use a single DynamoDB table on-demand. The partition key carries a tenant prefix, hardcoded to one tenant today, so a future multi-candidate version is a data change rather than a migration. A TTL attribute handles session expiry.

## Consequences

Data access becomes cheap and mostly ops-free: no idle charge, no connection pooling, no patching a database server. The trade-off is that DynamoDB is unforgiving of change: access patterns not designed for up front are expensive or impossible to query later, and adding a new access pattern means deliberately adding an index rather than writing an ad hoc query. This has to be kept in mind if the app's questions about its own data ever grow beyond get-by-token, list-for-admin, save-and-fetch-answers, and expire-by-date.
