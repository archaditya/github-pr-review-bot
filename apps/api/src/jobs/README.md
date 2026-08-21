# src/jobs/ — Inngest functions

Durable, retryable orchestration (ADR-005). Each Inngest function is a thin wrapper — every
`step.run()` body delegates to a `services/` method, so the actual logic is testable
independent of Inngest.

Planned functions:
- `review-pipeline.job.js` — triggered by `pr/review.requested` (emitted from
  `webhook.service.js` on `pull_request.opened`/`.synchronize`). Steps: fetch diff → resolve
  usage context → generate review (via `ai-service-client`, circuit-breaker wrapped) → post
  summary comment → update `ReviewJob` status.
- `handle-comment-reply.job.js` — triggered by `pr/comment.received` (emitted from
  `webhook.service.js` when `services/conversation.service.js` determines an `issue_comment`
  is directed at the bot — ADR-009). Steps: load `ReviewJob` + `ConversationMessage` history →
  call `ai-service` `/conversation/reply` → post reply → persist the new `ConversationMessage`.

Also owns: `client.js` (Inngest client instance), `index.js` (registers all functions with the
Express handler).
