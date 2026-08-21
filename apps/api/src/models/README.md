# src/models/

Sequelize model definitions: fields, associations, instance/model-level validation only.
No cross-model orchestration (that's a service's job) — a model doesn't call another
model's methods to implement a business rule.

State machines (e.g. `ReviewJob.status` transitions — see `docs/architecture/data-model.md`)
are enforced here via a guarded setter / `beforeUpdate` hook so invalid transitions raise
rather than silently persist.

Planned files: `user.model.js`, `installation.model.js`, `repository.model.js`,
`pull-request.model.js`, `review-job.model.js`, `review-comment.model.js`, `job-event.model.js`,
`index.js` (Sequelize init + associations).
