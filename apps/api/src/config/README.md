# src/config/

Single source of env parsing/validation — one typed config object built and validated at
startup (fail fast if a required var is missing). Nowhere else in the codebase reads
`process.env` directly.

Planned: `index.js` (exports the parsed config), `database.js` (Sequelize connection config,
per-env), `env.schema.js` (validation schema for required env vars).
