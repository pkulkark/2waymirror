# ADR-0009: Submission notifications from the API handler through SES

Date: 2026-09-17
Status: Accepted

## Context

A session link is sent to a company and then nothing reports back. The only way to learn that answers arrived is to run `2wm list` or `2wm pull` and look, which turns a live session into something that has to be polled; a submission can sit unseen for as long as it takes to remember to check. The answers are the point of the exercise and they are time sensitive, so the gap between a company submitting and the candidate knowing should be seconds, not however long until the next manual check.

Two constraints shaped the options. Answers stay editable until the link expires, so this is not a single event per session: the notification has to cover the first submission and every later edit. And nothing about notifications may put the submission itself at risk, since the company's work is already in hand by then; a rate-limited or misconfigured mail provider must not turn into a failed request.

## Options considered

1. **Send from the API handler, after the answers are stored.** Chosen. One moving part, no new infrastructure beyond the SES identities, and the code that knows whether this was a first submission or an edit is right there. The cost is an outbound call inside the request path, which adds latency to the submit and introduces a dependency that can fail. Both are bounded: the send happens after the write, the SES client is given short timeouts and a single attempt so a stalled endpoint cannot eat the function's timeout, every error is caught and logged, and the response is the same whatever SES did.
2. **DynamoDB Streams into a notifier Lambda.** The write path stays clean, the notification gets retries and a dead letter queue for free, and a slow SES cannot slow a submission down. Rejected as too much machinery for the volume involved: a second function, a second execution role, stream configuration, and a second deployment artifact, all to move a call that takes a few hundred milliseconds off a request that happens a handful of times per session. It is the right answer at a volume this project does not have, and it stays available if that changes.
3. **No notification; keep polling with the CLI.** Rejected. It is the status quo, and the status quo is the problem. It costs nothing and delivers nothing.

A debounce on the edit case was considered and dropped. It was in the issue to stop a burst of edits producing a burst of mail, but implementing it in the handler means either holding state about the last send (another item, another read and write per submit) or scheduling the send for later (which is option 2 under a different name). The submit endpoint is one deliberate save of a whole form, not a keystroke autosave, so the burst it guards against is not a shape this API can produce. The subject line carries the distinction instead: "Answers from X" or "Answers updated from X".

## Decision

The handler calls `notifications.send_answers_email` after `put_answers` returns, with a `first_submission` flag the write itself reports: `put_answers` puts with `ReturnValues=ALL_OLD` and says whether it replaced an earlier submission, so no extra read is needed and two concurrent submits cannot both call themselves the first. The function is a no-op unless both `TWM_NOTIFY_EMAIL` and `TWM_NOTIFY_FROM` are set, and it catches everything it can raise, logging failures with the company and a truncated token (the full token is the session's only credential and CloudWatch is not the place for it) and returning whether it sent. Terraform creates an SES domain identity for `var.domain_name` with DKIM records in the site's hosted zone and an email identity for `var.notify_email`, and grants the Lambda `ses:SendEmail` on the domain identity, conditioned on `ses:Recipients` being `var.notify_email`. `var.notify_email` is empty by default, comes from a repository variable, and never appears in the repo.

## Consequences

The candidate hears about a submission as it happens, and the mail carries enough to act on without opening anything: company, contact, variant, timestamp, the session link, and every question with its answer. Notifications are one variable to switch on and one to switch off, with no diff against a stack deployed without them.

What gets harder: submit latency now includes an SES call, so a slow SES shows up as a slow submit even though it can never show up as a failed one; a send that fails is a line in CloudWatch and nothing else, with no retry and no queue, so a missed notification is only noticed by its absence; and SES in sandbox mode needs the recipient to click a verification link once by hand, which Terraform can create the request for but cannot complete. Every edit mails again, which is loud for a company that saves three times in a row; if that becomes a real annoyance, the fix is a debounce, and a debounce is the argument for revisiting option 2 rather than for patching the handler.
