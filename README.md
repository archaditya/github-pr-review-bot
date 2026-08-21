# archadi-pr-review

AI-powered GitHub PR review platform — CodeRabbit jaisa, apna version. Ek PR khulte hi (ya webhook trigger pe) automated, context-aware code review comments post ho jaate hain, powered by OpenAI + a proper agent harness.

> Status: **Planning phase.** Yeh commit sirf structure + docs hai — folders apni responsibility ke saath, PRD aur ADRs decided. Implementation is next.

## Why this structure

Teen alag deployable services hain, har ek apni zimmedari ke saath:

| Service | Path | Language | Responsibility |
|---|---|---|---|
| **web** | `apps/web` | Next.js | User-facing dashboard — login, connect repos, view reviews, settings |
| **api** | `apps/api` | Node.js + Express | Source of truth — auth, GitHub App webhooks, orchestration, persistence, job triggering |
| **ai-service** | `apps/ai-service` | Python + FastAPI | Stateless AI compute — diff analysis, review generation via OpenAI SDK, agent harness |

Full reasoning: see [`docs/architecture/00-system-overview.md`](docs/architecture/00-system-overview.md) and the ADRs in `docs/architecture/`.

## Repo map

```
archadi-pr-review/
├── docs/                    # PRD, ADRs, data model, runbooks — read this first
├── apps/
│   ├── web/                 # Next.js frontend
│   ├── api/                 # Node/Express backend (router → controller → service → repository)
│   └── ai-service/          # Python FastAPI — review generation, agent harness
├── infra/
│   ├── docker/{local,prod}  # compose overrides per environment
│   └── nginx/               # prod reverse proxy config
├── docker-compose.local.yml # local dev — ports exposed, hot reload, envs visible
├── docker-compose.prod.yml  # prod — no host ports exposed except via nginx, secrets via env_file
└── .github/workflows/       # CI (lint, test, build) — placeholder for now
```

## Running everything (once implemented)

```bash
# local dev — hot reload, all ports exposed for debugging
make dev

# prod-like — nothing exposed except the reverse proxy
make prod
```

Both are single-command entrypoints wrapping `docker compose -f docker-compose.<env>.yml up`. See `docs/runbooks/local-development.md`.

## Start here

1. [`docs/PRD.md`](docs/PRD.md) — what we're building and why
2. [`docs/architecture/00-system-overview.md`](docs/architecture/00-system-overview.md) — how the pieces fit
3. ADRs in `docs/architecture/` — every non-trivial decision with trade-offs
4. Each `apps/*` and `apps/api/src/*` folder has its own `README.md` explaining its single responsibility
