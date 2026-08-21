# ADR-006: Circuit breaker + retry around every `api → ai-service` call

## Status
Accepted

## Context
`ai-service` calls OpenAI, which can be slow, rate-limited, or briefly unavailable. Without protection, every concurrent review job would hold an open connection waiting on a slow/failing `ai-service`, and under load this becomes a thread/connection-pool exhaustion problem in `api` — a classic cascading failure.

## Decision
All calls from `apps/api/src/integrations/ai-service-client/` to `ai-service` go through:

1. **Circuit breaker** (e.g. `opossum` in Node) — per-endpoint breaker (review-generation breaker separate from any future summarize/classify breaker), so one failing capability doesn't trip breakers for unrelated ones
   - Closed → Open after N consecutive failures (default: 5)
   - Open → all calls instantly fail (`AiServiceUnavailableError`) for a cooldown window (default: 30s) — no HTTP call attempted
   - Half-open → one test request after cooldown; success closes the circuit, failure re-opens it
2. **Retry with exponential backoff** for transient failures only (timeouts, 5xx, network errors) — never retried for 4xx (bad request is not transient)
3. **Timeout** on every call — bounded, so a hung request can't hold resources indefinitely

When the breaker is open, the calling Inngest step fails fast, its own retry/backoff schedule kicks in (ADR-005), and `ReviewJob` surfaces a `RETRYING` state to the user instead of a generic failure.

## Alternatives considered
- **Plain retry, no circuit breaker**: rejected — retries alone make an ongoing outage *worse* (more load hitting an already-struggling `ai-service`); the breaker's fail-fast behavior is what prevents pile-up.
- **No resilience layer, rely on Inngest retries only**: rejected — Inngest retries a whole step, which is coarser and slower than an in-process breaker; both are used together, at different layers (breaker = fast local circuit, Inngest retry = durable step-level retry).

## Consequences
- (+) `ai-service` degradation never cascades into `api` being unresponsive
- (+) Users get an honest "review pending / retrying" state instead of a hung request
- (–) Requires tuning (failure threshold, cooldown) once real traffic patterns are known — start with conservative defaults above and revisit
