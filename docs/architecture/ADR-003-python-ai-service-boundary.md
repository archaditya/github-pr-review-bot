# ADR-003: `ai-service` is stateless and framework-boundary-only

## Status
Accepted

## Context
AI logic (prompting, OpenAI SDK calls, structured outputs, agent harness/tooling) ko kahin rakhna hai. Do options: embed in `api` via a Python subprocess/sidecar, ya ek clean FastAPI service.

## Decision
`ai-service` is a pure FastAPI HTTP service with **zero external state**:
- No database connection, no GitHub credentials, no session/user awareness
- Input: diff + file context + usage-context JSON. Output: structured review findings JSON (OpenAI structured outputs / function-calling schema)
- Every endpoint is idempotent given the same input

Internal structure (see `apps/ai-service/README.md`):
- `app/api/` — FastAPI routers, request/response wiring only
- `app/schemas/` — Pydantic models = the contract with `api`; this is the file that changes when the API surface changes
- `app/agents/` — the review harness: prompt templates, tool/function definitions, the OpenAI SDK call orchestration itself
- `app/services/` — business logic for turning agent output into the final structured review (dedup, severity scoring, etc.)
- `app/core/` — settings, logging, OpenAI client construction

## Alternatives considered
- **Python code embedded/subprocess inside Node**: rejected — loses process isolation (a Python crash could take down `api`), harder to scale independently.
- **Give `ai-service` its own DB access** (e.g. to cache embeddings/results): rejected for MVP — keeps the fault-isolation story clean (a stateless service is trivially safe to restart/scale/redeploy). Revisit if/when a semantic cache is needed; it would still go through a `provider`-style interface, not ad-hoc queries.

## Consequences
- (+) `ai-service` can be restarted, scaled, or redeployed anytime with zero data-consistency risk
- (+) Trivial to unit test — no mocking DB/GitHub, just OpenAI calls (which themselves should be behind a thin client for testability)
- (–) Every piece of context the agent needs must be explicitly passed in by `api` on each call — no server-side memory. Acceptable: PR review is inherently a single-shot, context-complete task per invocation.
