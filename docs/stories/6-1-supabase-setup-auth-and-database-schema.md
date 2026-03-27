# Story 6.1: Supabase Setup, Auth & Database Schema

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want Supabase configured with database schema and auth,
so that all Epic 6 stories have a data and authentication foundation.

## Acceptance Criteria

1. **Supabase JS installed and clients created**
   - `@supabase/supabase-js` (v2.x) added to project dependencies
   - Frontend client singleton at `client/src/lib/supabase.ts` using `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
   - Backend client singleton at `src/lib/supabase.ts` using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
   - Backend client must NEVER be importable from client code

2. **Environment variables configured**
   - `SUPABASE_URL` added to `.env.example` and `app.config.ts` Zod schema
   - `SUPABASE_ANON_KEY` added to `.env.example` and `app.config.ts` Zod schema
   - `SUPABASE_SERVICE_ROLE_KEY` added to `.env.example` and `app.config.ts` Zod schema (server-only)
   - `VITE_SUPABASE_URL` added to `.env.example` (frontend, exposed via Vite)
   - `VITE_SUPABASE_ANON_KEY` added to `.env.example` (frontend, exposed via Vite)
   - `FEATURE_PLANS_PAGE` added to `app.config.ts` Zod schema as boolean, default `false`
   - All new env vars validated on startup; missing required vars cause process exit

3. **Database schema created via SQL migrations**
   - `profiles` table: `id` (uuid, FK to `auth.users`), `full_name` (text), `email` (text), `default_initials` (text, max 5 chars), `created_at` (timestamptz), `updated_at` (timestamptz)
   - `processing_batches` table: `id` (uuid, PK), `user_id` (uuid, FK to `auth.users`), `session_id` (text), `image_count` (int), `status` (text), `csv_filename` (text), `created_at` (timestamptz), `expires_at` (timestamptz)
   - `usage_tracking` table: `id` (uuid, PK), `user_id` (uuid, FK to `auth.users`), `month_year` (text, e.g. "2026-03"), `images_used` (int, default 0), `updated_at` (timestamptz)
   - Migration SQL files stored in `supabase/migrations/` directory

4. **Supabase Auth configured**
   - Email/password provider enabled
   - JWT expiration set to 7 days
   - Email confirmation disabled for MVP
   - Auth configured via Supabase dashboard (not code)

5. **Row Level Security (RLS) policies active**
   - RLS enabled on `profiles`, `processing_batches`, and `usage_tracking` tables
   - `profiles`: authenticated users can SELECT/UPDATE only their own row (`auth.uid() = id`)
   - `processing_batches`: authenticated users can SELECT/INSERT only their own rows (`auth.uid() = user_id`)
   - `usage_tracking`: authenticated users can SELECT/UPDATE/INSERT only their own rows (`auth.uid() = user_id`)

6. **Feature flag operational**
   - `FEATURE_PLANS_PAGE` defaults to `false` in app config
   - Backend exposes flag value (for future use by other stories)
   - `VITE_FEATURE_PLANS_PAGE` available to frontend via `import.meta.env`

7. **Existing functionality unaffected**
   - All 965+ existing tests pass without modification
   - Upload/processing/results flow works identically
   - No changes to existing routes, services, or components
   - Supabase is purely additive — no existing code rewritten

## Tasks / Subtasks

- [x] Task 1: Install `@supabase/supabase-js` dependency (AC: 1)
  - [x] 1.1 `npm install @supabase/supabase-js`
  - [x] 1.2 Verify package.json updated, lock file regenerated
- [x] Task 2: Create Supabase client singletons (AC: 1)
  - [x] 2.1 Create `client/src/lib/supabase.ts` — frontend client with `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`
  - [x] 2.2 Create `src/lib/supabase.ts` — backend admin client with `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`
  - [x] 2.3 Export typed clients (use `SupabaseClient` type)
- [x] Task 3: Configure environment variables (AC: 2, 6)
  - [x] 3.1 Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to `src/config/app.config.ts` Zod schema (all strings, required in production, optional in test)
  - [x] 3.2 Add `FEATURE_PLANS_PAGE` to Zod schema (boolean, default `false`)
  - [x] 3.3 Update `.env.example` with all new vars (including `VITE_` prefixed frontend vars)
  - [x] 3.4 Verify app starts without Supabase vars in dev/test (graceful skip or mock)
- [x] Task 4: Create database migration SQL files (AC: 3)
  - [x] 4.1 Create `supabase/migrations/` directory
  - [x] 4.2 Write migration for `profiles` table with FK to `auth.users`
  - [x] 4.3 Write migration for `processing_batches` table
  - [x] 4.4 Write migration for `usage_tracking` table
  - [x] 4.5 Add `updated_at` trigger function for auto-updating timestamps
- [x] Task 5: Create RLS policies (AC: 5)
  - [x] 5.1 Enable RLS on all three tables
  - [x] 5.2 Write SELECT/UPDATE policy for `profiles` (own row only)
  - [x] 5.3 Write SELECT/INSERT policy for `processing_batches` (own rows only)
  - [x] 5.4 Write SELECT/UPDATE/INSERT policy for `usage_tracking` (own rows only)
- [x] Task 6: Write tests (AC: 7)
  - [x] 6.1 Unit tests for backend Supabase client creation (mock `createClient`)
  - [x] 6.2 Unit tests for updated app.config.ts Zod schema (new env vars validate correctly)
  - [x] 6.3 Unit tests for feature flag default value
  - [x] 6.4 Verify all existing tests still pass (`npm test`)
- [ ] Task 7: Supabase project setup (AC: 4) — manual step
  - [ ] 7.1 Create Supabase project via dashboard
  - [ ] 7.2 Enable email/password auth provider
  - [ ] 7.3 Set JWT expiration to 7 days
  - [ ] 7.4 Disable email confirmation
  - [ ] 7.5 Run migration SQL in Supabase SQL editor or via CLI
  - [ ] 7.6 Copy project URL and keys to `.env`

## Dev Notes

### Context & Business Value

This is the **foundation story for Epic 6** (User Account System). Every subsequent story (6.2–6.11) depends on the Supabase client, auth configuration, and database schema established here. Getting this right prevents cascading issues across 10 downstream stories.

Key decisions from Sprint Change Proposal 2026-03-26:

- Supabase replaces the originally planned manual PostgreSQL + Prisma + bcrypt + JWT approach
- Supabase provides auth, database, and RLS in one package — eliminates old Story 6.3 (JWT Middleware) entirely
- Feature flag `FEATURE_PLANS_PAGE` gates monetization UI for controlled beta rollout
- Free tier is 500 images/month (updated from 100)

### Architecture Patterns & Constraints

**Singleton pattern for Supabase clients** — follows the existing DI container pattern in `src/config/container.ts`. However, Supabase clients should NOT go into the container. They are simple `createClient()` calls exported as module-level singletons:

- Frontend: `client/src/lib/supabase.ts` — uses `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`
- Backend: `src/lib/supabase.ts` — uses `config.supabase.url` and `config.supabase.serviceRoleKey` from the Zod-validated config

**Zod config extension** — The existing `app.config.ts` uses a Zod schema that validates all env vars on startup and exits on failure. Add a new `supabase` section:

```typescript
supabase: {
  url: z.string().url().optional(),           // Optional for dev/test without Supabase
  anonKey: z.string().optional(),
  serviceRoleKey: z.string().optional(),
}
featureFlags: {
  plansPage: z.boolean().default(false),      // FEATURE_PLANS_PAGE
}
```

**Critical:** Make Supabase vars optional (not required) so existing dev/test workflows don't break. The backend client should check for config presence before initializing.

**RLS is mandatory** — The anon key is exposed in frontend code. Without RLS, any user could read/write any row. Enable RLS on every table and write policies using `auth.uid()` (not the deprecated `auth.role()`).

**Migration files are documentation** — Store SQL in `supabase/migrations/` as timestamped `.sql` files. These serve as the schema source of truth even if initially applied via the Supabase dashboard SQL editor.

### Supabase JS Client — Key API Reference

**Library:** `@supabase/supabase-js` v2.x (latest stable: 2.100.1)

**Client creation:**

```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key);
```

**Auth methods used by downstream stories (for reference only — do NOT implement auth flows in this story):**

- `supabase.auth.signUp({ email, password, options: { data: { full_name } } })` — Story 6.3
- `supabase.auth.signInWithPassword({ email, password })` — Story 6.4
- `supabase.auth.onAuthStateChange((event, session) => {})` — Story 6.5
- `supabase.auth.signOut()` — Story 6.5
- `supabase.auth.getUser()` — backend JWT verification

**Database queries (for reference — used in later stories):**

- `supabase.from('profiles').select().eq('id', userId).single()`
- `supabase.from('processing_batches').select().eq('user_id', userId)`
- `supabase.from('usage_tracking').upsert({ user_id, month_year, images_used })`

### Database Schema Details

**`profiles` table:**

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  default_initials text check (char_length(default_initials) <= 5),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

- `id` is the same UUID as `auth.users.id` — NOT auto-generated, set from auth
- Story 6.3 will create a database trigger: on `auth.users` INSERT → auto-insert into `profiles`

**`processing_batches` table:**

```sql
create table public.processing_batches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  session_id text not null,
  image_count integer not null default 0,
  status text not null default 'completed',
  csv_filename text,
  created_at timestamptz default now() not null,
  expires_at timestamptz default (now() + interval '30 days') not null
);
```

- `session_id` links to existing cookie-based session tracking (backward compat)
- `expires_at` defaults to 30 days (free tier history retention)

**`usage_tracking` table:**

```sql
create table public.usage_tracking (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  month_year text not null,
  images_used integer not null default 0,
  updated_at timestamptz default now() not null,
  unique(user_id, month_year)
);
```

- `month_year` format: `"2026-03"` — simple string comparison, no cron needed for reset
- `unique(user_id, month_year)` enables upsert pattern for incrementing usage

**`updated_at` auto-trigger:**

```sql
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to profiles and usage_tracking
create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();
create trigger usage_tracking_updated_at before update on usage_tracking
  for each row execute function update_updated_at();
```

### RLS Policy Details

```sql
-- Profiles: users can only read/update their own profile
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles
  for select to authenticated using (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Processing batches: users can read/insert their own batches
alter table processing_batches enable row level security;
create policy "Users can view own batches" on processing_batches
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own batches" on processing_batches
  for insert to authenticated with check (auth.uid() = user_id);

-- Usage tracking: users can read/upsert their own usage
alter table usage_tracking enable row level security;
create policy "Users can view own usage" on usage_tracking
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own usage" on usage_tracking
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own usage" on usage_tracking
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### File Structure Requirements

**New files to create:**

```
client/src/lib/supabase.ts          # Frontend Supabase client (anon key)
src/lib/supabase.ts                 # Backend Supabase admin client (service role key)
supabase/migrations/00001_create_profiles.sql
supabase/migrations/00002_create_processing_batches.sql
supabase/migrations/00003_create_usage_tracking.sql
supabase/migrations/00004_create_rls_policies.sql
supabase/migrations/00005_create_updated_at_trigger.sql
```

**Files to modify:**

```
src/config/app.config.ts            # Add supabase + featureFlags to Zod schema
.env.example                        # Add SUPABASE_URL, keys, VITE_ vars, FEATURE_PLANS_PAGE
.gitignore                          # Ensure .env is ignored (already should be)
```

**Do NOT modify:**

- `src/config/container.ts` — Supabase clients are standalone singletons, not DI services
- `server.ts` — No new routes or middleware in this story
- Any `client/src/components/` files — No UI changes in this story
- Any existing test files — Must all pass as-is

### Testing Requirements

**Framework:** Vitest with `globals: true` (no explicit imports for `describe`, `it`, `expect`)

**New test files:**

- `tests/supabase-client.test.ts` — Tests for backend client creation
- `tests/app-config-supabase.test.ts` — Tests for new Zod schema fields

**Mock pattern for Supabase** (follows project convention):

```typescript
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn() },
    from: vi.fn(() => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn() })),
  })),
}));
```

**Config mock pattern** (extend existing):

```typescript
vi.mock('../src/config/app.config', () => ({
  config: {
    // ... existing fields ...
    supabase: {
      url: 'https://test.supabase.co',
      anonKey: 'test-anon',
      serviceRoleKey: 'test-service',
    },
    featureFlags: { plansPage: false },
  },
}));
```

**Test cases to cover:**

1. Backend client exports a valid Supabase client when config is present
2. Backend client handles missing config gracefully (returns null or throws descriptive error)
3. `app.config.ts` validates Supabase URL format (must be valid URL)
4. `app.config.ts` accepts missing Supabase vars (optional for dev)
5. `FEATURE_PLANS_PAGE` defaults to `false` when not set
6. `FEATURE_PLANS_PAGE` parses `"true"` string to boolean `true`
7. All 965+ existing tests still pass (regression check)

**Pre-commit hook:** Husky runs full test suite — all tests must pass before commit.

### Previous Story Intelligence

**From Stories 5.1–5.7 code reviews:**

- Use `useCallback` for handlers passed as props (established pattern)
- Use `useMemo` for derived data
- Use `tabular-nums` for numeric displays
- Toast notifications via Sonner (bottom-right, richColors, 5s duration) — already wired up in Story 5.7
- Error boundary wraps the app (Story 5.7) — new pages will inherit this

**Current frontend entry point** (`client/src/main.tsx`):

```typescript
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

Story 6.2 will wrap this with `RouterProvider` and `AuthProvider` — this story just creates the Supabase client they'll use.

### Git Intelligence

Recent commits follow `ASU-{description}` format. Latest: `751773d ASU-Complete Story 5.7 error handling and toast notifications with code review fixes`. Build has 1811 modules, 965 tests across 30 files.

**Current dependencies (48 production):** No Supabase yet. Adding `@supabase/supabase-js` is the only new dependency for this story.

### Anti-Patterns to Avoid

- **Do NOT add Supabase to the DI container** — it's a client library, not a business service
- **Do NOT create auth routes or middleware** — that's Stories 6.3–6.5
- **Do NOT modify any existing components** — this is infrastructure only
- **Do NOT make Supabase env vars required** — existing dev/test must work without them
- **Do NOT use `auth.role()` in RLS policies** — it's deprecated; use `TO authenticated` role clause
- **Do NOT use `service_role` key on the frontend** — security violation
- **Do NOT install Supabase CLI** — migrations are stored as SQL files, applied via dashboard or CLI externally

### Project Structure Notes

- `client/src/lib/` directory is NEW — create it for the frontend Supabase client
- `src/lib/` directory is NEW — create it for the backend Supabase admin client
- `supabase/migrations/` directory is NEW — stores SQL migration files as source of truth
- The `lib/` naming convention separates third-party client wrappers from business logic (`services/`)
- Existing path aliases (`@/*` → `src/*`) do not cover `lib/` — backend client should use relative import or add `@lib/*` alias

### References

- [Source: docs/epics.md#Story 6.1] — Full acceptance criteria and technical notes
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-03-26.md#Section 4.1] — Story origin and key decisions
- [Source: docs/architecture/architecture-client.md] — Frontend component architecture
- [Source: docs/architecture/architecture-api.md] — Backend layered architecture
- [Source: src/config/app.config.ts] — Current Zod env schema (extend, don't replace)
- [Source: src/config/container.ts] — DI container pattern (do NOT add Supabase here)
- [Source: .env.example] — Current env var template
- [Source: @supabase/supabase-js v2.100.1 docs] — createClient, Auth, RLS APIs

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No debug issues encountered. All implementations were straightforward.

### Completion Notes List

- Story context created 2026-03-27 — comprehensive developer guide with full schema SQL, RLS policies, and anti-pattern guardrails
- Ultimate context engine analysis completed — all artifacts analyzed (epics, architecture, PRD, sprint change proposal, 5 previous stories, 15 recent commits, Supabase JS v2.100.1 docs)
- Implementation completed 2026-03-27 — Tasks 1-6 done, Task 7 is manual (Supabase dashboard setup)
- `@supabase/supabase-js` v2.100.1 installed as sole new dependency
- Frontend client (`client/src/lib/supabase.ts`) exports `supabase` (nullable) using VITE\_ env vars
- Backend admin client (`src/lib/supabase.ts`) exports `supabaseAdmin` (nullable) using service role key from Zod config
- Both clients gracefully return `null` when env vars are not configured (dev/test safe)
- Zod schema extended with optional `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `FEATURE_PLANS_PAGE` (string→boolean transform)
- 5 SQL migration files created in `supabase/migrations/` covering all 3 tables, RLS policies, and updated_at triggers
- 11 new tests added (3 Supabase client + 8 config schema), all 976 tests pass (965 existing + 11 new)
- **Note:** `.env.example` update was blocked by file permissions — Alex needs to add Supabase vars manually
- Code review fixes applied 2026-03-27: `envSchema` exported for testability, test rewritten to use real schema instead of duplicated copy, `FEATURE_PLANS_PAGE` now case-insensitive, Supabase key min-length validation added, `processing_batches.user_id` index added, 3 new test cases (979 total passing)

### File List

**New files:**

- `client/src/lib/supabase.ts`
- `src/lib/supabase.ts`
- `supabase/migrations/00001_create_profiles.sql`
- `supabase/migrations/00002_create_processing_batches.sql`
- `supabase/migrations/00003_create_usage_tracking.sql`
- `supabase/migrations/00004_create_rls_policies.sql`
- `supabase/migrations/00005_create_updated_at_trigger.sql`
- `tests/supabase-client.test.ts`
- `tests/app-config-supabase.test.ts`
- `tests/supabase-client-frontend.test.ts`

**Modified files:**

- `src/config/app.config.ts`
- `package.json` / `package-lock.json`

**Manually updated by Alex:**

- `.env.example` — Supabase vars and feature flags added
- `.env` — configured with project credentials

**Pre-existing working tree changes (Sprint Change Proposal 2026-03-26, not part of this story):**

- `.gitignore` — added `references/` to ignore list
- `docs/PRD.md` — updated free tier (100→500), Supabase replaces PostgreSQL
- `docs/architecture/architecture-client.md` — added Router + Supabase sections for Epic 6
- `docs/epics.md` — Epic 6 restructured per sprint change proposal
- `docs/sprint-status.yaml` — sprint planning refresh, Epic 6 story statuses added
- `docs/planning-artifacts/correct-course-context-2026-03-26.md` — sprint correction context
- `docs/planning-artifacts/sprint-change-proposal-2026-03-26.md` — sprint change proposal

## Change Log

- 2026-03-27: Implemented Tasks 1-6 — Supabase JS installed, clients created, env config extended, SQL migrations written, RLS policies defined, 11 tests added (976 total passing)
- 2026-03-27: Code review fixes — exported envSchema, tests use real schema, case-insensitive feature flag, min-length Supabase key validation, processing_batches user_id index, unstaged unrelated .gitignore change (979 tests passing)
- 2026-03-27: Code review 2 fixes — UNIQUE constraint on profiles.email, CHECK constraint on processing_batches.status, RLS enabled in table migrations (not just 00004), frontend client tests added (3 tests), vitest explicit imports removed, .env.example trailing whitespace fixed + feature flag sync comment, undocumented git changes noted in File List (982 tests passing)
