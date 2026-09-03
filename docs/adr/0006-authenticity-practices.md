# ADR-0006: Authenticity practices for an AI-assisted build

Date: 2026-09-03
Status: Accepted

## Context

The project is built with AI assistance, and the author wants a hiring manager to be able to tell that the design, decisions, and written answers are hers. Authorship cannot be proven cryptographically. It can be made checkable, and it must survive a live conversation, since a hiring manager can ask the author to explain any part of the system on the spot.

## Options considered

1. **An explicit AI-use statement on the public "how I built it" page.** States what AI did (pairing on design, drafting code, review) and what the author owned (every decision, all recruiter-facing content, final review). Names the collaboration directly instead of leaving it implicit. Kept alongside the AI co-author trailer on commits.
2. **A dated ADR per decision, with rejected alternatives recorded.** Generated output tends to present conclusions without the options that were rejected along the way, and a reader cannot tell reasoning from restatement without seeing what was turned down.
3. **A visible timeline: issues before code, small commits, real PR descriptions.** Shows the shape of the work as it happened rather than a single large, unexplained drop of code.
4. **Specificity in recruiter-facing content.** Answers name real systems and link to public evidence: conference talks, upstream pull requests, public repositories. Specific, checkable claims are harder to mistake for generated filler than general ones.
5. **Working rules for who writes what.** The author writes the first draft of every behavioral and deep-dive answer, and AI only critiques it. The author states each ADR's decision and reasoning in her own words before formatting. Nothing merges that the author could not explain at a whiteboard. Fixes authorship at the point of drafting rather than detecting it after the fact.
6. **A short recorded walkthrough in the author's voice.** Optional, a final, hard-to-fake signal, but not required for the other practices to hold.

## Decision

Adopt all six practices: the AI-use statement with the commit trailer, a dated ADR per decision with rejected alternatives, a visible commit and issue timeline, specific and linkable content, the drafting and review rules above, and an optional recorded walkthrough.

## Consequences

Recruiter-facing content and architectural decisions stay checkable against public evidence and the author's own account of them, rather than resting on a claim of authorship alone. Rejected options are preserved for every decision, not just the outcome. It becomes harder to let AI produce end-to-end content unreviewed, since the rules require an author draft first. Real downside: this is slower than letting AI write everything, and the ADR discipline has to be kept up as the project continues.
