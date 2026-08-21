# app/schemas/ — the contract with apps/api

Pydantic models for every request/response. This is the single source of truth for the
`api ↔ ai-service` contract — when it changes, the corresponding `ai-service-client` schema/
types on the Node side must be updated in the same PR.

Planned:
- `review_request.py` / `review_response.py` — `ReviewContext` in (diff, changed files, usage
  sites — matches `docs/architecture/data-model.md`), structured findings out
- `conversation_request.py` / `conversation_response.py` — `ConversationContext` in (original
  findings + diff + prior `ConversationMessage` history), a single reply string + optional
  structured references out (ADR-009)
