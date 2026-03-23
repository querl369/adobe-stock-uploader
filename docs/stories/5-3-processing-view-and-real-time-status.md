# Story 5.3: Processing View & Real-Time Status

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want per-image status indicators and time estimates during processing,
so that I can see exactly which images are done, in progress, or failed.

## Acceptance Criteria

### AC1: Per-Image Status Indicators

**Given** a batch is being processed
**When** the ProcessingView is displayed
**Then** each image thumbnail shows its individual status overlay:

- **Completed** — green checkmark icon with "Done" label
- **Processing** — spinning loader animation with "Processing..." label
- **Failed** — red X icon with brief error reason displayed
- **Pending** — gray circle icon with "Waiting" label
- Images displayed in a 4-column thumbnail grid (matching UploadView layout)
- Each thumbnail shows the image preview with a semi-transparent status overlay

### AC2: Enhanced Progress Information

**Given** a batch is being processed
**When** polling returns updated progress
**Then** the following information is displayed above the thumbnail grid:

- Overall progress bar (existing shadcn/ui Progress component, kept)
- Completed count: "4 of 10 images processed"
- Time estimate: "About X seconds remaining" (from backend `estimatedTimeRemaining`)
- Processing speed: "~X.Xs per image" (calculated from elapsed time / completed count)

### AC3: Smooth CSS Transitions

**Given** the progress bar and status indicators update during polling
**When** values change between polls
**Then** visual updates are smooth:

- Progress bar uses CSS `transition-all duration-500` for smooth movement
- Status icon changes fade in (opacity transition, 300ms)
- Completed count updates without visual jank (tabular-nums for fixed-width digits)

### AC4: Automatic Transition to Results

**Given** all images have finished processing (completed or failed)
**When** the batch status is `completed` or `failed`
**Then:**

- If at least one image succeeded: show brief "Processing complete!" inline message, auto-transition to ResultsView after 1.5 seconds
- If partial failures: show summary "X of Y processed, Z failed" before transitioning
- If ALL images failed: show error summary with "All images failed" message, do NOT auto-transition (user must click a "Back to Upload" button)

### AC5: Batch Status Data Wiring

**Given** the app.tsx polling loop already fetches `BatchStatusResponse`
**When** ProcessingView renders
**Then** the component receives:

- `images: UploadedImage[]` — for thumbnails (from existing app state)
- `batchStatus: BatchStatusResponse` — full batch status from polling (includes per-image status, ETA, progress)
- New `batchStatus` state added to app.tsx, updated on each poll cycle

### AC6: Completion Flow Changes

**Given** the current completion flow uses `alert()` for success messages
**When** processing completes in Story 5.3
**Then:**

- The `alert()` for "Processing complete! X of Y images..." is replaced with inline ProcessingView display
- CSV auto-download still happens immediately on completion (unchanged)
- The `alert()` for "Processing failed. No images were processed" is replaced with inline error display
- `alert()` for API-level errors in the catch block remains (deferred to Story 5.7)
- The transition to ResultsView is delayed 1.5 seconds (was instant)

### AC7: Existing Functionality Preserved

**Given** all current features work from Story 5.1 and 5.2
**When** processing view enhancements are added
**Then** the following MUST still work identically:

- 2-second polling of `/api/batch-status/:batchId` (unchanged)
- Images state updated with metadata on completion (unchanged)
- CSV generation and auto-download on completion (unchanged)
- View state transitions: upload -> processing -> results -> upload
- All upload, validation, and drag-and-drop functionality (untouched)
- All custom CSS effects (grain texture, grain-gradient, lava lamp button)

### AC8: No New Dependencies

**Given** the existing dependency list
**When** the story is complete
**Then** NO new npm packages are added. Uses only existing packages:

- `lucide-react` (already installed, v0.553.0) — for status icons
- shadcn/ui `Progress` component (already used)
- CSS transitions only (no Framer Motion or animation libraries)

## Tasks / Subtasks

- [x] Task 1: Add batchStatus state to app.tsx (AC: #5)
  - [x] Add `batchStatus` state: `useState<BatchStatusResponse | null>(null)`
  - [x] Update polling loop to `setBatchStatus(statusData)` on each poll cycle
  - [x] Clear batchStatus when processing starts and on handleClear

- [x] Task 2: Expand ProcessingView props and layout (AC: #1, #2, #5)
  - [x] Update ProcessingViewProps: add `images`, `batchStatus` (nullable), `onComplete`, `onBackToUpload`; remove `processing` and `totalImages`
  - [x] Handle `batchStatus === null` loading state (spinner + "Starting processing..." text)
  - [x] Restructure component layout: progress info section + thumbnail grid
  - [x] Import lucide-react icons: `Check`, `Loader2`, `XCircle`, `Circle`

- [x] Task 3: Implement per-image status thumbnail grid (AC: #1)
  - [x] Render 4-column grid of image thumbnails (matching UploadView layout)
  - [x] Match `UploadedImage.fileId` to `BatchImageStatus.id` for status lookup
  - [x] Add semi-transparent status overlay on each thumbnail
  - [x] Display status icon and label per image
  - [x] Show error reason tooltip/text for failed images

- [x] Task 4: Implement enhanced progress information (AC: #2)
  - [x] Display "X of Y images processed" count
  - [x] Display "About X seconds remaining" from `batchStatus.estimatedTimeRemaining`
  - [x] Calculate and display processing speed: elapsed time / completed count
  - [x] Format time values for readability (seconds vs minutes)

- [x] Task 5: Add smooth CSS transitions (AC: #3)
  - [x] Add `transition-all duration-500` to Progress component wrapper
  - [x] Add `transition-opacity duration-300` to status overlays
  - [x] Use `tabular-nums` class on numeric displays for stable width
  - [x] Add spinner animation: `animate-spin` on Loader2 icon

- [x] Task 6: Implement completion summary and auto-transition (AC: #4, #6)
  - [x] Detect completion in ProcessingView (batchStatus.status === 'completed' || 'failed')
  - [x] Show inline completion/failure summary message
  - [x] Add 1.5-second timer before calling `onComplete` callback
  - [x] Handle all-failed edge case: show error summary, render "Back to Upload" button
  - [x] Remove `alert()` calls for completion/failure messages in app.tsx polling loop

- [x] Task 7: Update app.tsx to wire new ProcessingView (AC: #5, #6, #7)
  - [x] Refactor view routing from two-way to three-way conditional (upload / processing / results)
  - [x] Add `batchStatus` state, set on each poll, clear on start and completion
  - [x] Pass `images`, `batchStatus`, `onComplete`, `onBackToUpload` props to ProcessingView
  - [x] Add `handleProcessingComplete` handler for auto-transition
  - [x] Refactor completion logic: keep CSV download + image metadata update, remove `alert()` for completion, do NOT `setView('results')` immediately — let ProcessingView's timer handle it
  - [x] Keep `processing` state for button disabled/text (not passed to ProcessingView)

- [x] Task 8: Verify all existing functionality (AC: #7)
  - [x] Build passes: `npm run build`
  - [x] All backend tests pass: `npm test`
  - [ ] Manual verification: progress bar shows during processing
  - [ ] Manual verification: per-image status updates in real-time
  - [ ] Manual verification: auto-transition to results after completion
  - [ ] Manual verification: all upload/validation features still work
  - [ ] Manual verification: CSV still auto-downloads on completion

## Dev Notes

### Current Frontend Architecture (from Story 5.1 + 5.2)

```
client/src/
├── api/
│   └── client.ts              # ApiError class + uploadImages, startBatchProcessing, getBatchStatus, cleanup
├── components/
│   ├── ui/                    # shadcn/ui (DO NOT MODIFY)
│   ├── AppHeader.tsx          # Fixed top navigation (static)
│   ├── AppFooter.tsx          # Fixed bottom footer (static)
│   ├── UploadView.tsx         # Upload zone + image grid (193 lines) — NOT modified in this story
│   ├── ProcessingView.tsx     # Progress bar and status (26 lines) ← PRIMARY EDIT TARGET
│   └── ResultsView.tsx        # Results placeholder (24 lines)
├── types/
│   └── index.ts               # UploadedImage, ProcessingState, BatchStatusResponse, etc.
├── utils/
│   ├── csv.ts                 # generateCSV() and downloadCSV()
│   ├── format.ts              # formatFileSize()
│   └── validation.ts          # validateFiles()
├── app.tsx                    # Thin orchestrator (301 lines) — SECONDARY EDIT TARGET
├── index.css                  # Tailwind v4 + grain/lava-lamp effects
└── main.tsx                   # Entry point (untouched)
```

### Files to Modify

| File                                       | Change Type   | What Changes                                                                                                       |
| ------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `client/src/components/ProcessingView.tsx` | MAJOR REWRITE | From 26 lines to ~120-150 lines. Add per-image thumbnails, enhanced progress, completion summary, auto-transition  |
| `client/src/app.tsx`                       | MODIFY        | Add `batchStatus` state, update polling to pass full status, update ProcessingView props, refactor completion flow |
| `client/src/index.css`                     | MODIFY        | Add CSS for status overlay animations (if needed beyond Tailwind)                                                  |
| `client/src/types/index.ts`                | MINOR         | May not need changes — BatchStatusResponse already has all needed fields                                           |

### Current ProcessingView.tsx (26 lines — to be rewritten)

```typescript
import { Progress } from './ui/progress';
import type { ProcessingState } from '../types';

interface ProcessingViewProps {
  processing: ProcessingState;
  totalImages: number;
}

export function ProcessingView({ processing, totalImages }: ProcessingViewProps) {
  const progressPercent = totalImages > 0 ? ((processing.currentIndex + 1) / totalImages) * 100 : 0;
  return (
    <div className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-2 border-border/20 rounded-2xl p-6 space-y-3">
      <div className="flex items-center justify-between">
        <span>Processing...</span>
        <span>{processing.currentIndex + 1} / {totalImages}</span>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <p>{processing.currentFileName}</p>
    </div>
  );
}
```

→ Rewrite to receive `images` + `batchStatus` props, render thumbnail grid with status overlays, enhanced progress info, and completion handling.

### New ProcessingView Props Interface

```typescript
interface ProcessingViewProps {
  images: UploadedImage[];
  batchStatus: BatchStatusResponse | null; // null during initial 2-3s before first poll
  onComplete: () => void; // Called after 1.5s auto-transition delay
  onBackToUpload: () => void; // Called when all images failed
}
```

When `batchStatus` is null, render a minimal loading state: the grain-gradient card with a spinner and "Starting processing..." text. Once batchStatus arrives, render the full grid with status overlays.

### BatchStatusResponse (already defined — types/index.ts)

```typescript
export interface BatchStatusResponse {
  batchId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    completed: number; // includes both success and failed
    failed: number;
    processing: number;
    pending: number;
  };
  images: BatchImageStatus[];
  estimatedTimeRemaining?: number; // seconds
}

export interface BatchImageStatus {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  metadata?: { title: string; keywords: string; category: number };
  error?: string;
}
```

Key: `estimatedTimeRemaining` is in **seconds** (the backend divides ms by 1000 via `Math.round(estimatedTimeRemaining / 1000)`).

### Mapping Images to Batch Status

`UploadedImage.fileId` matches `BatchImageStatus.id`. To get per-image status:

```typescript
const getImageStatus = (image: UploadedImage): BatchImageStatus | undefined => {
  return batchStatus.images.find(bi => bi.id === image.fileId);
};
```

### ProcessingView Layout Design

```
┌─────────────────────────────────────────────────┐
│ Processing...                    4 of 10 (60%)  │
│ ████████████░░░░░░░░░░                          │
│ ~2.3s per image • About 14 seconds remaining    │
├─────────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│ │  ✓     │ │  ✓     │ │  ⟳     │ │  ○     │   │
│ │ [img]  │ │ [img]  │ │ [img]  │ │ [img]  │   │
│ │ Done   │ │ Done   │ │ Pro... │ │ Wait   │   │
│ └────────┘ └────────┘ └────────┘ └────────┘   │
│ ┌────────┐ ┌────────┐                          │
│ │  ○     │ │  ✗     │                          │
│ │ [img]  │ │ [img]  │                          │
│ │ Wait   │ │ Error  │                          │
│ └────────┘ └────────┘                          │
└─────────────────────────────────────────────────┘
```

### Status Icons (lucide-react)

| Status     | Icon      | Color         | Animation      |
| ---------- | --------- | ------------- | -------------- |
| Completed  | `Check`   | green-500     | None           |
| Processing | `Loader2` | foreground    | `animate-spin` |
| Failed     | `XCircle` | red-500       | None           |
| Pending    | `Circle`  | foreground/30 | None           |

### Status Overlay Styling

Each thumbnail gets a semi-transparent overlay:

```tsx
<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-300">
  <Check className="w-5 h-5 text-green-400" />
  <span className="text-[0.65rem] text-white/90 mt-1">Done</span>
</div>
```

For pending images, use a lighter overlay:

```tsx
<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 transition-opacity duration-300">
  <Circle className="w-5 h-5 text-white/40" />
  <span className="text-[0.65rem] text-white/50 mt-1">Waiting</span>
</div>
```

### Processing Speed Calculation

```typescript
// Track when processing started
const [startTime] = useState(() => Date.now());

// Calculate average speed
const elapsed = (Date.now() - startTime) / 1000;
const successCount = batchStatus.progress.completed - batchStatus.progress.failed;
const avgSpeed = successCount > 0 ? elapsed / successCount : 0;
// Display: "~2.3s per image"
```

### Time Estimate Formatting

```typescript
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds < 60) return `About ${Math.round(seconds)} seconds remaining`;
  const minutes = Math.round(seconds / 60);
  return `About ${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
}
```

### Auto-Transition Logic

In ProcessingView, use `useEffect` to detect completion:

```typescript
useEffect(() => {
  if (batchStatus.status === 'completed' || batchStatus.status === 'failed') {
    const allFailed = batchStatus.progress.failed === batchStatus.progress.total;
    if (allFailed) return; // No auto-transition when all failed

    const timer = setTimeout(() => onComplete(), 1500);
    return () => clearTimeout(timer);
  }
}, [batchStatus.status]);
```

### App.tsx Changes

**New state:**

```typescript
const [batchStatus, setBatchStatus] = useState<BatchStatusResponse | null>(null);
```

**View routing refactor — CRITICAL:**

Currently app.tsx has a two-way conditional: `view === 'results'` vs everything else (UploadView + buttons + conditional ProcessingView). This MUST change to three-way:

```tsx
{view === 'results' ? (
  <ResultsView onProcessMore={handleProcessMore} />
) : view === 'processing' ? (
  <ProcessingView
    images={images}
    batchStatus={batchStatus}
    onComplete={handleProcessingComplete}
    onBackToUpload={() => { handleClear(); setView('upload'); }}
  />
) : (
  <>
    <UploadView ... />
    <div>...initials input + buttons...</div>
  </>
)}
```

This means: when `view === 'processing'`, ONLY ProcessingView is rendered — no UploadView, no buttons, no initials input. The processing view gets the full content area.

**Initial loading state:** `batchStatus` will be `null` for ~2-3 seconds between clicking "Generate" and the first poll response. ProcessingView MUST handle `batchStatus: BatchStatusResponse | null` — show a minimal loading state (spinner + "Starting processing...") when null, then show the full status grid once data arrives.

**Polling loop changes (handleGenerateMetadata):**

```typescript
// At start: setBatchStatus(null)
// In polling loop, after getting statusData:
setBatchStatus(statusData);

// On completion - still update images and download CSV, but:
// 1. Remove alert() for completion message
// 2. Do NOT setView('results') — let ProcessingView's auto-transition handle it
// 3. Keep polling loop exit (isComplete = true) and setProcessing(false) in finally
```

**`processing` state still needed:** Even though ProcessingView no longer receives `processing` as a prop, the `processing.isProcessing` flag is still used by the Generate button's disabled state and "Processing..." text. The `processing` state stays in app.tsx — just no longer passed to ProcessingView.

**New handler:**

```typescript
const handleProcessingComplete = () => {
  setView('results');
  setBatchStatus(null);
};
```

### Completion Flow Refactor

**Current flow (app.tsx lines 151-178):**

1. statusData.status === 'completed' → update images → download CSV → alert() → setView('results')

**New flow:**

1. statusData.status === 'completed' → update images → download CSV → setBatchStatus(statusData) → wait
2. ProcessingView detects completion → shows inline summary → 1.5s timer → calls onComplete
3. onComplete → setView('results') → setBatchStatus(null)

This moves the transition trigger from the polling loop to ProcessingView, enabling the visual completion summary.

### What NOT to Do

- Do NOT add Framer Motion or any animation library — CSS transitions only
- Do NOT replace `alert()` for API errors in the catch block — that's Story 5.7
- Do NOT modify UploadView.tsx — this story only touches ProcessingView
- Do NOT modify ResultsView.tsx — that's Story 5.4
- Do NOT add dark mode toggle — that's Story 5.5
- Do NOT add responsive breakpoints — that's Story 5.6
- Do NOT modify shadcn/ui components in `client/src/components/ui/`
- Do NOT write frontend tests — no frontend test infrastructure exists yet
- Do NOT touch backend code — this is a frontend-only story
- Do NOT add Sonner/toast notifications — that's Story 5.7
- Do NOT create custom React hooks — premature abstraction for this scope
- Do NOT change `main.tsx` or Vite config
- Do NOT add Server-Sent Events (SSE) — current polling approach is kept, SSE is future scope

### Project Structure Notes

- ProcessingView.tsx is the primary edit target — major rewrite from 26 to ~120-150 lines
- app.tsx changes are moderate — add state, refactor completion flow
- No new files needed — all changes to existing files
- The thumbnail grid in ProcessingView should visually match UploadView's grid (4-column, rounded-2xl cards, grain-gradient)
- Alignment with architecture: ProcessingView stays as a presentational component, app.tsx manages state

### References

- [Source: docs/epics.md#Story-5.3-Processing-View-Real-Time-Status] — User story and acceptance criteria
- [Source: docs/stories/5-1-component-architecture-and-app-decomposition.md] — Architecture patterns, component boundaries, code review learnings
- [Source: docs/stories/5-2-upload-experience-and-file-validation.md] — Previous story with thumbnail card patterns and validation flow
- [Source: docs/PRD.md#FR-8-Simple-Progress-Feedback] — Progress bar requirements
- [Source: docs/architecture/architecture-client.md] — Frontend component architecture, design system
- [Source: client/src/components/ProcessingView.tsx] — Current implementation (26 lines)
- [Source: client/src/app.tsx] — Current orchestrator with polling loop (lines 128-188)
- [Source: client/src/types/index.ts] — BatchStatusResponse, BatchImageStatus types
- [Source: client/src/api/client.ts] — getBatchStatus API client function
- [Source: src/services/batch-tracking.service.ts] — Backend getBatchStatus response shape (includes estimatedTimeRemaining in seconds)
- [Source: src/api/routes/batch.routes.ts] — Backend batch-status endpoint

### Previous Story Intelligence (Story 5.1 + 5.2)

**Patterns established:**

- Prop drilling from App to view components (no Context/Redux needed)
- Functional state updaters for concurrent-safe updates: `setImages(prev => prev.filter(...))`
- API client in `client/src/api/client.ts` with `ApiError` class for centralized error handling
- Pure utilities in `client/src/utils/` (csv.ts, format.ts, validation.ts)
- Static presentational components (AppHeader, AppFooter) vs stateful view components
- View state routing: `const [view, setView] = useState<AppView>('upload')`
- Thumbnail card pattern: `grain-gradient` + `rounded-2xl` + `overflow-hidden` + `aspect-square` inner div

**Code review fixes to learn from:**

- Always use functional updaters for state that depends on previous value (stale closure fix)
- Use `type: unknown` over `any` for better safety
- Disable non-functional placeholder UI elements
- Add cleanup in useEffect returns (timers, object URLs)
- Use `tabular-nums` class for numeric displays to prevent layout shift
- `Math.max(0, ...)` guards for values that could go negative

**Build/test baseline:**

- Build: `npm run build` — 154 modules
- Tests: `npm test` — 965 tests passing across 30 test files
- No frontend tests exist or are expected

### Git Intelligence (Recent Commits)

```
f0f29a3 ASU-Complete Story 5.1 component architecture and app decomposition with code review fixes
f9147c8 ASU-Complete Story 4.3 batch history persistence with sprint planning updates
4f6f65f ASU-Complete Story 4.2 instant download endpoint with code review fixes
```

Commit format: `ASU-{short description}`
Note: Story 5.2 changes are uncommitted (in-progress).

### Latest Tech Notes

**React 19 (current):** `useState` functional updaters, `useEffect` cleanup patterns all standard. `useEffect` with dependency on `batchStatus.status` is the correct approach for auto-transition timer.

**Tailwind CSS v4 (current):** All utility classes work dynamically. `animate-spin`, `transition-all`, `duration-300`, `backdrop-blur-[2px]`, `tabular-nums` all available. No custom CSS needed beyond what's already in index.css.

**lucide-react v0.553.0 (current):** Icons import as React components. Usage: `import { Check, Loader2, XCircle, Circle } from 'lucide-react'`. Size via `className="w-5 h-5"`. Color via `className="text-green-500"`. Spinner via `className="animate-spin"`.

**Backend batch-status response:** `estimatedTimeRemaining` is in seconds (integer). Returns `undefined` when no estimate available (before first image completes). Progress object has `total`, `completed` (includes success+failed), `failed`, `processing`, `pending` counts.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Build: 1807 modules, successful
- Tests: 30 files, 965 tests passing, 0 regressions

### Completion Notes List

- Task 1: Added `batchStatus` state to app.tsx with `useState<BatchStatusResponse | null>(null)`. Updated polling loop to call `setBatchStatus(statusData)` on each cycle. Cleared on processing start and handleClear.
- Task 2: Rewrote ProcessingView props interface with `images`, `batchStatus`, `onComplete`, `onBackToUpload`. Added null-state loading spinner. Imported Check, Loader2, XCircle, Circle from lucide-react.
- Task 3: Built 4-column thumbnail grid matching UploadView pattern (grain-gradient, rounded-2xl, aspect-square). Status lookup via `batchStatus.images.find(bi => bi.id === image.fileId)`. Semi-transparent overlays with status icons. Failed images show error text with title tooltip.
- Task 4: Enhanced progress info: "X of Y images processed" count with tabular-nums, time estimate from `estimatedTimeRemaining`, processing speed calculated from elapsed/successCount.
- Task 5: CSS transitions: `transition-all duration-500` on progress bar wrapper, `transition-opacity duration-300` on all status overlays, `tabular-nums` on numeric displays, `animate-spin` on Loader2 processing icon.
- Task 6: useEffect detects completion via `batchStatus.status`, triggers 1.5s timer before `onComplete()`. All-failed shows error summary + "Back to Upload" button (no auto-transition). Removed both `alert()` calls for completion/failure messages from app.tsx polling loop.
- Task 7: Three-way view routing: results / processing / upload. ProcessingView gets full content area during processing. Added `handleProcessingComplete` handler (sets view to results, clears batchStatus). Completion flow now: polling updates images + downloads CSV → ProcessingView shows summary → timer calls onComplete → transitions to results.
- Task 8: Build passes (1807 modules). All 965 backend tests pass (0 regressions). Manual verification items deferred to user.

### File List

- `client/src/app.tsx` — Modified: added batchStatus state, three-way view routing, handleProcessingComplete handler, removed alert() calls, refactored completion flow. Code review #1: wrapped handleProcessingComplete in useCallback, removed dead setProcessing in polling loop, added setBatchStatus(null) in error catch, removed redundant type annotations. Code review #2: simplified processing state to boolean (removed dead currentIndex/currentFileName), memoized handleClear+handleBackToUpload with useCallback, added partial progress CSV recovery in polling error catch. Code review #3: removed misleading async/await from handleProcessMore (handleClear returns void, not Promise).
- `client/src/components/ProcessingView.tsx` — Major rewrite: from 26 to ~167 lines. Per-image thumbnail grid with status overlays, enhanced progress info, auto-transition logic, all-failed handling. Code review #1: added onComplete to useEffect deps, Math.min(100,...) on progress, Map for O(1) status lookup, fixed ETA=0 empty span, removed unused BatchImageStatus import. Code review #2: memoized statusMap with useMemo, context-aware header text for partial failures, fixed icon colors to spec (green-500/red-500), added aria-label to all status overlays. Code review #3: fixed processing speed denominator to use progress.completed (all finished) instead of successCount (successes only), fixed useMemo dependency to use batchStatus (stable semantic dep), removed redundant Math.max(0,...) guard on ETA.
- `client/src/index.css` — Added thin-scrollbar utility class for cross-browser scrollbar styling (scrollbar-width + webkit pseudo-elements)
- `client/src/types/index.ts` — Fixed BatchImageStatus.status from 'success' to 'completed' to match backend. Code review #3: removed dead ProcessingState interface (unused after processing was simplified to boolean in review #2).
- `src/services/batch-tracking.service.ts` — Modified: refactored updateImageResult() to call updateProgressCounts() and completeBatch() for accurate real-time progress tracking needed by ProcessingView polling. (Note: backend change was necessary for correct progress counts despite frontend-only story scope.)
- `vite.config.ts` — Added `allowedHosts: true` for dev server and `/temp` proxy to localhost:3000 for backend temp URL serving.

### Change Log

- 2026-03-21: Implemented Story 5.3 — Processing View & Real-Time Status. Rewrote ProcessingView.tsx with per-image status thumbnails, enhanced progress info (count, speed, ETA), smooth CSS transitions, and auto-transition to results. Refactored app.tsx completion flow to remove alert() calls and use three-way view routing with ProcessingView managing transition timing.
- 2026-03-21: Code review #1 fixes (8 issues: 1 HIGH, 2 MEDIUM, 5 LOW). H1: Added onComplete to useEffect deps + useCallback. M1: Removed dead setProcessing updates in polling loop. M2: Added setBatchStatus(null) in error catch. L1: Math.min(100,...) progress guard. L2: Cross-browser thin-scrollbar CSS class. L3: Map for O(1) status lookup. L4: Fixed empty span when ETA=0. L5: Removed redundant type annotations.
- 2026-03-21: Code review #2 fixes (7 issues: 1 HIGH, 3 MEDIUM, 3 LOW). H1: Simplified processing state to boolean — removed dead currentIndex/currentFileName fields. M1: Wrapped onBackToUpload in useCallback (+ memoized handleClear with functional updater). M2: Context-aware header text — "Processing failed"/"Processing finished"/"Processing complete!" based on failure state. M3: Partial progress CSV recovery in polling error catch via lastStatusData tracking. L1: Added aria-label to all status overlays for accessibility. L2: Fixed icon colors to match spec (green-500, red-500). L3: Memoized statusMap with useMemo.
- 2026-03-23: Code review #3 fixes (8 issues: 1 HIGH, 4 MEDIUM, 3 LOW). H1: Documented backend change (batch-tracking.service.ts) that was made outside frontend-only story scope. M1: Added 3 missing files to File List (types/index.ts, batch-tracking.service.ts, vite.config.ts). M2: Documented allowedHosts + /temp proxy in vite.config.ts. M3: Fixed processing speed denominator — was dividing by successCount (excludes failed), now uses progress.completed (all finished). M4: Removed dead ProcessingState interface from types/index.ts. L1: Fixed useMemo dependency from batchStatus?.images to batchStatus. L2: Removed misleading async/await from handleProcessMore. L3: Removed redundant Math.max(0,...) guard on ETA display.
