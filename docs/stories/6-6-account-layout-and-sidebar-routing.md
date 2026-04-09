# Story 6.6: Account Layout & Sidebar Routing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a logged-in user,
I want a dashboard layout with sidebar navigation,
so that I can switch between my profile, history, and billing settings.

## Acceptance Criteria

1. **AccountLayout renders sidebar + content area**
   - Left sidebar (200px on md+) with navigation links
   - Right content area with `<Outlet />` for nested route content
   - Header section: "Account Details" title + subtitle matching Figma AccountLayout.tsx
   - Grid layout: `md:grid-cols-[200px_1fr]` with gap-12, stacks vertically on mobile

2. **Sidebar navigation links with active state**
   - "Profile" link → `/account` (index route, active by default)
   - "History" link → `/account/history`
   - "Billing" link → `/account/billing` (only visible when `VITE_FEATURE_PLANS_PAGE=true`)
   - Active link: `bg-black/5 text-foreground font-medium`
   - Inactive link: `hover:bg-black/5 text-foreground/50 hover:text-foreground`
   - Profile uses exact path match; History and Billing use startsWith match

3. **Log out functionality in sidebar**
   - "Log out" button at bottom of sidebar with `mt-8` spacing
   - Styled as muted red: `text-red-500/50 hover:text-red-500 hover:bg-red-500/10`
   - Calls `signOut()` from `useAuth()` hook (Story 6.5)
   - After sign out, redirects to `/` using `useNavigate()`

4. **ProtectedRoute wrapper component**
   - Wraps `/account/*` routes — redirects to `/login` if not authenticated
   - Uses `useAuth()` hook to check auth state
   - While `isLoading` is true: renders nothing (or minimal loading state)
   - When `isLoading` is false and no user: redirects to `/login` via `<Navigate to="/login" replace />`
   - When user exists: renders `<Outlet />` (children)

5. **Feature flag for Billing link**
   - Read `VITE_FEATURE_PLANS_PAGE` from `import.meta.env`
   - When `'true'`: show "Billing" link in sidebar
   - When absent or any other value: hide "Billing" link

6. **Visual design matches Figma AccountLayout.tsx**
   - Page padding: `pt-32 pb-32 px-4`
   - Max width: `max-w-4xl` centered with `mx-auto`
   - Header border: `border-b border-border/10 pb-8`
   - Title: `tracking-[-0.04em] opacity-95 text-[clamp(2rem,4vw,3rem)] leading-[1.1]`
   - Subtitle: `opacity-40 tracking-[-0.01em] text-[1rem]`
   - Sidebar links: `px-4 py-3 rounded-xl tracking-[-0.01em] text-[0.875rem]`

7. **Route integration — ProtectedRoute wraps AccountLayout in routes.tsx**
   - Update `client/src/routes.tsx` to wrap `account` route with ProtectedRoute
   - All nested account routes inherit protection from ProtectedRoute parent

8. **Existing functionality unaffected**
   - All 1030 existing tests pass (routes.test.ts updated to reflect new ProtectedRoute nesting)
   - Upload/processing/results flow works identically
   - Login, Signup, and Header navigation work as before
   - No changes to backend code

## Tasks / Subtasks

- [x] Task 1: Create ProtectedRoute component (AC: 4)
  - [x] 1.1 Create `client/src/components/ProtectedRoute.tsx`
  - [x] 1.2 Import `useAuth()` from `../contexts/AuthContext`
  - [x] 1.3 Handle loading state (render nothing while `isLoading`)
  - [x] 1.4 Redirect to `/login` with `<Navigate to="/login" replace />` when no user
  - [x] 1.5 Render `<Outlet />` when user is authenticated

- [x] Task 2: Replace AccountLayout placeholder with Figma implementation (AC: 1, 2, 3, 5, 6)
  - [x] 2.1 Replace placeholder content in `client/src/pages/AccountLayout.tsx`
  - [x] 2.2 Add header section: "Account Details" title + subtitle
  - [x] 2.3 Add sidebar nav with Profile, History, Billing (feature-flagged) links
  - [x] 2.4 Implement active link highlighting using `useLocation()` pattern from Figma
  - [x] 2.5 Add "Log out" button with `signOut()` from `useAuth()` and redirect to `/`
  - [x] 2.6 Add `<Outlet />` content area
  - [x] 2.7 Gate "Billing" link behind `VITE_FEATURE_PLANS_PAGE` env var

- [x] Task 3: Integrate ProtectedRoute into routes (AC: 7)
  - [x] 3.1 Update `client/src/routes.tsx` to wrap account path with ProtectedRoute component
  - [x] 3.2 Keep AccountLayout as child of ProtectedRoute with existing nested children

- [x] Task 4: Write tests (AC: 8)
  - [x] 4.1 Unit test: ProtectedRoute renders Outlet when authenticated
  - [x] 4.2 Unit test: ProtectedRoute redirects to /login when not authenticated
  - [x] 4.3 Unit test: ProtectedRoute shows nothing while isLoading
  - [x] 4.4 Unit test: AccountLayout renders sidebar with Profile, History links
  - [x] 4.5 Unit test: AccountLayout shows Billing link when feature flag is true
  - [x] 4.6 Unit test: AccountLayout hides Billing link when feature flag is false/absent
  - [x] 4.7 Unit test: Active link has correct styling (font-medium)
  - [x] 4.8 Unit test: Log out button calls signOut() and navigates to /
  - [x] 4.9 Unit test: AccountLayout renders Outlet for nested content
  - [x] 4.10 Verify all existing tests still pass (`npm test`) — 1040 tests pass

## Dev Notes

### Context & Business Value

This story creates the **account dashboard shell** — the layout container that all subsequent account stories (6.7 Profile, 6.8 History, 6.11 Billing) render inside. It also introduces `ProtectedRoute`, the auth gate used by every `/account/*` route. Without this story, no authenticated-only pages can exist.

Key decisions from Sprint Change Proposal 2026-03-26:

- AccountLayout uses React Router `<Outlet />` for nested content — sub-pages render inside the content area
- ProtectedRoute redirects to `/login` when unauthenticated — no custom "access denied" page
- Billing link gated by `VITE_FEATURE_PLANS_PAGE` (same flag used in header, Story 6.5)
- Log out button lives in sidebar (NOT header) — `signOut()` from AuthContext (Story 6.5)
- Sub-route pages (Profile, History, Billing) keep their "Coming soon" placeholder content — full implementations are Stories 6.7, 6.8, 6.11

### Architecture Patterns & Constraints

**ProtectedRoute Pattern — Auth Gate with Outlet:**

```typescript
// client/src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

**CRITICAL:** Import from `'react-router'` NOT `'react-router-dom'`. This project uses React Router v7 — all imports come from `'react-router'`. See `client/src/routes.tsx`, `client/src/pages/Login.tsx`, `client/src/pages/SignUp.tsx` for established pattern.

**Route Integration — ProtectedRoute wraps AccountLayout:**

```typescript
// client/src/routes.tsx — updated account section
import { ProtectedRoute } from './components/ProtectedRoute';

{
  path: 'account',
  Component: ProtectedRoute,  // Auth gate
  children: [
    {
      Component: AccountLayout,  // Sidebar + content shell
      children: [
        { index: true, Component: AccountProfile },
        { path: 'history', Component: History },
        { path: 'billing', Component: Billing },
      ],
    },
  ],
}
```

**CRITICAL:** ProtectedRoute must be the parent route component. AccountLayout becomes a pathless child that provides the layout. This way ProtectedRoute checks auth first, then AccountLayout renders with sidebar and `<Outlet />` for the actual page content.

**AccountLayout — Figma Reference Implementation:**

The layout MUST match `references/Elegant Minimalist Web App (1)/src/AccountLayout.tsx` exactly:

```typescript
// client/src/pages/AccountLayout.tsx
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export function AccountLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const showBilling = import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true';

  const navItems = [
    { path: '/account', label: 'Profile', exact: true },
    { path: '/account/history', label: 'History', exact: false },
    // Billing conditionally added below
  ];

  if (showBilling) {
    navItems.push({ path: '/account/billing', label: 'Billing', exact: false });
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex flex-col items-center pt-32 pb-32 px-4">
      <div className="w-full max-w-4xl space-y-12">
        {/* Header */}
        <div className="space-y-2 border-b border-border/10 pb-8">
          <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
            Account Details
          </h1>
          <p className="opacity-40 tracking-[-0.01em] text-[1rem]">
            Manage your personal information, history, and billing
          </p>
        </div>

        <div className="grid md:grid-cols-[200px_1fr] gap-12">
          {/* Sidebar */}
          <div className="space-y-2">
            {navItems.map(item => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block w-full text-left px-4 py-3 rounded-xl tracking-[-0.01em] text-[0.875rem] transition-colors ${
                    isActive
                      ? 'bg-black/5 text-foreground font-medium'
                      : 'hover:bg-black/5 text-foreground/50 hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-500/50 hover:text-red-500 tracking-[-0.01em] text-[0.875rem] transition-colors mt-8"
            >
              Log out
            </button>
          </div>

          {/* Content */}
          <div>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Active Link Detection — useLocation (NOT NavLink):**

The Figma reference and this project use `useLocation()` + `Link` for active state detection. Do NOT use `NavLink`. The pattern:

- Profile (`/account`): exact match — `location.pathname === '/account'`
- History (`/account/history`): prefix match — `location.pathname.startsWith('/account/history')`
- Billing (`/account/billing`): prefix match — `location.pathname.startsWith('/account/billing')`

**Feature Flag Pattern (same as header in Story 6.5):**

```typescript
const showBilling = import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true';
```

Vite env vars are strings. Check for string `'true'`, not boolean `true`.

**AuthContext — Already Created in Story 6.5:**

```typescript
import { useAuth } from '../contexts/AuthContext';
// Returns: { user, session, isLoading, signOut }
```

`signOut()` already clears user/session state via try/finally. After calling it, navigate to `/`.

### Anti-Patterns to Avoid

- **Do NOT use `NavLink`** — use `Link` + `useLocation()` for active state (matches Figma and project pattern)
- **Do NOT import from `'react-router-dom'`** — use `'react-router'` (v7 pattern)
- **Do NOT implement Profile/History/Billing page content** — those are Stories 6.7, 6.8, 6.11; keep "Coming soon" placeholders
- **Do NOT add user avatar, dropdown menu, or user info to sidebar** — not in Figma, not in scope
- **Do NOT modify AuthContext or AuthProvider** — they work correctly from Story 6.5
- **Do NOT modify AppHeader** — header navigation is complete from Story 6.5
- **Do NOT add loading spinner in ProtectedRoute** — return `null` while loading (brief flash acceptable)
- **Do NOT redirect to a custom "access denied" page** — redirect to `/login` only
- **Do NOT modify the placeholder sub-pages** (AccountProfile, History, Billing) — leave their "Coming soon" content
- **Do NOT modify shadcn/ui components** in `client/src/components/ui/`
- **Do NOT modify any backend files** — no server-side changes needed
- **Do NOT add signOut to header** — sign out lives only in account sidebar

### Testing Requirements

**Framework:** Vitest with `globals: true` (no explicit imports for `describe`, `it`, `expect`)

**New test file:** `tests/account-layout.test.tsx`

**Mock patterns (follow `tests/header-navigation.test.tsx` exactly):**

```typescript
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// --- Supabase mock (same pattern as header-navigation.test.tsx) ---
let mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
let mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
let mockSupabaseValue: unknown = {
  auth: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
};

vi.mock('../client/src/lib/supabase', () => ({
  get supabase() {
    return mockSupabaseValue;
  },
}));
```

**Testing ProtectedRoute — mock useNavigate for redirect detection:**

```typescript
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => {
      mockNavigate(to, { replace });
      return null;
    },
  };
});
```

**Testing AccountLayout with specific route paths:**

```typescript
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthProvider } from '../client/src/contexts/AuthContext';
import { AccountLayout } from '../client/src/pages/AccountLayout';

// Render at specific path to test active link highlighting
render(
  <MemoryRouter initialEntries={['/account']}>
    <AuthProvider>
      <Routes>
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<div>Profile Content</div>} />
          <Route path="history" element={<div>History Content</div>} />
          <Route path="billing" element={<div>Billing Content</div>} />
        </Route>
      </Routes>
    </AuthProvider>
  </MemoryRouter>
);
```

**Key test scenarios (10 tests):**

1. ProtectedRoute renders Outlet when user is authenticated
2. ProtectedRoute redirects to `/login` when user is not authenticated
3. ProtectedRoute renders nothing while `isLoading` is true
4. AccountLayout renders sidebar with Profile and History links
5. AccountLayout shows Billing link when `VITE_FEATURE_PLANS_PAGE=true`
6. AccountLayout hides Billing link when feature flag is false/absent
7. Profile link has active styling when at `/account`
8. History link has active styling when at `/account/history`
9. Log out button calls `signOut()` and navigates to `/`
10. AccountLayout renders Outlet content area

**Pre-commit hook:** Husky runs full test suite — all 1030+ tests must pass.

### Previous Story Intelligence

**From Story 6.5 (Header Navigation — direct predecessor):**

- AuthProvider context created at `client/src/contexts/AuthContext.tsx` — provides `{ user, session, isLoading, signOut }`
- `signOut()` uses try/finally to always clear state even if Supabase call fails
- Nullable supabase client pattern: check for null before calling auth methods
- React Router v7 imports: `import { Link, useLocation, useNavigate } from 'react-router'` (NOT react-router-dom)
- Feature flag: `import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true'` (string comparison)
- Test pattern established in `tests/header-navigation.test.tsx` — use same Supabase mock pattern
- `lava-button` CSS class not needed in this story (only for Sign Up CTA in header)
- AuthProvider placed inside Root.tsx wrapping `<AppHeader />`, `<main>`, `<AppFooter />`, `<Toaster />`
- Full test suite: 38 files, 1030 tests — all must still pass
- Code review lessons: always use `waitFor` for async state updates, use `try/finally` for cleanup

**From Story 6.2 (React Router):**

- `createBrowserRouter` in `client/src/routes.tsx` with nested routes
- Root layout provides grain background, header, footer, Toaster
- Account route already has nested children (AccountProfile, History, Billing)
- Placeholder pages already exist at `client/src/pages/AccountLayout.tsx`, `AccountProfile.tsx`, `History.tsx`, `Billing.tsx`

**From Story 6.1 (Supabase):**

- Frontend Supabase client is nullable: `export const supabase: SupabaseClient | null`
- Located at `client/src/lib/supabase.ts`
- Sessions persist in localStorage (7-day expiry)

### Git Intelligence

Recent commits show Story 6.5 was the last implementation:

```
55ffeb9 ASU-Fix header navigation styles and layout overlap
8e0325c Merge pull request #4
13525dd ASU-Implement Story 6.4 login page with code review fixes
```

**Patterns from recent work:**

- Files modified in 6.5: `AppHeader.tsx`, `AuthContext.tsx`, `Root.tsx`, `header-navigation.test.tsx`
- Commit format: `ASU-{description}`
- Code review produces follow-up fix commits
- Test files live in project root `tests/` directory

### File Structure Requirements

**New files to create:**

```
client/src/components/ProtectedRoute.tsx    # Auth gate component (~15 lines)
tests/account-layout.test.tsx               # AccountLayout + ProtectedRoute tests
```

**Files to modify:**

```
client/src/pages/AccountLayout.tsx          # Replace placeholder with Figma layout
client/src/routes.tsx                       # Wrap account route with ProtectedRoute
```

**Do NOT modify:**

- `client/src/contexts/AuthContext.tsx` — works correctly from Story 6.5
- `client/src/components/AppHeader.tsx` — header nav is complete
- `client/src/pages/Root.tsx` — Root layout is complete
- `client/src/pages/AccountProfile.tsx` — placeholder, implemented in Story 6.7
- `client/src/pages/History.tsx` — placeholder, implemented in Story 6.8
- `client/src/pages/Billing.tsx` — placeholder, implemented in Story 6.11
- `client/src/pages/Login.tsx` — works as-is
- `client/src/pages/SignUp.tsx` — works as-is
- `client/src/components/ui/*` — shadcn/ui components, never modify
- Any backend files — no server-side changes needed
- Any existing test files — must all pass as-is

### Project Structure Notes

- `client/src/components/ProtectedRoute.tsx` — new component alongside existing `AppHeader.tsx`, `AppFooter.tsx`, `DropZone.tsx`
- AccountLayout is a page (`client/src/pages/`) not a component — it's a route-level layout, consistent with Root.tsx placement
- ProtectedRoute is a component (`client/src/components/`) — it's reusable infrastructure, not a page
- `tests/account-layout.test.tsx` follows naming pattern of `tests/header-navigation.test.tsx`

### References

- [Source: docs/epics.md#Story 6.6] — Full acceptance criteria and technical notes
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-03-26.md#4.6] — Story origin, feature flag decisions
- [Source: docs/architecture/architecture-client.md#Key Architectural Patterns] — ProtectedRoute pattern, AccountLayout sidebar + Outlet
- [Source: docs/stories/6-5-header-navigation-update.md] — Predecessor: AuthProvider, useAuth, feature flag, test patterns
- [Source: docs/stories/6-2-react-router-and-app-shell.md] — Router setup, route config, placeholder pages
- [Source: docs/stories/6-1-supabase-setup-auth-and-database-schema.md] — Supabase client, auth config
- [Source: references/Elegant Minimalist Web App (1)/src/AccountLayout.tsx] — Figma layout reference (exact implementation)
- [Source: client/src/contexts/AuthContext.tsx] — AuthProvider with useAuth hook
- [Source: client/src/routes.tsx] — Current route config (needs ProtectedRoute wrapper)
- [Source: client/src/pages/AccountLayout.tsx] — Current placeholder (to be replaced)
- [Source: tests/header-navigation.test.tsx] — Test mock patterns to replicate

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Active link test initially failed because `hover:bg-black/5` in inactive links contains substring `bg-black/5`. Fixed by using `font-medium` as active indicator instead.
- Existing `tests/routes.test.ts` required update to reflect new ProtectedRoute wrapper nesting (account children: 3 → 1 layout wrapper → 3 nested children).

### Completion Notes List

- Created ProtectedRoute component (~10 lines) — auth gate using useAuth() hook with loading/redirect/outlet pattern
- Replaced AccountLayout placeholder with full Figma implementation — sidebar nav with active link highlighting, log out button, feature-flagged Billing link
- Integrated ProtectedRoute as parent wrapper in routes.tsx — ProtectedRoute checks auth, then AccountLayout renders sidebar + content
- Wrote 10 unit tests covering all acceptance criteria (3 ProtectedRoute + 7 AccountLayout)
- Updated existing routes.test.ts to match new nesting structure
- All 39 test files, 1040 tests pass — zero regressions

### File List

**New files:**

- `client/src/components/ProtectedRoute.tsx` — Auth gate component
- `tests/account-layout.test.tsx` — 10 unit tests for ProtectedRoute + AccountLayout

**Modified files:**

- `client/src/pages/AccountLayout.tsx` — Replaced placeholder with Figma sidebar layout
- `client/src/routes.tsx` — Wrapped account route with ProtectedRoute
- `tests/routes.test.ts` — Updated nested account route assertions for new structure
- `docs/sprint-status.yaml` — Story status: backlog → done
- `docs/stories/6-6-account-layout-and-sidebar-routing.md` — Task checkboxes, Dev Agent Record, File List, Change Log, Status

### Change Log

- 2026-04-08: Implemented Story 6.6 — Account Layout & Sidebar Routing. Created ProtectedRoute auth gate, replaced AccountLayout placeholder with Figma design (sidebar nav, active links, log out, feature-flagged billing), integrated into route config. 10 new tests, 1040 total passing.
- 2026-04-08: Code review fixes — (M1) Added useNavigate mock and navigation assertion to log out test, (M2) Wrapped handleLogout in try/finally so navigate('/') always executes even if signOut throws, (M3) Updated AC 8 wording to accurately reflect routes.test.ts modification, (L2) Removed unused container destructuring in loading test. 1040 tests pass.
- 2026-04-09: Code review #2 fixes — (M1) Changed sidebar `<div>` to `<nav>` with aria-label for accessibility, (M2) Added catch block to handleLogout to prevent unhandled promise rejection, (M3) Extended routes.test.ts Component check to verify 3rd-level nested route Components, (L1) Added aria-current="page" to active sidebar links, (L2) Added type="button" to log out button, (L3) Added test for Billing link active styling, (L4) Added test for subtitle text, (L5) Fixed File List sprint-status description to match actual git diff.
