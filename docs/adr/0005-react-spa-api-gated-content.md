# ADR-0005: React + TypeScript SPA on S3 + CloudFront, content served only through the API

Date: 2026-09-03
Status: Accepted

## Context

The author wanted React and TypeScript for the frontend, with a professional and engaging UI, rather than server-rendered templates. The earlier plan was server-rendered Jinja2, which is simpler, but the decision to build a single-page app stands. The chosen stack is Vite, React 19, TypeScript, Tailwind, shadcn/ui, Motion, and React Router. A Vite build produces static files, so a hosting and delivery approach was needed, along with a way to serve session content (recruiter answers and company questions, which vary by role-level variant) without exposing it in the shipped bundle.

## Options considered

1. **Next.js.** Attractive as a well-known React framework. Rejected: it wants a Node server or forces static export, and static export gives nothing over Vite here.
2. **Serving static files from Lambda.** Would keep the whole system on one compute path. Rejected: it adds a cold start to every page load, including the initial shell.
3. **GitHub Pages, Vercel, or Netlify.** Attractive for being simpler to set up. Rejected: it splits the system across providers, and Terraform would manage only half of it.
4. **Amplify Hosting.** Attractive for handling S3 and CloudFront wiring automatically. Rejected: it hides pieces of the setup worth understanding and controlling directly.
5. **S3 for the static build, fronted by CloudFront.** S3 alone cannot serve HTTPS on a custom domain, so CloudFront sits in front as a single origin: `/api/*` routes to API Gateway with no CORS needed, `/*` serves the SPA with 404s rewritten to `index.html` for client-side routing, plus edge caching. Chosen.

## Decision

Ship the frontend as a Vite-built React and TypeScript SPA, hosted on S3 and served through CloudFront, with the same CloudFront distribution routing `/api/*` to API Gateway. Session content is never bundled into the JavaScript; it is fetched from the API against a valid session token. Bundling it would mean anyone could read all three variants out of the shipped bundle, making expiry and revocation cosmetic.

## Consequences

Easier: one custom domain and one CloudFront distribution cover both app and API, with no CORS configuration and edge caching for static assets. Terraform manages the whole system rather than half of it split across providers. Harder: link previews in email clients will show generic Open Graph tags for every session, since content is fetched client-side rather than rendered per URL; a CloudFront Function could fix this later but is not built yet. The shell also has to render a loading skeleton so an API cold start reads as loading rather than as a dead link, an extra piece of UI state to get right.
