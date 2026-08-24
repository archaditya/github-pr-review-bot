# src/routes/

URL → controller mapping only. Each file owns one resource's routes and wires in the
per-route middleware (auth guard, request validator) before handing off to a controller method.

No business logic, no DB access, no direct calls to `integrations/`.

- `health.routes.js` — `GET /health`, `GET /health/ready`
- `webhooks.routes.js` — `POST /webhooks/github` (signature-verified, not auth-guarded)
- `auth.routes.js` — `GET /auth/github/login`, `GET /auth/github/callback`,
  `POST /auth/logout`, `GET /auth/me` (auth-guarded)
- `repositories.routes.js` — `GET /repositories`, `GET /repositories/:id`,
  `PATCH /repositories/:id` (all auth-guarded)
- `review-jobs.routes.js` — `GET /review-jobs?repositoryId=`, `GET /review-jobs/:id`
  (all auth-guarded)
- `index.js` — mounts everything on the Express app
