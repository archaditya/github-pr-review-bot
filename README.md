# archadi-pr-review

An AI-powered GitHub pull request review bot — similar in spirit to CodeRabbit. On every PR
open/update, it reads the diff, resolves where changed functions/exports are used elsewhere in
the diff, and posts a single AI-generated review summary. Contributors can `@mention` the bot
in a reply to ask follow-up questions about the review.

> **Status: under active implementation.** See [`PROGRESS.md`](PROGRESS.md) for exactly what's
> built, tested, and still outstanding, service by service.

## Architecture at a glance

Three independently deployable services:

| Service | Path | Stack | Responsibility |
|---|---|---|---|
| **web** | `apps/web` | Next.js | User dashboard — connect repos, view review history |
| **api** | `apps/api` | Node/Express | Source of truth — auth, GitHub webhooks, orchestration, persistence |
| **ai-service** | `apps/ai-service` | Python/FastAPI | Stateless AI compute — review generation, agent harness |

Full reasoning for every major decision lives in `docs/architecture/` as ADRs — read those
before changing anything structural. Quick map:

- [`docs/PRD.md`](docs/PRD.md) — what we're building, why, and the resolved product decisions
- [`docs/architecture/00-system-overview.md`](docs/architecture/00-system-overview.md) — how
  the three services fit together, request lifecycle
- [`docs/architecture/data-model.md`](docs/architecture/data-model.md) — entities, the
  `ReviewJob` state machine, the conversational-reply data model
- [`docs/architecture/ADR-*.md`](docs/architecture/) — one decision per file, with trade-offs
- Every `apps/*` folder (and its subfolders) has its own `README.md` explaining exactly what
  belongs there — read the nearest one before adding a file to a folder you haven't touched yet

## Prerequisites

- **Docker + Docker Compose** — everything runs containerized, nothing needs to be installed
  on the host beyond Docker itself
- **A GitHub App** registered for local development (App ID, private key, webhook secret) —
  see [Setting up the GitHub App](#setting-up-the-github-app) below
- **An OpenAI API key**
- **A tunnel to localhost** for GitHub webhook delivery — [smee.io](https://smee.io) or
  [ngrok](https://ngrok.com) both work; GitHub can't reach `localhost:4000` directly

## Quick start

```bash
git clone <this-repo>
cd archadi-pr-review

# 1. Copy env templates and fill them in (see "Environment variables" below)
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/ai-service/.env.example apps/ai-service/.env

# 2. Start everything — Postgres, api, ai-service, web, and the Inngest Dev Server
make dev

# 3. In a second terminal, once Postgres is healthy, run migrations + seed data
make db-migrate
make db-seed
```

That's it — `make dev` brings up the full stack with hot reload on all three services.

| Service | URL |
|---|---|
| web (dashboard) | http://localhost:3000 |
| api | http://localhost:4000 |
| api health check | http://localhost:4000/health |
| ai-service | http://localhost:8000 |
| ai-service health check | http://localhost:8000/health |
| Inngest Dev Server (job/event inspector) | http://localhost:8288 |
| Postgres | localhost:5432 |

Stop everything with `make down`. Tail logs with `make logs`.

## Environment variables

Three env files, each copied from a `.env.example` next to it:

- **`.env`** (repo root) — shared Postgres credentials + local port overrides, consumed by
  `docker-compose.local.yml`
- **`apps/api/.env`** — database URL, JWT secret, GitHub App credentials, ai-service client
  config (timeouts, circuit-breaker thresholds), Inngest keys
- **`apps/ai-service/.env`** — OpenAI API key/model, and every guardrail threshold (diff token
  cap, max findings, max conversation history, max reply length, max request body size)

Every var is documented inline in its `.env.example` file — nothing is undocumented.

## Setting up the GitHub App

The bot authenticates as a GitHub App, not a personal OAuth token (see
[ADR-007](docs/architecture/ADR-007-github-app-auth-webhooks.md) for why). To set one up for
local development:

1. GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**
2. **Webhook URL**: point it at your tunnel (e.g. the `smee.io` URL), which forwards to
   `http://localhost:4000/webhooks/github`
3. **Webhook secret**: generate one, put it in `apps/api/.env` as `GITHUB_WEBHOOK_SECRET`
4. **Permissions**: Pull requests (Read & write), Issues (Read & write), Metadata (Read-only)
5. **Subscribe to events**: Pull request, Issue comment
6. After creating the App, note the **App ID** (`GITHUB_APP_ID`) and generate a **private key**
   (`GITHUB_APP_PRIVATE_KEY` — the PEM contents; if stored as a single-line env var, literal
   `\n` sequences are handled automatically, see `apps/api/src/integrations/github/app-auth.js`)
7. Install the App on a test repository

Full step-by-step troubleshooting (webhook not arriving, jobs stuck, etc.) is in
[`docs/runbooks/local-development.md`](docs/runbooks/local-development.md).

## Common commands

```bash
make dev          # start the full local stack (hot reload, all ports exposed)
make prod          # start the prod-configured stack (api/web ports exposed directly, no bind mounts)
make down         # stop the local stack
make logs         # tail logs from all local services
make db-migrate   # run pending Sequelize migrations (apps/api)
make db-seed      # load local demo fixtures
```

## Repo map

```
archadi-pr-review/
├── docs/                    # PRD, ADRs, data model, runbooks
├── apps/
│   ├── web/                 # Next.js frontend — not yet implemented, see PROGRESS.md
│   ├── api/                 # Node/Express backend — auth, webhooks, orchestration
│   │   └── src/
│   │       ├── routes|controllers|services|repositories|models/  # layered architecture
│   │       ├── db/{migrations,seeders}/
│   │       ├── integrations/{github,ai-service-client}/
│   │       ├── jobs/        # Inngest functions (the review pipeline)
│   │       └── constants|middlewares|config|utils/
│   └── ai-service/          # Python FastAPI — review generation, agent harness
│       └── app/
│           ├── api|core|agents|services|schemas|utils/
├── infra/
│   ├── docker/{local,prod}/
├── docker-compose.local.yml
├── docker-compose.prod.yml
└── Makefile
```

## Where things stand

This repo is being built incrementally, service by service. **[`PROGRESS.md`](PROGRESS.md)**
is the single source of truth for what's done, what's stubbed, and what's next — read it
before assuming a piece of functionality exists.
