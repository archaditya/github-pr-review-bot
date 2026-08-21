# src/db/migrations/

The only way schema changes ship — no `sync({ alter: true })` anywhere, including local
(ADR-004). Every migration must be reversible (`up`/`down`). Once a migration is merged, it is
never edited — a schema correction is a new migration.

Run via `make db-migrate` (wraps `sequelize-cli db:migrate` inside the `api` container).

Planned initial migrations (in order): `create-users`, `create-installations`,
`create-repositories`, `create-pull-requests`, `create-review-jobs`, `create-review-comments`,
`create-job-events`.
