# System Overview

## Service topology

```
                         ┌──────────────────────┐
                         │   GitHub (App +      │
                         │   Webhooks + API)     │
                         └──────────┬───────────┘
                       webhook      │      installation
                       events       │      token calls
                                    ▼
┌────────────┐   HTTPS    ┌──────────────────┐   internal HTTP   ┌───────────────────┐
│  apps/web  │───────────▶│    apps/api       │──────────────────▶│  apps/ai-service   │
│  Next.js   │◀───────────│  Node + Express   │◀──────────────────│  Python + FastAPI  │
└────────────┘   REST     │  (router→ctrl→    │   circuit breaker  │  stateless, OpenAI │
                          │   service→repo)   │   wrapped client   │  SDK, agent harness│
                          └────────┬──────────┘                    └────────────────────┘
                                   │
                     ┌─────────────┼──────────────┐
                     ▼             ▼              ▼
               ┌──────────┐  ┌───────────┐  ┌───────────┐
               │ Postgres │  │  Inngest  │  │  (Redis — │
               │(Sequelize)│  │(durable   │  │  optional │
               │           │  │ jobs)     │  │  cache)   │
               └──────────┘  └───────────┘  └───────────┘
```

## Why three services, not one monolith

1. **Language fit**: Express is a solid, boring choice for CRUD + auth + webhook orchestration. Python owns the OpenAI SDK ecosystem, structured-output tooling, and any future ML/eval libraries — forcing that into Node would mean fighting the ecosystem.
2. **Blast radius**: If `ai-service` is slow or the OpenAI API is degraded, `api` must stay up — users can still log in, browse past reviews, manage repo settings. This is why every `api → ai-service` call goes through a circuit breaker (ADR-006).
3. **Statelessness boundary**: `ai-service` never touches Postgres or GitHub credentials. It's a pure function: `(diff, context) → structured findings`. This makes it trivially horizontally scalable and easy to test in isolation.
4. **Independent deploys**: changing a prompt or swapping models doesn't require touching or redeploying `api`.

## Request lifecycle (PR review)

| Step | Owner | Detail |
|---|---|---|
| 1. Webhook receipt | `api` — `routes/webhooks` | Verify GitHub HMAC signature before anything else touches the payload |
| 2. Persist + enqueue | `api` — `services/review` | Write `PullRequest`/`ReviewJob` (status `PENDING`) in one transaction, then emit an Inngest event — never emit before the DB write commits |
| 3. Durable orchestration | `api` — `jobs/` (Inngest functions) | Each step (fetch diff → resolve usages → call AI → post comments) is its own retryable Inngest step |
| 4. AI review generation | `ai-service` | Stateless HTTP call, structured JSON in/out, no side effects of its own |
| 5. Comment posting | `api` — `integrations/github` | Uses the GitHub App installation token, never a user's personal token. One summary comment per review (ADR-009) |
| 6. Status update | `api` | `ReviewJob.status = COMPLETED / FAILED`, visible to `web` |
| 7. Conversational follow-up | `api` — separate Inngest function, triggered by `issue_comment.created` | Handles user replies to the summary comment; see ADR-009 |

## Layering inside `apps/api`

Strict one-directional dependency: **routes → controllers → services → repositories → models**. See `apps/api/README.md` for the full contract per layer. Business logic never lives in a controller or a route handler.

## What lives where — quick index

- Product scope, users, success criteria → `docs/PRD.md`
- Data model / entities / state machines → `docs/architecture/data-model.md`
- Every non-trivial decision + trade-offs → `docs/architecture/ADR-*.md`
- Per-folder responsibility → `README.md` inside each `apps/*/...` folder
