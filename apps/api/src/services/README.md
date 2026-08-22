# src/services/

All business logic lives here. Owns transaction boundaries (a service method that writes
across multiple tables wraps them in one Sequelize transaction). Orchestrates calls across
one or more repositories and/or integrations.

Never touches `req`/`res`. Never writes raw SQL (delegates to a repository method — add a new
repository method rather than reaching around it).

- `webhook.service.js` — verifies + persists inbound GitHub events (`pull_request`,
  `issue_comment`), emits Inngest events (`pr/review.requested`, `pr/comment.received`)
- `review.service.js` — the review pipeline's business logic (diff fetch, usage resolution,
  findings generation, summary posting), called from `jobs/review-pipeline.job.js`'s steps
- `conversation.service.js` — owns the `@mention`-only trigger rule (ADR-009, D4) for
  detecting whether a PR comment is directed at the bot
- `auth.service.js` *(planned)* — login, session/JWT issuance
- `repository.service.js` *(planned)* — repo connect/disconnect, per-repo settings
