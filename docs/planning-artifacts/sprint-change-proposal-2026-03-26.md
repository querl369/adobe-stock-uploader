# Sprint Change Proposal — Figma Design Integration & Epic 6 Expansion

**Date:** 2026-03-26
**Triggered by:** New Figma UI designs requiring Epic 6 expansion and PRD updates
**Scope:** Moderate — Epic 6 restructured (7 → 11 stories), PRD updates, architecture additions
**Status:** Approved (2026-03-26)

---

## Section 1: Issue Summary

New Figma UI designs at `references/Elegant Minimalist Web App (1)/src/` introduce pages and features that go beyond the current Epic 6 plan. The Figma export is a fully working Vite + React reference app with React Router, shadcn/ui, and a matching design system (grain texture, lava-lamp buttons, light theme).

**4 entirely new features** not covered by any existing story:

- **Plans & Pricing page** (`/plans`) — 3 subscription tiers ($5/$23/$40)
- **Billing management tab** (`/account/billing`) — plan status, payment, invoices
- **Account routing layout** (`AccountLayout.tsx`) — sidebar nav with nested React Router routes
- **Header navigation update** — auth-aware nav links (Pricing, Login, SignUp, Account)

**4 existing stories** need updates to align with Figma UI references (6.1, 6.2, 6.5, 6.6 in old numbering).

**Key decisions made during analysis:**

- **Database/Auth:** Supabase selected (PostgreSQL + built-in auth + RLS)
- **Billing scope:** UI-only for MVP — Stripe integration deferred to post-release
- **Feature flag:** Plans and Billing pages hidden behind `FEATURE_PLANS_PAGE` flag for beta
- **Theme:** No change — Story 5.5 (Dark Mode) deferred, not a priority
- **Free tier:** Updated from 100 → 500 images/month

**Discovery context:** Identified during sprint planning as Epic 5 nears completion (5.1–5.4 done, 5.7 in review). Epic 6 is entirely backlog — no stories drafted, no code written.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic                | Status      | Impact                                                                        |
| ------------------- | ----------- | ----------------------------------------------------------------------------- |
| Epic 1 (Foundation) | Verified    | No impact                                                                     |
| Epic 2 (Processing) | Verified    | No impact                                                                     |
| Epic 3 (AI Engine)  | Done        | No impact                                                                     |
| Epic 4 (CSV Export) | Done        | No impact                                                                     |
| Epic 5 (UI/UX)      | In-progress | Minor — Story 5.5 deferred, 5.7 status correction (review, not ready-for-dev) |
| Epic 6 (Accounts)   | Backlog     | **Major** — restructured from 7 → 11 stories, Supabase replaces manual auth   |

### Story Impact

**Epic 5 changes:**

- Story 5.5 (Dark Mode): **Deferred** — removed from active sprint, not a priority
- Story 5.7 (Error Handling): **Status correction** — actually in `review` (code review pending), not `ready-for-dev`

**Epic 6 restructured (complete replacement):**

| New # | Story                                      | Origin                    |
| ----- | ------------------------------------------ | ------------------------- |
| 6.1   | Supabase Setup, Auth & Database Schema     | **NEW**                   |
| 6.2   | React Router & App Shell                   | **NEW**                   |
| 6.3   | User Registration & Signup Page            | Revised (was 6.1)         |
| 6.4   | User Login & Authentication Page           | Revised (was 6.2)         |
| 6.5   | Header Navigation Update                   | **NEW**                   |
| 6.6   | Account Layout & Sidebar Routing           | **NEW**                   |
| 6.7   | Account Profile & Settings                 | Revised (was 6.6)         |
| 6.8   | Processing History & CSV Re-Download       | Revised (was 6.5)         |
| 6.9   | Monthly Usage Tracking & Quota Enforcement | Revised (was 6.4)         |
| 6.10  | Plans & Pricing Page (feature-flagged)     | **NEW** (absorbs old 6.7) |
| 6.11  | Billing Management Tab (feature-flagged)   | **NEW**                   |

**Stories removed:**

- Old 6.3 (JWT Middleware) — **eliminated**, Supabase handles JWT/session management
- Old 6.7 (Upgrade Prompts) — **absorbed** into Story 6.10 (Plans page)

### Artifact Conflicts

| Artifact                                   | Change Needed                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PRD.md`                              | Add subscription tier definitions, update free tier to 500 images/month, add Plans & Billing as features (UI-only), note Supabase as database/auth |
| `docs/epics.md`                            | Complete rewrite of Epic 6 section (7 → 11 stories)                                                                                                |
| `docs/sprint-status.yaml`                  | Fix 5.7 status, mark 5.5 deferred, replace Epic 6 story list                                                                                       |
| `docs/architecture/architecture-client.md` | Add React Router, account routing pattern, Supabase client integration                                                                             |
| `CLAUDE.md`                                | Add React Router, Supabase to tech stack                                                                                                           |

### Technical Impact

- **New dependencies:** `react-router-dom`, `@supabase/supabase-js`
- **New infrastructure:** Supabase project (hosted PostgreSQL + Auth)
- **New env variables:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_FEATURE_PLANS_PAGE`
- **New architectural patterns:** Client-side routing, nested layouts with `<Outlet />`, auth context provider, protected routes, feature flags
- **No existing code needs to be rewritten** — React Router wraps existing components, Supabase is additive

---

## Section 3: Recommended Approach

**Selected: Direct Adjustment — restructure Epic 6 stories in `docs/epics.md`**

### Rationale

1. **Zero disruption** — all Epic 6 stories are backlog with no drafted files or code
2. **Figma reduces ambiguity** — exact UI reference for every page, reducing dev time
3. **Supabase simplifies auth** — eliminates 1 entire story (JWT middleware) and simplifies 2 others
4. **Controlled scope** — billing/plans UI-only, feature-flagged, Stripe deferred
5. **Strong foundation** — Epics 1–4 complete, component architecture from 5.1 supports new pages
6. **Free tier increase** (100 → 500) makes beta more attractive without backend changes

### Alternatives Considered

- **Rollback:** Not viable — no completed work conflicts with Figma designs
- **MVP Review:** Not needed — expansion is controlled (UI-only pages, feature flags)
- **Separate Epic 7 for monetization:** Rejected — billing/plans are UI scaffolding, not a separate epic. Stripe integration will warrant its own epic later.

### Effort & Risk

- **Effort:** Medium — Epic 6 grows from ~7 to ~11 stories, adding ~3–5 dev days
- **Risk:** Low — all changes target backlog items, Figma provides clear specs
- **Timeline impact:** Manageable — Supabase and feature flags reduce per-story complexity

---

## Section 4: Detailed Change Proposals

### 4.1 — NEW Story 6.1: Supabase Setup, Auth & Database Schema

**As a** developer,
**I want** Supabase configured with database schema and auth,
**So that** all Epic 6 stories have a data and authentication foundation.

**Key deliverables:**

- Supabase project with PostgreSQL database
- `@supabase/supabase-js` installed (frontend + backend)
- Database schema: `profiles`, `processing_batches`, `usage_tracking` tables
- Supabase Auth configured (email/password, 7-day JWT, no email confirmation for MVP)
- Row Level Security (RLS) policies for all tables
- Feature flag `FEATURE_PLANS_PAGE` added to app config (default: false)
- Supabase client singletons (frontend with ANON_KEY, backend with SERVICE_ROLE_KEY)

**Prerequisites:** None (first Epic 6 story)
**Reference:** N/A (infrastructure story)

---

### 4.2 — NEW Story 6.2: React Router & App Shell

**As a** developer,
**I want** client-side routing with React Router,
**So that** the app can navigate between pages without full page reloads.

**Key deliverables:**

- `react-router-dom` installed
- `createBrowserRouter` with routes: `/`, `/login`, `/signup`, `/plans`, `/account/*`
- Root layout with header, `<Outlet />`, footer
- Existing upload flow moved to Home page component at `/`
- Placeholder pages for routes built in later stories
- Vite and Express SPA fallback configured

**Prerequisites:** Story 6.1
**Reference:** `references/Elegant Minimalist Web App (1)/src/routes.ts`, `Root.tsx`

---

### 4.3 — Revised Story 6.3: User Registration & Signup Page

**As a** new user,
**I want** to create an account with my name, email, and password,
**So that** I can process 500 images/month and save my history.

**Key changes from original 6.1:**

- Added Full Name field (from Figma)
- Removed confirm password field (Figma omits for simplicity)
- Uses Supabase Auth (`supabase.auth.signUp()`) instead of manual bcrypt + JWT
- Auto-generates Default Initials from full name
- Database trigger creates profiles row on signup
- Lava-button CTA styling

**Prerequisites:** Story 6.1, Story 6.2
**Reference:** `references/Elegant Minimalist Web App (1)/src/SignUp.tsx`

---

### 4.4 — Revised Story 6.4: User Login & Authentication Page

**As a** returning user,
**I want** to log in with my email and password,
**So that** I can access my account and processing history.

**Key changes from original 6.2:**

- Uses Supabase Auth (`supabase.auth.signInWithPassword()`) instead of manual JWT
- Added "Forgot?" placeholder link (from Figma, non-functional in MVP)
- Supabase handles rate limiting on auth attempts automatically
- Lava-button CTA styling

**Prerequisites:** Story 6.3
**Reference:** `references/Elegant Minimalist Web App (1)/src/Login.tsx`

---

### 4.5 — NEW Story 6.5: Header Navigation Update

**As a** user,
**I want** the header to show relevant navigation based on my auth state,
**So that** I can access pricing, login, signup, or my account.

**Key deliverables:**

- Auth-aware header: Logged out → Pricing/Login/SignUp links; Logged in → Pricing/Account links
- AuthProvider context with `useAuth()` hook (shared dependency for all auth features)
- "Pricing" link gated by `FEATURE_PLANS_PAGE` feature flag
- Sign Up styled as lava-button CTA

**Prerequisites:** Story 6.4
**Reference:** `references/Elegant Minimalist Web App (1)/src/Root.tsx`

---

### 4.6 — NEW Story 6.6: Account Layout & Sidebar Routing

**As a** logged-in user,
**I want** a dashboard layout with sidebar navigation,
**So that** I can switch between profile, history, and billing.

**Key deliverables:**

- AccountLayout with sidebar nav + `<Outlet />` for nested content
- Sidebar links: Profile, History, Billing (feature-flagged), Log out
- ProtectedRoute component (redirects to /login if not authenticated)
- Active link highlighting via React Router NavLink

**Prerequisites:** Story 6.5
**Reference:** `references/Elegant Minimalist Web App (1)/src/AccountLayout.tsx`

---

### 4.7 — Revised Story 6.7: Account Profile & Settings

**As a** logged-in user,
**I want** to view and edit my profile information,
**So that** I can update my name and default initials for metadata.

**Key changes from original 6.6:**

- Added Default Initials field (from Figma — connects accounts to upload flow)
- Removed password change, email update, account deletion (deferred for beta)
- Uses Supabase client for profile CRUD
- Renders inside AccountLayout `<Outlet />`

**Prerequisites:** Story 6.6
**Reference:** `references/Elegant Minimalist Web App (1)/src/AccountProfile.tsx`

---

### 4.8 — Revised Story 6.8: Processing History & CSV Re-Download

**As a** logged-in user,
**I want** to view past sessions and re-download CSVs,
**So that** I don't lose my work if I close the browser.

**Key changes from original 6.5:**

- Click-anywhere-to-download card pattern (from Figma, replaces table-with-button)
- Download icon with hover animation
- Removed pagination and filtering (defer for beta)
- Backend update: store user_id in processing_batches for authenticated users

**Prerequisites:** Story 6.6, Story 4.3
**Reference:** `references/Elegant Minimalist Web App (1)/src/History.tsx`

---

### 4.9 — Revised Story 6.9: Monthly Usage Tracking & Quota Enforcement

**As a** free-tier user,
**I want** to see how many images I've used this month,
**So that** I know my remaining quota.

**Key changes from original 6.4:**

- Free tier updated: **500 images/month** (was 100)
- Uses Supabase for usage data storage and queries
- Backend quota check via Supabase JWT verification
- Upload page shows "X of 500 images used" when logged in
- Anonymous prompt: "Want 500 images/month? Create a free account"

**Prerequisites:** Story 6.7
**Reference:** N/A (functional story, no Figma page)

---

### 4.10 — NEW Story 6.10: Plans & Pricing Page (feature-flagged)

**As a** visitor or logged-in user,
**I want** to see available subscription plans,
**So that** I understand what each tier offers.

**Key deliverables:**

- 3-tier pricing display: $5/mo, $23/mo (highlighted), $40/mo
- Middle tier visually prominent (scale-105, shadow-2xl, "Most Popular")
- CTA buttons non-functional (show "Coming soon" toast)
- Free tier callout: "Currently free — 500 images/month for all accounts"
- Upgrade prompts (absorbed from old 6.7) — gated by feature flag
- Entire page and all prompts hidden when `FEATURE_PLANS_PAGE=false`

**Prerequisites:** Story 6.5, Story 6.9
**Reference:** `references/Elegant Minimalist Web App (1)/src/Plans.tsx`

---

### 4.11 — NEW Story 6.11: Billing Management Tab (feature-flagged)

**As a** logged-in user,
**I want** to see my current plan and billing information,
**So that** I understand my subscription status.

**Key deliverables:**

- Current Plan section (hardcoded "Free Plan" for MVP)
- Payment Method placeholder ("Add Payment Method" → toast)
- Billing Email display (from profile)
- Recent Invoices empty state (table structure ready for Stripe)
- All interactive elements show "coming soon" toasts
- Hidden when `FEATURE_PLANS_PAGE=false`

**Prerequisites:** Story 6.6, Story 6.9
**Reference:** `references/Elegant Minimalist Web App (1)/src/Billing.tsx`

---

## Section 5: Implementation Handoff

### Scope Classification: Moderate

Epic 6 is restructured with 4 new stories and 4 revised stories. New infrastructure (Supabase, React Router) introduced. All changes target backlog items with no impact on completed work.

### Handoff

| Role                     | Responsibility                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SM (Scrum Master)**    | Update `docs/epics.md` with restructured Epic 6 (11 stories). Update `docs/sprint-status.yaml`. Update PRD tier definitions. Context Epic 6 via sprint planning workflow. |
| **Dev team**             | Implement stories 6.1–6.11 via normal dev-story → code-review cycle. Set up Supabase project.                                                                             |
| **No escalation needed** | All changes are to backlog items. Architecture additions (Router, Supabase) are standard patterns.                                                                        |

### Workflow Sequence

1. ✅ `/bmad-bmm-correct-course` — this workflow (complete)
2. Update `docs/epics.md` — rewrite Epic 6 section
3. Update `docs/PRD.md` — add tier definitions, update free tier to 500
4. Update `docs/sprint-status.yaml` — fix 5.7, defer 5.5, restructure Epic 6
5. Update `docs/architecture/architecture-client.md` — add React Router, Supabase
6. `/bmad-bmm-sprint-planning` — context Epic 6, plan sprint
7. `/bmad-bmm-create-story` — draft each story (6.1 first, then sequential)
8. `/bmad-bmm-dev-story` → `/bmad-bmm-code-review` — implement + review cycle

### Success Criteria

- All 11 stories in `docs/epics.md` reflect Supabase + Figma-aligned scope
- Story 6.1 establishes Supabase foundation enabling all subsequent stories
- Story 6.2 establishes React Router enabling all page stories
- Feature flag gates monetization UI (Plans, Billing, upgrade prompts)
- Free tier displays as 500 images/month
- No existing functionality regresses during Epic 6 implementation
- Existing upload flow at `/` works identically after Router integration

### PRD Updates Required

1. **Free tier:** 100 → 500 images/month
2. **Subscription tiers:** Add 3 paid tiers ($5/$23/$40) as planned/UI-only
3. **Database:** Add Supabase as database/auth provider (replaces PostgreSQL + Prisma plan)
4. **Features:** Add Plans page, Billing tab as MVP features (UI-only)
5. **Feature flags:** Document `FEATURE_PLANS_PAGE` flag

### Architecture Updates Required

1. **React Router:** `createBrowserRouter` with nested routes
2. **Supabase client:** Frontend (ANON_KEY) and backend (SERVICE_ROLE_KEY)
3. **Auth context:** AuthProvider + useAuth() hook pattern
4. **Protected routes:** ProtectedRoute wrapper for /account/\*
5. **Account layout:** Sidebar + nested `<Outlet />` pattern
