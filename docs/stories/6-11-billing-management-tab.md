# Story 6.11: Billing Management Tab (Feature-Flagged)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a logged-in user,
I want to see my current plan and billing information,
so that I understand my subscription status and can manage payments (future).

## Acceptance Criteria

1. **Current Plan section (when `FEATURE_PLANS_PAGE=true`)**
   - Navigate to `/account/billing` → see billing page inside AccountLayout's `<Outlet />`
   - Plan name: "Free Plan" for all MVP users
   - Status badge: "Active" (green)
   - Auto-renewal date: "N/A" for free tier
   - "Change Plan" link → `/plans`

2. **Payment Method section**
   - Placeholder: "No payment method on file"
   - "Add Payment Method" button (non-functional)
   - Button click shows toast: "Payment methods coming soon!"

3. **Billing Email section**
   - Displays user's email from auth context (`user.email`)
   - "Update" link/button (non-functional)
   - Click shows toast: "Coming soon!"

4. **Recent Invoices section**
   - Empty state: "No invoices yet"
   - Table structure ready: Date, Description, Amount, Status columns

5. **Feature flag disabled behavior (`FEATURE_PLANS_PAGE=false`)**
   - "Billing" link hidden from account sidebar (already implemented in Story 6.6)
   - `/account/billing` route redirects to `/account`
   - No billing references visible in the app

6. **Visual design matches Figma Billing.tsx layout**
   - Renders inside AccountLayout's `<Outlet />`
   - Uses glassmorphism card pattern (grain-gradient, rounded corners, borders)
   - Entry animation: `animate-in fade-in slide-in-from-bottom-4 duration-500`
   - All interactive elements show "coming soon" toasts

7. **Existing functionality unaffected**
   - All existing tests pass (1110+)
   - Login, Signup, Header, AccountLayout, Home, Plans, History, Profile all work as before
   - No changes to backend code

## Tasks / Subtasks

- [x] Task 1: Replace Billing placeholder with full implementation (AC: 1, 2, 3, 4, 6)
  - [x] 1.1 Replace placeholder content in `client/src/pages/Billing.tsx` with full billing page
  - [x] 1.2 Use Figma reference (`references/Elegant Minimalist Web App (1)/src/Billing.tsx`) as the visual design spec
  - [x] 1.3 Add page header: "Billing & Plan" title + "Manage your subscription and billing details" subtitle
  - [x] 1.4 Add Current Plan card with glassmorphism styling (grain-gradient, rounded-[2rem], border patterns, inner glow overlay)
  - [x] 1.5 Plan name: "Free Plan" with green "Active" badge (`px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-[0.7rem] font-medium uppercase`)
  - [x] 1.6 Auto-renewal text: "N/A" for free tier (Figma shows a real date — override with "N/A")
  - [x] 1.7 "Change Plan" link → `/plans` using `Link` from `react-router` (styled as ghost button: `bg-black/5 hover:bg-black/10 rounded-xl`)
  - [x] 1.8 Payment Method section below divider: "No payment method on file" (Figma shows "•••• 4242" — override)
  - [x] 1.9 "Add Payment Method" button → `toast("Payment methods coming soon!")`
  - [x] 1.10 Billing Email section: display `user.email` from `useAuth()` (Figma shows hardcoded email — use real user email)
  - [x] 1.11 "Update" button → `toast("Coming soon!")`
  - [x] 1.12 Recent Invoices section: empty state "No invoices yet" (Figma shows 3 invoices — override with empty state)
  - [x] 1.13 Include table column headers (Date, Description, Amount, Status) for structural readiness, show empty state below
  - [x] 1.14 Entry animation: `animate-in fade-in slide-in-from-bottom-4 duration-500`

- [x] Task 2: Add feature flag gating to Billing page (AC: 5)
  - [x] 2.1 Check `import.meta.env.VITE_FEATURE_PLANS_PAGE` at top of component
  - [x] 2.2 When flag is `false` or absent: redirect to `/account` using `<Navigate to="/account" replace />`
  - [x] 2.3 **NOTE:** Plans page redirects to `/` — Billing redirects to `/account` (stays in account section)

- [x] Task 3: Write component tests (AC: 7)
  - [x] 3.1 Create `tests/billing.test.tsx` following `tests/plans.test.tsx` patterns
  - [x] 3.2 Test: Renders billing page content when feature flag is `true`
  - [x] 3.3 Test: Redirects to `/account` when feature flag is `false`
  - [x] 3.4 Test: Redirects to `/account` when feature flag is absent
  - [x] 3.5 Test: Shows "Free Plan" plan name
  - [x] 3.6 Test: Shows "Active" status badge
  - [x] 3.7 Test: Shows "Change Plan" link pointing to `/plans`
  - [x] 3.8 Test: Shows "No payment method on file"
  - [x] 3.9 Test: "Add Payment Method" button shows toast on click
  - [x] 3.10 Test: Displays user email from auth context
  - [x] 3.11 Test: Shows "No invoices yet" empty state
  - [x] 3.12 Run `npm test` — all existing + new tests pass

## Dev Notes

### Context & Business Value

This is the **final story in Epic 6** and the lightest one — mostly static UI with placeholder interactions. It creates the Billing page scaffold that will be connected to Stripe integration in a future epic. For MVP, all users are on the "Free Plan" so billing data is hardcoded/derived from auth context rather than a backend endpoint.

The page is feature-flagged behind `VITE_FEATURE_PLANS_PAGE` (default: `false`). When the flag is off, the Billing page redirects to `/account` and is inaccessible.

### Architecture Patterns & Constraints

**Feature Flag Pattern (Established in Stories 6.5, 6.6, 6.10):**

```typescript
// Same pattern used in AppHeader.tsx, AccountLayout.tsx, Plans.tsx, Home.tsx
if (import.meta.env.VITE_FEATURE_PLANS_PAGE !== 'true') {
  return <Navigate to="/account" replace />;
}
```

**CRITICAL:** Billing redirects to `/account` (stays in account section). Plans redirects to `/` (goes home). These are intentionally different.

**Toast Pattern (Sonner — established across all Epic 6 stories):**

```typescript
import { toast } from 'sonner';
// Non-functional button handlers:
toast('Payment methods coming soon!');
toast('Coming soon!');
```

**Auth Context for User Email:**

```typescript
import { useAuth } from '../contexts/AuthContext';

export function Billing() {
  const { user } = useAuth();
  // user.email → display in Billing Email section
  // user is guaranteed non-null (ProtectedRoute ensures authenticated)
}
```

**Glassmorphism Card Pattern (from Figma Billing.tsx):**

```typescript
// Main card container:
<div className="grain-gradient bg-gradient-to-br from-white/60 via-white/40 to-transparent border-2 border-border/20 rounded-[2rem] p-8 shadow-sm relative overflow-hidden">
  {/* Inner glow overlay */}
  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent opacity-50 pointer-events-none" />
  {/* Content sits on top */}
  <div className="relative z-10">
    {/* ... card content ... */}
  </div>
</div>
```

**Green Status Badge (from Figma):**

```typescript
<span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-[0.7rem] tracking-[-0.01em] font-medium uppercase">
  Active
</span>
```

**Ghost Button / Link Style (from Figma "Change Plan"):**

```typescript
<Link
  to="/plans"
  className="shrink-0 inline-flex items-center justify-center px-6 py-3 bg-black/5 hover:bg-black/10 rounded-xl tracking-[-0.01em] text-[0.9rem] transition-colors font-medium"
>
  Change Plan
</Link>
```

**Typography & Spacing Patterns (consistent across all account sub-pages):**

| Element         | Classes                                                  |
| --------------- | -------------------------------------------------------- |
| Section header  | `tracking-[-0.02em] text-[1.5rem] font-medium`           |
| Card title      | `tracking-[-0.02em] text-[1.25rem] font-medium`          |
| Description     | `opacity-40 tracking-[-0.01em] text-[0.875rem]`          |
| Uppercase label | `opacity-40 text-[0.75rem] tracking-[-0.01em] uppercase` |
| Body text       | `tracking-[-0.01em] text-[0.9rem]`                       |
| Entry animation | `animate-in fade-in slide-in-from-bottom-4 duration-500` |

### Figma vs AC Differences — CRITICAL

The Figma Billing.tsx shows a **paid-user scenario**. The AC requires **MVP/free-tier overrides**:

| Element               | Figma Shows        | AC Requires                       | Action   |
| --------------------- | ------------------ | --------------------------------- | -------- |
| Plan name             | "First Tier"       | "Free Plan"                       | Override |
| Status badge          | "Active" (green)   | "Active" (green)                  | Keep     |
| Renewal date          | "Apr 24, 2026"     | "N/A"                             | Override |
| Payment method        | "•••• 4242"        | "No payment method on file"       | Override |
| Billing email         | "jane@example.com" | User's actual `user.email`        | Override |
| Invoices              | 3 hardcoded rows   | Empty state "No invoices yet"     | Override |
| Change Plan link      | Link to `/plans`   | Link to `/plans`                  | Keep     |
| Add Payment Method    | Not in Figma       | Button with toast                 | Add      |
| Update email          | Not in Figma       | Button/link with toast            | Add      |
| Invoice table headers | Not in Figma       | Date, Description, Amount, Status | Add      |

**Follow the Figma for layout, spacing, and visual styling. Override data content per AC.**

### Anti-Patterns to Avoid

- **Do NOT create any backend endpoints** — this is a pure frontend story
- **Do NOT integrate Stripe** — all interactive elements are placeholder toasts
- **Do NOT modify `routes.tsx`** — Billing route is already configured
- **Do NOT modify `AccountLayout.tsx`** — Billing sidebar link already feature-flagged (Story 6.6)
- **Do NOT modify `AppHeader.tsx`** — header navigation is complete (Story 6.5)
- **Do NOT modify `Plans.tsx`** — Plans page is complete (Story 6.10)
- **Do NOT modify `Home.tsx`** — upgrade prompts already implemented (Story 6.9)
- **Do NOT modify `AccountProfile.tsx`** — profile is complete (Story 6.7)
- **Do NOT modify `History.tsx`** — history is complete (Story 6.8)
- **Do NOT modify shadcn/ui components** in `client/src/components/ui/`
- **Do NOT import from `'react-router-dom'`** — use `'react-router'` (React Router v7)
- **Do NOT use `NavLink`** — use `Link` from `react-router`
- **Do NOT create database tables for billing** — all data is derived from auth context or hardcoded
- **Do NOT add real payment logic** — interactive elements show informational toasts only
- **Do NOT fetch data from any API endpoint** — user email comes from `useAuth()`, everything else is static
- **Do NOT modify any backend files** — no server-side changes

### Testing Requirements

**Framework:** Vitest with `globals: true` (no explicit imports for `describe`, `it`, `expect`)

**New test file:** `tests/billing.test.tsx`

**Test mock patterns (follow `tests/plans.test.tsx` and `tests/account-layout.test.tsx`):**

```typescript
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

// Stub feature flag
vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'true');

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

// Mock AuthContext — user guaranteed non-null (ProtectedRoute ensures auth)
const mockUser = { id: 'user-123', email: 'test@example.com' };
vi.mock('../client/src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    session: null,
    isLoading: false,
    signOut: vi.fn(),
  }),
}));
```

**Key test scenarios (11 tests):**

1. Renders billing page when feature flag is `true`
2. Redirects to `/account` when feature flag is `false`
3. Redirects to `/account` when feature flag is absent
4. Shows "Free Plan" plan name
5. Shows "Active" status badge
6. Shows "Change Plan" link pointing to `/plans`
7. Shows "No payment method on file"
8. "Add Payment Method" button triggers toast on click
9. Displays user email from auth context
10. "Update" button/link triggers toast on click
11. Shows "No invoices yet" empty state

**Feature flag redirect test pattern (from `tests/plans.test.tsx`):**

```typescript
it('redirects to /account when feature flag is false', () => {
  vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'false');
  render(
    <MemoryRouter initialEntries={['/account/billing']}>
      <Routes>
        <Route path="/account/billing" element={<Billing />} />
        <Route path="/account" element={<div>Account Page</div>} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText('Account Page')).toBeInTheDocument();
});
```

**Toast test pattern (from `tests/plans.test.tsx`):**

```typescript
import { toast } from 'sonner';

it('shows toast when Add Payment Method is clicked', async () => {
  const user = userEvent.setup();
  render(/* ... */);
  await user.click(screen.getByRole('button', { name: /add payment method/i }));
  expect(toast).toHaveBeenCalledWith('Payment methods coming soon!');
});
```

**Pre-commit hook:** Husky runs full test suite — all 1110+ existing tests + new tests must pass.

### Previous Story Intelligence

**From Story 6.10 (Plans & Pricing Page — direct predecessor):**

- Feature flag redirect: `if (import.meta.env.VITE_FEATURE_PLANS_PAGE !== 'true') return <Navigate to="/" replace />;`
  - **Billing uses `/account` instead of `/`** as redirect target
- Toast: `toast("Coming soon! We'll notify you when plans are available.")`
- Glassmorphism card: `grain-gradient rounded-[2.5rem] p-8 border-2 border-border/20`
- Plans does NOT use shadcn/ui components — all custom Tailwind matching Figma
- 10 tests in `tests/plans.test.tsx` — follow same patterns for billing tests
- All 45 test files, 1110 tests passing at end of Story 6.10

**From Story 6.9 (Monthly Usage Tracking):**

- `useAuth()` provides `{ user, session, isLoading, signOut }` — use `user.email` for billing email
- Feature flag: `import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true'` (string comparison, NOT boolean)

**From Story 6.6 (Account Layout):**

- AccountLayout sidebar has feature-flagged Billing link (line 8): `const showBilling = import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true';`
- Billing renders inside `<Outlet />` in the content area — no wrapper changes needed
- Active link detection: `location.pathname.startsWith('/account/billing')`

**From Story 6.8 (Processing History):**

- History page is a good template for account sub-pages within AccountLayout
- Uses `useAuth()` for user context, custom card styling with grain-gradient
- Fetches data inline in `useEffect` — but Billing has no async data fetching needed

### Git Intelligence

Recent commits:

```
d5ee95a ASU-Implement Story 6.10 plans and pricing page with code review fixes
6a79859 ASU-Implement Story 6.9 monthly usage tracking and quota enforcement with code review fixes
46fa4d6 ASU-Implement Story 6.8 processing history and CSV re-download with code review fixes
```

**Patterns:**

- Commit format: `ASU-{description}`
- Page components in `client/src/pages/`
- Test files in project root `tests/` directory
- Import from `'react-router'`, NOT `'react-router-dom'`
- Feature flag: `import.meta.env.VITE_FEATURE_PLANS_PAGE`
- Toast: `import { toast } from 'sonner'`

### Project Structure Notes

**Files to modify:**

```
client/src/pages/Billing.tsx              # Replace placeholder with full billing UI
```

**New files to create:**

```
tests/billing.test.tsx                    # Component tests for Billing page
```

**No new backend files. No new frontend files besides the test.**

**Do NOT modify:**

- `client/src/routes.tsx` — Billing route already configured
- `client/src/pages/AccountLayout.tsx` — Billing sidebar link already feature-flagged
- `client/src/components/AppHeader.tsx` — header navigation is complete
- `client/src/pages/Plans.tsx` — Plans page is complete
- `client/src/pages/Home.tsx` — upgrade prompts already implemented
- `client/src/pages/AccountProfile.tsx` — profile is complete
- `client/src/pages/History.tsx` — history is complete
- `client/src/components/ProtectedRoute.tsx` — auth gate is complete
- `client/src/contexts/AuthContext.tsx` — auth context works correctly
- `client/src/lib/supabase.ts` — frontend client setup is correct
- `client/src/components/ui/*` — shadcn/ui components, never modify
- Any backend files — no server-side changes
- `docs/sprint-status.yaml` — updated by workflow

### References

- [Source: docs/epics.md#Story 6.11] — Full acceptance criteria, prerequisites, technical notes
- [Source: docs/epics.md#Epic 6 Key Decisions] — FEATURE_PLANS_PAGE flag, free tier, Supabase auth
- [Source: references/Elegant Minimalist Web App (1)/src/Billing.tsx] — Figma reference: exact UI spec for billing page layout
- [Source: client/src/pages/Billing.tsx] — Current placeholder ("Coming soon")
- [Source: client/src/pages/Plans.tsx] — Plans page: same feature flag, toast, and glassmorphism patterns
- [Source: client/src/pages/AccountLayout.tsx] — Account shell with sidebar and Outlet
- [Source: client/src/routes.tsx] — Billing route configured at `/account/billing`
- [Source: client/src/contexts/AuthContext.tsx] — useAuth hook providing user.email
- [Source: tests/plans.test.tsx] — Test patterns for feature-flagged pages
- [Source: docs/stories/6-10-plans-and-pricing-page.md] — Predecessor: feature flag redirect, toast, glassmorphism
- [Source: docs/stories/6-9-monthly-usage-tracking-and-quota-enforcement.md] — useAuth pattern, feature flag
- [Source: docs/stories/6-6-account-layout-and-sidebar-routing.md] — AccountLayout sidebar, Billing link feature-flagged
- [Source: docs/stories/6-8-processing-history-and-csv-re-download.md] — Account sub-page template, grain-gradient card patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Initial `@testing-library/user-event` import failed (not installed) — switched to `fireEvent` from `@testing-library/react` to match existing test patterns (plans.test.tsx)

### Completion Notes List

- Replaced placeholder Billing.tsx with full billing page matching Figma layout with MVP/free-tier overrides
- Glassmorphism card with Current Plan ("Free Plan", "Active" badge, N/A renewal), Payment Method (placeholder with toast), Billing Email (from useAuth), and Recent Invoices (empty state with table headers)
- Feature flag gate: redirects to `/account` when `VITE_FEATURE_PLANS_PAGE !== 'true'`
- All interactive elements show "coming soon" toasts via Sonner
- 12 component tests covering all ACs: rendering, feature flag redirect, plan info, payment method, toast interactions, user email, invoices empty state
- Full suite: 46 files, 1122 tests passing (1110 existing + 12 new)
- **Figma deviation (intentional):** Payment/email grid uses `grid-cols-1 sm:grid-cols-2 gap-6` instead of Figma's `grid-cols-2 gap-4` — adds responsive breakpoint for mobile

### File List

- `client/src/pages/Billing.tsx` — Modified: replaced placeholder with full billing page implementation
- `tests/billing.test.tsx` — New: 12 component tests for billing page
- `docs/sprint-status.yaml` — Modified: story status ready-for-dev → in-progress → review

## Senior Developer Review (AI)

**Reviewer:** Code Review Workflow (Claude Opus 4.6)
**Date:** 2026-04-14
**Outcome:** Approved with fixes applied

**Issues Found:** 1 High, 3 Medium, 3 Low — all HIGH/MEDIUM fixed

| #   | Severity | Issue                                             | Fix                                                  |
| --- | -------- | ------------------------------------------------- | ---------------------------------------------------- |
| 1   | HIGH     | No test for AC 1 auto-renewal "N/A" text          | Added test `shows auto-renewal as N/A for free tier` |
| 2   | MEDIUM   | "Auto-renews on N/A" grammatically awkward        | Changed to "Auto-renewal: N/A"                       |
| 3   | MEDIUM   | Figma grid deviation undocumented                 | Documented in Completion Notes                       |
| 4   | MEDIUM   | sprint-status.yaml: 6-10 stale at `ready-for-dev` | Updated to `done`                                    |
| 5   | LOW      | `user?.email` unnecessary optional chaining       | Changed to `user.email`                              |
| 6   | LOW      | `fireEvent` vs `userEvent`                        | Not fixable — package not installed                  |
| 7   | LOW      | "Update" button lacks aria context                | Added `aria-label="Update billing email"`            |

**Post-fix test results:** 46 files, 1123 tests passing (13 billing tests)

## Change Log

- 2026-04-14: Code review — 6 issues fixed (1H, 3M, 2L). Added auto-renewal test, fixed grammar, added aria-label, removed unnecessary optional chaining, documented Figma deviation, fixed stale 6-10 status in sprint-status.yaml.
- 2026-04-14: Implemented full billing page (Tasks 1-3). Replaced placeholder with Figma-based layout, added feature flag gating, wrote 12 component tests. All 1122 tests passing.
