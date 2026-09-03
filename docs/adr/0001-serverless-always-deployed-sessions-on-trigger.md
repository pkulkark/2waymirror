# ADR-0001: Serverless, always deployed, sessions provisioned on trigger

Date: 2026-09-03
Status: Accepted

## Context

The original idea was to deploy on a serverless instance when triggered: spin up infrastructure per recruiter when a session is needed. This needed to be reconsidered before the app's compute and deployment model could be settled. The candidate sends all email herself and the app only drafts, so a session link has to exist as soon as she writes the reply. The budget goal is near-zero idle cost, and traffic is tiny, dozens of visits a month.

## Options considered

1. **Deploy infrastructure per session, on trigger.** The attraction was that nothing would run except when a recruiter session was actually needed, in theory pushing idle cost to zero. Rejected for three reasons. Something must always be running to receive the trigger in the first place, so idle cost never actually reaches zero. An infrastructure-as-code run takes minutes, so the link would not be ready at the moment the reply is written. And every session would become a separate deployment that has to be individually expired, revoked, and torn down.
2. **Deploy once, always reachable, provision sessions as data.** The app itself is deployed a single time and stays up. Creating a session does not deploy anything; it writes one row (company, contact, variant, created, expiry, random token) and the link is /s/<token>. Revocation flips a flag on that row instead of tearing down infrastructure. This was attractive because pay-per-use compute (Lambda) makes "always deployed" cost nothing at idle, and it avoids the per-session deployment overhead of option 1.

## Decision

The app is deployed once and always reachable. Creating a session is a data write, not a deployment: one row per session (company, contact, variant, created, expiry, random token) with the link at /s/<token>, and revocation is a flag flip. Compute runs on pay-per-use Lambda so idle cost stays at zero. Fixed costs are limited to the DNS hosted zone and the domain. The design avoids anything with an idle charge: no VPC, no RDS, no load balancer, no NAT gateway, no provisioned concurrency.

## Consequences

Session creation is instant, a single row write, so a link is ready the moment the reply is written, and revocation is a one-field update rather than a teardown. Idle cost is effectively zero since only DNS and the domain are fixed costs. The accepted trade-off is cold starts of roughly half a second to a second on Lambda, since the app is not pre-warmed. This cost model needs to be revisited if traffic grows enough that cold starts become disruptive or that Lambda's pay-per-use pricing stops being cheaper than a small always-on instance.
