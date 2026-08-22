# ADR-008: Single-command Docker Compose, split local vs. prod configs

## Status
Accepted

## Context
Three services + Postgres (+ Inngest dev server locally) need to start together reliably, for both local development and production, without leaking prod ports/secrets and without local dev requiring manual multi-terminal setup.

## Decision
Two Compose files, sharing the same service images/Dockerfiles, differing only in exposure/config:

- **`docker-compose.local.yml`**
  - All service ports mapped to host (`web:3000`, `api:4000`, `ai-service:8000`, `postgres:5432`) for direct debugging
  - Bind-mounted source for hot reload (`nodemon` / `uvicorn --reload` / `next dev`)
  - `.env` files loaded directly and visible (local secrets only — never real credentials)
  - Inngest Dev Server included as a service for local event/job introspection

- **`docker-compose.prod.yml`**
  - `postgres` and `ai-service` have **no host port mappings** — reachable only over the
    internal Docker network. `api` and `web` **do** expose ports directly, since this repo
    doesn't bundle a reverse proxy — that's set up and managed separately, outside this repo,
    and routes to `api`/`web` via their exposed ports
  - No bind mounts — images run what was built, immutable
  - Secrets injected via `env_file` pointing at deployment-time secret files, never committed
  - Health checks defined per service; restart policy `unless-stopped`

Single entrypoint via `Makefile`:
```
make dev    # docker compose -f docker-compose.local.yml up --build
make prod   # docker compose -f docker-compose.prod.yml up -d
```

## Alternatives considered
- **One Compose file with profiles**: possible, but two fully separate files make the prod-safety guarantee ("no ports exposed on the internal-only services") auditable at a glance rather than dependent on correctly-set profile flags.
- **Bundling a reverse proxy (nginx) in this repo's prod compose**: considered, but reverse-proxy/TLS/domain setup is managed separately and externally — keeping it out of this repo avoids coupling the app's compose file to infrastructure decisions (which proxy, cert management, routing rules) that live elsewhere.
- **Kubernetes for prod**: over-engineered for current scale (per ADR data — see PRD scalability notes); Compose is enough until multi-node scaling is actually needed. Revisit as its own ADR if/when that happens.

## Consequences
- (+) Local dev is genuinely one command, matches CI build
- (+) `postgres`/`ai-service` attack surface is minimal by construction, not by convention
- (–) `api` and `web` ports are directly exposed in prod — whatever reverse proxy sits in front of them (managed outside this repo) is responsible for TLS termination and being the actual internet-facing entrypoint; this repo's compose file doesn't enforce that on its own
- (–) Two files to keep in sync structurally (service list, image names) — mitigated by keeping all environment-specific values (ports, mounts, env source) as the *only* diff between them; document this expectation in `infra/docker/README.md`-equivalents
