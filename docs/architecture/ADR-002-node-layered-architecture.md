# ADR-002: Strict router → controller → service → repository layering in `apps/api`

## Status
Accepted

## Context
`apps/api` grow karega — auth, webhooks, review orchestration, repo settings, billing (future). Bina discipline ke, business logic routes/controllers mein leak ho jaati hai aur testing/mocking mushkil ho jaata hai.

## Decision
4 layers, strict one-direction dependency (`route → controller → service → repository`). Koi layer apne se neeche wali layer ko skip nahi karti.

| Layer | Responsibility | Never does |
|---|---|---|
| `routes/` | URL → controller mapping, middleware wiring (auth, validation) | No business logic, no DB access |
| `controllers/` | Parse request, call exactly one service method, shape the HTTP response | No DB queries, no direct external API calls |
| `services/` | All business logic, orchestration across repositories/integrations, transaction boundaries | No raw SQL, no `req`/`res` objects |
| `repositories/` | All Sequelize queries — the *only* layer that imports models directly | No business logic, no branching on business rules |
| `models/` | Sequelize model definitions, associations, instance-level validation | No cross-model orchestration |

Additional rule: `integrations/` (GitHub client, AI-service client) are called **only from services**, never from controllers or repositories — they're treated like another repository-ish dependency, but for external systems instead of Postgres.

## Alternatives considered

- **MVC only (no repository layer)**: rejected — couples business logic directly to Sequelize, makes it harder to swap query strategy (e.g. cursor pagination later) or mock DB access in service-level tests.
- **Feature-folder ("module") structure** (each feature owns its own routes+controller+service+repo in one folder): reasonable alternative, but for MVP scope (auth, webhooks, reviews, repos — ~4 domains) a flat layered structure is easier to navigate; revisit if the codebase grows past ~8 domains.

## Consequences
- (+) Services are unit-testable without hitting Express or Postgres (mock the repository)
- (+) Repositories are the only place that needs to change if we ever move off Sequelize
- (–) More files/boilerplate per feature than a "fat controller" approach — accepted trade-off given the user's stated preference for maintainability over quick-and-dirty
