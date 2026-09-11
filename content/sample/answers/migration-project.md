---
question: Tell me about a project you are proud of.
summary: Led a sharded queue migration that cut p99 latency by 40 percent.
evidence:
  - label: Public writeup of the migration
    url: https://example.com/writeups/queue-migration
    type: writeup
  - label: Upstream pull request
    url: https://example.com/sample-org/queue-migration/pull/42
    type: pr
---
I led the migration of our task queue from a single Redis instance to a sharded setup with
per-tenant isolation[^1], cutting p99 latency by 40 percent during peak load with no downtime for
any customer.
