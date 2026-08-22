# Progress

Single source of truth for what's actually built vs. still outstanding, service by service.
Read this before assuming a piece of functionality exists — the folder READMEs describe intent
and structure; this file tracks actual implementation status.

**Legend:** ✅ done &nbsp; 🟡 partial/stubbed &nbsp; ⬜ not started

---

## apps/api (Node/Express)

### Foundation
| Item | Status | Notes |
|---|---|---|
| Env validation (zod) + typed config | ✅ | `src/config/` |
| Structured logging (pino) + error classes | ✅ | `src/utils/` — includes `AiServiceUnavailableError`, `InvalidStateTransitionError` |
| Middlewares (request-logger, error-handler, 404, validate, auth guard) | ✅ | `src/middlewares/` |
| Express app assembly (helmet, cors, compression, rate-limit, raw-body capture) | ✅ | `src/app.js` |
| Server bootstrap (DB check, graceful shutdown) | ✅ | `src/server.js` |
| Health routes (liveness + DB-check readiness) | ✅ | `src/routes/health.routes.js` |

### Data layer
| Item | Status | Notes |
|---|---|---|
| 8 Sequelize models + associations | ✅ | User, Installation, Repository, PullRequest, ReviewJob, ReviewComment, ConversationMessage, JobEvent |
| `ReviewJob` guarded state machine | ✅ | `src/constants/review-job-status.js` + `models/review-job.model.js` hook |
| 8 migrations (mirror the models exactly) | ✅ | `src/db/migrations/` |
| Demo seeder | ✅ | `src/db/seeders/` |
| **Migrations run against a real Postgres** | ⬜ | Never verified — this sandbox couldn't install Postgres. **First thing to verify via `make dev` + `make db-migrate`.** |

### GitHub integration
| Item | Status | Notes |
|---|---|---|
| Webhook HMAC signature verification | ✅ | `src/integrations/github/webhook-verifier.js` |
| GitHub App auth (JWT + installation tokens) | ✅ | `src/integrations/github/app-auth.js` — uses dynamic `import()` since `@octokit/app` v15 is ESM-only |
| PR/diff fetch client | ✅ | `src/integrations/github/pull-request-client.js` |
| Comment posting client (summary + reply) | ✅ | `src/integrations/github/comment-client.js` |
| Webhook route + controller + verify middleware | ✅ | `POST /webhooks/github` |
| **Real GitHub App credentials configured + tested against live webhooks** | ⬜ | Needs a registered GitHub App (see root README) and a tunnel — not something buildable without your GitHub org |

### AI service client
| Item | Status | Notes |
|---|---|---|
| HTTP client + circuit breaker (opossum, per-endpoint) | ✅ | `src/integrations/ai-service-client/` — ADR-006 |

### Business logic / jobs
| Item | Status | Notes |
|---|---|---|
| `webhook.service.js` — persist + emit on `pull_request` events | ✅ | Transaction-wrapped: Installation → Repository → PullRequest → ReviewJob → JobEvent |
| `webhook.service.js` — `@mention` detection on `issue_comment` events | ✅ | Delegates the trigger rule to `conversation.service.js` |
| `review.service.js` — diff fetch, usage-context resolution, findings generation, summary post | ✅ | **Known MVP limitation**: usage resolution only reasons over the diff hunks GitHub returns per changed file — not a full-repo checkout + AST scan. Flagged in code comments and `docs/architecture/data-model.md`. |
| `jobs/review-pipeline.job.js` — the full Inngest pipeline | ✅ | fetch-diff → resolve-usages → generate-review → post-comment → COMPLETED, each step transitions `ReviewJob.status` |
| `jobs/handle-comment-reply.job.js` | ✅ | load-context → generate-reply → post-reply |
| Inngest mounted at `/api/inngest` | ✅ | `src/app.js`, via `inngest/express` |
| **Inngest `onFailure` → transition ReviewJob to FAILED after retries exhaust** | ⬜ | Not wired yet — currently a pipeline that exhausts all retries throws and the job stays at whatever status it last reached, rather than being explicitly marked `FAILED`. Needs verifying against the installed Inngest SDK version's `onFailure` handler shape before wiring. |

### User-facing API (auth, repositories, review jobs)
| Item | Status | Notes |
|---|---|---|
| `auth.service.js` + `auth.controller.js` + `/auth` routes | ✅ | GitHub OAuth login (separate from the App's installation auth — ADR-007), CSRF state via short-lived cookie (double-submit pattern, no session store needed), session JWT issued as an httpOnly cookie. `requireAuth` now accepts either the cookie or a `Bearer` header. |
| `repository.service.js` + `repositories.controller.js` + routes | ✅ | List/get/toggle `isActive`, every method ownership-scoped to the requesting user's installations |
| `review-job.service.js` + `review-jobs.controller.js` + routes | ✅ | Cursor-paginated list (by `createdAt`, not `id` — UUIDs aren't sequential) + full job detail (summary comment, conversation thread, JobEvent audit trail) |
| `validators/repository.validator.js`, `validators/review-job.validator.js` | ✅ | zod schemas, wired via `middlewares/validate.middleware.js` |
| `cookie-parser` added to `package.json` | 🟡 | Dependency added, but **`package-lock.json` was not regenerated** (no `npm install` run this session per instruction) — run `npm install` before first boot to pick it up |
| **Any of the above actually exercised (login round-trip, cookie handling, cursor pagination)** | ⬜ | Written but not run — same caveat as the rest of this batch, see note below |

### Not started
| Item | Status | Notes |
|---|---|---|
| Automated tests | ⬜ | `npm test` is currently a no-op placeholder |
| `.eslintrc` | ⬜ | `package.json` has a `lint` script but no config file yet |
| Rate-limiting specifically on `/auth/*` | ⬜ | Only the global rate limiter (`app.js`) currently applies — auth endpoints (especially the OAuth callback) are a reasonable candidate for a tighter, dedicated limit |

### Verified (real, not just written)
Everything marked ✅ above under Foundation / GitHub integration / AI service client / Business
logic (the original batch) was **boot-tested** in an earlier session: `npm install` succeeded
clean, all modules loaded at require-time without errors, the Express server was started and
exercised — health endpoints, webhook signature accept/reject, event-type and action-level
filtering all behaved exactly as expected (no live GitHub/OpenAI calls were made, and no
Postgres was available in that sandbox).

The **auth/repositories/review-jobs batch above, and everything in `apps/ai-service`, have not
been run at all** — written and internally consistent (checked by re-reading, not by
executing), but not boot-tested, not `npm install`-ed with the new `cookie-parser` dependency,
and not exercised against a real request. Treat this batch as a first-pass implementation that
needs a real run before being trusted the way the earlier batch can be.

---

## apps/ai-service (Python/FastAPI)

| Item | Status | Notes |
|---|---|---|
| Config, logging, OpenAI client, middleware | ✅ | `app/core/` |
| Schemas (`Finding`, review + conversation request/response) | ✅ | `app/schemas/` |
| Review harness (`review_agent.py`) | ✅ | Structured outputs (strict JSON schema) + Pydantic re-validation + retry-on-transient-error-only |
| Conversation harness (`conversation_agent.py`) | ✅ | Same retry/error shape, reply-length capped |
| Guardrails: input capping, prompt-injection resistance, output bounding, body-size limit | ✅ | Full list + where each lives: `app/agents/README.md` |
| API routers (`/review/generate`, `/conversation/reply`, `/health`) | ✅ | `app/api/` |
| `app/main.py` — app assembly, middleware, global exception handler | ✅ | |
| **`pip install` + boot test against a real/mock OpenAI call** | ⬜ | Written but not run in this session — see "What to verify first" below |
| Automated tests | ⬜ | None yet |

---

## apps/web (Next.js)

| Item | Status | Notes |
|---|---|---|
| Everything | ⬜ | Only `README.md`, `Dockerfile`, and a stub `package.json` exist — no actual Next.js app code (`app/`, `components/`, `lib/`) has been written yet |

---

## infra / docker / CI

| Item | Status | Notes |
|---|---|---|
| `docker-compose.local.yml` / `docker-compose.prod.yml` | ✅ | Written, matches ADR-008 |
| `Makefile` (`make dev` / `make prod` / `make db-migrate` / `make db-seed`) | ✅ | |
| `apps/api/Dockerfile`, `apps/ai-service/Dockerfile` | ✅ | Multi-stage dev/prod, healthchecks, non-root prod user |
| `apps/web/Dockerfile` | ✅ | Written, unverified (no app code to build yet) |
| `.github/workflows/*.yml` (CI) | ⬜ | Only a placeholder README — no actual pipeline yet |
| Reverse proxy (nginx or otherwise) in front of `api`/`web` | ⬜ (out of scope) | Set up and managed separately, outside this repo — `api`/`web` expose their ports directly in `docker-compose.prod.yml` for it to route to (ADR-008) |
| **Full stack boot via `make dev`** | ⬜ | Never run end-to-end in this session (no Docker daemon available in this sandbox) — first thing to try in a real environment |

---

## What to verify first, in order

1. `make dev` — does the full local stack actually come up (Postgres healthy, api connects, ai-service starts, Inngest Dev Server reachable)?
2. `make db-migrate && make db-seed` — do all 8 migrations apply cleanly against real Postgres?
3. `apps/ai-service`: `pip install -r requirements.txt` + a manual `POST /review/generate` call with a small fake diff and a real `OPENAI_API_KEY` — confirms the structured-outputs call shape actually works against the live OpenAI API (this has only been reasoned through, never executed)
4. Register a real GitHub App per the root README, point its webhook at a tunnel, open a test PR — confirms the webhook → Inngest → review → comment loop end-to-end
5. Register a GitHub OAuth App (for login — separate from the GitHub App itself, see
   `apps/api/.env.example`), run `npm install` to pick up `cookie-parser`, and exercise the
   `/auth/github/login` → `/auth/github/callback` round trip in a browser
