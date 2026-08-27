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
└────────────┘   REST     │  (router→ctrl→    │   circuit breaker  │  stateless, Gemini │
                          │   service→repo)   │   wrapped client   │  structured output │
                          └────────┬──────────┘                    └────────────────────┘
                                   │
                     ┌─────────────┼──────────────┬──────────────────┐
                     ▼             ▼              ▼                  ▼
               ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌────────────────────┐
               │ Postgres │  │  Inngest  │  │  (Redis — │  │ apps/indexer-service│
               │(Sequelize)│  │(durable   │  │  optional │  │  Python + FastAPI   │
               │           │  │ jobs)     │  │  cache)   │  │  Tree-sitter + Neo4j│
               └──────────┘  └───────────┘  └───────────┘  └────────┬───────────┘
                                                                     │
                                                                     ▼
                                                               ┌───────────┐
                                                               │   Neo4j   │
                                                               │(code graph)│
                                                               └───────────┘
```

## Why four services, not one monolith

1. **Language fit**: Express is a solid, boring choice for CRUD + auth + webhook orchestration. Python owns the AI SDK ecosystem, structured-output tooling, and Tree-sitter bindings — forcing that into Node would mean fighting the ecosystem.
2. **Blast radius**: If `ai-service` is slow or the AI API is degraded, `api` must stay up — users can still log in, browse past reviews, manage repo settings. This is why every `api → ai-service` call goes through a circuit breaker (ADR-006).
3. **Statelessness boundary**: `ai-service` never touches Postgres or GitHub credentials. It's a pure function: `(diff, context) → structured findings`. This makes it trivially horizontally scalable and easy to test in isolation.
4. **Independent deploys**: changing a prompt or swapping models doesn't require touching or redeploying `api`.
5. **Indexer separation**: `indexer-service` handles Tree-sitter parsing and Neo4j graph writes. It has no knowledge of users, PRs, or GitHub auth — it receives a repo clone URL + token and produces a code knowledge graph. This keeps parsing concerns isolated from review orchestration.

## Request lifecycle (PR review)

| Step | Owner | Detail |
|---|---|---|
| 1. Webhook receipt | `api` — `routes/webhooks` | Verify GitHub HMAC signature before anything else touches the payload |
| 2. Persist + enqueue | `api` — `services/review` | Write `PullRequest`/`ReviewJob` (status `PENDING`) in one transaction, then emit an Inngest event — never emit before the DB write commits |
| 3. Durable orchestration | `api` — `jobs/` (Inngest functions) | Each step (fetch diff → analyze impact → build context → generate review → post comments) is its own retryable Inngest step |
| 4. Graph impact analysis | `api` — `integrations/neo4j` | Query the code knowledge graph for blast radius: changed symbols → callers → callees → affected endpoints. Gracefully degrades if repo isn't indexed |
| 5. AI review generation | `ai-service` | Stateless HTTP call with diff + structural impact context, structured JSON in/out, no side effects of its own |
| 6. Comment posting | `api` — `integrations/github` | Uses the GitHub App installation token, never a user's personal token. One summary comment per review (ADR-009) |
| 7. Status update | `api` | `ReviewJob.status = COMPLETED / FAILED`, visible to `web` via REST + WebSocket |
| 8. Conversational follow-up | `api` — separate Inngest function, triggered by `issue_comment.created` | Handles user replies to the summary comment; see ADR-009 |

## Request lifecycle (Repository indexing)

| Step | Owner | Detail |
|---|---|---|
| 1. Installation/manual trigger | `api` — `jobs/index-repository.job.js` | Triggers when GitHub App is installed (`installation` / `installation_repositories` webhook) or user clicks "Re-index Graph" in the UI |
| 2. Clone + parse | `indexer-service` — `indexing/full_indexer.py` | Shallow-clones the repo, discovers source files, parses each with Tree-sitter to extract AST |
| 3. Symbol + edge extraction | `indexer-service` — `parsers/` | From each AST, extracts symbols (functions, classes, variables) and edges (calls, imports, exports) |
| 4. Graph write | `indexer-service` — `graph/graph_writer.py` | Upserts File nodes, Symbol nodes, and relationship edges into Neo4j |
| 5. Status update | `api` — `jobs/index-repository.job.js` | Updates `Repository.indexStatus = INDEXED` with file/symbol counts, emits WebSocket event |

### Incremental indexing (push to default branch)

When a PR is merged (push to default branch), the system does not re-index the entire repo:
1. `api` receives `push` webhook → collects changed file paths from commits
2. `indexer-service` clones HEAD, computes SHA256 content hashes for changed files
3. **hash_old == hash_new** → skip (no-op). **hash_old != hash_new** → delete old subgraph, re-parse, upsert new
4. Deleted files → their entire subgraph (File node + symbols + edges) is removed from Neo4j

## Layering inside `apps/api`

Strict one-directional dependency: **routes → controllers → services → repositories → models**. See `apps/api/README.md` for the full contract per layer. Business logic never lives in a controller or a route handler.

## What lives where — quick index

- Product scope, users, success criteria → `docs/PRD.md`
- Data model / entities / state machines → `docs/architecture/data-model.md`
- Every non-trivial decision + trade-offs → `docs/architecture/ADR-*.md`
- Per-folder responsibility → `README.md` inside each `apps/*/...` folder
