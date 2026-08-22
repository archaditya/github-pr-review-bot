# src/integrations/github/

All direct GitHub interaction lives here — the only place in `api` that talks to GitHub.

- `app-auth.js` — GitHub App JWT signing + installation access token exchange/caching (ADR-007).
  Uses a dynamic `import()` for `@octokit/app` since v15+ ships as pure ESM.
- `oauth-client.js` — the separate, thinner OAuth flow for **user login** on the web dashboard
  (ADR-007) — building the authorize URL, exchanging a code for a token, fetching the profile.
  Distinct from `app-auth.js`: this never touches repo data, it only identifies who's logging in.
- `webhook-verifier.js` — HMAC-SHA256 signature verification for inbound webhooks, used by
  `middlewares/verify-github-webhook.middleware.js` before a webhook payload is trusted
- `pull-request-client.js` — fetch PR metadata, diff, changed files
- `comment-client.js` — post the summary comment (Issues API) and post conversational replies

Never called from a controller or repository directly — always through `services/`.
