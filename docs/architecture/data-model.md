# Data Model (Postgres, via Sequelize)

Planning-stage entities. Exact columns finalize when migrations are written (`apps/api/src/db/migrations/`) — this doc is the shared contract before that.

## Entities

| Entity | Key fields (indicative) | Notes |
|---|---|---|
| **User** | id, github_user_id, email, name | Identity for the `web` dashboard login |
| **Installation** | id, github_installation_id, account_login, installed_by_user_id | One row per GitHub App install (org or user account) |
| **Repository** | id, installation_id (FK), github_repo_id, full_name, is_active | Repos the app is installed on; `is_active` lets a user pause reviews per-repo without uninstalling |
| **PullRequest** | id, repository_id (FK), github_pr_number, title, head_sha, base_sha, author_login | One row per PR; updated on `synchronize` |
| **ReviewJob** | id, pull_request_id (FK), status, attempt_count, error, started_at, completed_at | Tracks one review run (state machine below) |
| **ReviewComment** | id, review_job_id (FK), body, github_comment_id, findings (JSON) | **One row per `ReviewJob`** — the single summary comment posted on the PR (ADR-009). `findings` holds the structured per-item data (file, line, severity, rationale) that was rendered into `body`; posted via the Issues API, not per-finding inline comments |
| **ConversationMessage** | id, review_job_id (FK), github_comment_id, author_type (`bot` \| `user`), author_login, body, created_at | Chronological thread built around the summary comment — every bot reply and user follow-up, used to build context for the next reply (ADR-009) |
| **JobEvent** (audit log) | id, review_job_id (FK), step, status, detail, created_at | Append-only trace per pipeline step — powers debugging + the runbook's "why did this review fail" workflow |

## ReviewJob state machine

```
PENDING → FETCHING_DIFF → RESOLVING_USAGES → GENERATING_REVIEW → POSTING_COMMENTS → COMPLETED
                │                  │                  │                  │
                └──────────────────┴──────────────────┴──────────────────┴──→ FAILED (after retries exhausted)
                                                                          ↘ RETRYING (transient failure, Inngest step retry in progress)
```

Enforced as a Sequelize model-level guard (valid transition map), same pattern as `document`/`job` state machines in prior projects — invalid transitions raise rather than silently overwrite status. Full transition table to be finalized alongside `models/review-job.js`.

## Review Context (the "where else is this used" requirement)

Per the core user story in the PRD: when a changed function/export is detected in a diff, the pipeline resolves same-repo call sites before calling `ai-service`, so the AI has more than just the diff hunk to reason about.

```
ReviewContext (per changed symbol, passed to ai-service — not persisted as its own table for v1)
{
  symbol: string              // e.g. "sum"
  changed_file: string
  diff_hunk: string
  usage_sites: [
    { file: string, line: number, snippet: string }
  ]
}
```

`usage_sites` resolution (v1: best-effort grep/AST scan within `api`, scoped to the repo checkout) lives in `apps/api/src/services/` — not in `ai-service`, keeping `ai-service` a pure "given this context, generate findings" function (ADR-003).

## Isolation rules (mirrors ADR-002 / ADR-003)

- Every repository method that reads `PullRequest`/`ReviewJob`/`ReviewComment`/`ConversationMessage` data is scoped by `installation_id` (via join) — no cross-installation data leakage at the query level
- `ai-service` never sees `User`, `Installation`, or any GitHub token — only the `ReviewContext` payload above (and, for conversational replies, an equivalent stateless `ConversationContext` payload — diff + findings + message history, no DB access)

## Conversational reply detection (ADR-009)

GitHub's Issues API (used for the summary comment) has no native reply-threading, so "is this
comment meant for the bot" is a heuristic, not a structural fact. **MVP rule: `@mention`-only**
— a comment is treated as directed at the bot only if it explicitly `@mentions` the bot's
GitHub App bot-user handle (e.g. `@archadi-bot`). No other signal (comment ordering, time
window) is used.

This rule is isolated to `services/conversation.service.js` (`apps/api`) so it can be relaxed
later without touching webhook plumbing or the data model.
