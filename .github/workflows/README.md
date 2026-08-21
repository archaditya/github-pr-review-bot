# .github/workflows/

CI placeholder — not yet implemented. Planned pipeline once code lands:

- `ci.yml` — per-PR: lint + typecheck + unit tests for `web`, `api`, `ai-service`
  independently (path-filtered, so a `web`-only change doesn't run Python tests)
- `build.yml` — on merge to `main`: build + push all three images
