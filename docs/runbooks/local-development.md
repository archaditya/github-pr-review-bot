# Runbook: Local Development

## Prerequisites
- Docker + Docker Compose
- A GitHub App registered (dev instance) — App ID, private key, webhook secret (see ADR-007)
- A Gemini API key (or compatible AI provider key)
- A tunnel for webhook delivery to localhost (e.g. `smee.io` or `ngrok`) — GitHub can't reach `localhost:4000` directly

## First-time setup

1. Copy environment templates:
   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/ai-service/.env.example apps/ai-service/.env
   ```
2. Fill in: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `GEMINI_API_KEY`, Postgres credentials (defaults fine for local), Neo4j credentials (defaults fine for local).
3. Point your GitHub App's webhook URL at your tunnel, forwarding to `http://localhost:4000/webhooks/github`.
4. Ensure your GitHub App has the following webhook events enabled:
   - `Installation` — for initial app installation (creates repos)
   - `Installation repositories` — for incremental repo adds/removes
   - `Pull requests` — for PR review triggering
   - `Issue comments` — for conversational follow-up replies
   - `Push` — for incremental indexing on default branch

## Start everything

```bash
make dev
```

This runs `docker-compose.local.yml` — brings up:
- `web` (3000) — Next.js dashboard
- `api` (4000) — Node/Express API + Inngest worker
- `ai-service` (8000) — Python/FastAPI AI review generator
- `indexer-service` (8001) — Python/FastAPI code indexer (Tree-sitter + Neo4j)
- `postgres` (5432) — main relational database
- `neo4j` (7474/7687) — code knowledge graph database
- Inngest Dev Server — durable job queue UI

All with hot reload.

## Run migrations / seeders

```bash
make db-migrate   # apply pending migrations
make db-seed      # load local fixtures
```

(Wraps `sequelize-cli db:migrate` / `db:seed:all` inside the `api` container — see `apps/api/src/db/migrations/README.md`.)

## Tracing a review job

1. Check the **Pipeline Activity** section in the web dashboard's review job detail view — it shows step-by-step events with timing, status, and expandable detail JSON
2. The `job_events` table (Postgres) holds the raw audit trail — each row is one pipeline step with its status and JSONB detail
3. Inngest Dev Server UI (exposed locally) shows function runs, step retries, and payloads — first stop for "why didn't my review post"
4. If stuck at `GENERATING_REVIEW`: check the circuit breaker state for the `ai-service` client (logged on state transitions) — an open circuit means `ai-service` has been failing and calls are being fast-failed

## Tracing repository indexing

1. Check the repo detail page in the dashboard — shows file count, symbol count, indexed commit, and "How Indexing Works" expandable section
2. `indexer-service` logs show Tree-sitter parsing, symbol extraction, and Neo4j graph writes
3. Neo4j Browser (http://localhost:7474) — query the code knowledge graph directly:
   ```cypher
   MATCH (f:File {repo_id: $repoId}) RETURN f.path, f.language, f.content_hash LIMIT 20
   MATCH (s:Symbol {repo_id: $repoId}) RETURN s.name, s.type, s.file_path LIMIT 20
   ```
4. For incremental indexing issues, check that `push` webhooks are arriving (the handler only processes pushes to the default branch for repos with `indexStatus = INDEXED`)

## Webhook events handled

| Event | When | What happens |
|---|---|---|
| `installation` (created) | GitHub App first installed | Creates Installation + all selected Repository rows, triggers full index for each |
| `installation_repositories` (added) | Repos added to existing installation | Creates new Repository rows, triggers full index |
| `pull_request` (opened/synchronize/reopened) | PR created or updated | Creates PullRequest + ReviewJob, triggers review pipeline |
| `issue_comment` (created) | User comments on PR with @mention | Triggers conversational reply |
| `push` (default branch) | PR merged | Triggers incremental indexing (SHA256 hash-based diffing) |

## Common issues

| Symptom | Likely cause |
|---|---|
| Webhook never arrives at `api` | Tunnel not running, or GitHub App webhook URL misconfigured |
| Only 1 repo shows after installing on 7 | `installation` event not enabled in GitHub App settings (needs both `Installation` and `Installation repositories` events) |
| `ReviewJob` stuck at `PENDING` | Inngest event wasn't emitted — check `api` logs for the emit call right after the webhook handler's DB write |
| Comments never post | Installation token expired/missing scope, or GitHub API rate limit — check `integrations/github` logs |
| Repo stays `NOT_INDEXED` | `indexer-service` not running, or Neo4j connection failed — check indexer logs |
| Repo stays `INDEXING` indefinitely | Inngest job failed silently — check Inngest Dev Server. Use "Reset Index" button in UI to clear stuck state |
| `ANALYZING_IMPACT` shows null context | Repo not indexed or Neo4j graph empty — graph impact analysis gracefully degrades to standard review |
