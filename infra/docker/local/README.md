# infra/docker/local/

Local-only Docker assets that don't belong inside an individual app's Dockerfile — e.g. any
local Postgres init scripts, or a Caddyfile/nginx.conf if local ever needs a reverse proxy
(not required for MVP — services are reached directly by port).

Currently empty — `docker-compose.local.yml` at the repo root is the actual local orchestration
file; this folder exists for local-specific config that config grows into.
