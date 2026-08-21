# ADR-005: Inngest for durable, event-driven background jobs

## Status
Accepted

## Context
Review pipeline multi-step hai: webhook receive → diff fetch → usage resolution → AI call → comment posting → status update. Har step external I/O hai (GitHub API, `ai-service`) — kisi bhi step pe fail ho sakta hai, aur user ko "review lost ho gaya" nahi dikhna chahiye.

## Decision
Use **Inngest** for orchestrating the review pipeline as durable, retryable, step-based functions, invoked from `apps/api/src/jobs/`.

- Webhook handler does the *minimum* synchronous work (verify signature, persist `PullRequest` + `ReviewJob` row) then emits an Inngest event and returns 200 to GitHub immediately
- The Inngest function owns the rest: each pipeline stage is a separate `step.run()`, individually retried on failure without re-running earlier (already-succeeded) steps
- Failures after retry exhaustion mark `ReviewJob.status = FAILED` with the error recorded — never silently dropped

## Alternatives considered
- **Hand-rolled Redis/BullMQ queue**: works, but we'd be rebuilding retry policy, step-level idempotency, and observability that Inngest already gives us. Given this is an MVP with a small team, buying this capability is the better trade.
- **Synchronous handling in the webhook request**: rejected outright — GitHub expects a fast webhook ack (~10s), and AI review generation will regularly exceed that.
- **Cron polling instead of event-driven**: rejected — adds latency (reviews would wait for the next poll) for no benefit, since GitHub already pushes events to us.

## Consequences
- (+) Each pipeline stage retries independently; a transient GitHub API blip doesn't re-trigger a whole new OpenAI call
- (+) Full step-level trace per `ReviewJob` for debugging ("which step failed, how many times")
- (–) External dependency on Inngest's execution model — mitigated by keeping each `step.run()` a thin wrapper around a `services/` method, so the actual logic stays testable independent of Inngest
