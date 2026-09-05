---
question: Describe an incident you handled and what you changed afterward.
evidence:
  - label: Postmortem template used afterward
    url: https://example.com/docs/postmortem-template
variants:
  principal:
    evidence:
      - label: Postmortem template used afterward
        url: https://example.com/docs/postmortem-template
      - label: Cross-team runbook adopted after the incident
        url: https://example.com/docs/runbook-database-failover
---
A primary database failover did not complete cleanly and left the app serving stale reads for
about six minutes. I wrote the postmortem, and the runbook that came out of it is still the
one the team uses for failover drills.
