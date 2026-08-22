# src/jobs/ — Inngest functions

Durable, retryable orchestration (ADR-005). Each Inngest function is a thin wrapper — every
`step.run()` body delegates to a `services/` method, so the actual logic is testable
independent of Inngest.

- `client.js` — the shared Inngest client instance
- `review-pipeline.job.js` — triggered by `pr/review.requested` (emitted from
  `webhook.service.js` on `pull_request.opened`/`.synchronize`/`.reopened`). Steps: fetch diff
  → resolve usage context → generate review (via `ai-service-client`, circuit-breaker wrapped)
  → post summary comment → mark `ReviewJob` `COMPLETED`. Each step also transitions
  `ReviewJob.status` (guarded state machine, `models/review-job.model.js`).
- `handle-comment-reply.job.js` — triggered by `pr/comment.received` (emitted when
  `services/conversation.service.js`'s `@mention` rule matches — ADR-009). Steps: load the
  original findings + `ConversationMessage` history → generate a reply via `ai-service` →
  post it and persist the new message.
- `index.js` — registers both functions; mounted at `/api/inngest` in `app.js` via
  `inngest/express`'s `serve()` handler, which the Inngest Dev Server / Cloud calls into.
