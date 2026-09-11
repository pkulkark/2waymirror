# content

Schema and a sample candidate for the recruiter-facing content: logistics, initial-conversation
answers, behavioral answers, project deep dives, and the questions asked of the company. YAML for
structured facts, Markdown for prose, with an overlay per role-level variant. The variant ids
themselves are declared by the content, not by code.

**This directory contains only a fictional sample candidate.** It exists so the app runs end to
end locally, in tests, and in a fresh fork. The real candidate's content is kept in a separate
private repository and deployed to a private S3 bucket, which the backend reads at cold start and
caches in memory for a short, configurable interval (five minutes by default). Content updates are
an S3 sync and do not require a backend deploy; they show up once the interval passes.

Content is served only against a valid session token and is never bundled into the frontend.

## Layout

```
variants.yaml               # the variant ids this content supports (id, label)
profile.yaml                # name, email, headline, links, location; email is what an
                             # expired link offers the visitor
logistics.yaml              # ordered list of items (label, value); each may carry
                             # per-variant overrides under `variants:`
company_questions.yaml      # list; each may carry `variants: [...]` to restrict
sections/<section>.yaml     # id, title, ordered list of answer ids
answers/<id>.md             # YAML front matter: question, summary (optional one-line
                             # lead), evidence (list of label, url, and an optional
                             # type of repo, pr, talk, writeup, or other), variants
                             # (optional emphasis overrides); body is the answer in
                             # Markdown
```

Section files are read in filename order, so `content/sample/sections/` numbers them
(`01-initial-conversation.yaml`, `02-deep-dives.yaml`, ...) to control display order.

`logistics.yaml` looks like this:

```yaml
- label: Availability
  value: One month notice at current role
- label: Compensation
  value: EUR 70,000 to 85,000 base, open to discussing total comp
  variants:
    principal:
      value: EUR 85,000 to 100,000 base, open to discussing total comp
```

## Evidence footnotes

An answer body may cite its own evidence with a standard Markdown footnote reference, `[^1]`,
`[^2]`, and so on. The number is the position of the item in that answer's `evidence` list, so
`[^1]` points at the first entry. No footnote definitions are needed anywhere in the file: the
frontend turns each marker into a superscript link to the matching evidence row. A marker whose
number has no evidence item is left as written.

```markdown
I led the migration from a single instance to a sharded setup[^1], with no downtime.
```

## Variant merge rule

Two different `variants:` shapes appear in this tree:

- `logistics.yaml` items and `answers/<id>.md` front matter: `variants` is a map of variant
  name to a partial override object. The merge is base value, then `variants.<variant>`
  overrides key by key (shallow; a key not present in the override keeps its base value).
  For `logistics.yaml`, this merge runs per item, keyed by the item's position in the list,
  so each item's own `variants` map only ever overrides that item's own `value`.
- `company_questions.yaml`: `variants` on a question is a list of variant names the question is
  restricted to. A question with no `variants` key is visible to every variant.

## Local development

`backend/src/twowaymirror/content.py` reads this tree from `TWM_CONTENT_SOURCE` (a local path or
an `s3://bucket/prefix` URI), applies the merge rule above for the session's variant, and caches
the unmerged tree in memory after the first read. See `backend/README.md` for running the backend
against `content/sample/`.
