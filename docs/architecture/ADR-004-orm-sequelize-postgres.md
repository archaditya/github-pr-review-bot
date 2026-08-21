# ADR-004: Sequelize + Postgres, migrations + seeders as the only schema source of truth

## Status
Accepted

## Context
Persistence layer needs: users, GitHub installations/repos, pull requests, review jobs, review comments, audit/event log. Schema will evolve as features (billing, per-repo config) get added.

## Decision
- **Postgres** as the primary datastore (relational data — users, repos, PRs, jobs — with real foreign keys and transactional guarantees around job-state transitions)
- **Sequelize** as the ORM, used exclusively from `apps/api/src/repositories/` (ADR-002)
- **Migrations** (`src/db/migrations/`) are the *only* way schema changes ship — no manual `sync({ alter: true })` in any environment, including local. Every migration is reversible (`up`/`down`)
- **Seeders** (`src/db/seeders/`) provide deterministic local/dev fixtures — never run automatically in prod

## Alternatives considered
- **Prisma**: strong DX, but Sequelize was the explicitly requested choice for this project and the team already carries Sequelize migration/seeder conventions from prior work.
- **Raw SQL / query builder (Knex) only**: rejected — loses model-level validation and association ergonomics that the repository layer relies on.
- **NoSQL for review data**: rejected — review jobs, PRs, and comments have clear relational structure (PR belongs to Repo belongs to Installation belongs to User) and need transactional state transitions (a job shouldn't be half-`COMPLETED`).

## Consequences
- (+) Schema changes are reviewable, reversible, and reproducible across local/staging/prod from the same migration history
- (+) Repository layer stays thin — Sequelize models + associations cover most query needs; complex reporting queries can drop to raw SQL inside a repository method without leaking Sequelize specifics upward
- (–) Sequelize migrations need discipline (no editing a migration after it's merged — always a new one) — call out in `src/db/migrations/README.md`
