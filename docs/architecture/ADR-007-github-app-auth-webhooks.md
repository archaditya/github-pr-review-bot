# ADR-007: GitHub App (not plain OAuth) for repo access + webhook delivery

## Status
Accepted

## Context
System needs two things from GitHub: (1) know when a PR opens/updates (webhooks), (2) be able to read diffs and post review comments on behalf of the install, scoped correctly per repo.

## Decision
Use a **GitHub App** (not a personal OAuth token flow) for repo-level integration:

- Users install the App on specific repos → app receives repo-scoped, short-lived installation access tokens (not tied to a single user's personal token/permissions)
- Webhook events (`pull_request.opened`, `pull_request.synchronize`, `installation.*`) are delivered to a single `apps/api` endpoint, signature-verified via the App's webhook secret (HMAC-SHA256) before any payload parsing
- **User login** (for the `web` dashboard) is a separate, thinner OAuth flow — just enough to identify who's viewing/managing which installations. This is distinct from the App's repo-access tokens.

## Alternatives considered
- **Personal Access Tokens (PAT) per user**: rejected — ties repo access to an individual's account/permissions (breaks if they leave/lose access), broader scopes than needed, no clean webhook story.
- **OAuth App with repo scope**: rejected — same coupling-to-a-person problem as PAT, and installation tokens (GitHub App) are explicitly designed for this "acting as a bot with least-privilege, per-repo access" use case.

## Consequences
- (+) Least-privilege, per-repo access; revoking is a simple "uninstall"
- (+) Installation tokens are short-lived (~1hr) — reduces blast radius if leaked; `ai-service` never receives them at all (ADR-003)
- (–) GitHub App setup (manifest, private key, webhook secret) is more upfront config than a simple OAuth app — documented in `docs/runbooks/local-development.md`
