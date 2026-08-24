# apps/web — Next.js frontend

## Responsibility
User-facing dashboard only. No business logic lives here — everything goes through
`apps/api` over REST via `lib/api-client.ts` (axios, `withCredentials: true` for the
session cookie).

- GitHub login (redirects to `apps/api`'s OAuth flow — see `app/login/`)
- Repository list + per-repo pause/resume toggle
- Review job history per repository, with live status
- Review job detail: pipeline progress, findings, conversation thread

## Stack
- **Next.js 14** (App Router), TypeScript
- **Tailwind CSS** — design tokens as CSS variables in `app/globals.css`, extended in
  `tailwind.config.ts`
- **shadcn/ui-style primitives** — hand-authored in `components/ui/` (Button, Card, Badge,
  Skeleton, Separator, Avatar), the same way the real `shadcn` CLI would generate them
  (copied into the repo, not an npm package) — see `components.json`
- **TanStack Query** — all server state (`hooks/`); nothing from `apps/api` is duplicated
  into client state
- **Zustand** — client-only ephemeral UI state only (`store/ui-store.ts` — currently just
  sidebar collapse). If you're tempted to put API data in a Zustand store, it belongs in a
  `hooks/` TanStack Query hook instead.
- **Axios** — the only HTTP client, wrapped once in `lib/api-client.ts`

## Design direction
Dark-mode-first, dev-tool aesthetic — not a generic SaaS look. Geist Sans/Mono (Vercel's
typeface, genuinely fitting for a tool whose whole subject is code diffs — mono is used
functionally for file paths, PR authors, and status pills, not decoratively). Colors lean on
git-diff semantics (add/remove green-red) and a real severity scale, defined once in
`app/globals.css` and consumed via Tailwind's `severity-*` / `diff-*` color extensions.

The signature element is `components/pipeline-stepper.tsx` — it renders the **actual**
`ReviewJob` state machine (`docs/architecture/data-model.md` /
`apps/api/src/constants/review-job-status.js`), not decorative step numbers. It's the one
place the UI takes a visual risk; everything else stays quiet and functional.

## Structure
```
app/
├── layout.tsx              # fonts, Providers
├── providers.tsx           # TanStack QueryClientProvider
├── globals.css             # design tokens (CSS variables)
├── login/page.tsx          # "Continue with GitHub" — redirects to apps/api's OAuth flow
└── (dashboard)/            # route group — sidebar shell, doesn't affect URLs
    ├── layout.tsx           # AppSidebar + content area
    ├── page.tsx             # "/" — repositories overview
    ├── repositories/[id]/page.tsx   # repo detail + review job history
    └── review-jobs/[id]/page.tsx    # job detail — stepper, findings, conversation

components/
├── ui/                     # shadcn-style primitives (Button, Card, Badge, ...)
├── app-sidebar.tsx
├── pipeline-stepper.tsx     # the signature element
├── status-badge.tsx / severity-badge.tsx
├── findings-list.tsx / conversation-thread.tsx / repo-list-item.tsx
└── empty-state.tsx

hooks/        # TanStack Query — one hook per apps/api resource
lib/          # api-client.ts (axios), utils.ts (cn helper)
store/        # ui-store.ts (Zustand, UI-only state)
types/        # api.ts — TypeScript types mirroring apps/api's models/responses
```

## Boundaries
- Never talks to Postgres, GitHub, or `ai-service` directly — only `apps/api`
- `types/api.ts` is hand-kept in sync with `apps/api`'s model/response shapes — there's no
  shared codegen between the two yet (see root `PROGRESS.md`)
