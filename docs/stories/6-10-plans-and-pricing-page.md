# Story 6.10: Plans & Pricing Page (Feature-Flagged)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a visitor or logged-in user,
I want to see available subscription plans and pricing,
so that I understand what each tier offers and can choose to upgrade.

## Acceptance Criteria

1. **3-tier pricing display when `FEATURE_PLANS_PAGE=true`**
   - Navigate to `/plans` → see 3 pricing cards:
     - **First Tier — $5/month:** 1,000 images/month, Standard AI metadata, CSV exports, Email support
     - **Second Tier (highlighted) — $23/month:** 5,000 images/month, Advanced AI metadata, CSV + JSON exports, Priority support. Visually prominent: `scale-105`, `shadow-2xl`, "Most Popular" badge. CTA uses lava-button style.
     - **Third Tier — $40/month:** 10,000 images/month, Custom AI prompts, API access, 24/7 phone support

2. **Tier card structure**
   - Price display with "/mo" suffix
   - Feature list with Check icons (lucide-react)
   - CTA button: "Get Started" (non-functional for MVP)
   - CTA click shows toast: "Coming soon! We'll notify you when plans are available."

3. **Free tier mention**
   - Page shows: "Currently free — 500 images/month for all accounts"

4. **Upgrade prompts (absorbed from old Story 6.7)**
   - When free quota exhausted and `FEATURE_PLANS_PAGE=true`: link to `/plans` "See our plans for more images" (already implemented in Story 6.9 Home.tsx)
   - When flag is false, quota-exhausted message says: "You've used all 500 free images this month. Try again next month." (already implemented in Story 6.9)

5. **Feature flag disabled behavior (`FEATURE_PLANS_PAGE=false`)**
   - `/plans` route redirects to `/` or shows a 404-style page
   - "Pricing" link hidden from header (already implemented in Story 6.5)
   - Upgrade prompts default to non-monetization messages (already implemented in Story 6.9)
   - No references to paid tiers visible anywhere in the app

6. **Existing functionality unaffected**
   - All existing tests pass
   - Login, Signup, Header, AccountLayout, Home, History all work as before
   - Routes remain unchanged (already configured in `routes.tsx`)

## Tasks / Subtasks

- [x] Task 1: Implement Plans page with 3-tier pricing UI (AC: 1, 2, 3)
  - [x] 1.1 Replace placeholder `client/src/pages/Plans.tsx` with full 3-tier pricing page
  - [x] 1.2 Use Figma reference (`references/Elegant Minimalist Web App (1)/src/Plans.tsx`) as the design spec
  - [x] 1.3 Define static tier data object: name, price, images, popular flag, features array
  - [x] 1.4 Render 3 pricing cards in a responsive grid (`md:grid-cols-3`)
  - [x] 1.5 Middle tier: `scale-105`, `shadow-2xl`, "Most Popular" badge, lava-button CTA
  - [x] 1.6 Feature list items with `Check` icon from lucide-react
  - [x] 1.7 CTA buttons: `onClick` shows toast "Coming soon! We'll notify you when plans are available."
  - [x] 1.8 Add free tier mention: "Currently free — 500 images/month for all accounts"
  - [x] 1.9 Page title: "Simple, transparent pricing" with subtitle
  - [x] 1.10 Follow glassmorphism design: `grain-gradient`, `rounded-[2.5rem]`, backdrop blur, border patterns

- [x] Task 2: Add feature flag gating to Plans page (AC: 5)
  - [x] 2.1 Check `import.meta.env.VITE_FEATURE_PLANS_PAGE` at top of Plans component
  - [x] 2.2 When flag is `false`: redirect to `/` using `Navigate` from `react-router`, OR render a user-friendly "page not found" message
  - [x] 2.3 Test: Plans page renders pricing cards when flag is `true`
  - [x] 2.4 Test: Plans page redirects/shows 404 when flag is `false`

- [x] Task 3: Verify existing upgrade prompts work correctly (AC: 4)
  - [x] 3.1 Verify Home.tsx "See our plans for more images" link navigates to `/plans` when quota exceeded and flag is `true` (already implemented in Story 6.9)
  - [x] 3.2 Verify Home.tsx shows non-monetization message when flag is `false` (already implemented)
  - [x] 3.3 No code changes expected — just verification

- [x] Task 4: Verify all tests pass (AC: 6)
  - [x] 4.1 Run `npm test` — all existing tests should pass
  - [x] 4.2 No new backend tests needed (no backend changes)
  - [x] 4.3 No changes to routes.tsx (Plans already in router)

## Dev Notes

### Context & Business Value

This story brings the Plans & Pricing page to life, replacing the placeholder with a polished 3-tier pricing display. The page is entirely frontend — tier data is static, CTAs are placeholder toasts, and no Stripe integration is included. This establishes the pricing UI scaffold that will be connected to real payment processing in a future epic.

The page is feature-flagged behind `FEATURE_PLANS_PAGE` (default: `false`). When the flag is off, the Plans page is inaccessible and no pricing references appear in the app.

### Architecture Patterns & Constraints

**Feature Flag Pattern (Already Established):**

```typescript
// Same pattern used in AppHeader.tsx, Home.tsx, AccountLayout.tsx
const showPlans = import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true';
```

For the Plans page specifically, when the flag is `false`, the component should redirect:

```typescript
import { Navigate } from 'react-router';

export function Plans() {
  if (import.meta.env.VITE_FEATURE_PLANS_PAGE !== 'true') {
    return <Navigate to="/" replace />;
  }
  // ... render pricing cards
}
```

**Toast Pattern (Sonner):**

```typescript
import { toast } from 'sonner';
// CTA click handler:
toast("Coming soon! We'll notify you when plans are available.");
```

**Design Patterns — Glassmorphism (from existing components):**

```typescript
// Card: grain-gradient + rounded corners + border + backdrop
className = 'grain-gradient rounded-[2.5rem] p-8 border-2 border-border/20';

// Highlighted card (popular tier):
className =
  'border-2 border-foreground/20 bg-gradient-to-br from-white/90 to-white/50 shadow-2xl scale-105 z-10';

// Lava button for popular tier CTA:
className =
  'lava-button grain-gradient bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground';
```

**Figma Reference — CRITICAL:**

The exact UI spec is at `references/Elegant Minimalist Web App (1)/src/Plans.tsx`. This file contains:

- Complete tier data structure (name, price, images, popular flag, features)
- Full JSX with Tailwind classes for cards, badges, buttons
- Responsive grid layout
- Animation classes (`animate-in fade-in slide-in-from-bottom-4 duration-700`)
- "Most Popular" badge positioning
- CTA button variants (lava-button vs regular)

**The Figma file is the source of truth for layout, spacing, class names, and visual styling.** Follow it exactly, then add:

- Feature flag gating (not in Figma)
- Toast on CTA click (Figma has static buttons)
- Free tier mention text (not in Figma)
- CTA text change: Figma says "Subscribe Now"/"Choose Plan" → Story says "Get Started" for all CTAs

### Anti-Patterns to Avoid

- **Do NOT create any backend endpoints** — this is a pure frontend story
- **Do NOT integrate Stripe** — all CTAs are placeholder toasts
- **Do NOT modify `routes.tsx`** — Plans route is already configured
- **Do NOT modify `AppHeader.tsx`** — Pricing link already feature-flagged (Story 6.5)
- **Do NOT modify `Home.tsx`** — upgrade prompts already implemented (Story 6.9)
- **Do NOT modify `AccountLayout.tsx`** — Billing link already feature-flagged (Story 6.6)
- **Do NOT modify shadcn/ui components** in `client/src/components/ui/`
- **Do NOT import from `'react-router-dom'`** — use `'react-router'` (React Router v7)
- **Do NOT use `NavLink`** — use `Link` from `react-router` if needed
- **Do NOT hardcode the free tier limit** — use text "500 images/month" (matches what config defines)
- **Do NOT create a database table for plans** — tier data is a static object in the component
- **Do NOT add real pricing logic** — CTAs show informational toast only

### Testing Requirements

**Framework:** Vitest with `globals: true`

This story requires **minimal testing**:

- No new backend code → no backend tests
- The Plans page is a static UI component with a feature flag redirect
- Existing tests should pass unchanged (`npm test`)

**If desired (optional):** A simple render test for the Plans component could verify:

- Renders pricing cards when feature flag is true
- Redirects when feature flag is false

However, since the Figma reference already defines the exact structure and there are no interactive behaviors beyond toast, a visual check via the dev server is the primary verification method.

### Previous Story Intelligence

**From Story 6.9 (Monthly Usage Tracking — direct predecessor):**

- `FEATURE_PLANS_PAGE` flag checks already in Home.tsx line 42: `const showPlansLink = import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true';`
- "See our plans for more images" link already rendered at Home.tsx lines 364-367 when quota exceeded and flag enabled
- Quota exceeded without flag shows non-monetization message (Home.tsx lines 360-362)
- Usage display pattern at Home.tsx lines 351-355
- All 44 test files, 1100 tests passing at end of Story 6.9

**From Story 6.5 (Header Navigation):**

- `showPricing` flag check in AppHeader.tsx line 6
- Pricing link already conditionally rendered (AppHeader.tsx lines 16-23)
- Links to `/plans` route

**From Story 6.6 (Account Layout):**

- `showBilling` flag check in AccountLayout.tsx line 8
- Billing sidebar link already conditionally rendered

**From Story 6.2 (React Router):**

- `/plans` route already configured in `routes.tsx` line 23
- Plans component already imported at line 6
- No routing changes needed

### Git Intelligence

Recent commits:

```
46fa4d6 ASU-Implement Story 6.8 processing history and CSV re-download with code review fixes
766c9f3 ASU-Implement Story 6.7 account profile and settings page
ae43eb9 ASU-Implement Story 6.6 account layout sidebar routing with code review fixes
```

**Patterns:**

- Commit format: `ASU-{description}`
- Page components in `client/src/pages/`
- Import from `'react-router'`, NOT `'react-router-dom'`
- Feature flag: `import.meta.env.VITE_FEATURE_PLANS_PAGE`

### Project Structure Notes

**Files to modify:**

```
client/src/pages/Plans.tsx              # Replace placeholder with full pricing UI
```

**No new files needed.**

**Do NOT modify:**

- `client/src/routes.tsx` — Plans route already configured
- `client/src/components/AppHeader.tsx` — Pricing link already feature-flagged
- `client/src/pages/Home.tsx` — upgrade prompts already implemented
- `client/src/pages/AccountLayout.tsx` — Billing link already feature-flagged
- `client/src/components/ui/*` — shadcn/ui components, never modify
- `server.ts` — no backend changes
- Any backend service or route files
- `docs/sprint-status.yaml` — updated by workflow

### References

- [Source: docs/epics.md#Story 6.10] — Full acceptance criteria, prerequisites, technical notes
- [Source: docs/epics.md#Epic 6 Key Decisions] — FEATURE_PLANS_PAGE flag, free tier 500 images/month
- [Source: references/Elegant Minimalist Web App (1)/src/Plans.tsx] — Figma reference: exact UI spec for 3-tier pricing
- [Source: client/src/pages/Plans.tsx] — Current placeholder ("Coming soon")
- [Source: client/src/routes.tsx] — Plans route already configured at line 23
- [Source: client/src/components/AppHeader.tsx] — Pricing link feature-flagged at line 6
- [Source: client/src/pages/Home.tsx:42] — Feature flag check for plans link
- [Source: client/src/pages/Home.tsx:364-367] — Existing "See our plans" link when quota exceeded
- [Source: client/src/pages/AccountLayout.tsx:8] — Billing sidebar feature-flagged
- [Source: docs/stories/6-9-monthly-usage-tracking-and-quota-enforcement.md] — Predecessor: upgrade prompt implementation, feature flag patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation with no issues.

### Completion Notes List

- Replaced placeholder Plans.tsx with full 3-tier pricing page following Figma reference exactly
- Static tier data: First Tier ($5, 1000 images), Second Tier ($23, 5000 images, highlighted), Third Tier ($40, 10000 images)
- Feature flag gating: `VITE_FEATURE_PLANS_PAGE !== 'true'` redirects to `/` via `Navigate` from react-router
- CTA buttons show sonner toast: "Coming soon! We'll notify you when plans are available."
- Free tier mention text at bottom of page
- Glassmorphism design: grain-gradient, rounded-[2.5rem], backdrop blur, border patterns
- Middle tier: scale-105, shadow-2xl, "Most Popular" badge, lava-button CTA
- CTA text changed from Figma's "Subscribe Now"/"Choose Plan" to "Get Started" per story AC
- Feature text updated to match AC (e.g., "Standard AI metadata" vs Figma's "Standard AI descriptions")
- Price suffix uses "/mo" per AC requirement
- 10 new tests covering: page rendering, tier cards, prices, Most Popular badge, feature lists, CTA buttons, toast, free tier mention, feature flag redirect (true/false/absent)
- Verified existing upgrade prompts in Home.tsx work correctly (no changes needed)
- All 45 test files, 1110 tests passing with zero regressions

### Change Log

- 2026-04-12: Implemented Story 6.10 — Plans & Pricing page with 3-tier UI, feature flag gating, and 10 component tests
- 2026-04-12: Code review — fixed 5 issues (2 MEDIUM, 3 LOW): added /mo suffix test assertion, tested toast on all 3 tier buttons, corrected "CSV & JSON" to "CSV + JSON" per AC, added aria-labels to CTA buttons, used getAllByRole for semantic test queries

### File List

- `client/src/pages/Plans.tsx` — Modified: replaced placeholder with full 3-tier pricing page; review fixes: "CSV + JSON" text, aria-labels on CTA buttons
- `tests/plans.test.tsx` — New: 10 tests for Plans component (rendering, feature flag, toast); review fixes: /mo assertion, all-button toast test, semantic getAllByRole queries
