# src/integrations/github/

All direct GitHub interaction lives here — the only place in `api` that talks to GitHub.

- `app-auth.js` — GitHub App JWT signing + installation access token exchange/caching (ADR-007)
- `webhook-verifier.js` — HMAC-SHA256 signature verification for inbound webhooks, used by
  `middlewares/` before a webhook payload is trusted
- `pull-request-client.js` — fetch PR metadata, diff, changed files
- `comment-client.js` — post the summary comment (Issues API) and post conversational replies
  (also Issues API — see ADR-009 for why this isn't native inline-comment threading)

Never called from a controller or repository directly — always through `services/`.
