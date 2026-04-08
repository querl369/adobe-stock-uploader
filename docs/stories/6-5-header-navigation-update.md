# Story 6.5: Header Navigation Update

Status: done

## Story

As a user,
I want the header to show relevant navigation links based on my auth state,
so that I can easily access pricing, login, signup, or my account.

## Acceptance Criteria

1. **AuthProvider context wraps the app**
   - Create `AuthProvider` component that wraps content inside `Root` layout
   - Listens to `supabase.auth.onAuthStateChange()` for real-time auth state
   - Provides `useAuth()` hook returning `{ user, session, isLoading, signOut }`
   - Handles nullable Supabase client gracefully (treats as permanently logged-out)
   - Shows nothing extra while auth state is loading (header renders with logged-out links)

2. **Header shows logged-out navigation when unauthenticated**
   - "Pricing" link → `/plans` (only visible when `VITE_FEATURE_PLANS_PAGE=true`)
   - "Login" link → `/login`
   - "Sign Up" link → `/signup` styled with `lava-button` CSS class
   - Logo/brand on left: dot + "AI Metadata" text linking to `/` (matches Figma Root.tsx)

3. **Header shows logged-in navigation when authenticated**
   - "Pricing" link → `/plans` (only visible when `VITE_FEATURE_PLANS_PAGE=true`)
   - "Account" link → `/account`
   - "Login" and "Sign Up" links hidden
   - Logo/brand unchanged

4. **Sign out functionality**
   - `signOut()` function available from `useAuth()` hook
   - Calls `supabase.auth.signOut()`
   - Clears auth context state (user, session set to null)
   - Sign Out link itself appears in Account sidebar (Story 6.6) — this story only provides the `signOut` function

5. **Feature flag for Pricing link**
   - Read `VITE_FEATURE_PLANS_PAGE` from `import.meta.env`
   - When `'true'`: show "Pricing" link in header
   - When absent or any other value: hide "Pricing" link
   - Add `VITE_FEATURE_PLANS_PAGE=false` to `.env.example`

6. **Visual design matches Figma reference**
   - Header layout matches `references/Elegant Minimalist Web App (1)/src/Root.tsx`
   - Logo: dot (1.5x1.5 rounded-full) + "AI Metadata" text (13px, opacity-50)
   - Nav links: 13px, tracking-[-0.01em], rounded-full pill buttons with hover:bg-black/5
   - "Sign Up" link uses lava-button styling (distinct CTA)
   - Fixed header with backdrop-blur and gradient background (existing pattern preserved)

7. **Existing functionality unaffected**
   - All existing tests pass without modification
   - Upload/processing/results flow works identically
   - Login and Signup pages work as before
   - No changes to backend code

## Tasks / Subtasks

- [x] Task 1: Create AuthProvider context (AC: 1, 4)
  - [x] 1.1 Create `client/src/contexts/AuthContext.tsx` with AuthContextType interface
  - [x] 1.2 Implement AuthProvider component with `supabase.auth.onAuthStateChange()` listener
  - [x] 1.3 Handle nullable supabase client (if null → permanently logged-out state)
  - [x] 1.4 Implement `signOut()` function that calls `supabase.auth.signOut()` and clears state
  - [x] 1.5 Export `useAuth()` hook with context validation (throw if used outside provider)

- [x] Task 2: Integrate AuthProvider into app (AC: 1)
  - [x] 2.1 Wrap content in `client/src/pages/Root.tsx` with `<AuthProvider>`
  - [x] 2.2 Verify AuthProvider is available to AppHeader and all Outlet children

- [x] Task 3: Update AppHeader with auth-aware navigation (AC: 2, 3, 5, 6)
  - [x] 3.1 Replace disabled About/Help buttons with auth-aware nav links
  - [x] 3.2 Make logo/brand a `Link` to `/` with Figma styling (dot + "AI Metadata")
  - [x] 3.3 Logged-out state: show Pricing (if flagged), Login, Sign Up (lava-button)
  - [x] 3.4 Logged-in state: show Pricing (if flagged), Account
  - [x] 3.5 Read `VITE_FEATURE_PLANS_PAGE` from `import.meta.env` to gate Pricing link
  - [x] 3.6 Style all links matching Figma Root.tsx (13px, rounded-full pills, hover:bg-black/5)

- [x] Task 4: Add feature flag env variable (AC: 5)
  - [x] 4.1 Add `VITE_FEATURE_PLANS_PAGE=false` to `.env.example`

- [x] Task 5: Write tests (AC: 7)
  - [x] 5.1 Unit test: AuthProvider provides user/session/isLoading/signOut via useAuth()
  - [x] 5.2 Unit test: AuthProvider handles null supabase client (logged-out state)
  - [x] 5.3 Unit test: signOut() calls supabase.auth.signOut() and clears state
  - [x] 5.4 Unit test: AppHeader shows Login + Sign Up when logged out
  - [x] 5.5 Unit test: AppHeader shows Account when logged in
  - [x] 5.6 Unit test: Pricing link visible only when VITE_FEATURE_PLANS_PAGE=true
  - [x] 5.7 Unit test: Pricing link hidden when feature flag is false/absent
  - [x] 5.8 Unit test: Sign Up link has lava-button styling
  - [x] 5.9 Unit test: Logo links to `/`
  - [x] 5.10 Verify all existing tests still pass (`npm test`) — 1028 tests pass, 38 files

## Dev Notes

### Context & Business Value

This is the **pivotal auth infrastructure story** in Epic 6. It creates the `AuthProvider` context that ALL subsequent stories depend on (6.6 ProtectedRoute, 6.7 Profile, 6.8 History, 6.9 Usage). It also transforms the header from a static placeholder into a functional, auth-aware navigation bar matching the Figma design.

Key decisions from Sprint Change Proposal 2026-03-26:

- AuthProvider + `useAuth()` hook is the shared auth dependency for all Epic 6 features
- "Pricing" link gated by `FEATURE_PLANS_PAGE` feature flag (default: false for beta)
- Sign Up styled as lava-button CTA (distinct from other nav links)
- signOut function provided by AuthProvider, consumed by Account sidebar in Story 6.6

### Architecture Patterns & Constraints

**AuthProvider Pattern — React Context + Supabase Listener:**

```typescript
// client/src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**CRITICAL: Nullable Supabase Client Handling:**
The `supabase` client from `client/src/lib/supabase.ts` is `SupabaseClient | null`. When null (env vars missing), AuthProvider treats user as permanently logged-out — no listener, isLoading immediately false.

**AuthProvider Placement — Inside Root.tsx:**

```typescript
// client/src/pages/Root.tsx
import { AuthProvider } from '../contexts/AuthContext';

export function Root() {
  return (
    <AuthProvider>
      <div className="grain min-h-screen flex flex-col bg-gradient-to-br from-[#fafafa] via-[#f5f5f5] to-[#efefef]">
        <AppHeader />
        <main className="flex-1 flex flex-col">
          <Outlet />
        </main>
        <AppFooter />
        <Toaster position="bottom-right" richColors closeButton duration={5000} />
      </div>
    </AuthProvider>
  );
}
```

AuthProvider wraps INSIDE Root so it has access to router context (for future navigation needs) and provides auth state to AppHeader and all Outlet children.

**React Router v7 Navigation:**

```typescript
import { Link } from 'react-router'; // v7 import — NOT 'react-router-dom'
```

**CRITICAL:** This project uses React Router v7. Imports are from `'react-router'` NOT `'react-router-dom'`. See `client/src/routes.tsx` for the established pattern.

**Feature Flag Pattern:**

```typescript
const showPricing = import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true';
```

Vite env vars are strings. Check for string `'true'`, not boolean `true`.

### AppHeader Navigation Layout (Figma Reference)

The header must match `references/Elegant Minimalist Web App (1)/src/Root.tsx`:

```tsx
<header className="fixed top-0 left-0 right-0 z-50 px-8 py-5 backdrop-blur-sm bg-gradient-to-b from-background/80 to-transparent">
  <div className="max-w-7xl mx-auto flex items-center justify-between">
    {/* Logo/Brand — left side */}
    <Link to="/" className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
      <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
      <span className="tracking-[-0.02em] opacity-50 text-[13px]">AI Metadata</span>
    </Link>

    {/* Navigation — right side */}
    <div className="flex gap-2">
      {/* Pricing: feature-flagged */}
      {showPricing && (
        <Link
          to="/plans"
          className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px]"
        >
          Pricing
        </Link>
      )}

      {/* Logged OUT: Login + Sign Up */}
      {!user && (
        <>
          <Link
            to="/login"
            className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px]"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="lava-button px-5 py-2 rounded-full text-white text-[13px] tracking-[-0.01em]"
          >
            Sign Up
          </Link>
        </>
      )}

      {/* Logged IN: Account */}
      {user && (
        <Link
          to="/account"
          className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px]"
        >
          Account
        </Link>
      )}
    </div>
  </div>
</header>
```

**CRITICAL — Brand text change:** Figma uses "AI Metadata", NOT the current "Adobe Stock Uploader". Follow the Figma exactly.

**CRITICAL — Sign Up lava-button styling:** The Sign Up link must use the `lava-button` CSS class (defined in `client/src/index.css` ~line 235). This gives it the animated gradient CTA appearance. The `lava-button` class provides `background`, `color: white`, and hover/active transforms. Add `px-5 py-2 rounded-full text-white text-[13px] tracking-[-0.01em]` for sizing to match other nav links.

### Testing Requirements

**Framework:** Vitest with `globals: true` (no explicit imports for `describe`, `it`, `expect`)

**New test file:** `tests/header-navigation.test.tsx`

**Mock patterns:**

```typescript
// Mock Supabase client (for AuthProvider tests)
vi.mock('../client/src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

// Mock React Router
const mockNavigate = vi.fn();
vi.mock('react-router', () => ({
  ...vi.importActual('react-router'),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));
```

**Testing auth states:** To test logged-in state, mock `getSession` to return a session:

```typescript
const mockSession = {
  user: { id: 'user-1', email: 'test@example.com' },
  access_token: 'mock-token',
};

vi.mocked(supabase!.auth.getSession).mockResolvedValue({
  data: { session: mockSession as any },
  error: null,
} as any);
```

**Testing feature flag:** To test VITE_FEATURE_PLANS_PAGE:

```typescript
// Set env before importing component
vi.stubEnv('VITE_FEATURE_PLANS_PAGE', 'true');
// After test:
vi.unstubAllEnvs();
```

**Rendering test pattern** (React Router v7 compatible):

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../client/src/contexts/AuthContext';
import { AppHeader } from '../client/src/components/AppHeader';

// Wrap in MemoryRouter + AuthProvider for full context
render(
  <MemoryRouter>
    <AuthProvider>
      <AppHeader />
    </AuthProvider>
  </MemoryRouter>
);
```

**Key test scenarios:**

1. AppHeader renders Login + Sign Up links when logged out
2. AppHeader renders Account link when logged in
3. Login + Sign Up hidden when logged in
4. Account hidden when logged out
5. Pricing link visible when VITE_FEATURE_PLANS_PAGE=true
6. Pricing link hidden when feature flag is false/absent
7. Sign Up link has lava-button class
8. Logo links to `/` with "AI Metadata" text
9. useAuth() throws when used outside AuthProvider
10. AuthProvider handles null supabase client (logged-out state)
11. signOut() calls supabase.auth.signOut() and resets user/session
12. All existing tests pass (`npm test`)

**Pre-commit hook:** Husky runs full test suite — all tests must pass before commit.

### Previous Story Intelligence

**From Story 6.4 (Login — direct predecessor):**

- Nullable supabase client pattern: check for null before calling auth methods
- React Router v7 imports: `import { Link } from 'react-router'` (NOT react-router-dom)
- Toast via sonner: `import { toast } from 'sonner'` (Toaster already in Root.tsx)
- `lava-button` CSS class used for CTA buttons — applies to Sign Up nav link too
- `supabase.auth.signInWithPassword()` establishes sessions — AuthProvider picks these up via `onAuthStateChange`
- Full test suite: 37 files, 1017 tests — all must still pass

**From Story 6.3 (Signup):**

- Supabase `signUp()` creates user + triggers profile row creation
- After signup, `onAuthStateChange` fires with new session — AuthProvider should detect this automatically
- Form patterns established: controlled inputs, useState, inline errors

**From Story 6.2 (React Router):**

- `createBrowserRouter` with nested routes in `client/src/routes.tsx`
- Root layout provides grain background, header, footer, Toaster
- All routes exist: `/login`, `/signup`, `/plans`, `/account/*`

**From Story 6.1 (Supabase):**

- Frontend client is nullable: `export const supabase: SupabaseClient | null`
- Located at `client/src/lib/supabase.ts`
- Supabase types: `User`, `Session` from `@supabase/supabase-js`
- Sessions persist in localStorage (7-day expiry)

### Anti-Patterns to Avoid

- **Do NOT create ProtectedRoute** — that's Story 6.6
- **Do NOT add AccountLayout sidebar** — that's Story 6.6
- **Do NOT add Sign Out button to header** — sign out lives in Account sidebar (Story 6.6)
- **Do NOT modify Login or Signup pages** — they work correctly, AuthProvider will auto-detect their auth state changes
- **Do NOT add user avatar/dropdown to header** — keep it simple: just text links
- **Do NOT import from `'react-router-dom'`** — use `'react-router'` (v7 pattern)
- **Do NOT modify shadcn/ui components** — use them as-is
- **Do NOT create backend auth middleware** — Supabase SDK handles auth directly
- **Do NOT redirect after signOut in AuthProvider** — let the consuming component handle navigation
- **Do NOT modify `client/src/routes.tsx`** — route structure is already correct
- **Do NOT modify `client/src/app.tsx`** — AuthProvider goes inside Root.tsx, not around RouterProvider
- **Do NOT show loading spinner while auth resolves** — render logged-out nav immediately, switch when session detected

### File Structure Requirements

**New files to create:**

```
client/src/contexts/AuthContext.tsx    # AuthProvider + useAuth hook
tests/header-navigation.test.tsx       # Header + AuthProvider tests
```

**Files to modify:**

```
client/src/components/AppHeader.tsx    # Replace About/Help with auth-aware nav
client/src/pages/Root.tsx              # Wrap content with AuthProvider
```

**Do NOT modify:**

- `client/src/routes.tsx` — route structure already correct
- `client/src/app.tsx` — RouterProvider setup is fine
- `client/src/lib/supabase.ts` — client is fine
- `client/src/pages/Login.tsx` — works as-is
- `client/src/pages/SignUp.tsx` — works as-is
- `client/src/components/ui/*` — shadcn/ui components, never modify
- Any backend files — no server-side changes needed
- Any existing test files — must all pass as-is

### Project Structure Notes

- `client/src/contexts/` directory does NOT exist — must create it
- AppHeader is imported in Root.tsx — no import changes needed after modifying AppHeader
- AuthProvider placement inside Root.tsx means it's within the router tree — `useNavigate` would work if needed in future
- Feature flag `VITE_FEATURE_PLANS_PAGE` follows Vite convention: `VITE_` prefix for client-exposed env vars

### References

- [Source: docs/epics.md#Story 6.5] — Full acceptance criteria and technical notes
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-03-26.md] — Story origin, feature flag decisions
- [Source: docs/architecture/architecture-client.md] — AuthProvider pattern, component tree, auth context interface
- [Source: docs/stories/6-4-user-login-and-authentication-page.md] — Predecessor: login patterns, lava-button, Router v7
- [Source: docs/stories/6-3-user-registration-and-signup-page.md] — Signup patterns, supabase signUp flow
- [Source: docs/stories/6-2-react-router-and-app-shell.md] — Router setup, Root layout, placeholder pages
- [Source: docs/stories/6-1-supabase-setup-auth-and-database-schema.md] — Supabase client, auth config
- [Source: references/Elegant Minimalist Web App (1)/src/Root.tsx] — Figma header design reference
- [Source: client/src/lib/supabase.ts] — Nullable Supabase client
- [Source: client/src/components/AppHeader.tsx] — Current header (placeholder to replace)
- [Source: client/src/pages/Root.tsx] — Root layout (add AuthProvider)
- [Source: client/src/routes.tsx] — Route config (no changes needed)
- [Source: client/src/index.css#~line-235] — lava-button CSS class definition

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Existing root-layout.test.ts calls `Root()` directly and checks root element props — resolved by placing AuthProvider inside the div (not wrapping it), preserving test compatibility without modifying existing tests

### Completion Notes List

- Created AuthProvider context with full Supabase auth state management (user, session, isLoading, signOut)
- AuthProvider handles nullable supabase client gracefully — treats as permanently logged-out
- Updated AppHeader: replaced disabled About/Help placeholders with auth-aware navigation (Login, Sign Up, Account, Pricing)
- Sign Up link uses lava-button CSS class for CTA styling
- Logo updated from "Adobe Stock Uploader" to "AI Metadata" per Figma, now links to `/`
- Pricing link gated by `VITE_FEATURE_PLANS_PAGE` feature flag
- AuthProvider placed inside Root.tsx wrapping AppHeader, main, AppFooter, and Toaster
- All 11 new header-navigation tests pass, all 1028 total tests pass (0 regressions)
- Task 4 (.env.example update) completed by user
- Code review: 6 issues found (1H, 2M, 3L), all fixed — 12 tests, 1029 total pass

### File List

- `client/src/contexts/AuthContext.tsx` — NEW: AuthProvider context + useAuth hook
- `client/src/components/AppHeader.tsx` — MODIFIED: Auth-aware navigation with feature-flagged Pricing
- `client/src/pages/Root.tsx` — MODIFIED: Wrapped content with AuthProvider
- `tests/header-navigation.test.tsx` — NEW: 11 tests for AuthProvider + AppHeader navigation
- `docs/sprint-status.yaml` — MODIFIED: Story 6.5 status updated to in-progress

### Change Log

- 2026-04-08: Implemented Story 6.5 — AuthProvider context, auth-aware header navigation, 11 unit tests
- 2026-04-08: Code review fixes — H1: added dark bg to Sign Up lava-button, M1: added getSession error handling, M2: added Pricing+logged-in test, L2: nav landmark, L3: span wrapper for z-index
- 2026-04-08: Code review #2 fixes — M1: fixed act() warning in Logo test (added waitFor), M2: signOut() now uses try/finally to always clear state, M3: added subscription cleanup test, L2: replaced gradient class assertion with text-white check. 13 tests, 1030 total pass
