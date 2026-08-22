# src/controllers/

Parses the HTTP request, calls exactly one `services/` method, shapes the HTTP response
(status code, JSON body, error mapping). Nothing else.

No DB queries, no direct external API calls, no multi-step orchestration — that belongs in
a service. A controller method should read as: validate input → call service → return response.

- `health.controller.js`, `webhooks.controller.js`
- `auth.controller.js` — owns the OAuth state cookie (CSRF) and session cookie, delegates the
  actual token exchange to `services/auth.service.js`
- `repositories.controller.js`
- `review-jobs.controller.js`
