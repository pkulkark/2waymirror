# frontend

React 19 + TypeScript + Vite. Static build served from S3 + CloudFront; all session content
comes from the API. See `docs/architecture.md` at the repo root for the full contract.

## Stack

- Vite, React 19, TypeScript
- React Router v7 (declarative mode: `BrowserRouter` / `Routes` / `Route`)
- Tailwind v4 (`@tailwindcss/vite` plugin), shadcn/ui components (neutral theme) in
  `src/components/ui/`
- `react-markdown` to render answer text as React elements without raw HTML injection
- Vitest + Testing Library for tests

## Routes

- `/` landing page: a one-paragraph explanation of 2WayMirror and a link to `/how-i-built-it`
- `/s/:token` session page: fetches `GET /api/sessions/{token}` and renders a loading
  skeleton, a not-found state (404), an expired state (410), or the live session (candidate
  header, logistics, sections with Markdown answers and evidence links, and a form for the
  company's own questions that posts to `POST /api/sessions/{token}/answers`)
- `/how-i-built-it` placeholder: the architecture write-up is coming

## Typed API client

`src/api.ts` mirrors the contract's `Session` and `Content` shapes and wraps both endpoints
in typed result types (`fetchSession`, `submitAnswers`) so callers switch on `kind` instead of
inspecting HTTP status codes directly.

## Local development

```sh
npm install
npm run dev          # http://localhost:5173, proxies /api to the backend on :8080
npm test
npm run lint && npm run typecheck && npm run format:check
npm run test:coverage
npm run build
```

The backend runs on port 8080 (DynamoDB Local occupies 8000); see the repo root
`docker-compose.yml` and `backend/scripts/seed.py` to stand up a local session to point at.

## Adding shadcn/ui components

Components under `src/components/ui/` follow shadcn conventions (`components.json` is
configured for the `new-york` style and the `neutral` base color) but were hand-added rather
than pulled through the CLI in this environment. Add new ones the same way: a single file per
component, styled with the CSS variables defined in `src/index.css`.
