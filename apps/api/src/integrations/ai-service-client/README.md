# src/integrations/ai-service-client/

HTTP client to `apps/ai-service`, wrapped in a circuit breaker + retry + timeout (ADR-006).
This is the *only* place `api` calls the AI service — never called ad-hoc from a service method
without going through this client.

Planned files:
- `client.js` — the HTTP call (base URL, timeout) — no business logic
- `circuit-breaker.js` — per-endpoint breaker config (e.g. `opossum`), independent breakers per
  capability so one failing endpoint doesn't trip others
- `errors.js` — `AiServiceUnavailableError`, `AiServiceTimeoutError` — mapped to a `ReviewJob`
  `RETRYING`/`FAILED` state by the calling service, never leaked as a raw HTTP error
