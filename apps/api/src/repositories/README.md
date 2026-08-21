# src/repositories/

The only layer that imports Sequelize models directly. Every method here is scoped correctly
(e.g. by `installation_id`) so a caller can never accidentally cross-installation query —
see `docs/architecture/data-model.md` § Isolation rules.

No business logic and no branching on business rules here — if a query's shape depends on a
business decision, that decision is made in the calling service, not the repository.

Planned files: `user.repository.js`, `installation.repository.js`, `repository.repository.js`,
`pull-request.repository.js`, `review-job.repository.js`, `review-comment.repository.js`,
`job-event.repository.js`.
