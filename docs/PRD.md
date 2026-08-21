# PRD — archadi-pr-review

## 1. Problem

Manual PR review is slow aur inconsistent. Reviewers miss edge cases, style issues repeat baar baar, aur "yeh function kahan-kahan use ho raha hai, isko change karne se kya break ho sakta hai" — yeh context reviewer ko manually dhoondhna padta hai. Hum ek AI reviewer bana rahe hain jo:

- Har naye PR / naye commit pe automatically diff padhe
- Sirf line-by-line diff nahi — **usage context** bhi samjhe (yeh function kahan aur call ho raha hai, breaking change hai kya)
- Structured, actionable review comments GitHub PR pe directly post kare
- Reliable ho — AI service down ho jaaye to bhi backend crash na ho (circuit breaker), aur review request lost na ho (durable job queue)

## 2. Goals (MVP scope)

| # | Goal | Success signal |
|---|---|---|
| G1 | User GitHub OAuth se login kare, apne repos connect kare | User can install the GitHub App on 1+ repos |
| G2 | GitHub App PR events (`opened`, `synchronize`) pe webhook receive kare | Webhook signature verified, event durably queued within 1s |
| G3 | System PR diff fetch kare aur changed-function usages resolve kare | For `sum(a,b) → sum(a,b,c)` style changes, system reports call sites |
| G4 | AI service structured review comments generate kare (OpenAI SDK, structured outputs) | Comments have file, line, severity, rationale — not free text blobs |
| G5 | Review comments PR pe post ho (inline + summary) | Comment appears on the actual PR within a defined SLA (e.g. <2 min for typical PR size) |
| G6 | AI service down/timeout ho to system degrade gracefully | Circuit breaker opens, user sees "review pending, retrying" not a 500 |
| G7 | Poora system ek command se local mein chal jaaye, aur prod mein securely deploy ho | `make dev` / `make prod` both work off the same images |

### Out of scope (v1)

- Multi-LLM provider routing (OpenAI only for v1; interface designed to allow more later)
- Self-hosted / on-prem deployment
- IDE plugin / CLI reviewer
- Team-level analytics dashboard (basic per-repo review history is in scope, analytics is not)

## 3. Users

- **Repo maintainer / org admin** — installs the GitHub App, configures review rules (per-repo settings: which checks matter, ignored paths)
- **Contributor** — opens PRs, sees AI review comments same as a human reviewer's
- **(Internal) System actor** — GitHub webhooks, Inngest scheduled/event functions

## 4. Core user story (from planning session)

> Agar kisi ne `sum(a, b)` function mein change kiya — jaise signature `sum(a, b, c)` ho gaya — to system yeh bataye ki yeh function **kahan-kahan use ho raha hai**, aur us change se **kya break ho sakta hai**.

Iska matlab review sirf diff-level nahi, **call-graph aware** hona chahiye — kam se kam same-repo symbol usage ke liye. Detail: `docs/architecture/data-model.md` § Review Context.

## 5. High-level flow

1. GitHub → webhook (`pull_request` event) → **api** validates HMAC signature
2. **api** persists a `PullRequest` + `ReviewJob` row (status: `PENDING`), publishes an Inngest event
3. Inngest function (durable, retryable) in **api**:
   - Fetches PR diff + full file contents for changed files via GitHub App installation token
   - Resolves symbol usage for changed function/exports across the repo (best-effort static grep/AST pass)
   - Calls **ai-service** (`POST /review/generate`) with diff + usage context, through a circuit breaker
4. **ai-service** runs the review agent harness (OpenAI SDK, structured outputs) → returns structured findings
5. Inngest function maps findings → **one summary comment** on the PR, posted via GitHub App (ADR-009)
6. **ReviewJob** status updated (`COMPLETED` / `FAILED`), visible on the **web** dashboard
7. If the user comments back asking about the review, a separate flow (triggered by `issue_comment.created`) picks it up, builds context from the original review + PR + comment history, and posts a reply — see ADR-009

## 6. Non-functional requirements

- **Reliability**: no review request should silently disappear — every stage is a durable, retryable step (Inngest), and every AI call is behind a circuit breaker with sane fallback
- **Security**: GitHub webhook signatures verified; GitHub App installation tokens short-lived and never exposed to `ai-service`; `ai-service` is fully stateless and has no GitHub or DB credentials
- **Isolation**: `ai-service` never touches Postgres or GitHub directly — it only receives/returns structured JSON
- **Observability**: every review job traceable end-to-end (webhook receipt → AI call → comment posted) via a job/event log
- **Deployability**: one command to bring up the full stack locally; a separate, locked-down prod compose config with no exposed ports besides the reverse proxy

## 7. Key architectural decisions (see ADRs for full reasoning)

- Node/Express for **api** with strict router → controller → service → repository layering (ADR-002)
- Python/FastAPI for **ai-service**, fully stateless (ADR-003)
- Sequelize + Postgres, migrations + seeders, no raw manual schema drift (ADR-004)
- Inngest for durable, event-driven background jobs instead of hand-rolled queues (ADR-005)
- Circuit breaker + retry around every `api → ai-service` call (ADR-006)
- GitHub App (not OAuth-only) for repo access + webhook auth (ADR-007)
- Docker Compose with separate local/prod configs (ADR-008)
- Single summary comment per review, with conversational follow-up replies (ADR-009)

## 8. Decisions (resolved)

| # | Question | Decision |
|---|---|---|
| D1 | GitHub App vs. plain OAuth for repo access | **GitHub App**, repo-level install. Confirmed — ADR-007 unchanged. |
| D2 | Where does symbol-usage resolution run | **Node (`apps/api`)**, as an Inngest background step — cheap AST/grep pass, keeps `ai-service` pure-LLM. Confirmed — ADR-003 unchanged. |
| D3 | Comment posting strategy | **Single summary comment per review**, but the bot must support **conversational follow-ups** — if the user replies/comments asking about the review, the bot responds in-thread. This is a new capability beyond a one-shot post; see **ADR-009**. |

## 9. Decisions, continued

- **D4 — comment reply trigger**: `@mention`-only (e.g. `@archadi-bot`). No time-window or
  comment-ordering heuristic for MVP — unambiguous, needs no tuning. See ADR-009.
