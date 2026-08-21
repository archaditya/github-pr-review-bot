# src/services/

All business logic lives here. Owns transaction boundaries (a service method that writes
across multiple tables wraps them in one Sequelize transaction). Orchestrates calls across
one or more repositories and/or integrations.

Never touches `req`/`res`. Never writes raw SQL (delegates to a repository method — add a new
repository method rather than reaching around it).

Planned files:
- `auth.service.js` — login, session/JWT issuance
- `webhook.service.js` — verify + persist inbound GitHub events, emit Inngest events
  (`pr/review.requested`, `pr/comment.received`)
- `review.service.js` — the review pipeline's business logic (called from `jobs/` Inngest steps)
- `conversation.service.js` — owns the "is this comment meant for the bot" trigger rule
  (**`@mention`-only for MVP** — ADR-009) and builds reply context from `ConversationMessage`
  history
- `repository.service.js` — repo connect/disconnect, per-repo settings
