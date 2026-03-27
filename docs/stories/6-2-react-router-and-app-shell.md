# Story 6.2: React Router & App Shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want client-side routing with React Router,
so that the app can navigate between pages without full page reloads.

## Acceptance Criteria

1. **`react-router-dom` installed**
   - `react-router-dom` (v6.x or v7.x — latest stable) added to project dependencies
   - No other routing libraries introduced

2. **`createBrowserRouter` configured in `client/src/routes.tsx`**
   - `/` → Home (existing upload page — current `app.tsx` content)
   - `/login` → Login page (placeholder, built in Story 6.4)
   - `/signup` → Signup page (placeholder, built in Story 6.3)
   - `/plans` → Plans page (placeholder, built in Story 6.10)
   - `/account` → Account layout with nested routes (placeholder, built in Story 6.6):
     - `/account` → Profile (index route)
     - `/account/history` → History
     - `/account/billing` → Billing

3. **Root layout component created (`client/src/pages/Root.tsx`)**
   - Fixed header (existing `AppHeader` component)
   - `<Outlet />` for page content
   - Fixed footer (existing `AppFooter` component)
   - `<Toaster />` rendered once in Root (moved from App)
   - Grain background and gradient applied at Root level

4. **Existing App component refactored**
   - Current upload/processing/results flow moves into `client/src/pages/Home.tsx`
   - `DropZone` component moves to its own file `client/src/components/DropZone.tsx`
   - `App.tsx` becomes a thin `RouterProvider` wrapper (renders `<ErrorBoundary><RouterProvider router={router} /></ErrorBoundary>`)
   - All existing functionality preserved — upload flow works identically at `/`

5. **Placeholder pages created**
   - Each placeholder returns centered "Coming soon" text matching existing design system
   - Placeholder files: `Login.tsx`, `SignUp.tsx`, `Plans.tsx`, `AccountLayout.tsx`, `AccountProfile.tsx`, `History.tsx`, `Billing.tsx`
   - All in `client/src/pages/` directory

6. **SPA fallback verified**
   - Vite dev server: default SPA behavior (no config change needed — proxy for `/api` and `/temp` already configured)
   - Express production server: existing `GET *` fallback at `server.ts:438` already serves `index.html` for non-API routes — verify it handles `/login`, `/account/history` etc. correctly

7. **Existing functionality unaffected**
   - All 982+ existing tests pass without modification
   - Upload/processing/results flow works identically at `/`
   - No changes to existing API routes, services, or backend code
   - AppHeader and AppFooter render identically (visual regression check)
   - DropZone drag-and-drop still works after extraction to own file

## Tasks / Subtasks

- [x] Task 1: Install `react-router-dom` dependency (AC: 1)
  - [x] 1.1 `npm install react-router-dom`
  - [x] 1.2 Verify package.json updated, lock file regenerated

- [x] Task 2: Extract DropZone to its own component (AC: 4)
  - [x] 2.1 Create `client/src/components/DropZone.tsx` — move `DropZone` function from `app.tsx`
  - [x] 2.2 Export as named export, preserve exact same props interface and behavior
  - [x] 2.3 Update import in what will become `Home.tsx`

- [x] Task 3: Create Home page component (AC: 4)
  - [x] 3.1 Create `client/src/pages/Home.tsx`
  - [x] 3.2 Move ALL upload/processing/results state and logic from current `App` function
  - [x] 3.3 Move the JSX render (DropZone wrapper, hero, view routing, initials input, action buttons)
  - [x] 3.4 Keep `DndProvider` wrapping inside Home (Home owns drag-and-drop context)
  - [x] 3.5 Remove `AppHeader`, `AppFooter`, `Toaster`, grain background from Home (Root handles these)
  - [x] 3.6 Verify all imports resolve correctly

- [x] Task 4: Create Root layout component (AC: 3)
  - [x] 4.1 Create `client/src/pages/Root.tsx`
  - [x] 4.2 Render `AppHeader` at top
  - [x] 4.3 Render `<Outlet />` for routed page content
  - [x] 4.4 Render `AppFooter` at bottom
  - [x] 4.5 Render `<Toaster position="bottom-right" richColors closeButton duration={5000} />` once
  - [x] 4.6 Apply `grain` class and background gradient at Root level (`min-h-screen bg-gradient-to-br from-[#fafafa] via-[#f5f5f5] to-[#efefef]`)

- [x] Task 5: Create placeholder page components (AC: 5)
  - [x] 5.1 Create `client/src/pages/Login.tsx` — "Coming soon" placeholder
  - [x] 5.2 Create `client/src/pages/SignUp.tsx` — "Coming soon" placeholder
  - [x] 5.3 Create `client/src/pages/Plans.tsx` — "Coming soon" placeholder
  - [x] 5.4 Create `client/src/pages/AccountLayout.tsx` — "Coming soon" with `<Outlet />`
  - [x] 5.5 Create `client/src/pages/AccountProfile.tsx` — "Coming soon" placeholder
  - [x] 5.6 Create `client/src/pages/History.tsx` — "Coming soon" placeholder
  - [x] 5.7 Create `client/src/pages/Billing.tsx` — "Coming soon" placeholder

- [x] Task 6: Create router configuration (AC: 2)
  - [x] 6.1 Create `client/src/routes.tsx`
  - [x] 6.2 Define `createBrowserRouter` with route tree matching Figma reference structure
  - [x] 6.3 Export `router` for use in App

- [x] Task 7: Refactor App.tsx to RouterProvider wrapper (AC: 4)
  - [x] 7.1 Replace entire App component body with `<RouterProvider router={router} />`
  - [x] 7.2 Keep `ErrorBoundary` wrapping in `main.tsx` (already exists)
  - [x] 7.3 Remove all upload/processing state and logic from App (now in Home)
  - [x] 7.4 Remove AppHeader, AppFooter, Toaster, DndProvider imports (now in Root/Home)

- [x] Task 8: Write tests (AC: 7)
  - [x] 8.1 Unit test for route configuration — verify all expected routes exist
  - [x] 8.2 Unit test for Root layout — renders header, outlet, footer
  - [x] 8.3 Verify all existing 982+ tests still pass (`npm test`)

- [x] Task 9: Verify SPA fallback (AC: 6)
  - [x] 9.1 Verify Express `GET *` handler serves index.html for `/login`, `/signup`, `/plans`, `/account`, `/account/history`
  - [x] 9.2 Verify Vite dev server handles client-side routes correctly
  - [x] 9.3 Verify `/api/*` routes still proxy correctly in dev

## Dev Notes

### Context & Business Value

This is the **routing foundation for Epic 6** (User Account System). Every subsequent page story (6.3–6.11) depends on the router and layout structure established here. The existing upload flow must continue to work identically at `/` — this story is purely additive infrastructure.

Key decisions from Sprint Change Proposal 2026-03-26:

- React Router v6+ with `createBrowserRouter` (modern data router API)
- Root layout pattern: header + `<Outlet />` + footer
- Existing `app.tsx` content moves to `Home.tsx` — zero functional change
- Placeholder pages for all future routes (populated in Stories 6.3–6.11)

### Architecture Patterns & Constraints

**React Router v6/v7 — Modern API:**

```typescript
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: 'login', Component: Login },
      { path: 'signup', Component: SignUp },
      { path: 'plans', Component: Plans },
      {
        path: 'account',
        Component: AccountLayout,
        children: [
          { index: true, Component: AccountProfile },
          { path: 'history', Component: History },
          { path: 'billing', Component: Billing },
        ],
      },
    ],
  },
]);
```

**Important:** The Figma reference (`references/Elegant Minimalist Web App (1)/src/routes.ts`) imports from `"react-router"` not `"react-router-dom"`. This is the React Router v7 import pattern. Check the installed version — if v7, use `"react-router"` imports; if v6, use `"react-router-dom"`.

**Root Layout Component Pattern:**

```typescript
import { Outlet } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { AppFooter } from '../components/AppFooter';
import { Toaster } from '../components/ui/sonner';

export function Root() {
  return (
    <div className="grain min-h-screen bg-gradient-to-br from-[#fafafa] via-[#f5f5f5] to-[#efefef]">
      <AppHeader />
      <main>
        <Outlet />
      </main>
      <AppFooter />
      <Toaster position="bottom-right" richColors closeButton duration={5000} />
    </div>
  );
}
```

**Refactored App.tsx — Thin Wrapper:**

```typescript
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';

function App() {
  return <RouterProvider router={router} />;
}

export default App;
```

**main.tsx remains unchanged** — ErrorBoundary wraps App:

```typescript
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

### Critical: Home Component Extraction

The current `client/src/app.tsx` (366 lines) contains:

1. **DropZone component** (lines 20–69) — extract to `client/src/components/DropZone.tsx`
2. **App function** (lines 72–366) — rename to `Home`, move to `client/src/pages/Home.tsx`

**What moves to Home.tsx:**

- All `useState` hooks: `images`, `initials`, `isDragging`, `view`, `isProcessing`, `batchStatus`, `validationErrors`, `processingDuration`, `isUploading`
- All `useRef` hooks: `fileInputRef`, `validationTimerRef`
- All `useEffect` hooks (cleanup on mount)
- All handler functions: `handleFileSelect`, `handleFileInputChange`, `handleSelectImagesClick`, `handleGenerateMetadata`, `handleClear`, `handleDragEnter`, `handleDragLeave`, `handleImageDelete`, `handleProcessingComplete`, `handleBackToUpload`, `handleDownloadCsv`
- The `DndProvider` wrapper
- The JSX: DropZone → hero section → view routing (upload/processing/results)
- All existing imports (UploadView, ProcessingView, ResultsView, etc.)

**What moves to Root.tsx:**

- `AppHeader` component
- `AppFooter` component
- `Toaster` component
- `grain` CSS class and background gradient div

**What Home.tsx does NOT include:**

- `AppHeader` — Root renders it
- `AppFooter` — Root renders it
- `Toaster` — Root renders it
- `grain` background — Root applies it
- The outermost `<div className="grain min-h-screen bg-gradient-to-br...">` wrapper — Root handles this

### Placeholder Page Pattern

All placeholder pages should match the design system. Minimal example:

```typescript
export function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center pt-20 pb-32">
      <div className="text-center space-y-2">
        <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(1.5rem,3vw,2rem)] leading-[1.1]">
          Login
        </h1>
        <p className="opacity-40 tracking-[-0.01em] text-[0.9rem]">
          Coming soon
        </p>
      </div>
    </div>
  );
}
```

**AccountLayout placeholder** is special — it needs `<Outlet />` for nested routes:

```typescript
import { Outlet } from 'react-router-dom';

export function AccountLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center pt-20 pb-32">
      <div className="text-center space-y-2">
        <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(1.5rem,3vw,2rem)] leading-[1.1]">
          Account
        </h1>
        <p className="opacity-40 tracking-[-0.01em] text-[0.9rem]">
          Coming soon
        </p>
        <Outlet />
      </div>
    </div>
  );
}
```

### SPA Fallback — Already Configured

**Express (production):** `server.ts:438-442` already handles SPA fallback:

```typescript
app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/metrics')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});
```

This correctly serves `index.html` for `/login`, `/account/history`, etc. **No changes needed.**

**Vite (dev):** Vite's dev server handles SPA fallback by default — navigating to `/login` will serve `index.html` and React Router handles the route. The proxy config for `/api` and `/temp` is already in `vite.config.ts`. **No changes needed.**

### Figma Reference Analysis

**`references/Elegant Minimalist Web App (1)/src/routes.ts`** defines the exact route structure:

- Root → Home (index), Login, SignUp, Plans, Account (with nested Profile, History, Billing)
- Uses `Component` prop (React Router v7 pattern) — if we install v6, use `element` instead

**`references/Elegant Minimalist Web App (1)/src/Root.tsx`** shows the layout:

- Fixed header with logo and nav links (Link components)
- `<Outlet />` for content
- Fixed footer
- Note: Figma Root shows all nav links including auth — Story 6.2 keeps the current AppHeader (auth-aware header is Story 6.5)

**`references/Elegant Minimalist Web App (1)/src/Home.tsx`** is the Figma's version of the upload page — our production `Home.tsx` will be the moved content from `app.tsx`, NOT the Figma version (Figma Home is a simplified prototype).

### File Structure Requirements

**New files to create:**

```
client/src/routes.tsx                    # Router configuration (createBrowserRouter)
client/src/pages/Root.tsx                # Root layout (header + Outlet + footer)
client/src/pages/Home.tsx                # Upload flow (moved from app.tsx)
client/src/pages/Login.tsx               # Placeholder
client/src/pages/SignUp.tsx              # Placeholder
client/src/pages/Plans.tsx               # Placeholder
client/src/pages/AccountLayout.tsx       # Placeholder with Outlet
client/src/pages/AccountProfile.tsx      # Placeholder
client/src/pages/History.tsx             # Placeholder
client/src/pages/Billing.tsx             # Placeholder
client/src/components/DropZone.tsx       # Extracted from app.tsx
```

**Files to modify:**

```
client/src/app.tsx                       # Gut to thin RouterProvider wrapper
package.json / package-lock.json         # react-router-dom dependency added
```

**Do NOT modify:**

- `client/src/main.tsx` — ErrorBoundary wrapping stays as-is
- `client/src/components/AppHeader.tsx` — Nav changes are Story 6.5
- `client/src/components/AppFooter.tsx` — No changes needed
- `client/src/components/UploadView.tsx` — No changes
- `client/src/components/ProcessingView.tsx` — No changes
- `client/src/components/ResultsView.tsx` — No changes
- `client/src/api/client.ts` — No changes
- `client/src/utils/csv.ts` — No changes
- `server.ts` — SPA fallback already works
- Any backend files — This is purely frontend routing
- Any existing test files — Must all pass as-is

### Testing Requirements

**Framework:** Vitest with `globals: true` (no explicit imports for `describe`, `it`, `expect`)

**New test files:**

- `tests/routes.test.ts` — Tests for route configuration
- `tests/root-layout.test.ts` — Tests for Root component rendering (optional — simple component)

**Key test scenarios:**

1. Router has correct number of routes (9 total: /, /login, /signup, /plans, /account, /account (index), /account/history, /account/billing)
2. Home component renders at `/` with upload flow
3. Root layout renders header and footer
4. All 982+ existing tests still pass (regression check)

**Mock pattern for react-router-dom:**

```typescript
vi.mock('react-router-dom', () => ({
  createBrowserRouter: vi.fn(),
  RouterProvider: vi.fn(({ children }) => children),
  Outlet: vi.fn(() => null),
  Link: vi.fn(({ children, to }) => <a href={to}>{children}</a>),
  NavLink: vi.fn(({ children, to }) => <a href={to}>{children}</a>),
}));
```

**Pre-commit hook:** Husky runs full test suite — all tests must pass before commit.

### Previous Story Intelligence

**From Story 6.1 implementation:**

- `client/src/lib/supabase.ts` exists — exports nullable `supabase` client
- `src/lib/supabase.ts` exists — exports nullable `supabaseAdmin` client
- Supabase vars are optional — dev/test works without them
- `FEATURE_PLANS_PAGE` defaults to `false` — no env change needed for Story 6.2
- 982 tests currently passing (979 from code review + 3 from second code review)
- Story 6.1 created `client/src/lib/` directory — `pages/` directory is NEW

**From Stories 5.1–5.7 code reviews:**

- `useCallback` for handlers passed as props (already done in app.tsx)
- `useMemo` for derived data
- Toast notifications via Sonner (bottom-right, richColors, 5s duration) — Toaster moves to Root
- Error boundary wraps the app in `main.tsx` — stays in place, wraps RouterProvider

**Current frontend entry point (`client/src/main.tsx`):**

```typescript
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

This stays unchanged. `App` becomes `RouterProvider` wrapper — ErrorBoundary still catches rendering errors.

### Git Intelligence

Recent commits follow `ASU-{description}` format. Latest: `1a00a68 ASU-Complete Story 6.1 Supabase setup auth and database schema with code review fixes`. Build has 1811 modules, 982 tests across 30+ files.

**Current dependencies:** `@supabase/supabase-js` added in 6.1. Adding `react-router-dom` is the only new dependency for this story.

### Anti-Patterns to Avoid

- **Do NOT modify AppHeader or AppFooter** — nav changes are Story 6.5
- **Do NOT create AuthProvider or useAuth** — that's Story 6.5
- **Do NOT add ProtectedRoute** — that's Story 6.6
- **Do NOT implement actual login/signup forms** — those are Stories 6.3–6.4
- **Do NOT use react-router-dom `<BrowserRouter>`** — use `createBrowserRouter` + `RouterProvider` (modern data router API)
- **Do NOT change the Figma Home.tsx** — our Home.tsx is the production code from app.tsx, not the Figma prototype
- **Do NOT add route loaders or actions** — simple route config only, data fetching patterns come in later stories
- **Do NOT modify server.ts** — SPA fallback already works correctly
- **Do NOT break the DndProvider context** — it must wrap the upload flow in Home, not Root (drag-and-drop is upload-specific)
- **Do NOT leave dead imports in app.tsx** — clean removal of all moved code
- **Do NOT put pages in `components/` directory** — use `pages/` for route-level components

### Project Structure Notes

- `client/src/pages/` directory is NEW — create it for all route-level page components
- `client/src/components/DropZone.tsx` is NEW — extracted from app.tsx for cleaner separation
- Convention: `pages/` = route-level components, `components/` = reusable UI components
- The `@` path alias (`@/`) resolves to `client/src/` — imports like `@/pages/Home` will work
- File naming: PascalCase for components (matches existing convention in `components/`)

### References

- [Source: docs/epics.md#Story 6.2] — Full acceptance criteria and technical notes
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-03-26.md#Section 4.2] — Story origin and key decisions
- [Source: docs/architecture/architecture-client.md] — Frontend component architecture with Router tree
- [Source: references/Elegant Minimalist Web App (1)/src/routes.ts] — Figma route configuration
- [Source: references/Elegant Minimalist Web App (1)/src/Root.tsx] — Figma root layout
- [Source: references/Elegant Minimalist Web App (1)/src/Home.tsx] — Figma home page (prototype only)
- [Source: client/src/app.tsx] — Current app component to be refactored (366 lines)
- [Source: client/src/main.tsx] — Entry point (unchanged)
- [Source: client/src/components/AppHeader.tsx] — Existing header (unchanged)
- [Source: client/src/components/AppFooter.tsx] — Existing footer (unchanged)
- [Source: server.ts:438-442] — Express SPA fallback (already working)
- [Source: vite.config.ts] — Vite config with proxy (no changes needed)
- [Source: docs/stories/6-1-supabase-setup-auth-and-database-schema.md] — Previous story context

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation with no debugging needed.

### Completion Notes List

- Installed `react-router-dom` v7.13.2 (React Router v7); using `react-router` import pattern per v7 convention
- Extracted `DropZone` component from `app.tsx` to `client/src/components/DropZone.tsx` — identical behavior, named export
- Created `Home.tsx` page with all upload/processing/results state and logic moved from `App` function
- Created `Root.tsx` layout with `AppHeader`, `<Outlet />`, `AppFooter`, `Toaster`, and grain/gradient background
- Created 7 placeholder pages: `Login`, `SignUp`, `Plans`, `AccountLayout` (with `<Outlet />`), `AccountProfile`, `History`, `Billing`
- Created `routes.tsx` with `createBrowserRouter` defining all routes per AC: `/`, `/login`, `/signup`, `/plans`, `/account` (nested: profile index, `/history`, `/billing`)
- Refactored `app.tsx` to thin `RouterProvider` wrapper (from 366 lines to 9 lines)
- `main.tsx` unchanged — `ErrorBoundary` still wraps `App`
- No backend changes — SPA fallback at `server.ts:438` already handles all client routes
- Vite dev server SPA fallback works by default — proxy for `/api` and `/temp` unchanged
- Build succeeds: 1831 modules (up from 1811)
- All 987 tests pass (982 existing + 5 new route tests, zero regressions)

### Implementation Plan

Tasks executed in story order (1→9). No TDD red phase needed for Tasks 1-7 (structural refactoring). Route tests written in Task 8 and validated against route configuration. Full regression suite run to confirm zero breakage.

### File List

**New files:**

- `client/src/components/DropZone.tsx` — Extracted DropZone component
- `client/src/pages/Root.tsx` — Root layout (header + Outlet + footer + Toaster)
- `client/src/pages/Home.tsx` — Upload flow (moved from app.tsx)
- `client/src/pages/Login.tsx` — Placeholder
- `client/src/pages/SignUp.tsx` — Placeholder
- `client/src/pages/Plans.tsx` — Placeholder
- `client/src/pages/AccountLayout.tsx` — Placeholder with Outlet
- `client/src/pages/AccountProfile.tsx` — Placeholder
- `client/src/pages/History.tsx` — Placeholder
- `client/src/pages/Billing.tsx` — Placeholder
- `client/src/pages/ErrorPage.tsx` — Route error boundary component (code review fix)
- `client/src/routes.tsx` — Router configuration (createBrowserRouter)
- `tests/routes.test.ts` — Route configuration tests (5 tests)
- `tests/root-layout.test.ts` — Root layout rendering tests (3 tests, code review fix)

**Modified files:**

- `client/src/app.tsx` — Gutted to thin RouterProvider wrapper
- `package.json` — Added react-router-dom dependency
- `package-lock.json` — Lock file updated
- `docs/sprint-status.yaml` — Story status updated
- `docs/architecture/architecture-client.md` — Updated React Router version refs (code review fix)
- `vitest.config.ts` — Added esbuild JSX automatic transform (code review fix)

### Change Log

- 2026-03-27: Story 6.2 implemented — React Router v7, app shell with Root layout, Home page extraction, 7 placeholder pages, 5 new route tests (987 total passing)
- 2026-03-27: Code review fixes — 7 issues found (1H, 3M, 3L), all fixed: added Root layout tests (H1), fixed placeholder/Root flex layout (M1/M2), added route ErrorBoundary (L1), updated stale architecture doc versions (M3). 990 tests passing.
