# Data Model (Postgres, via Sequelize)

Entities and their relationships. Exact columns are defined in migrations (`apps/api/src/db/migrations/`). Models live in `apps/api/src/models/`.

## Entities

| Entity | Key fields (indicative) | Notes |
|---|---|---|
| **User** | id, github_user_id, email, name | Identity for the `web` dashboard login |
| **Installation** | id, github_installation_id, account_login, installed_by_user_id | One row per GitHub App install (org or user account). Created on `installation` or `installation_repositories` webhook |
| **Repository** | id, installation_id (FK), github_repo_id, full_name, is_active, index_status, indexed_commit_sha, indexed_at, default_branch, index_error, file_count, symbol_count | Repos the app is installed on; `is_active` lets a user pause reviews per-repo without uninstalling; `index_status` tracks the code knowledge graph state |
| **PullRequest** | id, repository_id (FK), github_pr_number, title, head_sha, base_sha, author_login | One row per PR; updated on `synchronize` |
| **ReviewJob** | id, pull_request_id (FK), status, attempt_count, error, started_at, completed_at | Tracks one review run (state machine below) |
| **ReviewComment** | id, review_job_id (FK), body, github_comment_id, findings (JSON) | **One row per `ReviewJob`** — the single summary comment posted on the PR (ADR-009). `findings` holds the structured per-item data (file, line, severity, rationale, evidence, affected_symbols, confidence) that was rendered into `body` |
| **ConversationMessage** | id, review_job_id (FK), github_comment_id, author_type (`bot` \| `user`), author_login, body, created_at | Chronological thread built around the summary comment — every bot reply and user follow-up, used to build context for the next reply (ADR-009) |
| **JobEvent** (audit log) | id, review_job_id (FK), step, status, detail (JSONB), created_at | Append-only trace per pipeline step — powers the pipeline activity log in the UI and the runbook's "why did this review fail" workflow |

## Repository index states

```
NOT_INDEXED → INDEXING → INDEXED
                  ↓
               FAILED

INDEXED → REINDEXING → INDEXED
              ↓
           FAILED
```

`index_status` values: `NOT_INDEXED`, `INDEXING`, `INDEXED`, `REINDEXING`, `FAILED`

## ReviewJob state machine

```
PENDING → FETCHING_DIFF → ANALYZING_IMPACT → BUILDING_CONTEXT → GENERATING_REVIEW → POSTING_COMMENTS → COMPLETED
               │                 │                  │                  │                  │
               └─────────────────┴──────────────────┴──────────────────┴──────────────────┴──→ FAILED (after retries exhausted)
                                                                                           ↘ RETRYING (transient failure, Inngest step retry in progress)
```

Enforced as a Sequelize model-level guard (valid transition map in `constants/review-job-status.js`), invalid transitions raise rather than silently overwrite status.

### Pipeline steps detail

| Status | Inngest Step | What happens |
|---|---|---|
| `PENDING` | — | Job created, waiting for Inngest worker pickup |
| `FETCHING_DIFF` | `fetch-diff` | Pulls unified diff + changed files list from GitHub API via installation token |
| `ANALYZING_IMPACT` | `analyze-impact` | Queries Neo4j code knowledge graph for blast radius — changed symbols, callers, callees, affected endpoints, related tests. **Gracefully degrades** if repo isn't indexed (skips, returns null) |
| `BUILDING_CONTEXT` | `build-context` | Assembles structural context from diff hunks, file metadata, and patch content for AI review |
| `GENERATING_REVIEW` | `generate-review` | Calls `ai-service` with diff + usage context + structural impact context. Returns structured findings (file, line, severity, rationale, evidence, affected_symbols) |
| `POSTING_COMMENTS` | `post-comment` | Posts one summary comment on the PR via GitHub API, persists `ReviewComment` row with findings |
| `COMPLETED` | — | All steps succeeded. `completedAt` set |
| `FAILED` | — | Terminal failure after retries exhausted. `error` field contains the failure message |

Legacy status `RESOLVING_USAGES` is kept for backward compatibility with existing review jobs in DB.

## Review Context

Per the core user story in the PRD: when changed functions/exports are detected in a diff, the pipeline resolves blast radius before calling `ai-service`.

### Standard context (always available)

```
UsageContext (per changed file, passed to ai-service)
{
  file: string          // e.g. "src/utils/sum.js"
  status: string        // "added" | "modified" | "removed"
  patch: string         // unified diff hunk
}
```

### Graph-enhanced context (when repo is indexed)

```
ImpactContext (from Neo4j code knowledge graph, passed to ai-service)
{
  changed_symbols: [{ name, type, file }]
  callers: [{ name, file, line }]         // who calls the changed symbol
  callees: [{ name, file, line }]         // what the changed symbol calls
  affected_endpoints: [{ name, file }]    // API routes that transitively use changed code
  related_tests: [{ name, file }]         // test files importing changed symbols
  affected_files_count: number
}
```

The `hadGraphContext` flag in the `complete` JobEvent's detail indicates whether graph-enhanced context was available for the review.

## Isolation rules (mirrors ADR-002 / ADR-003)

- Every repository method that reads `PullRequest`/`ReviewJob`/`ReviewComment`/`ConversationMessage` data is scoped by `installation_id` (via join) — no cross-installation data leakage at the query level
- `ai-service` never sees `User`, `Installation`, or any GitHub token — only the review context payload above
- `indexer-service` never sees `User`, `Installation`, or any auth-related data — it receives a repo clone URL + installation token and produces graph data in Neo4j

## Conversational reply detection (ADR-009)

GitHub's Issues API (used for the summary comment) has no native reply-threading, so "is this
comment meant for the bot" is a heuristic, not a structural fact. **MVP rule: `@mention`-only**
— a comment is treated as directed at the bot only if it explicitly `@mentions` the bot's
GitHub App bot-user handle (e.g. `@archadi-bot`). No other signal (comment ordering, time
window) is used.

This rule is isolated to `services/conversation.service.js` (`apps/api`) so it can be relaxed
later without touching webhook plumbing or the data model.
