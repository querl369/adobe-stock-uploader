# Story 6.4: User Login & Authentication Page

Status: done

## Story

As a returning user,
I want to log in with my email and password,
so that I can access my account and processing history.

## Acceptance Criteria

1. **Login form with required fields**
   - Email input (required, validated format)
   - Password input (required)
   - "Sign In" button using `lava-button` CSS class (animated gradient CTA)
   - "Forgot?" link next to password label (non-functional placeholder for MVP)
   - Link to signup: "Don't have an account? Sign up" navigating to `/signup`

2. **Client-side validation with inline errors**
   - Show inline errors below each field (NOT `alert()` dialogs)
   - Email: required, valid email format checked before submission
   - Password: required (no minimum length check on login — that's signup's job)
   - Errors clear when user corrects the field
   - Submit button disabled during form submission (loading state)

3. **Supabase Auth login integration**
   - Call `supabase.auth.signInWithPassword({ email, password })`
   - Handle null Supabase client gracefully (show error toast "Authentication service unavailable")
   - On success: redirect to `/` (home/upload page)
   - On failure: show generic inline error "Invalid email or password" (no email enumeration)
   - Supabase handles rate limiting on auth attempts automatically

4. **Post-login behavior**
   - User session established via Supabase (JWT stored in localStorage by default)
   - Redirect to `/` (home/upload page) after successful login
   - Session persists across page refreshes (7-day expiry configured in Story 6.1)

5. **Visual design matches project design system**
   - Centered card layout on grain texture background (Root provides background)
   - Use existing shadcn/ui `Input` and `Label` components
   - Use `lava-button` CSS class for CTA button
   - "Forgot?" link styled as subtle text next to password label
   - Consistent typography with existing placeholder pages and SignUp page

6. **Existing functionality unaffected**
   - All existing tests pass without modification
   - Upload/processing/results flow works identically
   - No changes to existing routes, services, or backend code

## Tasks / Subtasks

- [x] Task 1: Create login form component (AC: 1, 2, 5)
  - [x] 1.1 Replace placeholder in `client/src/pages/Login.tsx` with full login form
  - [x] 1.2 Add controlled inputs: email, password with `useState`
  - [x] 1.3 Add inline error state and display below each field
  - [x] 1.4 Add client-side validation (email required + format, password required)
  - [x] 1.5 Style with centered card layout, shadcn/ui `Input`/`Label`, `lava-button` CTA
  - [x] 1.6 Add "Don't have an account? Sign up" link using React Router `Link` to `/signup`
  - [x] 1.7 Add "Forgot?" placeholder link next to password label

- [x] Task 2: Implement Supabase login integration (AC: 3, 4)
  - [x] 2.1 Import `supabase` from `../lib/supabase` (nullable client)
  - [x] 2.2 On form submit: validate fields, then call `supabase.auth.signInWithPassword()`
  - [x] 2.3 Handle null supabase client — show toast error "Authentication service unavailable"
  - [x] 2.4 Handle Supabase auth errors — display generic "Invalid email or password" inline
  - [x] 2.5 On success: use React Router `useNavigate()` to redirect to `/`
  - [x] 2.6 Add loading state: disable button and show "Signing in..." during API call

- [x] Task 3: Write tests (AC: 6)
  - [x] 3.1 Unit test: Login component renders form with Email, Password fields and Sign In button
  - [x] 3.2 Unit test: Client-side validation shows inline errors for invalid input
  - [x] 3.3 Unit test: Successful login calls supabase.auth.signInWithPassword with correct params
  - [x] 3.4 Unit test: Handles null supabase client gracefully (toast error)
  - [x] 3.5 Unit test: Displays generic error message on failed login
  - [x] 3.6 Unit test: Redirects to `/` on successful login
  - [x] 3.7 Unit test: Shows "Forgot?" link and "Sign up" link
  - [x] 3.8 Verify all existing tests still pass (`npm test`)

## Dev Notes

### Context & Business Value

This is the **second auth UI story** in Epic 6. It builds on Story 6.1 (Supabase setup), Story 6.2 (React Router with `/login` route), and Story 6.3 (Signup — so test accounts exist). The login form replaces the current "Coming soon" placeholder at `client/src/pages/Login.tsx`. Story 6.5 (Header Navigation) depends on this story for end-to-end auth flow.

Key decisions from Sprint Change Proposal 2026-03-26:

- Supabase Auth handles login, session management, JWT, and rate limiting
- No "Remember me" toggle — Supabase sessions persist by default (7-day expiry)
- No email confirmation flow — disabled for MVP
- "Forgot?" link is a non-functional placeholder (no password reset in MVP)
- Generic error message on failed login to prevent email enumeration

### Architecture Patterns & Constraints

**Supabase Client — Nullable Pattern:**
The frontend Supabase client (`client/src/lib/supabase.ts`) is nullable — it returns `null` when env vars are not configured. The login form MUST check for null before calling auth methods.

```typescript
import { supabase } from '../lib/supabase';

// MUST check for null
if (!supabase) {
  toast.error('Authentication service unavailable');
  return;
}

const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

**Supabase signInWithPassword Response:**

```typescript
// Success: data.user and data.session populated
// Error: error.message contains details (e.g., "Invalid login credentials")
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
  setFormError('Invalid email or password'); // Generic message — do NOT expose error.message
  return;
}
// data.session exists — user is logged in
navigate('/');
```

**CRITICAL: Always show generic "Invalid email or password"** — never expose the actual Supabase error message (e.g., "Email not confirmed", "Invalid login credentials") as it could leak information about which emails are registered.

**React Router v7 Navigation:**

```typescript
import { useNavigate, Link } from 'react-router'; // v7 import — NOT 'react-router-dom'

const navigate = useNavigate();
// After successful login:
navigate('/');
```

**CRITICAL:** This project uses React Router v7. Imports are from `'react-router'` NOT `'react-router-dom'`. See `client/src/routes.tsx` for the established pattern.

**Toast Notifications:**

```typescript
import { toast } from 'sonner';
// For errors not tied to a specific field:
toast.error('Authentication service unavailable');
```

Toaster is rendered once in `Root.tsx` — no need to add it in Login.

### Login Form Layout Pattern

Centered card layout matching existing design system and parallel to SignUp page. Reference the existing placeholder styling in `Login.tsx` for outer container pattern.

```tsx
<div className="flex-1 flex items-center justify-center px-4">
  <div className="w-full max-w-sm space-y-6">
    <div className="text-center space-y-2">
      <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(1.5rem,3vw,2rem)] leading-[1.1]">
        Welcome Back
      </h1>
      <p className="opacity-40 tracking-[-0.01em] text-[0.9rem]">
        Sign in to your account
      </p>
    </div>

    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="alex@example.com" ... />
        {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <span className="text-xs opacity-40 cursor-pointer hover:opacity-60">Forgot?</span>
        </div>
        <Input id="password" type="password" ... />
        {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
      </div>

      {/* Server error */}
      {formError && <p className="text-sm text-red-500 text-center">{formError}</p>}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="lava-button w-full h-10 rounded-md bg-neutral-900 text-white text-sm font-medium
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
      </button>
    </form>

    <p className="text-center text-sm opacity-60">
      Don't have an account?{' '}
      <Link to="/signup" className="underline hover:opacity-80">Sign up</Link>
    </p>
  </div>
</div>
```

### Client-Side Validation Logic

```typescript
function validateForm(): boolean {
  const newErrors: { email?: string; password?: string } = {};

  if (!email.trim()) {
    newErrors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    newErrors.email = 'Please enter a valid email address';
  }

  if (!password) {
    newErrors.password = 'Password is required';
  }
  // NOTE: No minimum length check on login — that's signup's job

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}
```

### Testing Requirements

**Framework:** Vitest with `globals: true` (no explicit imports for `describe`, `it`, `expect`)

**New test file:** `tests/login.test.tsx`

**Mock patterns:**

```typescript
// Mock Supabase client
vi.mock('../client/src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}));

// Mock React Router navigation
const mockNavigate = vi.fn();
vi.mock('react-router', () => ({
  ...vi.importActual('react-router'),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
```

**Key test scenarios:**

1. Renders form with Email, Password fields and Sign In button
2. Shows "Email is required" error when submitting empty email
3. Shows "Please enter a valid email address" for invalid email format
4. Shows "Password is required" for empty password
5. Calls `supabase.auth.signInWithPassword` with correct email/password on valid submission
6. Shows generic "Invalid email or password" on auth failure (NOT Supabase error message)
7. Navigates to `/` on successful login
8. Shows toast error when supabase client is null
9. Disables submit button during API call (loading state)
10. Renders "Forgot?" link and "Don't have an account? Sign up" link to `/signup`

**Rendering test pattern** (React Router v7 compatible):

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Login } from '../client/src/pages/Login';

// Wrap component in MemoryRouter for Link/useNavigate
render(
  <MemoryRouter>
    <Login />
  </MemoryRouter>
);
```

**Pre-commit hook:** Husky runs full test suite — all tests must pass before commit.

### Previous Story Intelligence

**From Story 6.3 (Signup — direct predecessor):**

- SignUp.tsx replaces placeholder with full form — Login.tsx should follow identical structure
- Nullable supabase client pattern established: check for null, show toast if unavailable
- Controlled inputs with `useState` — no React Hook Form
- Inline error pattern: `{errors.field && <p className="text-sm text-red-500">...</p>}`
- Loading state pattern: `isSubmitting` state disables button, changes text
- Form validation function returns boolean, sets errors state
- React Router v7 imports: `import { useNavigate, Link } from 'react-router'`
- Toast via sonner: `import { toast } from 'sonner'`
- Centered card layout: `flex-1 flex items-center justify-center px-4` outer, `w-full max-w-sm space-y-6` inner

**From Story 6.2 (React Router):**

- React Router v7 installed (`react-router` v7.13.2) — use `'react-router'` imports
- Routes configured in `client/src/routes.tsx` — `/login` already mapped to `Login` component
- Root layout provides grain background, header, footer, Toaster — Login only renders form content
- Placeholder pages use `flex-1 flex items-center justify-center` outer container

**From Story 6.1 (Supabase):**

- Frontend Supabase client is nullable: `export const supabase: SupabaseClient | null`
- Located at `client/src/lib/supabase.ts`
- Auth method: `supabase.auth.signInWithPassword({ email, password })`
- Sessions persist in localStorage (7-day expiry)

### Anti-Patterns to Avoid

- **Do NOT create AuthProvider or useAuth** — that's Story 6.5
- **Do NOT add ProtectedRoute** — that's Story 6.6
- **Do NOT modify AppHeader** — auth-aware nav is Story 6.5
- **Do NOT implement password reset** — "Forgot?" is a non-functional placeholder
- **Do NOT expose Supabase error messages** — always show generic "Invalid email or password"
- **Do NOT use React Hook Form** — simple controlled inputs sufficient for 2 fields
- **Do NOT import from `'react-router-dom'`** — use `'react-router'` (v7 pattern)
- **Do NOT add Toaster component** — already rendered in Root.tsx
- **Do NOT modify routes.tsx** — `/login` route already exists
- **Do NOT create backend auth routes** — Supabase SDK handles auth directly from frontend
- **Do NOT modify shadcn/ui components** — use them as-is from `client/src/components/ui/`
- **Do NOT add "Remember me" toggle** — Supabase sessions persist by default
- **Do NOT check password minimum length on login** — that's signup's concern

### File Structure Requirements

**New files to create:**

```
tests/login.test.tsx    # Login component tests
```

**Files to modify:**

```
client/src/pages/Login.tsx    # Replace placeholder with full login form
```

**Do NOT modify:**

- `client/src/routes.tsx` — `/login` route already exists
- `client/src/pages/Root.tsx` — layout is fine
- `client/src/lib/supabase.ts` — client is fine
- `client/src/components/ui/input.tsx` — use as-is
- `client/src/components/ui/label.tsx` — use as-is
- Any backend files — no server-side auth routes needed
- Any existing test files — must all pass as-is

### Project Structure Notes

- `client/src/pages/Login.tsx` already exists as placeholder — replace contents
- Use `../lib/supabase` relative import or `@/lib/supabase` alias (both work)
- File naming: PascalCase for components (matches existing convention)
- Login form is structurally simpler than SignUp (2 fields vs 3, no database trigger)

### References

- [Source: docs/epics.md#Story 6.4] — Full acceptance criteria and technical notes
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-03-26.md] — Story origin and decisions
- [Source: docs/architecture/architecture-client.md] — Frontend component architecture with auth flow
- [Source: docs/stories/6-1-supabase-setup-auth-and-database-schema.md] — Supabase setup, client patterns
- [Source: docs/stories/6-2-react-router-and-app-shell.md] — Router setup, placeholder pages, React Router v7
- [Source: docs/stories/6-3-user-registration-and-signup-page.md] — Signup form patterns (direct template)
- [Source: client/src/lib/supabase.ts] — Nullable Supabase client
- [Source: client/src/pages/Login.tsx] — Current placeholder to replace
- [Source: client/src/routes.tsx] — Route config (/login already mapped)
- [Source: client/src/index.css#line-235] — lava-button CSS class definition
- [Source: client/src/components/ui/input.tsx] — shadcn/ui Input component
- [Source: client/src/components/ui/label.tsx] — shadcn/ui Label component

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debugging needed.

### Completion Notes List

- Replaced placeholder Login.tsx with full login form matching SignUp page design patterns
- Implemented email + password controlled inputs with client-side validation
- Integrated Supabase signInWithPassword with null-client check and generic error messages
- Added "Forgot?" placeholder link and "Sign up" navigation link
- Loading state disables button and shows "Signing in..." during API call
- 14 unit tests covering all ACs: form rendering, validation, auth integration, navigation, error handling
- Full test suite passes (37 files, 1017 tests) — no regressions

### Change Log

- 2026-04-07: Implemented Story 6.4 — Login form with Supabase auth, validation, tests
- 2026-04-07: Code review fixes — 7 issues (2H, 3M, 2L): Figma alignment (label, subtitle, placeholder, Forgot? styling), Forgot? span→button for accessibility, test improvements (element type assertion, negative security assertion, button disambiguation)
- 2026-04-07: Code review 2 fixes — 3M issues: autocomplete attributes on inputs, formError cleared on field edit, negative navigation assertions in failure tests

### File List

- `client/src/pages/Login.tsx` — Modified: replaced placeholder with full login form
- `tests/login.test.tsx` — Created: 14 unit tests for Login component
- `docs/stories/6-4-user-login-and-authentication-page.md` — Modified: task checkboxes, status, dev agent record
- `docs/sprint-status.yaml` — Modified: story status updated
