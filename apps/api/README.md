# apps/api — Node + Express backend

## Responsibility
Source of truth for the whole system: auth, GitHub webhook receipt + signature verification,
persistence, job orchestration (Inngest), and the only service allowed to hold GitHub/DB credentials.

## Layering (see ADR-002 for full contract)
`routes/ → controllers/ → services/ → repositories/ → models/`, one direction only.
`integrations/` (GitHub client, ai-service client) are called from `services/` only.

## Folder-by-folder
- `src/routes/` — URL → controller wiring, per-route middleware (auth, validation)
- `src/controllers/` — HTTP request/response shaping only, delegates to exactly one service call
- `src/services/` — all business logic, transaction boundaries, orchestration
- `src/repositories/` — the only layer that imports Sequelize models
- `src/models/` — Sequelize model definitions + associations
- `src/db/migrations/` — schema history, the only way schema changes ship (ADR-004)
- `src/db/seeders/` — local/dev fixtures, never auto-run in prod
- `src/middlewares/` — auth (JWT/session), error handling, request logging
- `src/config/` — env parsing/validation, one typed config object, no `process.env` reads elsewhere
- `src/jobs/` — Inngest function definitions, the review pipeline orchestration (ADR-005)
- `src/integrations/github/` — GitHub App auth, webhook verification, PR/diff/comment API calls
- `src/integrations/ai-service-client/` — HTTP client to `ai-service`, circuit breaker + retry wrapped (ADR-006)
- `src/validators/` — request payload schemas (e.g. zod/joi), used by route middleware
- `src/utils/` — pure helper functions, no side effects

## Boundaries
- Never calls OpenAI directly — always through `ai-service`
- Never lets `ai-service` see GitHub tokens or DB access (ADR-003)
