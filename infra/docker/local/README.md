# infra/docker/local/

Local-only Docker assets that don't belong inside an individual app's Dockerfile — e.g. any
local Postgres init scripts.

Currently empty — `docker-compose.local.yml` at the repo root is the actual local orchestration
file; this folder exists for local-specific config that grows into needing it.
