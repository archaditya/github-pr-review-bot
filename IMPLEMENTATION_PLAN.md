# ARCHADI PR-REVIEW & SOCIAL PLATFORM
## Multi-Tenant Architecture & Granular Feature Allocation Plan

> **Status:** Active Master Plan  
> **Target Release:** v2.0 Multi-Tenant & BYOK Platform  
> **Document Owner:** Aditya & AI Architecture Team  
> **Location:** Root Repository (`/IMPLEMENTATION_PLAN.md`)

---

## 1. Executive Summary & Core Objectives

### The Vision
Transform the single-developer PR Review Bot into an **invite-only, multi-tenant engineering platform** where external developers and teams can use our AI PR review bot, interactive repo chat, and multi-platform social media studio for their own repositories and brand accounts.

### The 4 Non-Negotiable Pillars
1. **Zero Cost & Liability for Platform Owner (BYOK):**
   Every non-admin user **must Bring Their Own Key (OpenAI API Key)** for LLM processing and DALL-E image generation. The owner pays $0 for third-party user activity.
2. **Granular Per-User Feature Entitlements (Admin Control):**
   Different users need different things. The Super Admin (Aditya) can configure capabilities **user-by-user** (e.g. User A gets PR Review only, User B gets PR + Repo Chat, User C gets Social Posts with platform limits).
3. **Platform Opt-In & Cost Awareness (Socials):**
   X (Twitter) API is expensive/paid, whereas LinkedIn, Facebook, and Instagram are free. Users must be able to toggle which platforms they want active and provide their own account credentials.
4. **Gatekeeper Security (Invite-Only):**
   New GitHub logins default to `pending` status. No user can access the platform without explicit Admin approval.

---

## 2. Complete Platform Feature Catalog

The platform consists of **5 distinct product pillars**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  PLATFORM CAPABILITIES                                  │
├─────────────────────────┬─────────────────────────┬─────────────────────────────────────┤
│ 1. AI PR REVIEW         │ 2. REPO & PR CHAT       │ 3. SOCIAL STUDIO (4 PLATFORMS)      │
│  - Automated PR diff    │  - GitHub thread @bot   │  - X (Twitter) [Paid Tier]          │
│    review               │  - Dashboard live chat  │  - LinkedIn [Free]                  │
│  - Neo4j blast radius   │  - Symbol caller/callee │  - Instagram Business [Free]        │
│  - Dual-mandate logic   │    graph exploration    │  - Facebook Pages [Free]            │
│  - Per-repo sensitivity │                         │  - Whiteboard architecture diagrams │
├─────────────────────────┼─────────────────────────┴─────────────────────────────────────┤
│ 4. CODE KNOWLEDGE GRAPH │ 5. REPO & WORKSPACE MANAGEMENT                                │
│  - Tree-sitter AST      │  - Per-repo auto-review toggles & custom voices               │
│  - Symbol call graphs   │  - Instant PR Merge action directly from dashboard            │
│  - Incremental indexing │  - Centralized Post Management & Review Job history           │
└─────────────────────────┴───────────────────────────────────────────────────────────────┘
```

### Feature 1: AI Pull Request Reviewer (`feat_pr_review`)
- Triggers on GitHub PR `opened` and `synchronize`.
- Dual-mandate review: catches real production bugs + offers 1–2 non-blocking observations for clean code.
- Enforces strict quantity limits (no 10–15 issue spam) and no fake "medium" severity inflation.
- Integrates with Neo4j code knowledge graph for caller/callee blast-radius context.

### Feature 2: Interactive Repo & PR Chat (`feat_repo_chat`)
- **GitHub Thread Replies:** Developers @mention `@archadi-bot` on PR review comments to ask questions, request alternatives, or discuss trade-offs.
- **Dashboard Chat:** Real-time web chat with code context and session history.

### Feature 3: Social Media Studio (`feat_social_studio`)
- Generates 4 platform drafts simultaneously from merged PRs or standalone engineering ideas.
- Automatically generates tailored whiteboard technical system design sketches (via DALL-E / Flare).
- Platform Granularity:
  - 🐦 **X (Twitter):** <280 chars, punchy tech hook, emojis & hashtags. *(Opt-in, requires paid X developer credits).*
  - 💼 **LinkedIn:** Multi-paragraph professional engineering breakdown. *(Free).*
  - 📸 **Instagram:** Aesthetic storytelling caption, clean line breaks, dev hashtags. *(Free).*
  - 👥 **Facebook:** Community-oriented update for Facebook Pages. *(Free).*

### Feature 4: Code Knowledge Graph (`feat_knowledge_graph`)
- Clones repo and parses AST symbols using Tree-sitter.
- Stores symbol nodes (`Function`, `File`, `Endpoint`) and relationships (`CALLS`, `DEFINED_IN`, `IMPORTS`) in Neo4j.
- Provides structural impact analysis during PR reviews.

### Feature 5: One-Click Merging & Job Automation (`feat_pr_actions`)
- Directly merge PRs from the dashboard with merge commit / squash / rebase strategies.
- Real-time SSE / WebSocket streaming of review pipeline progress.

---

## 3. Granular User-by-User Feature Entitlement Model

The Admin controls exactly what each user can do via a flexible `features` JSON configuration in the database:

```json
{
  "can_review_prs": true,
  "can_repo_chat": true,
  "can_social_studio": true,
  "allowed_social_platforms": ["linkedin", "instagram", "facebook"],
  "social_monthly_quota": 25,
  "ai_provider_mode": "byok_only",
  "max_indexed_repos": 5
}
```

### Entitlement Flags Breakdown:

| Flag | Type | Description | Default for New Users |
| :--- | :--- | :--- | :--- |
| `can_review_prs` | Boolean | Can install GitHub App and receive automated AI PR reviews | `true` |
| `can_repo_chat` | Boolean | Can use dashboard chat and @bot GitHub thread replies | `true` |
| `can_social_studio` | Boolean | Can access Create Post studio and generate social content | `true` |
| `allowed_social_platforms` | String[] | Which platforms this user can draft & publish to | `['linkedin', 'instagram', 'facebook']` (X is disabled by default) |
| `social_monthly_quota` | Number | Max social posts allowed per month (`0` = unlimited) | `20` |
| `ai_provider_mode` | Enum | `'byok_only'` (must bring key) or `'managed'` (admin sponsors) | `'byok_only'` (Aditya = `'managed'`) |
| `max_indexed_repos` | Number | Max repositories indexed in Neo4j knowledge graph | `5` |

---

## 4. Database Schema & Architecture Enhancements

### 4.1 Enhanced `users` Table
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS openai_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{
  "can_review_prs": true,
  "can_repo_chat": true,
  "can_social_studio": true,
  "allowed_social_platforms": ["linkedin", "instagram", "facebook"],
  "social_monthly_quota": 20,
  "ai_provider_mode": "byok_only",
  "max_indexed_repos": 5
}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_credentials_encrypted JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS usage JSONB DEFAULT '{
  "review_count": 0,
  "post_count": 0,
  "chat_count": 0,
  "reset_at": null
}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;
```

### 4.2 Security & Key Encryption (AES-256-GCM)
- Keys are never stored in plaintext.
- A dedicated helper `src/utils/crypto.js` encrypts/decrypts using `AES-256-GCM` with a 32-byte secret key derived from `ENCRYPTION_MASTER_KEY` (or `JWT_SECRET`).
- `maskApiKey("sk-proj-uMUn...")` returns `"sk-proj-...51AA"` for safe UI preview.

### 4.3 Enhanced `repositories` Table
- `ai_review_enabled`: Boolean (default `true`) — allows disabling the bot per repo without uninstalling the GitHub App.
- `review_level`: `'balanced' | 'strict' | 'permissive'` (default `'balanced'`).
- `custom_voice`: Text — custom tone/personality for social posts generated from this repository.

---

## 5. BYOK Runtime Pipeline (AI Service Injection)

```
┌──────────────────┐          ┌──────────────────────┐          ┌──────────────────┐
│  PR Webhook /    │          │      Express API     │          │    ai-service    │
│  User Request    │ ───────> │  1. Load User Record │ ───────> │  Request-scoped  │
└──────────────────┘          │  2. Decrypt API Key  │          │  OpenAI Client   │
                              │  3. Attach Header    │          │  Uses User Key!  │
                              │     X-OpenAI-Key     │          └──────────────────┘
                              └──────────────────────┘
```

1. **In `apps/api/src/integrations/ai-service-client/client.js`:**
   - Accepts an optional `{ apiKey }` option.
   - If present, attaches `X-OpenAI-Key: <decrypted_key>`.
2. **In `apps/ai-service/app/core/openai_client.py`:**
   - Allows passing `api_key: Optional[str] = None`.
   - If provided in request header, instantiates an `AsyncOpenAI(api_key=api_key)`.
   - If absent, falls back to `settings.openai_api_key` only for admin/managed users.
   - If user is `byok_only` and key is missing, rejects immediately with `402 Payment Required / Key Missing`.

---

## 6. User Interface Architecture

### 6.1 User Settings (`/settings`)
Refactored into 4 cohesive tabs:
1. **AI Brain (BYOK):**
   - OpenAI API Key input (hidden by default, with eye toggle).
   - "Test Connection" button that validates the key with OpenAI models endpoint.
   - Model preference selector (GPT-4o, GPT-4o-mini).
2. **Platform & Social Preferences (Cost Control):**
   - Toggle switches for active platforms:
     - 💼 **LinkedIn** *(Free — Active)*
     - 📸 **Instagram** *(Free — Active)*
     - 👥 **Facebook** *(Free — Active)*
     - 🐦 **X (Twitter)** *(Opt-in — Badge: "⚠️ Requires Paid X API Credits")*
   - Per-platform credentials form (User can paste their own LinkedIn token, Meta Page token, or X keys to post to their personal accounts).
3. **My Features & Quota:**
   - Visual card showing active features granted by Admin.
   - Usage progress bar (e.g. 8/20 posts used this month).
4. **App Access Keys:**
   - Existing API Keys table for webhook/programmatic integration.

---

### 6.2 Admin Dashboard (`/admin`) — [Super Admin Control]
Protected by `requireRole('admin')` middleware.

#### A. Gatekeeper Controls (Top Action Bar)
- **Gatekeeper Toggle:** "Require Admin Approval for new signups" (ON / OFF).
- **Global Metric Cards:** Total Users, Active Users, Pending Approval, Total Reviews Run, Total Social Posts.

#### B. User Management Table
- Columns:
  - User (Avatar, Name, GitHub Handle)
  - Role (`admin` / `user`)
  - Status Badge (`active` / `pending` / `suspended`)
  - Features Assigned (e.g. `[PR Review] [Chat] [Social (3/4)]`)
  - Usage Stats (Reviews: 14, Posts: 6)
  - Actions Menu:
    - **Approve User** (unlocks pending account)
    - **Edit Features** (opens Granular Feature Modal)
    - **Suspend / Activate** (instantly cuts off API access)
    - **Make Admin / Revoke Admin**

#### C. Granular Feature Modal (Per-User Configuration)
When clicking "Edit Features" on any user:
- `[x] Enable AI PR Review`
- `[x] Enable Interactive Repo Chat`
- `[x] Enable Social Media Studio`
  - Platform Checkboxes:
    - `[x] LinkedIn (Free)`
    - `[x] Instagram (Free)`
    - `[x] Facebook (Free)`
    - `[ ] X / Twitter (Paid)`
- Monthly Post Quota: `[ 20 ]`
- AI Key Policy: `(o) Require User's OpenAI Key (BYOK)   ( ) Sponsored by Admin`

---

### 6.3 Dedicated Post Management (`/posts`)
Sidebar navigation addition:
- **Filters:**
  - Platform Tabs: `All`, `X`, `LinkedIn`, `Instagram`, `Facebook`
  - Status Filter: `All`, `Draft`, `Published`, `Failed`
  - Search: search by PR title or post text
- **Post Cards:**
  - Platform Icon, Status Badge, Published Timestamp
  - Text preview with full inline expand
  - Attached Image thumbnail with click-to-enlarge
  - Actions: **Edit Draft**, **Retry Publish**, **Delete**, **Open Live Post**

---

### 6.4 Repository & Review Management (`/repositories`)
Enhance existing repository cards:
- **Auto-Review Switch:** Toggle ON/OFF to pause bot reviews on specific repos.
- **Review Sensitivity Dropdown:** `Balanced` (Default), `Strict` (Blockers only), `Permissive` (High confidence only).
- **Custom Repo Voice:** Input for repo tone (e.g. "ByteVault: High-speed cloud storage").

---

## 7. Phased Implementation Roadmap

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            IMPLEMENTATION PHASES                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Data Model, AES-256 Crypto & BYOK Runtime Injection                 │
│  - DB Migration: user roles, status, encrypted keys, features JSONB          │
│  - Crypto utility (AES-256-GCM encrypt/decrypt/mask)                         │
│  - ai-service: per-request X-OpenAI-Key support                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: User Settings UI (BYOK + Platform Opt-in)                           │
│  - /settings tabs: AI Engine (BYOK), Social Platforms, Entitlements          │
│  - Test Connection endpoint for OpenAI key                                   │
│  - Platform toggles (X paid warning, LinkedIn/Meta free)                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Admin Dashboard UI & Gatekeeper Controls                            │
│  - /admin route & requireAdmin middleware                                    │
│  - User management table with approve/suspend actions                         │
│  - Edit Features Modal for user-by-user feature toggling                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Dedicated Post Management (/posts)                                  │
│  - /posts page in web navigation                                             │
│  - History, platform filters, retry mechanism, direct editing                │
├──────────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: Repository Review Controls & Multi-User Social Publishing           │
│  - Per-repo AI review toggle & review sensitivity settings                   │
│  - Per-user social account credentials injection                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Verification & Acceptance Criteria

1. **BYOK Isolation:**
   - An invited user with no OpenAI key configured is blocked from running reviews or generating social posts with an informative alert.
   - Once they input their key, their reviews execute using their key.
   - Admin account can still run reviews using server fallback keys.
2. **User-by-User Feature Toggle:**
   - Disabling `can_social_studio` for User A hides the Create Post page and rejects `/api/social-posts` calls for User A.
   - Enabling only LinkedIn and Instagram restricts User A's generated drafts to those 2 platforms, omitting X and Facebook.
3. **Admin Control:**
   - New user login defaults to `pending`. They cannot access dashboard until Aditya approves them in `/admin`.
   - Aditya can suspend any user, immediately invalidating their session and stopping their PR reviews.
4. **Post Management:**
   - Any drafted or published post across X, LinkedIn, Instagram, or Facebook appears in `/posts` with accurate status and direct retry/edit capability.
