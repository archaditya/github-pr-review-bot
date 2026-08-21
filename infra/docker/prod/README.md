# infra/docker/prod/

Prod-only Docker assets: env-file templates for secret injection at deploy time (never
committed with real values), and any prod-specific Postgres config (connection pool limits,
etc.).

Currently empty — `docker-compose.prod.yml` at the repo root is the actual prod orchestration
file; this folder exists for prod-specific config that config grows into.
