# frontend

React 19 + TypeScript + Vite. Static build served from S3 + CloudFront; all session content comes from the API.

```sh
npm install
npm run dev          # http://localhost:5173, proxies /api to the backend on :8000
npm test
npm run lint && npm run typecheck && npm run format:check
npm run build
```
