# src/validators/

Request payload schemas (e.g. zod/joi), consumed by `middlewares/validate.middleware.js`.
One schema file per resource, mirrors the `routes/` breakdown.

Planned: `auth.validator.js`, `webhook.validator.js` (structural shape only — signature
verification is separate, in `integrations/github`), `repository.validator.js`.
