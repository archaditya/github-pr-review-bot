# src/integrations/ai-service-client/

HTTP client to `apps/ai-service`, wrapped in a circuit breaker + retry + timeout (ADR-006).
This is the *only* place `api` calls the AI service — never called ad-hoc from a service method
without going through this client.

- `client.js` — the raw HTTP call (base URL, timeout via AbortController) — no resilience logic
- `circuit-breaker.js` — wraps `client.js` with `opossum`, one breaker per endpoint so a failing
  capability doesn't trip breakers for unrelated ones; on open/timeout, throws
  `AiServiceUnavailableError` (`src/utils/errors.js`) rather than leaking a raw HTTP error
- `index.js` — public entrypoint (`generateReview`, `generateConversationReply`), the only path
  `services/` should import from this folder

Errors: reuses `AiServiceUnavailableError` from `src/utils/errors.js` rather than duplicating
an error type here — the calling service catches it and maps it to a `ReviewJob`
`RETRYING`/`FAILED` transition.
