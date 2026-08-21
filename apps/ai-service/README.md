# apps/ai-service — Python FastAPI (stateless AI compute)

## Responsibility
Pure `(diff + context) → structured review findings` function, exposed over HTTP. No database,
no GitHub credentials, no session/user awareness (ADR-003). Every endpoint is idempotent given
the same input.

## Structure
- `app/api/` — FastAPI routers; request/response wiring only, delegates to `services/`
- `app/core/` — settings (pydantic-settings), logging config, OpenAI client construction
- `app/agents/` — the review harness: prompt templates, tool/function-calling definitions,
  the actual OpenAI SDK orchestration (this is where "agent" behavior lives)
- `app/services/` — turns raw agent output into the final structured review (dedup findings,
  severity scoring, formatting to match the `ReviewComment` contract expected by `api`)
- `app/schemas/` — Pydantic models = the contract with `api`; this changes whenever the request/
  response shape changes, and nothing else should need to
- `app/utils/` — pure helpers (diff parsing, token counting, etc.)

## Boundaries
- Never writes to Postgres, never calls the GitHub API, never receives a GitHub token
- Every response conforms to `app/schemas/` — `api` treats this as a strict typed contract
- Uses OpenAI structured outputs / function calling for findings — not free-text parsing
