# src/controllers/

Parses the HTTP request, calls exactly one `services/` method, shapes the HTTP response
(status code, JSON body, error mapping). Nothing else.

No DB queries, no direct external API calls, no multi-step orchestration — that belongs in
a service. A controller method should read as: validate input → call service → return response.

Planned files: `auth.controller.js`, `webhooks.controller.js`, `repositories.controller.js`,
`review-jobs.controller.js`.
