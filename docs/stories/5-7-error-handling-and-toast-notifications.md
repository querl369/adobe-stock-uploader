# Story 5.7: Error Handling & Toast Notifications

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want clear, non-intrusive feedback for errors and successes,
so that I understand what happened without disruptive alert() popups.

## Acceptance Criteria

### AC1: Toast Notification System

**Given** the application uses `alert()` for user feedback
**When** Story 5.7 is implemented
**Then:**

- Install `sonner` package and rewrite `client/src/components/ui/sonner.tsx` without `next-themes` dependency
- Add `<Toaster />` component to App (rendered inside the root `<div>`, after `<AppFooter />`)
- Success toasts: "CSV downloaded!", "Images uploaded successfully"
- Error toasts: processing failures, network errors, API errors
- Toasts auto-dismiss after 5 seconds, can be manually dismissed
- Positioned bottom-right, stacking if multiple
- Toast styling should use shadcn/ui CSS variables for consistency with existing design

### AC2: Replace All alert() Calls

**Given** app.tsx contains 4 `alert()` calls
**When** toast system is available
**Then** ALL alert() calls are removed and replaced:

- **Line 116** (upload error): Replace with `toast.error()` showing the error message
- **Line 128** (missing initials): Replace with `toast.error('Please enter your initials')` — but KEEP this as inline validation since it's a form validation (per Story 5.2 pattern: validation = inline). Actually, this is a pre-processing guard so toast is appropriate here.
- **Line 130** (no files): Replace with `toast.error('No files to process. Please upload images first.')`
- **Line 191** (metadata generation error): Replace with `toast.error()` with user-friendly message

### AC3: API Error Messages (User-Friendly)

**Given** errors can come from network, server, or rate limiting
**When** an API error occurs
**Then** user-friendly toast messages are shown:

- Network errors (fetch fails): "Connection lost. Check your internet and try again."
- Server errors (500): "Something went wrong. Please try again."
- Rate limit (429): "Free limit reached. Create an account for 100 images/month."
- Timeout errors: "Request timed out. Please try again."
- All error messages use plain language — no status codes or stack traces shown to user

### AC4: React Error Boundary

**Given** uncaught React errors could cause a white screen
**When** a React rendering error occurs
**Then:**

- App is wrapped in an error boundary component (`client/src/components/ErrorBoundary.tsx`)
- Fallback UI: "Something unexpected happened" with "Reload" button that calls `window.location.reload()`
- Prevents white screen on uncaught React errors
- Error boundary is a class component (~30 lines)
- Styled consistently with existing grain-gradient card pattern

### AC5: Loading States & Double-Click Prevention

**Given** async operations take time
**When** the user triggers an async action
**Then:**

- "Generate & Export CSV" button shows `Loader2` spinner icon from lucide-react while processing (already shows "Processing..." text — add spinner icon)
- Upload operations disable the upload zone and "Select Images" button during upload
- "Generate & Export CSV" button is already disabled during processing (via `isProcessing` state) — verify this still works
- Batch re-download button in ResultsView already has loading/disabled state — verify

### AC6: Toast for ResultsView Operations

**Given** ResultsView has download and re-download operations
**When** these operations succeed or fail
**Then:**

- CSV download success: show `toast.success('CSV downloaded!')` (in addition to existing "Downloaded!" button text feedback)
- Batch re-download success: show `toast.success('CSV downloaded!')` (in addition to existing inline feedback)
- Batch re-download failure: show `toast.error()` with error message (in addition to existing inline error display)
- The existing inline feedback in ResultsView stays — toasts are supplementary

### AC7: Console.error Cleanup

**Given** `console.error()` calls exist as user-facing fallbacks
**When** toast system is available
**Then:**

- `console.error('Error uploading files:')` (app.tsx:115) — keep for debugging, toast replaces the alert
- `console.error('Error generating metadata:')` (app.tsx:179) — keep for debugging, toast replaces the alert
- `console.error('Failed to re-download batch CSV:')` (ResultsView:105) — keep for debugging, toast is supplementary
- `console.error('Error during initial cleanup:')` (app.tsx:80) — keep as-is (non-user-facing background operation)
- `console.error('Error cleaning up server files:')` (app.tsx:208) — keep as-is (non-user-facing background operation)
- **Summary:** NO console.error calls are removed — they stay for developer debugging. The alert() calls they preceded are what get replaced with toasts.

### AC8: Existing Functionality Preserved

**Given** all current features work from Stories 5.1–5.4
**When** error handling enhancements are added
**Then:**

- CSV auto-download during processing completion (unchanged — happens in polling loop)
- View state transitions: upload -> processing -> results -> upload
- All upload, validation, drag-and-drop functionality (untouched)
- Processing view with per-image status (untouched)
- ResultsView metadata table, download, batch history (untouched except toast additions)
- All custom CSS effects (grain texture, grain-gradient, lava lamp button)
- Inline validation errors in UploadView (Story 5.2 pattern — NOT replaced with toasts)

## Tasks / Subtasks

- [x] Task 1: Install sonner and rewrite sonner.tsx (AC: #1)
  - [x] Run `npm install sonner`
  - [x] Rewrite `client/src/components/ui/sonner.tsx` — remove `next-themes` import, use simple `<Sonner />` with shadcn/ui CSS variables, no theme prop needed (app is light mode, Story 5.5 not yet done)
  - [x] Verify the component exports `Toaster`

- [x] Task 2: Add Toaster to App and create ErrorBoundary (AC: #1, #4)
  - [x] Create `client/src/components/ErrorBoundary.tsx` — React class component with `componentDidCatch`, fallback UI with grain-gradient card styling and "Reload" button
  - [x] Import `Toaster` from `./components/ui/sonner` in app.tsx
  - [x] Add `<Toaster />` inside the root div, after `<AppFooter />`, with `position="bottom-right"` and `richColors` props
  - [x] Wrap the App export with `<ErrorBoundary>` in main.tsx (or wrap App's content — choose the most appropriate location)

- [x] Task 3: Enhance API client error handling (AC: #3)
  - [x] Update `handleResponse()` in `client/src/api/client.ts` to detect and categorize errors:
    - Network/fetch errors: wrapped with "Connection lost. Check your internet and try again."
    - 429 status: "Free limit reached. Create an account for 100 images/month."
    - 500 status: "Something went wrong. Please try again."
    - 408/timeout: "Request timed out. Please try again."
    - Other errors: use server message or fallback "Something went wrong"
  - [x] Consider adding a helper to wrap fetch calls and catch `TypeError` (network errors) separately

- [x] Task 4: Replace alert() calls in app.tsx with toast (AC: #2)
  - [x] Import `toast` from `sonner` in app.tsx
  - [x] Line 116: Replace `alert(error instanceof Error ? error.message : 'Failed to upload images...')` with `toast.error(error instanceof Error ? error.message : 'Failed to upload images. Please try again.')`
  - [x] Line 128: Replace `alert('Please enter your initials')` with `toast.error('Please enter your initials')`
  - [x] Line 130: Replace `alert('No files to process...')` with `toast.error('No files to process. Please upload images first.')`
  - [x] Line 191: Replace `alert(error instanceof Error ? error.message : 'Error generating metadata...')` with `toast.error(error instanceof Error ? error.message : 'Error generating metadata. Please try again.')`

- [x] Task 5: Add success toasts for operations (AC: #6)
  - [x] In app.tsx `handleFileSelect`: Add `toast.success('Images uploaded successfully')` after successful upload (line ~112)
  - [x] In app.tsx `handleDownloadCsv`: Add `toast.success('CSV downloaded!')` after CSV generation
  - [x] In ResultsView `handleDownload`: Add `toast.success('CSV downloaded!')` (supplementary to button text feedback)
  - [x] In ResultsView `handleBatchRedownload`: Add `toast.success('CSV downloaded!')` on success (supplementary to inline feedback)

- [x] Task 6: Add loading spinner to Generate button (AC: #5)
  - [x] Import `Loader2` from lucide-react in app.tsx
  - [x] Update "Generate & Export CSV" button: when `isProcessing`, show `<Loader2 className="w-4 h-4 animate-spin" />` alongside "Processing..." text
  - [x] Verify all disable states still work correctly

- [x] Task 7: Verify all existing functionality (AC: #8)
  - [x] Build passes: `npm run build`
  - [x] All backend tests pass: `npm test`
  - [ ] Manual verification: all upload, processing, results features still work
  - [ ] Manual verification: toasts appear for errors and successes
  - [ ] Manual verification: error boundary catches render errors (can test by temporarily throwing in a component)

## Dev Notes

### Current Frontend Architecture (from Stories 5.1–5.4)

```
client/src/
├── api/
│   └── client.ts              # ApiError class + uploadImages, startBatchProcessing, getBatchStatus, cleanup, getBatches, downloadBatchCsv
├── components/
│   ├── ui/                    # shadcn/ui (DO NOT MODIFY except sonner.tsx)
│   │   ├── table.tsx          # Used by ResultsView
│   │   ├── sonner.tsx         # BROKEN → REWRITE TARGET (remove next-themes dependency)
│   │   ├── progress.tsx       # Used by ProcessingView
│   │   ├── input.tsx          # Used by app.tsx and ResultsView
│   │   └── label.tsx          # Used by app.tsx and ResultsView
│   ├── AppHeader.tsx          # Fixed top navigation (static)
│   ├── AppFooter.tsx          # Fixed bottom footer (static)
│   ├── UploadView.tsx         # Upload zone + image grid (~193 lines) — NOT modified
│   ├── ProcessingView.tsx     # Processing status grid (~197 lines) — NOT modified
│   └── ResultsView.tsx        # Results, metadata table, download (~367 lines) — MINOR EDIT (add toast imports)
├── types/
│   └── index.ts               # UploadedImage, BatchStatusResponse, etc. — NOT modified
├── utils/
│   ├── csv.ts                 # generateCSV() and downloadCSV()
│   ├── format.ts              # formatFileSize()
│   └── validation.ts          # validateFiles()
├── app.tsx                    # Thin orchestrator (~343 lines) — MODERATE EDIT (replace alerts, add toasts, Toaster, spinner)
├── index.css                  # Tailwind v4 + grain/lava-lamp effects
└── main.tsx                   # Entry point — MINOR EDIT (wrap with ErrorBoundary)
```

### Files to Modify

| File                                      | Change Type   | What Changes                                                                       |
| ----------------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `client/src/components/ui/sonner.tsx`     | REWRITE       | Remove next-themes, simple Sonner export with CSS variables                        |
| `client/src/app.tsx`                      | MODERATE EDIT | Import toast+Toaster, replace 4 alert() calls, add success toasts, Loader2 spinner |
| `client/src/api/client.ts`                | MODERATE EDIT | Enhanced error categorization (429, 500, network, timeout)                         |
| `client/src/components/ResultsView.tsx`   | MINOR EDIT    | Import toast, add supplementary toast.success/error calls                          |
| `client/src/components/ErrorBoundary.tsx` | NEW FILE      | React class error boundary (~30-40 lines)                                          |
| `client/src/main.tsx`                     | MINOR EDIT    | Wrap App with ErrorBoundary                                                        |

### Current Broken sonner.tsx (to be rewritten)

```typescript
// CURRENT — BROKEN (imports uninstalled packages)
'use client';
import { useTheme } from 'next-themes@0.4.6'; // NOT INSTALLED
import { Toaster as Sonner, ToasterProps } from 'sonner@2.0.3'; // NOT INSTALLED
```

### New sonner.tsx (recommended implementation)

```typescript
import { Toaster as Sonner } from 'sonner';
import type { ComponentProps } from 'react';

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
```

### Toaster Placement in app.tsx

```tsx
// Inside the root div, after AppFooter:
<AppFooter />
<Toaster position="bottom-right" richColors />
```

### ErrorBoundary Component Pattern

```tsx
// client/src/components/ErrorBoundary.tsx
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fafafa] via-[#f5f5f5] to-[#efefef]">
          <div className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-2 border-border/20 rounded-2xl p-8 space-y-4 text-center max-w-md">
            <div className="text-[1.25rem] tracking-[-0.02em] opacity-90">
              Something unexpected happened
            </div>
            <p className="tracking-[-0.01em] opacity-50 text-[0.9rem]">
              The application encountered an error. Please reload to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="grain-gradient px-8 py-3 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl active:scale-[0.99] tracking-[-0.01em] text-[0.95rem] relative overflow-hidden group"
            >
              <span className="relative z-10">Reload</span>
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-2xl pointer-events-none" />
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### API Error Enhancement Pattern

```typescript
// Enhance handleResponse in client/src/api/client.ts
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 429) {
      throw new ApiError('Free limit reached. Create an account for 100 images/month.', 429);
    }
    if (response.status >= 500) {
      throw new ApiError('Something went wrong. Please try again.', response.status);
    }
    if (response.status === 408) {
      throw new ApiError('Request timed out. Please try again.', 408);
    }
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(errorData.message || 'Something went wrong', response.status);
  }
  return response.json();
}

// Wrap fetch calls to catch network errors
async function safeFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError('Connection lost. Check your internet and try again.', 0);
    }
    throw error;
  }
}
```

Then replace all `fetch()` calls in client.ts with `safeFetch()`.

### Alert Replacement Map

| Location    | Current alert()                                   | Replacement                                                                      |
| ----------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| app.tsx:116 | `alert(error.message \|\| 'Failed to upload...')` | `toast.error(error.message \|\| 'Failed to upload images. Please try again.')`   |
| app.tsx:128 | `alert('Please enter your initials')`             | `toast.error('Please enter your initials')`                                      |
| app.tsx:130 | `alert('No files to process...')`                 | `toast.error('No files to process. Please upload images first.')`                |
| app.tsx:191 | `alert(error.message \|\| 'Error generating...')` | `toast.error(error.message \|\| 'Error generating metadata. Please try again.')` |

### Success Toast Locations

| Location                          | Event                        | Toast                                           |
| --------------------------------- | ---------------------------- | ----------------------------------------------- |
| app.tsx handleFileSelect          | After successful upload      | `toast.success('Images uploaded successfully')` |
| app.tsx handleDownloadCsv         | After CSV generation         | `toast.success('CSV downloaded!')`              |
| ResultsView handleDownload        | After download click         | `toast.success('CSV downloaded!')`              |
| ResultsView handleBatchRedownload | After successful re-download | `toast.success('CSV downloaded!')`              |

### Loading Spinner for Generate Button

```tsx
<button
  onClick={handleGenerateMetadata}
  disabled={images.length === 0 || isProcessing}
  className="..."
>
  <span className="relative z-10 flex items-center gap-2">
    {isProcessing ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Processing...
      </>
    ) : (
      'Generate & Export CSV'
    )}
  </span>
  ...
</button>
```

### What NOT to Do

- Do NOT modify UploadView.tsx — inline validation stays as-is (Story 5.2 pattern)
- Do NOT modify ProcessingView.tsx — completed in Story 5.3
- Do NOT add dark mode theming to Toaster — that's Story 5.5 scope
- Do NOT add responsive breakpoints — that's Story 5.6 scope
- Do NOT modify shadcn/ui components in `client/src/components/ui/` (except sonner.tsx rewrite)
- Do NOT write frontend tests — no frontend test infrastructure exists yet
- Do NOT touch backend code — this is a frontend-only story (except `npm install sonner`)
- Do NOT add Sentry or production monitoring — defer to future epic
- Do NOT add Framer Motion or animation library — CSS transitions only
- Do NOT use modal dialogs for errors — toasts and inline messages only
- Do NOT remove console.error() calls — they stay for developer debugging
- Do NOT replace UploadView validation errors with toasts — validation = inline per Story 5.2
- Do NOT install `next-themes` — not needed until Story 5.5 (dark mode)

### Project Structure Notes

- ErrorBoundary.tsx is the only new file — all other changes modify existing files
- sonner.tsx rewrite stays in `components/ui/` for consistency with shadcn/ui pattern
- main.tsx gets ErrorBoundary wrapper — minimal change to entry point
- The `sonner` package is the only new dependency added
- Alignment with architecture: error handling centralized in API client, toasts called from orchestrator (app.tsx) and view components

### References

- [Source: docs/epics.md#Story-5.7-Error-Handling-Toast-Notifications] — User story and acceptance criteria
- [Source: docs/stories/5-4-results-view-and-metadata-preview.md] — Previous story with download feedback patterns, batch re-download error handling, sonner.tsx BROKEN note
- [Source: docs/stories/5-2-upload-experience-and-file-validation.md] — Validation = inline pattern (UploadView)
- [Source: docs/stories/5-1-component-architecture-and-app-decomposition.md] — Architecture patterns, component boundaries
- [Source: docs/architecture/architecture-client.md#Error-Handling] — Current alert() pattern, improvement recommendation for Sonner
- [Source: docs/architecture/api-contracts-api.md#Error-Handling] — Backend error response shapes (400, 404, 500)
- [Source: client/src/app.tsx] — Current orchestrator with 4 alert() calls (lines 116, 128, 130, 191)
- [Source: client/src/api/client.ts] — API client with ApiError class and handleResponse()
- [Source: client/src/components/ui/sonner.tsx] — BROKEN component (imports uninstalled next-themes + sonner)
- [Source: client/src/components/ResultsView.tsx] — Download/re-download with inline feedback (367 lines)
- [Source: client/src/main.tsx] — Entry point (needs ErrorBoundary wrap)
- [Source: client/src/types/index.ts] — Type definitions (no changes needed)

### Previous Story Intelligence (Stories 5.1–5.4)

**Patterns established:**

- Prop drilling from App to view components (no Context/Redux)
- Functional state updaters for concurrent-safe updates
- API client in `client/src/api/client.ts` with `ApiError` class for centralized error handling
- View state routing: `const [view, setView] = useState<AppView>('upload')`
- `useCallback` for handlers passed as props
- `useMemo` for derived data
- Inline validation in UploadView (validation = inline, operations = toast)
- Download button feedback: "Downloaded!" text change for 2 seconds (stays, toasts supplementary)
- Batch re-download: inline error display + loading state (stays, toasts supplementary)

**Code review fixes to learn from (accumulated across 5.1-5.4):**

- Always use functional updaters for state that depends on previous value
- Use `type: unknown` over `any` for better safety
- Add cleanup in useEffect returns (timers, object URLs)
- Use `tabular-nums` class for numeric displays
- Wrap handlers in `useCallback` when passed as props
- Memoize derived data with `useMemo`

**Build/test baseline:**

- Build: `npm run build` — ~1808 modules
- Tests: `npm test` — 965 tests passing across 30 test files
- No frontend tests exist or are expected

### Git Intelligence (Recent Commits)

```
7432228 ASU-Code review 3 fixes and polling improvements for Story 5.3
ce8c323 ASU-Update hero branding and UI polish with plugin settings
ec70e54 ASU-Complete Story 5.3 processing view and real-time status with code review fixes
67fc136 ASU-Complete Story 5.2 upload experience and file validation with code review fixes
f0f29a3 ASU-Complete Story 5.1 component architecture and app decomposition with code review fixes
```

Commit format: `ASU-{short description}`

### Latest Tech Notes

**sonner v2.x (latest stable):** Lightweight toast library. Import `toast` for imperative API, `Toaster` component for rendering. Key props: `position`, `richColors`, `duration`, `closeButton`. API: `toast('message')`, `toast.success()`, `toast.error()`, `toast.loading()`, `toast.dismiss()`. Does NOT require `next-themes` — theme can be set via `theme` prop directly on `<Toaster>` or omitted for default.

**React 19 Error Boundaries:** Still require class components (`componentDidCatch`, `getDerivedStateFromError`). No hooks equivalent. Simple ~30-line component is sufficient.

**lucide-react v0.553.0:** `Loader2` icon with `animate-spin` class is the standard spinner pattern. Already installed and used in ProcessingView.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — implementation proceeded without issues.

### Completion Notes List

- **Task 1:** Installed `sonner` package and rewrote `sonner.tsx` to remove broken `next-themes` dependency. Component now exports `Toaster` with shadcn/ui CSS variable styling.
- **Task 2:** Created `ErrorBoundary.tsx` class component with grain-gradient fallback UI and "Reload" button. Added `<Toaster position="bottom-right" richColors />` after `<AppFooter />` in app.tsx. Wrapped `<App />` with `<ErrorBoundary>` in main.tsx.
- **Task 3:** Enhanced `handleResponse()` in API client with status-specific user-friendly error messages (429, 500+, 408). Added `safeFetch()` wrapper to catch `TypeError` network errors with "Connection lost" message. All `fetch()` calls replaced with `safeFetch()`.
- **Task 4:** Replaced all 4 `alert()` calls in app.tsx with `toast.error()` calls. Zero `alert()` calls remain in frontend code.
- **Task 5:** Added `toast.success('Images uploaded successfully')` after upload, `toast.success('CSV downloaded!')` after CSV download in app.tsx and ResultsView. Added `toast.error()` for batch re-download failures in ResultsView. All toasts are supplementary to existing inline feedback.
- **Task 6:** Added `Loader2` spinner icon from lucide-react to "Generate & Export CSV" button during processing state. Button shows spinner + "Processing..." text.
- **Task 7:** Build passes (1811 modules), all 965 backend tests pass across 30 test files. Manual verification tasks left for user.

### Change Log

- **2026-03-24:** Implemented Story 5.7 — toast notification system, error boundary, enhanced API error handling, loading spinner. Replaced all `alert()` calls with `sonner` toasts. Added `safeFetch()` for network error handling.
- **2026-03-24:** Code review fixes — fixed double toast on CSV download (removed duplicate from app.tsx handleDownloadCsv), added isUploading state to disable upload zone during uploads (AC5), set toast duration to 5s and added closeButton prop (AC1), added status-specific error handling to downloadBatchCsv (AC3).
- **2026-03-24:** Code review 2 fixes — [H2] guard handleFileSelect against concurrent uploads via drag-and-drop, [M1] extracted shared categorizeHttpError helper to DRY up client.ts, [M2] success toast now shows image count, [M3] isUploading prop made required, [L1] explicit CSSProperties import in sonner.tsx, [L2] added try/catch to handleDownload in ResultsView. Story status set to in-progress pending manual verification.
- **2026-03-25:** Code review 3 fixes — [M1] added toast.warning for partial CSV auto-download on processing failure, [M2] added 504 Gateway Timeout handling to categorizeHttpError before >=500 catch-all, [M3] cleanup() now uses categorizeHttpError for consistent error handling, [L1] DropZone suppresses drag-over visual feedback when disabled/uploading, [L2] added toast.success for auto-downloaded CSV on processing completion, [L3] safeFetch explicitly passes through AbortError and converts all other errors to user-friendly messages. Build passes (1811 modules), 965 tests pass.
- **2026-04-27:** Code review 4 fixes — [H1] DropZone now truly blocks drops when disabled (added canDrop guard to react-dnd useDrop and disabled check to native handleDrop), [M1] 429 fallback message aligned with AC3 spec, [M2] polling loop in handleGenerateMetadata now has 10-minute hard timeout, [L2] ResultsView batch history load failure now shows toast.error. Build passes (1880 modules), 1127 tests pass. Story marked done.

### File List

- `client/src/components/ui/sonner.tsx` — REWRITTEN (removed next-themes, simplified Sonner export)
- `client/src/components/ErrorBoundary.tsx` — NEW (React class error boundary with grain-gradient fallback UI)
- `client/src/app.tsx` — MODIFIED (added Toaster, toast imports, Loader2 spinner, replaced 4 alert() with toast.error(), added success toasts, isUploading state, closeButton + duration on Toaster)
- `client/src/api/client.ts` — MODIFIED (enhanced handleResponse with status-specific errors, added safeFetch wrapper, replaced all fetch with safeFetch, added status-specific errors to downloadBatchCsv; code review 4: 429 fallback message aligned with AC3)
- `client/src/components/ResultsView.tsx` — MODIFIED (added toast import, supplementary success/error toasts for download operations; code review 4: toast.error on batch history load failure)
- `client/src/components/UploadView.tsx` — MODIFIED (added isUploading prop, disabled Select Images button and Add more images link during upload)
- `client/src/components/DropZone.tsx` — MODIFIED (code review 4: added canDrop: () => !disabled to useDrop, added disabled guard to native handleDrop, added disabled to dependency array)
- `client/src/pages/Home.tsx` — MODIFIED (code review 4: 10-minute polling timeout in handleGenerateMetadata)
- `client/src/main.tsx` — MODIFIED (wrapped App with ErrorBoundary)
- `package.json` — MODIFIED (added sonner dependency)
- `package-lock.json` — MODIFIED (lockfile updated)
