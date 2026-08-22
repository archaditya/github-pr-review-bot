# src/validators/

Request payload schemas (zod), consumed by `middlewares/validate.middleware.js`. One schema
file per resource, mirrors the `routes/` breakdown.

- `repository.validator.js` — `updateRepositorySchema` (`PATCH /repositories/:id` body)
- `review-job.validator.js` — `listReviewJobsQuerySchema` (`GET /review-jobs` query params —
  `repositoryId`, `limit`, `cursor`)

No validator for `auth.routes.js` — GitHub controls the shape of the OAuth callback's query
params (`code`, `state`), so the controller checks their presence directly rather than
validating a schema we don't control the source of.
