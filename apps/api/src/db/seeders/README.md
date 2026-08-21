# src/db/seeders/

Deterministic local/dev fixtures only. Never run automatically in prod (`make prod` does not
invoke seeders). Run via `make db-seed` (wraps `sequelize-cli db:seed:all`).

Planned: a demo user + installation + repo + a couple of `ReviewJob`s in different states, so
the `web` dashboard has something to render on a fresh local setup.
