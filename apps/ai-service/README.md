# apps/ai-service — Python FastAPI (stateless AI compute)

## Responsibility
Pure `(diff + context) → structured review findings` function, exposed over HTTP. No database,
no GitHub credentials, no session/user awareness (ADR-003). Every endpoint is idempotent given
the same input.

## Endpoints
- `POST /review/generate` — `ReviewRequest` → `ReviewResponse` (structured findings)
- `POST /conversation/reply` — `ConversationRequest` → `ConversationResponse` (a reply, ADR-009)
- `GET /health` — liveness only (no DB to check readiness against)

## Structure
- `app/main.py` — FastAPI app assembly: middleware, routers, the top-level exception handler
- `app/api/` — routers; request/response wiring only, delegates to `services/`
- `app/core/` — `config.py` (pydantic-settings, the only place env vars are read),
  `logging.py`, `openai_client.py` (shared client), `middleware.py` (body-size guardrail +
  access logging)
- `app/agents/` — the review/conversation harnesses: system prompts (`prompts/*.md`), the
  OpenAI structured-outputs JSON schema (`schema_defs.py`), and the orchestration loops
  (`review_agent.py`, `conversation_agent.py`)
- `app/services/` — post/pre-processing around the agents: dedup + cap findings
  (`review_service.py`), cap conversation history (`conversation_service.py`)
- `app/schemas/` — Pydantic models = the contract with `apps/api`
- `app/utils/` — `token_estimate.py`, `diff_capping.py` — the input-size guardrail

## Guardrails (see app/agents/README.md for the full list with rationale)
- Input capping: diff text is truncated before it reaches the model (`utils/diff_capping.py`)
- Prompt-injection resistance: system prompts explicitly instruct the model to treat all
  diff/code/conversation content as data, never as instructions
- Structured outputs: review findings are constrained by a strict JSON schema at decode time,
  not just requested by prompt — see `agents/schema_defs.py`
- Defense-in-depth validation: Pydantic re-validates model output independently of the
  JSON-schema constraint — two layers, not one
- Output bounding: findings are deduped + hard-capped (`services/review_service.py`);
  conversation replies are length-capped (`agents/conversation_agent.py`)
- Request body-size limit at the ASGI layer (`core/middleware.py`), ahead of any parsing
- Retry only on transient OpenAI errors (timeout/rate-limit), never on a validation failure —
  a bad model output is not something retrying fixes

## Boundaries
- Never writes to Postgres, never calls the GitHub API, never receives a GitHub token
- Every response conforms to `app/schemas/` — `apps/api` treats this as a strict typed contract
