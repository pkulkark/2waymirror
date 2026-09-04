# content

Schema and a sample candidate for the recruiter-facing content: logistics, initial-conversation
answers, behavioral answers, project deep dives, and the questions asked of the company. YAML for
structured facts, Markdown for prose, with an overlay per role-level variant (senior, staff,
lead).

**This directory contains only a fictional sample candidate.** It exists so the app runs end to
end locally, in tests, and in a fresh fork. The real candidate's content is kept in a separate
private repository and deployed to a private S3 bucket, which the backend reads at cold start and
caches in memory. Content updates are an S3 sync and do not require a backend deploy.

Content is served only against a valid session token and is never bundled into the frontend.

## Layout

```
profile.yaml                # name, headline, links, location
logistics.yaml              # base facts; may contain per-variant overrides under `variants:`
company_questions.yaml      # list; each may carry `variants: [senior, lead]` to restrict
sections/<section>.yaml     # id, title, ordered list of answer ids
answers/<id>.md             # YAML front matter: question, evidence (list of label/url),
                             # variants (optional emphasis overrides); body is the answer
                             # in Markdown
```

Section files are read in filename order, so `content/sample/sections/` numbers them
(`01-initial-conversation.yaml`, `02-deep-dives.yaml`, ...) to control display order.

## Variant merge rule

Two different `variants:` shapes appear in this tree:

- `logistics.yaml` and `answers/<id>.md` front matter: `variants` is a map of variant name to a
  partial override object. The merge is base value, then `variants.<variant>` overrides key by
  key (shallow; a key not present in the override keeps its base value).
- `company_questions.yaml`: `variants` on a question is a list of variant names the question is
  restricted to. A question with no `variants` key is visible to every variant.

## Local development

`backend/src/twowaymirror/content.py` reads this tree from `TWM_CONTENT_SOURCE` (a local path or
an `s3://bucket/prefix` URI), applies the merge rule above for the session's variant, and caches
the unmerged tree in memory after the first read. See `backend/README.md` for running the backend
against `content/sample/`.
