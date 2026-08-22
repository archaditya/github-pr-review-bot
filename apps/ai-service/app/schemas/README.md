# app/schemas/ — the contract with apps/api

Pydantic models for every request/response. This is the single source of truth for the
`api ↔ ai-service` contract — when it changes, the corresponding types on the Node side
(`apps/api/src/integrations/ai-service-client/`) must be updated in the same PR.

- `finding.py` — `Severity` enum + `Finding`, shared by both review and conversation schemas
- `review_request.py` / `review_response.py` — `ReviewRequest` (diff, per-file usage context,
  PR metadata — matches `docs/architecture/data-model.md` § Review Context) → `ReviewResponse`
- `conversation_request.py` / `conversation_response.py` — `ConversationRequest` (findings +
  message history) → `ConversationResponse` (ADR-009)
