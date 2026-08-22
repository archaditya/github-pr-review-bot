# infra/docker/prod/

Prod-only Docker assets: env-file templates for secret injection at deploy time (never
committed with real values), and any prod-specific Postgres config (connection pool limits,
etc.).

Note: this repo does not bundle a reverse proxy (ADR-008) — `api` and `web` expose their ports
directly in `docker-compose.prod.yml`, and whatever reverse proxy/TLS termination sits in front
of them is set up and managed separately, outside this repo.

Currently empty — `docker-compose.prod.yml` at the repo root is the actual prod orchestration
file; this folder exists for prod-specific config that grows into needing it.
