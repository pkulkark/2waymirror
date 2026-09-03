# content

Schema and a sample candidate for the recruiter-facing content: logistics, initial-conversation answers, behavioral answers, project deep dives, and the questions asked of the company. YAML for structured facts, Markdown for prose, with an overlay per role-level variant (e.g. Senior, Staff, Lead).

**This directory contains only a fictional sample candidate.** It exists so the app runs end to end locally, in tests, and in a fresh fork. The real candidate's content is kept in a separate private repository and deployed to a private S3 bucket, which the backend reads at cold start and caches in memory. Content updates are an S3 sync and do not require a backend deploy.

Content is served only against a valid session token and is never bundled into the frontend.

Not yet started. See the Content epic on the project board.
