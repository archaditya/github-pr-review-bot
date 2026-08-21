# ADR-001: Three-service topology (web / api / ai-service)

## Status
Accepted

## Context
Hume ek AI PR-reviewer banana hai jisme: user-facing dashboard, GitHub webhook + orchestration logic, aur heavy OpenAI SDK usage — teeno alag concerns hain, alag scaling profiles ke saath.

## Decision
Repo ko 3 independently deployable services mein split kar rahe hain:

- `apps/web` (Next.js) — user-facing only, no business logic, talks to `api` over REST
- `apps/api` (Node/Express) — single source of truth: auth, persistence, GitHub integration, job orchestration
- `apps/ai-service` (Python/FastAPI) — stateless AI compute only

Communication: `web → api` over public REST; `api → ai-service` over internal HTTP (not exposed outside the docker network in prod).

## Alternatives considered

| Option | Rejected because |
|---|---|
| Single Node monolith calling OpenAI directly | Node ecosystem for structured-output validation, prompt/eval tooling is weaker than Python's; also couples AI iteration speed to backend deploys |
| Python monolith (FastAPI does everything incl. auth/DB) | Team is more fluent doing auth/webhooks/ORMs in Node; Express + Sequelize is the stronger fit there |
| Serverless functions per endpoint | Loses the durable-job story we need for retries (Inngest fits better with a persistent `api` process orchestrating it) |

## Consequences

- (+) Independent scaling — `ai-service` replicas can scale on AI call volume without touching `api`
- (+) Fault isolation — `ai-service` outage degrades gracefully (circuit breaker), doesn't take down auth/dashboard
- (+) Clear ownership per language/ecosystem
- (–) One more network hop (`api → ai-service`) — mitigated by keeping the contract small and stable (see ADR-003)
- (–) Local dev needs to run 3 processes — mitigated by `docker-compose.local.yml` single-command startup (ADR-008)
