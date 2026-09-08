---
question: Describe an incident you handled and what you changed afterward.
summary: A failed database failover led to a postmortem and a runbook still in use today.
evidence:
  - label: Postmortem template used afterward
    url: https://example.com/docs/postmortem-template
    type: writeup
variants:
  principal:
    evidence:
      - label: Postmortem template used afterward
        url: https://example.com/docs/postmortem-template
        type: writeup
      - label: Cross-team runbook adopted after the incident
        url: https://example.com/docs/runbook-database-failover
        type: writeup
---
A primary database failover did not complete cleanly and left the app serving stale reads for
about six minutes. I wrote the postmortem, and the runbook that came out of it is still the
one the team uses for failover drills.
