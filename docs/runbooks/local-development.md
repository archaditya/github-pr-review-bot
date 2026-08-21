# Runbook: Local Development

## Prerequisites
- Docker + Docker Compose
- A GitHub App registered (dev instance) — App ID, private key, webhook secret (see ADR-007)
- An OpenAI API key
- A tunnel for webhook delivery to localhost (e.g. `smee.io` or `ngrok`) — GitHub can't reach `localhost:4000` directly

## First-time setup

1. Copy environment templates:
   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/ai-service/.env.example apps/ai-service/.env
   ```
2. Fill in: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `OPENAI_API_KEY`, Postgres credentials (defaults fine for local).
3. Point your GitHub App's webhook URL at your tunnel, forwarding to `http://localhost:4000/webhooks/github`.

## Start everything

```bash
make dev
```

This runs `docker-compose.local.yml` — brings up `web` (3000), `api` (4000), `ai-service` (8000), `postgres` (5432), and the Inngest Dev Server, all with hot reload.

## Run migrations / seeders

```bash
make db-migrate   # apply pending migrations
make db-seed      # load local fixtures
```

(Wraps `sequelize-cli db:migrate` / `db:seed:all` inside the `api` container — see `apps/api/src/db/migrations/README.md`.)

## Tracing a review job

1. Check `job_events` table (or the `web` dashboard's job detail view once built) for the step-by-step trace of a `ReviewJob`
2. Inngest Dev Server UI (exposed locally) shows function runs, step retries, and payloads — first stop for "why didn't my review post"
3. If stuck at `GENERATING_REVIEW`: check the circuit breaker state for the `ai-service` client (logged on state transitions) — an open circuit means `ai-service` has been failing and calls are being fast-failed

## Common issues

| Symptom | Likely cause |
|---|---|
| Webhook never arrives at `api` | Tunnel not running, or GitHub App webhook URL misconfigured |
| `ReviewJob` stuck at `PENDING` | Inngest event wasn't emitted — check `api` logs for the emit call right after the webhook handler's DB write |
| Comments never post | Installation token expired/missing scope, or GitHub API rate limit — check `integrations/github` logs |
