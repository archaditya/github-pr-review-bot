# apps/web — Next.js frontend

## Responsibility
User-facing dashboard only. No business logic lives here.

- GitHub login (thin OAuth, identifies the viewing user — see ADR-007)
- Install/manage GitHub App installations, view connected repos
- View `ReviewJob` history and status per PR (reads from `apps/api` REST endpoints)
- Per-repo settings (paths to ignore, review strictness) — MVP: basic form, persisted via `api`

## Boundaries
- Talks only to `apps/api` over REST (never directly to Postgres, GitHub, or `ai-service`)
- No secrets beyond a public API base URL — auth tokens handled via `api`-issued session cookies/JWT

## Structure (to be scaffolded on implementation)
```
apps/web/
├── app/            # Next.js app router
├── components/
├── lib/            # api client, auth helpers
└── public/
```
