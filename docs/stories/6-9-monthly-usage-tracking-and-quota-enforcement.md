# Story 6.9: Monthly Usage Tracking & Quota Enforcement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a free-tier user,
I want to see how many images I've used this month,
so that I know my remaining quota before processing a batch.

## Acceptance Criteria

1. **Metadata generation requires authentication**
   - `POST /api/process-batch-v2`: if no valid JWT in Authorization header → return 401 `{ message: "Sign up or log in to generate metadata" }`
   - `POST /api/upload-images`: anonymous uploads still allowed (users can preview images before signing up)
   - Frontend: "Generate & Export CSV" button shows auth prompt when user is not logged in
   - Clicking the auth prompt navigates to `/signup` (or `/login` if returning user)

2. **Usage tracking increments after successful batch completion**
   - After each batch completes, upsert `usage_tracking` row: increment `images_used` by the number of successfully processed images
   - Upsert pattern: INSERT if no row for `(user_id, current_month_year)`, UPDATE (increment) if row exists
   - `month_year` format: `"2026-04"` (YYYY-MM string)
   - Non-fatal: if Supabase upsert fails, log warning and continue (batch still works)

3. **Quota check before batch processing (server-side)**
   - In `POST /api/process-batch-v2`, after auth verification:
     - Query `usage_tracking` for current month usage
     - If `images_used + fileIds.length > FREE_TIER_LIMIT` (500): return 429 with `{ message: "You've used all 500 free images this month. Try again next month.", used, limit, remaining }`
   - Quota check is server-side only (can't trust client)

4. **GET /api/usage endpoint (protected)**
   - New endpoint requiring Supabase auth (JWT in Authorization header)
   - Returns: `{ tier: "free", monthlyLimit: 500, used: number, remaining: number, resetsAt: "2026-05-01" }`
   - If no usage row for current month, return `used: 0, remaining: 500`
   - If no valid JWT: return 401 `{ message: "Authentication required" }`

5. **Usage display on upload page (authenticated users)**
   - When logged in, show usage text near the "Generate & Export CSV" button: "37 of 500 images used this month"
   - Fetch usage from `GET /api/usage` on mount (when user is authenticated)
   - Update displayed count after each batch completes
   - When quota exceeded: disable "Generate & Export CSV" button, show: "You've used all 500 free images this month. Try again next month."
   - When `FEATURE_PLANS_PAGE=true` and quota exceeded: append link "See our plans for more images" → `/plans`
   - When `FEATURE_PLANS_PAGE=false`: no plans link, just the quota message

6. **Auth gate on Generate button (anonymous users)**
   - When not logged in, replace "Generate & Export CSV" with "Sign Up to Generate" (lava-button style, links to `/signup`)
   - Show subtle text below: "Free account required to generate metadata"
   - Upload, drag-drop, image preview, initials input all remain functional without auth

7. **FREE_TIER_LIMIT config updated to 500**
   - Update `app.config.ts`: `FREE_TIER_LIMIT` default from 100 → 500
   - Update client error message in `client.ts` `categorizeHttpError` 429 handler to reflect 500

8. **Remove anonymous session-based processing limits**
   - Anonymous users can no longer process batches, so the anonymous session rate limit on `process-batch-v2` is no longer needed
   - Keep anonymous upload rate limit (10 per session) to prevent upload abuse
   - Remove or skip `sessionUploadLimitMiddleware` on the batch processing endpoint

9. **Existing functionality unaffected**
   - All existing tests pass (1083+, with updates for new auth requirement)
   - Login, Signup, Header, AccountLayout, AccountProfile, History all work as before
   - Session-based batch tracking and CSV download unchanged for authenticated users

## Tasks / Subtasks

- [x] Task 1: Update FREE_TIER_LIMIT config and client error message (AC: 7)
  - [x] 1.1 Update `src/config/app.config.ts`: change `FREE_TIER_LIMIT` default from 100 → 500
  - [x] 1.2 Update `client/src/api/client.ts`: change 429 error message in `categorizeHttpError` from "100 images/month" → "500 images/month"

- [x] Task 2: Create UsageTrackingService (AC: 2, 3, 4)
  - [x] 2.1 Create `src/services/usage-tracking.service.ts` with class `UsageTrackingService`
  - [x] 2.2 Implement `getUsage(userId: string): Promise<{ used: number, limit: number, remaining: number, resetsAt: string }>` — query `usage_tracking` for current `month_year`, return 0 if no row
  - [x] 2.3 Implement `incrementUsage(userId: string, imageCount: number): Promise<void>` — upsert `usage_tracking` row, increment `images_used` by `imageCount`; wrap in try/catch, log warning on failure, never throw
  - [x] 2.4 Implement `checkQuota(userId: string, requestedCount: number): Promise<{ allowed: boolean, used: number, limit: number, remaining: number }>` — check if `images_used + requestedCount <= FREE_TIER_LIMIT`
  - [x] 2.5 Helper: `getCurrentMonthYear(): string` — returns `"2026-04"` format
  - [x] 2.6 Helper: `getResetDate(): string` — returns first day of next month as ISO string
  - [x] 2.7 Use `supabaseAdmin` from `src/lib/supabase.ts` (service role, bypasses RLS)
  - [x] 2.8 Use `config.rateLimits.freeTier` for the limit value (not hardcoded 500)

- [x] Task 3: Register UsageTrackingService in DI container (AC: 3, 4)
  - [x] 3.1 Import and instantiate `UsageTrackingService` in `src/config/container.ts`
  - [x] 3.2 Export as `services.usageTracking`

- [x] Task 4: Create GET /api/usage endpoint (AC: 4)
  - [x] 4.1 Create `src/api/routes/usage.routes.ts` with Express Router
  - [x] 4.2 `GET /api/usage`: extract userId via `extractUserId(req)`; if null → return 401 `{ message: "Authentication required" }`
  - [x] 4.3 Call `services.usageTracking.getUsage(userId)` and return `{ tier: "free", monthlyLimit, used, remaining, resetsAt }`
  - [x] 4.4 Mount route in `src/server.ts`: `app.use('/api', usageRoutes)`

- [x] Task 5: Require auth and add quota enforcement to batch processing (AC: 1, 3, 8)
  - [x] 5.1 In `POST /api/process-batch-v2` (`batch.routes.ts`), change `extractUserId(req)` from optional to required:
    - If `userId` is null → return 401 `{ message: "Sign up or log in to generate metadata" }`
  - [x] 5.2 After auth check, call `services.usageTracking.checkQuota(userId, fileIds.length)`
    - If `!allowed`: throw `RateLimitError` with message "You've used all {limit} free images this month. Try again next month." and include `{ used, limit, remaining }` in response
  - [x] 5.3 Remove the `userId: userId ?? undefined` fallback — `userId` is now always a string

- [x] Task 6: Increment usage after batch completion (AC: 2)
  - [x] 6.1 In `batch-tracking.service.ts` `completeBatch()`, after Supabase persistence block:
    - `batch.userId` is always set (since auth is now required); call `usageTrackingService.incrementUsage(batch.userId, successfulCount)` via setter injection
  - [x] 6.2 Non-fatal: wrap in try/catch, log warning on failure

- [x] Task 7: Auth gate on Generate button + usage display (AC: 5, 6)
  - [x] 7.1 Add `UsageResponse` type to `client/src/types/index.ts`: `{ tier: string, monthlyLimit: number, used: number, remaining: number, resetsAt: string }`
  - [x] 7.2 Add `getUsage()` function to `client/src/api/client.ts`: `GET /api/usage` with auth headers
  - [x] 7.3 In `Home.tsx`, import `useAuth` from `../contexts/AuthContext`
  - [x] 7.4 Add state: `usage: UsageResponse | null`, fetch on mount when user is authenticated
  - [x] 7.5 Refetch usage after batch completes (after CSV download)
  - [x] 7.6 **Authenticated + under quota**: show "37 of 500 images used this month" as muted text above buttons, "Generate & Export CSV" button works normally
  - [x] 7.7 **Authenticated + quota exceeded**: disable "Generate & Export CSV" button, show "You've used all 500 free images this month. Try again next month."
  - [x] 7.8 When `FEATURE_PLANS_PAGE=true` and quota exceeded: append link "See our plans for more images" → `/plans`
  - [x] 7.9 **Not authenticated**: replace "Generate & Export CSV" with "Sign Up to Generate" lava-button linking to `/signup`; show "Free account required to generate metadata" below
  - [x] 7.10 Use `Link` from `react-router` (NOT `react-router-dom`)
  - [x] 7.11 Upload, drag-drop, image preview, initials input remain functional without auth

- [x] Task 8: Clean up anonymous processing limits (AC: 8)
  - [x] 8.1 In `upload.routes.ts`: keep the existing `extractUserId(req)` check that bypasses anonymous rate limit for authenticated users — anonymous users can still upload (preview only)
  - [x] 8.2 Verify `POST /api/upload-images` still works without auth (for the preview experience)
  - [x] 8.3 Update or remove the `sessionUploadLimitMiddleware` check on `process-batch-v2` if it exists (anonymous users can't reach this endpoint anymore)

- [x] Task 9: Write tests (AC: 9)
  - [x] 9.1 Create `tests/usage-tracking.service.test.ts` — UsageTrackingService unit tests
  - [x] 9.2 Test: `getUsage` returns usage data for current month
  - [x] 9.3 Test: `getUsage` returns 0 used when no row exists
  - [x] 9.4 Test: `checkQuota` returns allowed=true when under limit
  - [x] 9.5 Test: `checkQuota` returns allowed=false when over limit
  - [x] 9.6 Test: `incrementUsage` upserts usage row
  - [x] 9.7 Test: `incrementUsage` logs warning on Supabase failure (non-fatal)
  - [x] 9.8 Test: `getCurrentMonthYear` returns correct format
  - [x] 9.9 Create `tests/usage.routes.test.ts` — GET /api/usage endpoint tests
  - [x] 9.10 Test: Returns usage data for authenticated user
  - [x] 9.11 Test: Returns 401 when no JWT provided
  - [x] 9.12 Test: Returns 0 used when no usage row exists
  - [x] 9.13 Update `tests/batch.routes.test.ts` — add auth requirement + quota enforcement tests
  - [x] 9.14 Test: Batch processing returns 401 when no JWT (anonymous blocked)
  - [x] 9.15 Test: Batch processing blocked when quota exceeded (429)
  - [x] 9.16 Test: Batch processing allowed when authenticated and quota available
  - [x] 9.17 Verify all existing tests still pass (`npm test`) — update any tests that assumed anonymous batch processing

## Dev Notes

### Context & Business Value

This story transitions the app from an open anonymous tool to an account-gated product. Previously, anyone could process up to 10 images per session without signing up. Now:

1. **Metadata generation requires authentication** — anonymous users can still upload/preview images but must sign up to generate metadata
2. **Monthly usage tracking** — each authenticated user gets 500 images/month, tracked in `usage_tracking` table
3. **Server-side quota enforcement** — prevents abuse, can't be circumvented by clearing cookies
4. **Usage visibility** — users see their remaining quota before generating

This eliminates the cookie-based abuse vector (delete cookies → unlimited free processing) and creates a natural conversion funnel: try the upload UX → sign up to generate.

### Architecture Patterns & Constraints

**Auth Middleware — extractUserId (Already Exists):**

```typescript
import { extractUserId } from '../middleware/auth.middleware';
// Returns string | null — non-throwing
// Uses supabaseAdmin.auth.getUser(token) for JWT verification
const userId = await extractUserId(req);
```

Exists at `src/api/middleware/auth.middleware.ts` (Story 6.8). For this story, the batch endpoint changes from optional auth to **required** auth — return 401 when `userId` is null.

**Supabase Admin Client — Server-Side Operations:**

```typescript
import { supabaseAdmin } from '../../lib/supabase';
// supabaseAdmin is SupabaseClient | null (null when env vars missing)
// Uses SUPABASE_SERVICE_ROLE_KEY — bypasses RLS
```

At `src/lib/supabase.ts`. The UsageTrackingService must handle `supabaseAdmin === null` gracefully (return defaults, log warnings).

**Supabase PromiseLike Gotcha (Bug 4 from Story 6.8):**

Supabase client returns `PromiseLike` (not full `Promise`), which lacks `.catch()`. Wrap Supabase calls in `Promise.resolve()` for proper chain:

```typescript
await Promise.resolve(
  supabaseAdmin.from('usage_tracking').upsert({ ... })
).catch(err => logger.warn({ err }, 'Usage tracking upsert failed'));
```

**Usage Tracking Table (Supabase PostgreSQL):**

```sql
-- supabase/migrations/00003_create_usage_tracking.sql
create table public.usage_tracking (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  month_year text not null,
  images_used integer not null default 0,
  updated_at timestamptz default now() not null,
  unique(user_id, month_year)
);
```

RLS policies (00004): users can SELECT, INSERT, UPDATE their own rows. Backend uses `supabaseAdmin` (service role) which bypasses RLS.

**Upsert Pattern for Usage Increment:**

```typescript
// Supabase upsert — increment images_used for current month
// onConflict triggers UPDATE when (user_id, month_year) already exists
const { error } = await supabaseAdmin
  .from('usage_tracking')
  .upsert(
    {
      user_id: userId,
      month_year: currentMonth,
      images_used: newCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,month_year' }
  );
```

Note: Supabase upsert doesn't support atomic `images_used = images_used + N`. You must first SELECT current count, then upsert with the new total. Use the service role client for both operations in a sequential call.

**DI Container Pattern:**

```typescript
// src/config/container.ts — register alongside existing services
import { UsageTrackingService } from '@services/usage-tracking.service';
// Instantiate after supabaseAdmin is available
const usageTracking = new UsageTrackingService();
export const services = { ..., usageTracking };
```

**Config — FREE_TIER_LIMIT:**

```typescript
// src/config/app.config.ts
FREE_TIER_LIMIT: z.coerce.number().default(500), // Changed from 100
// Access: config.rateLimits.freeTier
```

**Frontend Auth Context:**

```typescript
import { useAuth } from '../contexts/AuthContext';
const { user } = useAuth();
// user is null for anonymous, { id, email, ... } for authenticated
```

**Toast Notifications (Sonner):**

```typescript
import { toast } from 'sonner';
toast.error("You've used all 500 free images this month. Try again next month.");
```

**CRITICAL:** Import from `'react-router'` NOT `'react-router-dom'`. React Router v7.

**Batch Processing Flow (Where Hooks Go):**

```
POST /api/process-batch-v2 (batch.routes.ts)
  → extractUserId(req) — REQUIRED now (return 401 if null)
  → NEW: services.usageTracking.checkQuota(userId, fileIds.length)
    → If !allowed → throw RateLimitError (429)
  → batchTrackingService.createBatch({ sessionId, files, userId })
  → processFilesAsync() (background)
    → completeBatch(batch) (batch-tracking.service.ts)
      → persistenceService.persistBatch(batch) — existing SQLite
      → Supabase processing_batches INSERT — existing (Story 6.8)
      → NEW: services.usageTracking.incrementUsage(batch.userId, successfulCount)
```

**Home.tsx Generate Button Location (lines 324-342):**

The "Generate & Export CSV" button is at `Home.tsx:326`. For anonymous users, replace this button with a "Sign Up to Generate" link-button to `/signup`. The adjacent "Clear" button remains unchanged.

### Anti-Patterns to Avoid

- **Do NOT hardcode 500** — use `config.rateLimits.freeTier` everywhere
- **Do NOT trust client-side quota checks** — always enforce server-side in `process-batch-v2`
- **Do NOT import from `'react-router-dom'`** — use `'react-router'` (React Router v7)
- **Do NOT modify AccountLayout** — sidebar is complete from Story 6.6
- **Do NOT modify AppHeader** — header is complete from Story 6.5
- **Do NOT modify AuthContext or AuthProvider** — they work correctly from Story 6.5
- **Do NOT modify the frontend Supabase client** (`client/src/lib/supabase.ts`)
- **Do NOT modify shadcn/ui components** in `client/src/components/ui/`
- **Do NOT modify supabase migrations** — schema is complete, no new migrations needed
- **Do NOT make usage increment blocking** — always non-fatal, wrap in try/catch
- **Do NOT use a cron job for quota reset** — checking `month_year` field handles it naturally
- **Do NOT create a full Express middleware for auth on batch endpoint** — reuse existing `extractUserId()` inline, just change the null-handling from "continue anonymous" to "return 401"
- **Do NOT break anonymous uploads** — `POST /api/upload-images` must still work without auth (for preview UX)
- **Do NOT use `NavLink`** — use `Link` + `useLocation()` if routing needed (project convention)

### Testing Requirements

**Framework:** Vitest with `globals: true` (no explicit imports for `describe`, `it`, `expect`)

**New test files:**

- `tests/usage-tracking.service.test.ts` — UsageTrackingService unit tests
- `tests/usage.routes.test.ts` — GET /api/usage endpoint tests

**Updated test files:**

- `tests/batch.routes.test.ts` — add auth-required + quota tests

**UsageTrackingService test mock patterns:**

```typescript
// Mock supabaseAdmin
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockUpsert = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  get supabaseAdmin() {
    return {
      from: mockFrom,
    };
  },
}));

// Mock config
vi.mock('../src/config/app.config', () => ({
  config: {
    rateLimits: { freeTier: 500 },
  },
}));
```

**Usage route test patterns (follow `tests/auth-middleware.test.ts`):**

```typescript
// Mock extractUserId
vi.mock('../src/api/middleware/auth.middleware', () => ({
  extractUserId: vi.fn(),
}));

// Mock services.usageTracking
vi.mock('../src/config/container', () => ({
  services: {
    usageTracking: {
      getUsage: vi.fn(),
    },
  },
}));
```

**Batch routes test updates:**

Existing tests in `tests/batch.routes.test.ts` assume anonymous batch processing works. Update these:

- Tests that don't provide auth headers: expect 401 instead of 200
- Add new tests: auth + quota exceeded → 429, auth + quota ok → 200
- Keep the mock for `extractUserId` but change default behavior

**Key test scenarios:**

UsageTrackingService (7 tests):

1. `getUsage` returns data for current month
2. `getUsage` returns 0 when no row exists
3. `checkQuota` allowed when under limit
4. `checkQuota` denied when over limit
5. `incrementUsage` upserts row
6. `incrementUsage` non-fatal on failure
7. `getCurrentMonthYear` correct format

Usage route (3 tests):

1. Returns usage for authenticated user
2. Returns 401 when no JWT
3. Returns 0 used when no row

Batch route updates (3 new tests):

1. Returns 401 when no JWT (anonymous blocked)
2. Returns 429 when quota exceeded
3. Allows processing when authenticated + quota available

**Pre-commit hook:** Husky runs full test suite — all tests must pass.

### Previous Story Intelligence

**From Story 6.8 (Processing History — direct predecessor):**

- `extractUserId()` already exists in `auth.middleware.ts` and is already called in `batch.routes.ts` line 129
- `batch.userId` field already exists on `BatchState` (added in 6.8)
- `completeBatch()` already has a Supabase persistence block — add usage increment after it
- Frontend `authHeaders()` already sends JWT on `uploadImages()` and `startBatchProcessing()`
- Bug 5 from 6.8: authenticated users were blocked by anonymous 10-image rate limit — fixed by adding `extractUserId` check to upload route. This story changes the batch endpoint from optional to required auth.
- Bug 4 from 6.8: Supabase returns `PromiseLike` not `Promise` — wrap in `Promise.resolve()` for `.catch()`
- Total tests at end of 6.8: 42 files, 1083 tests passing

**From Story 6.7 (Account Profile):**

- Supabase query pattern: `.from('table').select().eq('id', user.id).single()`
- Toast patterns: `toast.success()` / `toast.error()` from sonner
- Null supabase client handling: check before calling, show error toast

**From Story 6.5 (Header Navigation):**

- `useAuth()` hook provides `{ user, session, isLoading, signOut }`
- `VITE_FEATURE_PLANS_PAGE` env var for feature flag checks on frontend

### Git Intelligence

Recent commits show Story 6.8 was the last implementation:

```
46fa4d6 ASU-Implement Story 6.8 processing history and CSV re-download with code review fixes
766c9f3 ASU-Implement Story 6.7 account profile and settings page
ae43eb9 ASU-Implement Story 6.6 account layout sidebar routing with code review fixes
```

**Patterns from recent work:**

- Commit format: `ASU-{description}`
- Page components in `client/src/pages/`
- Test files in project root `tests/` directory
- Service files in `src/services/`
- Route files in `src/api/routes/`

### Project Structure Notes

**New files to create:**

```
src/services/usage-tracking.service.ts    # UsageTrackingService
src/api/routes/usage.routes.ts            # GET /api/usage endpoint
tests/usage-tracking.service.test.ts      # Service unit tests
tests/usage.routes.test.ts                # Route endpoint tests
```

**Files to modify:**

```
src/config/app.config.ts                  # FREE_TIER_LIMIT 100 → 500
src/config/container.ts                   # Register UsageTrackingService
src/server.ts                             # Mount usage routes
src/api/routes/batch.routes.ts            # Auth required + quota check
src/services/batch-tracking.service.ts    # Increment usage on completion
client/src/api/client.ts                  # getUsage() function, update 429 msg
client/src/types/index.ts                 # UsageResponse type
client/src/pages/Home.tsx                 # Auth gate + usage display
tests/batch.routes.test.ts               # Update for auth requirement
```

**Do NOT modify:**

- `client/src/contexts/AuthContext.tsx` — works correctly from Story 6.5
- `client/src/components/AppHeader.tsx` — header is complete
- `client/src/pages/AccountLayout.tsx` — sidebar complete from Story 6.6
- `client/src/pages/AccountProfile.tsx` — profile complete from Story 6.7
- `client/src/pages/History.tsx` — history complete from Story 6.8
- `client/src/pages/Root.tsx` — app shell is complete
- `client/src/lib/supabase.ts` — frontend client setup is correct
- `client/src/routes.tsx` — routing is correct
- `client/src/components/ui/*` — shadcn/ui components, never modify
- `src/lib/supabase.ts` — backend admin client is correct
- `src/api/middleware/auth.middleware.ts` — extractUserId works as-is
- `src/services/batch-persistence.service.ts` — SQLite persistence, leave as-is
- `supabase/migrations/*` — schema is complete, no new migrations needed

### References

- [Source: docs/epics.md#Story 6.9] — Full acceptance criteria, prerequisites, technical notes
- [Source: docs/epics.md#Epic 6 Key Decisions] — 500 images/month free tier, FEATURE_PLANS_PAGE flag
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-03-26.md] — Epic 6 restructure, Supabase adoption
- [Source: docs/stories/6-8-processing-history-and-csv-re-download.md] — Predecessor: auth middleware, Supabase patterns, PromiseLike bug, test patterns
- [Source: docs/stories/6-7-account-profile-and-settings.md] — Supabase query patterns, toast patterns
- [Source: supabase/migrations/00003_create_usage_tracking.sql] — usage_tracking table schema
- [Source: supabase/migrations/00004_create_rls_policies.sql] — RLS policies for usage data
- [Source: src/api/middleware/auth.middleware.ts] — extractUserId helper (JWT verification)
- [Source: src/api/routes/batch.routes.ts] — Batch processing endpoint (line 129: extractUserId)
- [Source: src/api/routes/upload.routes.ts] — Upload endpoint (anonymous still allowed)
- [Source: src/services/batch-tracking.service.ts] — completeBatch() where usage increment hooks
- [Source: src/config/app.config.ts] — FREE_TIER_LIMIT (currently 100, change to 500)
- [Source: src/config/container.ts] — DI container for service registration
- [Source: src/lib/supabase.ts] — Backend Supabase admin client (service role)
- [Source: client/src/pages/Home.tsx] — Upload page, Generate button at line 326
- [Source: client/src/api/client.ts] — API client with authHeaders(), categorizeHttpError
- [Source: client/src/types/index.ts] — Frontend type definitions
- [Source: client/src/contexts/AuthContext.tsx] — AuthProvider with useAuth hook

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixed circular dependency: Used setter injection pattern (`setUsageTrackingService`) in `BatchTrackingService` instead of importing `services` from container (which caused container initialization in tests)
- Updated `container.test.ts` mock to include `config.supabase` and `supabaseAdmin` for `UsageTrackingService` dependency chain
- Updated `batch.routes.test.ts` to add `usageTracking` mock to services container and auth handling for tests that reach past validation

### Completion Notes List

- Task 1: Updated FREE_TIER_LIMIT from 100 to 500, updated client 429 error message
- Task 2: Created UsageTrackingService with getUsage, checkQuota, incrementUsage, getCurrentMonthYear, getResetDate. Uses supabaseAdmin with PromiseLike pattern. Non-fatal increment with try/catch
- Task 3: Registered UsageTrackingService in DI container as services.usageTracking
- Task 4: Created GET /api/usage endpoint with JWT auth requirement, mounted in server.ts
- Task 5: Made batch processing require auth (401), added quota enforcement (429 via RateLimitError), removed userId fallback
- Task 6: Added usage increment in completeBatch() via setter-injected UsageTrackingService, non-fatal with try/catch
- Task 7: Added auth gate on Generate button (Sign Up to Generate for anonymous), usage display for authenticated users, quota exceeded state, FEATURE_PLANS_PAGE link support
- Task 8: No code changes needed — sessionUploadLimitMiddleware was never on process-batch-v2. Anonymous uploads still work. Auth gate on batch endpoint handles the restriction.
- Task 9: Created 16 new tests (11 UsageTrackingService, 3 usage routes, 2 batch routes auth/quota). Updated 3 existing test files. All 1099 tests pass (44 files).

### File List

New files:

- src/services/usage-tracking.service.ts
- src/api/routes/usage.routes.ts
- tests/usage-tracking.service.test.ts
- tests/usage.routes.test.ts

Modified files:

- src/config/app.config.ts (FREE_TIER_LIMIT 100 → 500)
- src/config/container.ts (register UsageTrackingService)
- src/api/routes/batch.routes.ts (auth required, quota enforcement)
- src/services/batch-tracking.service.ts (usage increment in completeBatch)
- server.ts (mount usage routes, wire UsageTrackingService)
- client/src/api/client.ts (getUsage function, 429 message update)
- client/src/types/index.ts (UsageResponse type)
- client/src/pages/Home.tsx (auth gate, usage display)
- tests/batch.routes.test.ts (auth/quota tests, usageTracking mock)
- tests/container.test.ts (supabase mock, usageTracking in expected services)
- tests/batch-tracking.service.test.ts (no changes needed — passes with setter pattern)
- docs/sprint-status.yaml (status: in-progress → review)

### Change Log

- 2026-04-11: Implemented Story 6.9 — Monthly usage tracking and quota enforcement. Auth-gated batch processing, 500 images/month free tier, server-side quota enforcement, usage display on upload page. 44 test files, 1099 tests passing.
- 2026-04-11: Code review — 7 issues found (1H, 3M, 3L), 4 fixed automatically. (1) Fixed client 429 handler to pass through server error message instead of hardcoded "Create an account" text. (2) Fixed missing await on incrementUsage in completeBatch — changed to fire-and-forget `.catch()` pattern. (3) Updated stale `freeTier: 100` mock in batch.routes.test.ts to 500. (4) Added logging for Supabase query failures in getUsage. (5) Added race condition documentation comment on read-then-write increment pattern. LOW issues noted: auth-after-validation ordering, fail-open during outages.
- 2026-04-12: Code review #2 — 7 issues found (1H, 3M, 3L), 4 fixed automatically + 1 test improved. (H1) Fixed inconsistent 401 response format: batch.routes.ts and usage.routes.ts now throw AuthenticationError instead of inline res.status(401).json(), producing standard `{ success: false, error: { code, message } }` format; updated client categorizeHttpError to extract error.message from structured responses. (M1) Fixed false PGRST116 warning: getUsage now skips warning for Supabase "no rows found" code. (M2) Added logging in getUsage outer catch block. (M3) Added usageTracking service availability test in container.test.ts. (L1) Updated test mock to reflect real Supabase .single() PGRST116 behavior. LOW issues noted: UsageResponse.tier type looseness, auth-after-validation ordering. 44 files, 1100 tests passing.
