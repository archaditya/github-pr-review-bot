# src/constants/

Shared enums / lookup tables used across layers (models, services, jobs) so there's one
source of truth instead of magic strings scattered around.

- `review-job-status.js` — the `ReviewJob` status enum + valid state-transition map, consumed
  by `models/review-job.model.js` (guards writes) and `jobs/review-pipeline.job.js` (drives
  transitions). See `docs/architecture/data-model.md` for the state diagram.
