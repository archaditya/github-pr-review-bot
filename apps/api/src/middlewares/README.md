# src/middlewares/

Cross-cutting Express concerns: auth guard (verifies session/JWT, attaches `req.user`),
request validation (runs a `validators/` schema, 400s on failure), centralized error handler
(maps thrown errors incl. `AiServiceUnavailableError` to consistent HTTP responses), and
request logging.

Planned files: `auth.middleware.js`, `validate.middleware.js`, `error-handler.middleware.js`,
`request-logger.middleware.js`.
