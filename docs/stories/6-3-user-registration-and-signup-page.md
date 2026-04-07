# Story 6.3: User Registration & Signup Page

Status: done

## Story

As a new user,
I want to create an account with my name, email, and password,
so that I can process 500 images/month and save my history.

## Acceptance Criteria

1. **Signup form with required fields**
   - Full Name input (required)
   - Email input (validated — client-side format check before submission)
   - Password input (minimum 8 characters)
   - "Create Account" button using `lava-button` CSS class (animated gradient CTA)
   - Link to login: "Already have an account? Sign in" navigating to `/login`

2. **Client-side validation with inline errors**
   - Show inline errors below each field (NOT `alert()` dialogs)
   - Full Name: required, cannot be empty/whitespace
   - Email: valid email format checked before submission
   - Password: minimum 8 characters
   - Errors clear when user corrects the field
   - Submit button disabled during form submission (loading state)

3. **Supabase Auth signup integration**
   - Call `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
   - `full_name` stored in `auth.users.raw_user_meta_data`
   - Show server-side errors from Supabase inline (e.g., "Email already registered")
   - Handle null Supabase client gracefully (show error toast if Supabase not configured)

4. **Profile creation on signup**
   - SQL database trigger: on `auth.users` INSERT, auto-insert into `public.profiles`:
     - `id` = new user's UUID
     - `full_name` from `raw_user_meta_data`
     - `email` from `auth.users.email`
     - `default_initials` auto-generated from full name (e.g., "Alex Smith" -> "AS")
   - Migration file added to `supabase/migrations/`

5. **Post-signup behavior**
   - User session established automatically (Supabase handles JWT)
   - Redirect to `/` (home/upload page) after successful signup
   - No email confirmation required (disabled in Supabase project per Story 6.1)

6. **Visual design matches project design system**
   - Centered card layout on grain texture background (Root provides background)
   - Use existing shadcn/ui `Input` and `Label` components
   - Use `lava-button` CSS class for CTA button
   - Consistent typography with existing placeholder pages

7. **Existing functionality unaffected**
   - All 990+ existing tests pass without modification
   - Upload/processing/results flow works identically
   - No changes to existing routes, services, or backend code (except new migration)

## Tasks / Subtasks

- [x] Task 1: Create signup form component (AC: 1, 2, 6)
  - [x] 1.1 Replace placeholder in `client/src/pages/SignUp.tsx` with full signup form
  - [x] 1.2 Add controlled inputs: fullName, email, password with `useState`
  - [x] 1.3 Add inline error state and display below each field
  - [x] 1.4 Add client-side validation (name required, email format, password min 8)
  - [x] 1.5 Style with centered card layout, shadcn/ui `Input`/`Label`, `lava-button` CTA
  - [x] 1.6 Add "Already have an account? Sign in" link using React Router `Link` to `/login`

- [x] Task 2: Implement Supabase signup integration (AC: 3, 5)
  - [x] 2.1 Import `supabase` from `@/lib/supabase` (nullable client)
  - [x] 2.2 On form submit: validate fields, then call `supabase.auth.signUp()`
  - [x] 2.3 Handle null supabase client — show toast error "Authentication service unavailable"
  - [x] 2.4 Handle Supabase errors — display inline below form (e.g., "User already registered")
  - [x] 2.5 On success: use React Router `useNavigate()` to redirect to `/`
  - [x] 2.6 Add loading state: disable button and show "Creating account..." during API call

- [x] Task 3: Create database trigger migration (AC: 4)
  - [x] 3.1 Create `supabase/migrations/00006_create_profile_on_signup_trigger.sql`
  - [x] 3.2 Write trigger function `handle_new_user()` that:
    - Extracts `full_name` from `new.raw_user_meta_data`
    - Generates `default_initials` from first letters of name parts (max 5 chars)
    - Inserts into `public.profiles` with id, full_name, email, default_initials
  - [x] 3.3 Create trigger `on_auth_user_created` on `auth.users` AFTER INSERT

- [x] Task 4: Write tests (AC: 7)
  - [x] 4.1 Unit test: SignUp component renders form with all required fields
  - [x] 4.2 Unit test: Client-side validation shows inline errors for invalid input
  - [x] 4.3 Unit test: Successful signup calls supabase.auth.signUp with correct params
  - [x] 4.4 Unit test: Handles null supabase client gracefully
  - [x] 4.5 Unit test: Displays server-side error messages from Supabase
  - [x] 4.6 Unit test: Redirects to `/` on successful signup
  - [x] 4.7 Verify all existing 990+ tests still pass (`npm test`)

## Dev Notes

### Context & Business Value

This is the **first auth UI story** in Epic 6. It builds on Story 6.1 (Supabase setup) and Story 6.2 (React Router with `/signup` route). The signup form replaces the current "Coming soon" placeholder at `client/src/pages/SignUp.tsx`. Story 6.4 (Login) depends on this story so test accounts can be created.

Key decisions from Sprint Change Proposal 2026-03-26:

- Supabase Auth handles signup, password hashing, JWT, and session management
- No confirm password field (simpler UX per Figma design)
- No React Hook Form — simple controlled inputs are sufficient
- No email confirmation for MVP (configured in Supabase dashboard)
- Free tier: 500 images/month

### Architecture Patterns & Constraints

**Supabase Client — Nullable Pattern:**
The frontend Supabase client (`client/src/lib/supabase.ts`) is nullable — it returns `null` when env vars are not configured. The signup form MUST check for null before calling auth methods.

```typescript
import { supabase } from '../lib/supabase';

// MUST check for null
if (!supabase) {
  toast.error('Authentication service unavailable');
  return;
}

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: fullName } },
});
```

**Supabase signUp Response:**

```typescript
// Success: data.user is populated, data.session is populated (no email confirmation)
// Error: error.message contains human-readable error (e.g., "User already registered")
const { data, error } = await supabase.auth.signUp({ email, password, options });
if (error) {
  setFormError(error.message);
  return;
}
// data.user exists, data.session exists — user is logged in
navigate('/');
```

**React Router v7 Navigation:**

```typescript
import { useNavigate, Link } from 'react-router'; // v7 import pattern (NOT react-router-dom)

const navigate = useNavigate();
// After successful signup:
navigate('/');
```

**CRITICAL:** This project uses React Router v7. Imports are from `'react-router'` NOT `'react-router-dom'`. See `client/src/routes.tsx` for the established pattern.

**Toast Notifications:**

```typescript
import { toast } from 'sonner';
// For errors not tied to a specific field:
toast.error('Authentication service unavailable');
```

Toaster is rendered once in `Root.tsx` — no need to add it in SignUp.

### Signup Form Layout Pattern

Centered card layout matching existing design system. Reference the existing placeholder styling in `SignUp.tsx` and `Login.tsx` for outer container pattern.

```tsx
<div className="flex-1 flex items-center justify-center px-4">
  <div className="w-full max-w-sm space-y-6">
    <div className="text-center space-y-2">
      <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(1.5rem,3vw,2rem)] leading-[1.1]">
        Create Account
      </h1>
      <p className="opacity-40 tracking-[-0.01em] text-[0.9rem]">
        Process up to 500 images/month for free
      </p>
    </div>

    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input id="fullName" type="text" placeholder="Alex Smith" ... />
        {errors.fullName && <p className="text-sm text-red-500">{errors.fullName}</p>}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="alex@example.com" ... />
        {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="Min. 8 characters" ... />
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
        <span>{isSubmitting ? 'Creating account...' : 'Create Account'}</span>
      </button>
    </form>

    <p className="text-center text-sm opacity-60">
      Already have an account?{' '}
      <Link to="/login" className="underline hover:opacity-80">Sign in</Link>
    </p>
  </div>
</div>
```

### Database Trigger — Profile Auto-Creation

**File:** `supabase/migrations/00006_create_profile_on_signup_trigger.sql`

```sql
-- Trigger function: auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  name_parts text[];
  initials text;
begin
  -- Extract full_name from user metadata
  name_parts := string_to_array(
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    ' '
  );

  -- Generate initials from first letter of each name part (max 5)
  initials := '';
  for i in 1..least(array_length(name_parts, 1), 5) loop
    initials := initials || upper(left(name_parts[i], 1));
  end loop;

  insert into public.profiles (id, full_name, email, default_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    initials
  );
  return new;
end;
$$;

-- Trigger: fires after a new user is created in auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**CRITICAL:** The trigger uses `security definer` and `set search_path = ''` to safely access `auth.users` from a function that writes to `public.profiles`. This is the Supabase-recommended pattern. Use fully qualified table names (`public.profiles`) inside the function.

### Existing Migration Files

```
supabase/migrations/
  00001_create_profiles.sql
  00002_create_processing_batches.sql
  00003_create_usage_tracking.sql
  00004_create_rls_policies.sql
  00005_create_updated_at_trigger.sql
  00006_create_profile_on_signup_trigger.sql  ← NEW (this story)
```

### Client-Side Validation Logic

```typescript
function validateForm(): boolean {
  const newErrors: { fullName?: string; email?: string; password?: string } = {};

  if (!fullName.trim()) {
    newErrors.fullName = 'Full name is required';
  }

  if (!email.trim()) {
    newErrors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    newErrors.email = 'Please enter a valid email address';
  }

  if (!password) {
    newErrors.password = 'Password is required';
  } else if (password.length < 8) {
    newErrors.password = 'Password must be at least 8 characters';
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}
```

### Testing Requirements

**Framework:** Vitest with `globals: true` (no explicit imports for `describe`, `it`, `expect`)

**New test file:** `tests/signup.test.tsx`

**Mock patterns:**

```typescript
// Mock Supabase client
vi.mock('../client/src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
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

1. Renders form with Full Name, Email, Password fields and Create Account button
2. Shows "Full name is required" error when submitting empty name
3. Shows "Please enter a valid email address" for invalid email
4. Shows "Password must be at least 8 characters" for short password
5. Calls `supabase.auth.signUp` with correct parameters on valid submission
6. Shows Supabase error message inline when signup fails
7. Navigates to `/` on successful signup
8. Shows toast error when supabase client is null
9. Disables submit button during API call (loading state)

**Rendering test pattern** (React Router v7 compatible):

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SignUp } from '../client/src/pages/SignUp';

// Wrap component in MemoryRouter for Link/useNavigate
render(
  <MemoryRouter>
    <SignUp />
  </MemoryRouter>
);
```

**Pre-commit hook:** Husky runs full test suite — all tests must pass before commit.

### Previous Story Intelligence

**From Story 6.2 (React Router):**

- React Router v7 installed (`react-router` v7.13.2) — use `'react-router'` imports
- Routes configured in `client/src/routes.tsx` — `/signup` already mapped to `SignUp` component
- Root layout provides grain background, header, footer, Toaster — SignUp only renders form content
- Placeholder pages use `flex-1 flex items-center justify-center` outer container
- 990 tests passing after Story 6.2

**From Story 6.1 (Supabase):**

- Frontend Supabase client is nullable: `export const supabase: SupabaseClient | null`
- Located at `client/src/lib/supabase.ts`
- Auth methods: `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
- Profiles table exists with columns: id, full_name, email, default_initials, created_at, updated_at
- RLS policies exist — authenticated users can only access their own rows
- Migration files numbered 00001–00005 in `supabase/migrations/`

### Anti-Patterns to Avoid

- **Do NOT create AuthProvider or useAuth** — that's Story 6.5
- **Do NOT add ProtectedRoute** — that's Story 6.6
- **Do NOT modify AppHeader** — auth-aware nav is Story 6.5
- **Do NOT use React Hook Form** — simple controlled inputs are sufficient for 3 fields
- **Do NOT add email confirmation flow** — disabled for MVP
- **Do NOT add "Confirm Password" field** — Figma omits it
- **Do NOT import from `'react-router-dom'`** — use `'react-router'` (v7 pattern)
- **Do NOT add Toaster component** — already rendered in Root.tsx
- **Do NOT modify routes.tsx** — `/signup` route already exists
- **Do NOT create backend auth routes** — Supabase SDK handles auth directly from frontend
- **Do NOT store passwords** — Supabase handles hashing automatically
- **Do NOT modify shadcn/ui components** — use them as-is from `client/src/components/ui/`

### File Structure Requirements

**New files to create:**

```
supabase/migrations/00006_create_profile_on_signup_trigger.sql  # Profile auto-creation trigger
tests/signup.test.tsx                                            # SignUp component tests
```

**Files to modify:**

```
client/src/pages/SignUp.tsx    # Replace placeholder with full signup form
```

**Do NOT modify:**

- `client/src/routes.tsx` — `/signup` route already exists
- `client/src/pages/Root.tsx` — layout is fine
- `client/src/lib/supabase.ts` — client is fine
- `client/src/components/ui/input.tsx` — use as-is
- `client/src/components/ui/label.tsx` — use as-is
- Any backend files — no server-side auth routes needed
- Any existing test files — must all pass as-is

### Project Structure Notes

- `client/src/pages/SignUp.tsx` already exists as placeholder — replace contents
- `supabase/migrations/` directory already exists with 00001–00005
- Use `@/lib/supabase` import alias or relative `../lib/supabase` (both work)
- File naming: PascalCase for components (matches existing convention)

### References

- [Source: docs/epics.md#Story 6.3] — Full acceptance criteria and technical notes
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-03-26.md] — Story origin and decisions
- [Source: docs/architecture/architecture-client.md] — Frontend component architecture with auth flow
- [Source: docs/stories/6-1-supabase-setup-auth-and-database-schema.md] — Supabase setup, client patterns
- [Source: docs/stories/6-2-react-router-and-app-shell.md] — Router setup, placeholder pages, React Router v7
- [Source: client/src/lib/supabase.ts] — Nullable Supabase client
- [Source: client/src/pages/SignUp.tsx] — Current placeholder to replace
- [Source: client/src/routes.tsx] — Route config (/signup already mapped)
- [Source: client/src/index.css#line-235] — lava-button CSS class definition
- [Source: client/src/components/ui/input.tsx] — shadcn/ui Input component
- [Source: client/src/components/ui/label.tsx] — shadcn/ui Label component
- [Source: supabase/migrations/00001-00005] — Existing migration files

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- Code review performed 2026-03-29: 7 issues found (2 High, 3 Medium, 2 Low), all fixed
- Code review 2 performed 2026-03-30: 7 issues found (2 High, 3 Medium, 2 Low), all fixed

### Completion Notes List

- All 7 ACs implemented and verified
- 1002 tests passing (990 existing + 12 new signup tests)
- Code review 1 fixes: added aria accessibility attributes to form inputs, hardened SQL trigger for empty names, improved test reliability with try/finally pattern
- Code review 2 fixes: added catch block for network errors, added noValidate for consistent inline validation UX, added network error test, replaced toBeTruthy with toBeInTheDocument, improved null supabase mock pattern

### File List

- `client/src/pages/SignUp.tsx` — Replaced placeholder with full signup form (controlled inputs, validation, Supabase auth, accessibility)
- `supabase/migrations/00006_create_profile_on_signup_trigger.sql` — New: profile auto-creation trigger on auth.users INSERT
- `tests/signup.test.tsx` — New: 12 unit tests for SignUp component (rendering, validation, auth, navigation, loading state, network errors)
- `package.json` — Added devDependencies: @testing-library/jest-dom, @testing-library/react, jsdom
- `package-lock.json` — Lock file updated for new devDependencies
- `docs/sprint-status.yaml` — Updated story status to done
