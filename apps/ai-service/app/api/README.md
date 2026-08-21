# app/api/ — FastAPI routers

Route wiring only — parses the request against a `schemas/` model, calls one `services/`
function, returns its result. No prompt logic, no OpenAI calls directly from a router.

Planned:
- `review.py` — `POST /review/generate`, the main review-generation endpoint
- `conversation.py` — `POST /conversation/reply`, generates a reply for a follow-up comment on
  an existing review (ADR-009); still fully stateless — all context (original findings, diff,
  message history) is passed in per-call, nothing is looked up server-side
- `health.py` — `GET /health`, used by Docker healthchecks
