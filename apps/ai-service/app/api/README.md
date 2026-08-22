# app/api/ — FastAPI routers

Route wiring only — parses the request against a `schemas/` model (FastAPI + Pydantic reject
a malformed body with a 422 automatically), calls one `agents/`/`services/` function, returns
its result. No prompt logic, no OpenAI calls directly from a router.

- `health.py` — `GET /health`
- `review.py` — `POST /review/generate`; catches `ReviewGenerationError` and maps it to a 502
  (so apps/api's circuit breaker, ADR-006, counts it as a real failure)
- `conversation.py` — `POST /conversation/reply`; same 502 mapping via `ConversationGenerationError`
