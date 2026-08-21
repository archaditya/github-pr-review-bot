# src/routes/

URL → controller mapping only. Each file owns one resource's routes and wires in the
per-route middleware (auth guard, request validator) before handing off to a controller method.

No business logic, no DB access, no direct calls to `integrations/`.

Planned files: `auth.routes.js`, `webhooks.routes.js`, `repositories.routes.js`,
`review-jobs.routes.js`, `index.js` (mounts everything on the Express app).
