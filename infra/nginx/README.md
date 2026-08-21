# infra/nginx/

Prod reverse proxy config — the *only* entrypoint exposed to the host in
`docker-compose.prod.yml` (ADR-008). Routes `/api/*` → `api`, everything else → `web`.
`ai-service` is never routed here — it's only reachable from `api` over the internal network.

Planned: `nginx.conf` (routing rules, TLS termination if not handled upstream, gzip, basic
rate limiting/headers as a second layer on top of `api`'s own rate limiter).
