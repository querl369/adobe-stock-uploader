# Story 6.7: Account Profile & Settings

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a logged-in user,
I want to view and edit my profile information,
so that I can update my name, email, and default initials for metadata.

## Acceptance Criteria

1. **Profile form renders with pre-filled data from Supabase**
   - On mount, fetch profile from `profiles` table: `supabase.from('profiles').select().eq('id', user.id).single()`
   - Show loading state while fetching (disabled inputs or skeleton)
   - Pre-fill "Full Name" input with `profile.full_name`
   - Pre-fill "Email Address" input with `profile.email` (read-only for MVP)
   - Pre-fill "Default Initials" input with `profile.default_initials`
   - If fetch fails, show error toast: "Failed to load profile"

2. **Full Name field is editable**
   - Text input, pre-filled from `profile.full_name`
   - Required field (cannot save empty)
   - No max length constraint at UI level (DB is `text`)

3. **Email field is read-only for MVP**
   - Text input with `readOnly` attribute, pre-filled from `profile.email`
   - Visually muted (lower opacity) to indicate read-only state
   - Email change requires Supabase `updateUser()` flow — deferred to post-MVP

4. **Default Initials field is editable**
   - Text input, pre-filled from `profile.default_initials`
   - `maxLength={5}` (matches DB check constraint and upload page)
   - User can override auto-generated initials (trigger generates from name on signup)
   - Used as default in upload flow when logged in (integration point for future story)

5. **Save Changes persists to Supabase**
   - "Save Changes" button submits updated `full_name` and `default_initials`
   - Update via: `supabase.from('profiles').update({ full_name, default_initials }).eq('id', user.id)`
   - On success: show toast `"Profile updated"`
   - On error: show toast with error message (e.g., `"Failed to update profile"`)
   - Button shows loading state while saving (disabled + "Saving..." text or spinner)
   - Prevents double-submit while saving

6. **Visual design matches Figma AccountProfile.tsx**
   - Container: `space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500`
   - Section header: h2 "Profile" + subtitle "Manage your personal information"
   - Glass card: `grain-gradient bg-gradient-to-br from-white/60 via-white/40 to-transparent border-2 border-border/20 rounded-[2rem] p-8 shadow-xl relative overflow-hidden`
   - Inner gradient overlay: `absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent opacity-50 pointer-events-none`
   - Inputs: `grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-border/20 rounded-2xl px-6 py-4 tracking-[-0.01em] text-[1rem] focus:border-foreground/20 transition-all`
   - Labels: `tracking-[-0.01em] opacity-50 text-[0.75rem] uppercase`
   - Save button: gradient dark button with hover scale + shadow effects
   - Button wrapper: `pt-4 flex justify-end`

7. **Renders inside AccountLayout's Outlet**
   - AccountProfile is the `index` route of `/account` (already configured in routes.tsx from Story 6.6)
   - No route changes needed — replace placeholder content in `AccountProfile.tsx`
   - Uses `useAuth()` to get current `user.id` for Supabase queries

8. **Existing functionality unaffected**
   - All existing tests pass (1040+)
   - Upload/processing/results flow works identically
   - Login, Signup, Header navigation, AccountLayout sidebar all work as before
   - No changes to backend code
   - No changes to AuthContext or Supabase client setup

## Tasks / Subtasks

- [x] Task 1: Replace AccountProfile placeholder with profile form (AC: 1, 2, 3, 4, 6)
  - [x] 1.1 Replace placeholder content in `client/src/pages/AccountProfile.tsx`
  - [x] 1.2 Import `useAuth` from `../contexts/AuthContext` and `supabase` from `../lib/supabase`
  - [x] 1.3 Add `useState` for form fields: `fullName`, `email`, `defaultInitials`
  - [x] 1.4 Add `useState` for `isLoadingProfile` and `isSaving`
  - [x] 1.5 Add `useEffect` to fetch profile on mount using `supabase.from('profiles').select().eq('id', user.id).single()`
  - [x] 1.6 Pre-fill form fields from fetched profile data
  - [x] 1.7 Add section header: h2 "Profile" + subtitle "Manage your personal information"
  - [x] 1.8 Add glass card container matching Figma styling
  - [x] 1.9 Add Full Name input with Label (editable)
  - [x] 1.10 Add Email Address input with Label (readOnly, muted opacity)
  - [x] 1.11 Add Default Initials input with Label (editable, maxLength 5)
  - [x] 1.12 Style all inputs to match Figma: grain-gradient, rounded-2xl, px-6 py-4
  - [x] 1.13 Add entry animation: `animate-in fade-in slide-in-from-bottom-4 duration-500`

- [x] Task 2: Implement Save Changes functionality (AC: 5)
  - [x] 2.1 Add "Save Changes" button matching Figma gradient dark style
  - [x] 2.2 Add `handleSave` function that calls `supabase.from('profiles').update()`
  - [x] 2.3 Send only `full_name` and `default_initials` (not email)
  - [x] 2.4 Show `toast.success('Profile updated')` on success
  - [x] 2.5 Show `toast.error('Failed to update profile')` on error
  - [x] 2.6 Add loading/disabled state to button while saving
  - [x] 2.7 Handle null supabase client gracefully (show error toast)

- [x] Task 3: Write tests (AC: 8)
  - [x] 3.1 Unit test: Profile form renders with pre-filled data from Supabase
  - [x] 3.2 Unit test: Email field is read-only
  - [x] 3.3 Unit test: Save button calls Supabase update with correct data
  - [x] 3.4 Unit test: Success toast shown after save
  - [x] 3.5 Unit test: Error toast shown when save fails
  - [x] 3.6 Unit test: Loading state shown while fetching profile
  - [x] 3.7 Unit test: Error toast shown when profile fetch fails
  - [x] 3.8 Unit test: Default Initials field has maxLength 5
  - [x] 3.9 Unit test: Save button disabled while saving (prevents double-submit)
  - [x] 3.10 Verify all existing tests still pass (`npm test`)

## Dev Notes

### Context & Business Value

This story replaces the "Coming soon" placeholder in AccountProfile with a real profile management form. It's the first account page to provide actual functionality — users can view and edit their name and default initials. The Default Initials field is strategically important: it will eventually pre-fill the upload page's initials input (Story 6.9+ integration), saving photographers a step on every batch.

Key decisions from Sprint Change Proposal 2026-03-26 and epics:

- Email is read-only for MVP (email change requires Supabase `updateUser()` flow — deferred)
- Password change deferred to post-MVP (Supabase has `resetPasswordForEmail()`)
- Account deletion deferred to post-MVP
- Default Initials auto-generated from full name on signup (DB trigger in migration 00006)
- User can override auto-generated initials with any value up to 5 chars

### Architecture Patterns & Constraints

**Supabase Client is Nullable — Always Check:**

```typescript
import { supabase } from '../lib/supabase';
// supabase is SupabaseClient | null
// MUST check before using
if (!supabase) {
  toast.error('Service unavailable');
  return;
}
```

This is the established pattern from Stories 6.1-6.6. The client is null when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` env vars are missing (dev/test).

**Profile Fetch Pattern:**

```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('full_name, email, default_initials')
  .eq('id', user.id)
  .single();
```

RLS policy ensures users can only access their own row. The `.single()` call returns one row or error.

**Profile Update Pattern:**

```typescript
const { error } = await supabase
  .from('profiles')
  .update({ full_name: fullName, default_initials: defaultInitials })
  .eq('id', user.id);
```

Do NOT update `email` — it's synced from `auth.users` and should only change via `supabase.auth.updateUser()`.

**AuthContext — Already Available from Story 6.5:**

```typescript
import { useAuth } from '../contexts/AuthContext';
// Returns: { user, session, isLoading, signOut }
// user.id is the UUID needed for profile queries
```

**Toast Notifications (Sonner) — Already Wired Up:**

```typescript
import { toast } from 'sonner';
toast.success('Profile updated');
toast.error('Failed to update profile');
```

Toaster is configured in Root.tsx with `position="bottom-right" richColors closeButton duration={5000}`.

**CRITICAL:** Import from `'react-router'` NOT `'react-router-dom'`. This project uses React Router v7 — all imports come from `'react-router'`. (Same note as Stories 6.3, 6.4, 6.5, 6.6.)

**Figma Reference — EXACT Implementation Target:**

The file `references/Elegant Minimalist Web App (1)/src/AccountProfile.tsx` provides the exact layout. Key elements:

1. **Container animation:** `animate-in fade-in slide-in-from-bottom-4 duration-500`
2. **Glass card:** `grain-gradient bg-gradient-to-br from-white/60 via-white/40 to-transparent border-2 border-border/20 rounded-[2rem] p-8 shadow-xl relative overflow-hidden`
3. **Input styling:** `grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-border/20 rounded-2xl px-6 py-4 tracking-[-0.01em] text-[1rem] focus:border-foreground/20 transition-all`
4. **Label styling:** `tracking-[-0.01em] opacity-50 text-[0.75rem] uppercase`
5. **Save button:** Dark gradient with hover/active states (same pattern as upload page CTA)
6. **Inner overlay:** `absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent opacity-50 pointer-events-none`

Note: Figma shows `defaultValue="Jane Doe"` as static — replace with dynamic state values from Supabase.

**Database Schema (profiles table):**

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null unique,
  default_initials text check (char_length(default_initials) <= 5),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

- `updated_at` auto-updates via DB trigger on row change
- RLS enabled: users can SELECT and UPDATE only their own row
- `default_initials` has a 5-char check constraint at DB level

**shadcn/ui Components to Use:**

- `Label` from `../components/ui/label` — for form labels
- `Input` from `../components/ui/input` — for text inputs

Do NOT use `<Button>` from shadcn/ui for the save button — Figma shows a custom gradient dark button (same pattern as other pages). Build it with a native `<button>` element matching the Figma styling.

### Anti-Patterns to Avoid

- **Do NOT use `NavLink`** — if any routing needed, use `Link` + `useLocation()` (project convention)
- **Do NOT import from `'react-router-dom'`** — use `'react-router'` (React Router v7)
- **Do NOT modify `email` via profile update** — email lives in `auth.users`, not `profiles`
- **Do NOT add password change functionality** — deferred to post-MVP
- **Do NOT add account deletion** — deferred to post-MVP
- **Do NOT add avatar/photo upload** — not in Figma, not in scope
- **Do NOT modify AuthContext or AuthProvider** — they work correctly from Story 6.5
- **Do NOT modify AccountLayout** — sidebar is complete from Story 6.6
- **Do NOT modify AppHeader** — header is complete from Story 6.5
- **Do NOT use uncontrolled inputs** (`defaultValue`) — use controlled `value` + `onChange` for form state
- **Do NOT modify the Supabase client setup** (`client/src/lib/supabase.ts`)
- **Do NOT modify shadcn/ui components** in `client/src/components/ui/`
- **Do NOT modify any backend files** — no server-side changes needed
- **Do NOT integrate initials into the upload page** — that's a future story concern

### Testing Requirements

**Framework:** Vitest with `globals: true` (no explicit imports for `describe`, `it`, `expect`)

**New test file:** `tests/account-profile.test.tsx`

**Mock patterns (follow `tests/account-layout.test.tsx` and `tests/header-navigation.test.tsx`):**

```typescript
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// --- Supabase mock (same base pattern as existing tests) ---
let mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
let mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

// ADD profile-specific mocks:
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'profiles') {
    return {
      select: mockSelect,
      update: mockUpdate,
    };
  }
  return {};
});

let mockSupabaseValue: unknown = {
  auth: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
  from: mockFrom,
};

vi.mock('../client/src/lib/supabase', () => ({
  get supabase() {
    return mockSupabaseValue;
  },
}));
```

**Setup helpers:**

```typescript
function setupAuthenticatedWithProfile(
  profile = {
    full_name: 'Test User',
    email: 'test@example.com',
    default_initials: 'TU',
  }
) {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockSession = { user: mockUser, access_token: 'token' };

  mockGetSession.mockResolvedValue({ data: { session: mockSession } });
  mockOnAuthStateChange.mockImplementation((callback: Function) => {
    callback('SIGNED_IN', mockSession);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });

  // Chain: .select().eq().single()
  mockSelect.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: profile, error: null }),
    }),
  });

  // Chain: .update().eq()
  mockUpdate.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
}
```

**Key test scenarios (10 tests):**

1. Profile form renders with pre-filled Full Name from Supabase
2. Profile form renders with pre-filled Email (read-only)
3. Profile form renders with pre-filled Default Initials
4. Email input has `readOnly` attribute
5. Default Initials input has maxLength of 5
6. Save button calls Supabase update with edited values
7. Success toast appears after successful save
8. Error toast appears when save fails
9. Loading state shown while profile is being fetched
10. Save button disabled while save is in progress

**Rendering pattern:**

```typescript
render(
  <MemoryRouter initialEntries={['/account']}>
    <AuthProvider>
      <AccountProfile />
    </AuthProvider>
  </MemoryRouter>
);
```

**Pre-commit hook:** Husky runs full test suite — all 1040+ tests must pass.

### Previous Story Intelligence

**From Story 6.6 (Account Layout — direct predecessor):**

- ProtectedRoute created at `client/src/components/ProtectedRoute.tsx` — auth gate for `/account/*` routes
- AccountLayout at `client/src/pages/AccountLayout.tsx` — sidebar nav + `<Outlet />` for nested content
- AccountProfile is the `index` route at `/account` — renders inside AccountLayout's Outlet
- Active link highlighting uses `useLocation()` + `Link` (NOT `NavLink`)
- Test pattern: `tests/account-layout.test.tsx` with Supabase mock, AuthProvider wrapper, MemoryRouter
- Total tests: 39 files, 1040 tests — all passing
- Code review lessons: use `<nav>` with `aria-label` for navigation, `aria-current="page"` for active links, `type="button"` on non-submit buttons, `try/finally` for cleanup

**From Story 6.5 (Header Navigation):**

- AuthProvider context at `client/src/contexts/AuthContext.tsx` — provides `{ user, session, isLoading, signOut }`
- `signOut()` uses try/finally to always clear state even if Supabase call fails
- Nullable supabase client: check for null before calling auth methods
- React Router v7 imports: `import { ... } from 'react-router'` (NOT react-router-dom)
- Feature flag: `import.meta.env.VITE_FEATURE_PLANS_PAGE === 'true'` (string comparison)
- Test pattern established in `tests/header-navigation.test.tsx`
- Code review lessons: always use `waitFor` for async state updates

**From Story 6.4 (Login Page):**

- Login form pattern: controlled inputs with `useState`, submit handler, error toast
- Form submission to Supabase: `supabase.auth.signInWithPassword()`
- Loading state during auth: button disabled + loading text
- Toast for success/error feedback
- `navigate('/')` after successful action

**From Story 6.3 (Signup Page):**

- Signup form: Full Name + Email + Password + Confirm Password
- Initials auto-generated from full name via DB trigger (migration 00006)
- Form validation: client-side checks before Supabase call
- Error handling: show Supabase error message in toast

**From Story 6.1 (Supabase Setup):**

- Frontend supabase client is nullable: `export const supabase: SupabaseClient | null`
- Located at `client/src/lib/supabase.ts`
- Sessions persist in localStorage (7-day expiry)
- Profiles table: `id`, `full_name`, `email`, `default_initials`, `created_at`, `updated_at`
- RLS policies: users can only SELECT/UPDATE their own profile row

### Git Intelligence

Recent commits show Story 6.6 was the last implementation:

```
ae43eb9 ASU-Implement Story 6.6 account layout sidebar routing with code review fixes
55ffeb9 ASU-Fix header navigation styles and layout overlap
8e0325c Merge pull request #4
13525dd ASU-Implement Story 6.4 login page with code review fixes
```

**Patterns from recent work:**

- Files modified: component files, page files, test files, sprint-status, story docs
- Commit format: `ASU-{description}`
- Code review produces follow-up fix commits
- Test files live in project root `tests/` directory
- All stories follow same structure: placeholder replacement + tests + sprint-status update

### File Structure Requirements

**Files to modify:**

```
client/src/pages/AccountProfile.tsx       # Replace placeholder with profile form
```

**New files to create:**

```
tests/account-profile.test.tsx            # Profile form unit tests
```

**Do NOT modify:**

- `client/src/contexts/AuthContext.tsx` — works correctly from Story 6.5
- `client/src/components/AppHeader.tsx` — header is complete
- `client/src/pages/AccountLayout.tsx` — sidebar is complete from Story 6.6
- `client/src/pages/Root.tsx` — app shell is complete
- `client/src/lib/supabase.ts` — client setup is correct
- `client/src/routes.tsx` — routing is correct (AccountProfile is index route)
- `client/src/components/ui/*` — shadcn/ui components, never modify
- Any backend files — no server-side changes needed
- Any existing test files — must all pass as-is

### Project Structure Notes

- `AccountProfile.tsx` is a page (`client/src/pages/`) — consistent with AccountLayout, Login, SignUp placement
- Test file `tests/account-profile.test.tsx` follows naming pattern of `tests/account-layout.test.tsx`, `tests/header-navigation.test.tsx`
- No new components directory entries — profile form is self-contained in the page component
- Supabase queries are made directly from the component (no service abstraction needed for this MVP scope)

### References

- [Source: docs/epics.md#Story 6.7] — Full acceptance criteria, prerequisites, technical notes
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-03-26.md] — Epic 6 restructure, feature flag decisions
- [Source: docs/architecture/architecture-client.md] — Frontend architecture, Supabase integration, component patterns
- [Source: docs/stories/6-6-account-layout-and-sidebar-routing.md] — Predecessor: AccountLayout, ProtectedRoute, test patterns
- [Source: docs/stories/6-5-header-navigation-update.md] — AuthProvider, useAuth hook, toast patterns
- [Source: docs/stories/6-4-user-login-and-authentication-page.md] — Login form pattern, controlled inputs, Supabase auth
- [Source: docs/stories/6-3-user-registration-and-signup-page.md] — Signup form, initials auto-generation
- [Source: docs/stories/6-1-supabase-setup-auth-and-database-schema.md] — Supabase client, profiles table, RLS policies
- [Source: references/Elegant Minimalist Web App (1)/src/AccountProfile.tsx] — Figma layout reference (exact implementation target)
- [Source: supabase/migrations/00001_create_profiles.sql] — Profiles table schema
- [Source: supabase/migrations/00006_create_profile_on_signup_trigger.sql] — Auto-initials trigger
- [Source: client/src/contexts/AuthContext.tsx] — AuthProvider with useAuth hook
- [Source: client/src/lib/supabase.ts] — Frontend Supabase client (nullable)
- [Source: client/src/pages/AccountProfile.tsx] — Current placeholder (to be replaced)
- [Source: tests/account-layout.test.tsx] — Test mock patterns to replicate

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixed `vi.mock` hoisting issue for sonner toast mock — used `vi.hoisted()` pattern
- Fixed `isLoadingProfile` not being reset to `true` when user changes and profile fetch restarts

### Completion Notes List

- Replaced placeholder "Coming soon" content in AccountProfile with a fully functional profile form
- Form fetches profile data from Supabase `profiles` table on mount, pre-fills Full Name, Email (read-only), and Default Initials
- Save Changes button updates `full_name` and `default_initials` via Supabase (email excluded per MVP)
- All styling matches Figma reference: glass card, grain-gradient inputs, entry animation, gradient dark button
- Loading state disables inputs while fetching; saving state disables button to prevent double-submit
- Toast notifications for success/error on both fetch and save operations
- Null supabase client handled gracefully with error toast
- 11 unit tests covering all acceptance criteria: form rendering, read-only email, save functionality, loading states, error handling
- All 1053 tests pass (40 test files, 0 regressions)

### File List

- `client/src/pages/AccountProfile.tsx` — Modified: replaced placeholder with profile form component
- `tests/account-profile.test.tsx` — New: 11 unit tests for AccountProfile
- `docs/sprint-status.yaml` — Modified: story status ready-for-dev → in-progress → review
- `docs/stories/6-7-account-profile-and-settings.md` — Modified: tasks marked complete, dev record updated

### Change Log

- 2026-04-09: Implemented Story 6.7 — Account Profile & Settings form with Supabase integration, Figma-matching UI, and comprehensive test coverage (11 tests)
