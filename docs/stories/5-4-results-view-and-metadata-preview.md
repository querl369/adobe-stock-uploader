# Story 5.4: Results View & Metadata Preview

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see the generated metadata before downloading the CSV,
so that I can verify the AI output and feel confident in the results.

## Acceptance Criteria

### AC1: Results Summary Banner

**Given** batch processing has completed (transitioned from ProcessingView)
**When** the ResultsView is displayed
**Then** a summary banner shows at the top:

- **All success:** "10 of 10 images processed successfully"
- **Partial failure:** "8 of 10 images processed (2 failed)"
- **Total processing time:** "Completed in 42 seconds" (calculated from batch start to completion)
- The banner uses the existing `grain-gradient` card styling
- Success count uses `tabular-nums` for stable digit width

### AC2: Metadata Preview Table

**Given** the results view is displayed with processed images
**When** the user views the metadata table
**Then** a scrollable table shows all processed images:

- **Columns:** Thumbnail (40x40 rounded), Filename, Title, Keywords (truncated to ~50 chars with full text on hover), Category
- **Failed images:** shown with red-tinted row, error reason in place of metadata columns
- **Uses shadcn/ui Table component** (already installed: Table, TableHeader, TableBody, TableRow, TableHead, TableCell)
- Table wrapped in `max-h-[400px] overflow-y-auto` scrollable container (matches UploadView grid pattern)
- Keywords column shows first ~50 chars with ellipsis; full text in `title` attribute tooltip

### AC3: Download Experience

**Given** the metadata table is displayed
**When** the user wants to download the CSV
**Then:**

- Prominent "Download CSV" button (primary dark CTA, matching existing button style)
- Initials input field shown in results view (pre-filled with value from upload flow)
- User can edit initials before re-downloading
- Clicking "Download CSV" generates and downloads the CSV client-side using existing `generateCSV()` + `downloadCSV()` utilities
- Download does NOT navigate away from the page
- Button text changes briefly to "Downloaded!" for 2 seconds after click (visual feedback without toast)

### AC4: Post-Download Actions

**Given** the CSV has been downloaded (or user is viewing results)
**When** the user wants to continue
**Then:**

- "Process More Images" button — returns to upload view, clears all state (existing `handleProcessMore` behavior)
- "Download CSV" button always available for re-downloads with current initials value
- Both buttons visible below the metadata table

### AC5: Batch History Section

**Given** the results view is displayed
**When** previous batches exist for this session
**Then** a "Recent Batches" section appears below the current results:

- Fetches from `GET /api/batches` (implemented in Story 4.3)
- Shows last 10 batches: date/time, image count, success/fail counts, status
- Each batch with `csvAvailable: true` shows a "Re-download" button
- Re-download triggers `GET /api/download-csv/:batchId` (implemented in Story 4.2)
- If no previous batches or batch persistence unavailable: section is hidden (not an error)
- Uses compact card or list layout (NOT the full Table component — keep it visually distinct from metadata preview)

### AC6: Data Flow Changes in app.tsx

**Given** the current completion flow clears `batchStatus` on transition to results
**When** Story 5.4 is implemented
**Then:**

- `batchStatus` is NOT cleared when transitioning from processing to results (`handleProcessingComplete` only sets view)
- `batchStatus` is cleared when user clicks "Process More" (`handleProcessMore`)
- `initials` is passed to ResultsView as a prop (pre-filled, editable)
- `images` (with metadata populated from polling loop) passed to ResultsView
- ResultsView receives `batchStatus` for summary banner (progress counts, timing)
- New `onInitialsChange` callback prop for ResultsView to update initials in app state

### AC7: Existing Functionality Preserved

**Given** all current features work from Stories 5.1–5.3
**When** results view enhancements are added
**Then** the following MUST still work identically:

- CSV auto-download during processing completion (unchanged — happens in polling loop)
- View state transitions: upload -> processing -> results -> upload
- All upload, validation, drag-and-drop functionality (untouched)
- Processing view with per-image status (untouched)
- All custom CSS effects (grain texture, grain-gradient, lava lamp button)
- Object URL memory management

### AC8: No New Dependencies

**Given** the existing dependency list
**When** the story is complete
**Then** NO new npm packages are added. Uses only existing packages:

- shadcn/ui `Table` component (already installed)
- `lucide-react` (already installed) — for download icon, clock icon, etc.
- Existing `generateCSV()` and `downloadCSV()` utilities from `client/src/utils/csv.ts`

**Note:** Sonner toast is NOT used in this story — the `sonner.tsx` component imports `next-themes` and `sonner` packages which are NOT installed. Toast notifications are deferred to Story 5.7. Download feedback uses inline button text change instead.

## Tasks / Subtasks

- [x] Task 1: Update app.tsx completion flow for ResultsView data (AC: #6)
  - [x] Remove `setBatchStatus(null)` from `handleProcessingComplete` — keep batchStatus for ResultsView
  - [x] Move `setBatchStatus(null)` to `handleProcessMore` (clear on "Process More" only)
  - [x] Update ResultsView props: add `images`, `batchStatus`, `initials`, `onInitialsChange`, `onDownloadCsv`
  - [x] Create `handleDownloadCsv` function using existing `generateCSV()` + `downloadCSV()`
  - [x] Pass all new props to ResultsView in view routing

- [x] Task 2: Add batch history API to client (AC: #5)
  - [x] Add `BatchHistoryItem` interface to `client/src/types/index.ts`
  - [x] Add `BatchHistoryResponse` interface to `client/src/types/index.ts`
  - [x] Add `getBatches(): Promise<BatchHistoryResponse>` to `client/src/api/client.ts`
  - [x] Add `downloadBatchCsv(batchId: string): Promise<void>` to `client/src/api/client.ts` (triggers file download via fetch + blob)

- [x] Task 3: Implement results summary banner (AC: #1)
  - [x] Calculate processing time from batchStatus timestamps or elapsed time
  - [x] Display success/failure counts from `batchStatus.progress`
  - [x] Use `grain-gradient` card styling matching ProcessingView
  - [x] Use `tabular-nums` for numeric displays

- [x] Task 4: Implement metadata preview table (AC: #2)
  - [x] Import shadcn/ui Table components
  - [x] Render table with columns: Thumbnail, Filename, Title, Keywords, Category
  - [x] Map `images` array to table rows (only images with metadata)
  - [x] Show failed images (from batchStatus) with error reason, red-tinted styling
  - [x] Truncate keywords with ellipsis and `title` tooltip for full text
  - [x] Wrap table in scrollable container `max-h-[400px] overflow-y-auto`
  - [x] Render 40x40 rounded thumbnails from `image.preview` Object URLs

- [x] Task 5: Implement download experience (AC: #3)
  - [x] Add initials input field (pre-filled from prop, editable, calls `onInitialsChange`)
  - [x] Add "Download CSV" primary button
  - [x] On click: call `onDownloadCsv` which generates CSV from current images + initials
  - [x] Button text feedback: changes to "Downloaded!" for 2 seconds, then reverts
  - [x] Use `useState` for download feedback state with `setTimeout` cleanup

- [x] Task 6: Implement post-download actions (AC: #4)
  - [x] "Process More Images" button (existing `onProcessMore` callback)
  - [x] Layout: initials input + download button on one row, "Process More" below
  - [x] Both buttons always visible below the metadata table

- [x] Task 7: Implement batch history section (AC: #5)
  - [x] Fetch batch history from `getBatches()` on ResultsView mount via `useEffect`
  - [x] Handle loading state (spinner), empty state (hide section), error state (hide section)
  - [x] Render compact list of previous batches with date, image count, status
  - [x] Add "Re-download" button for batches with `csvAvailable: true`
  - [x] Re-download uses `downloadBatchCsv(batchId)` from API client
  - [x] Format dates for readability (e.g., "Mar 23, 2:15 PM")

- [ ] Task 8: Verify all existing functionality (AC: #7)
  - [x] Build passes: `npm run build`
  - [x] All backend tests pass: `npm test`
  - [ ] Manual verification: CSV still auto-downloads on processing completion
  - [ ] Manual verification: results view shows metadata table after processing
  - [ ] Manual verification: "Download CSV" button re-downloads with current initials
  - [ ] Manual verification: "Process More" clears state and returns to upload
  - [ ] Manual verification: batch history shows previous batches (if any exist)
  - [ ] Manual verification: all upload/processing features still work

## Dev Notes

### Current Frontend Architecture (from Stories 5.1–5.3)

```
client/src/
├── api/
│   └── client.ts              # ApiError class + uploadImages, startBatchProcessing, getBatchStatus, cleanup
├── components/
│   ├── ui/                    # shadcn/ui (DO NOT MODIFY)
│   │   ├── table.tsx          # Table, TableHeader, TableBody, TableRow, TableHead, TableCell
│   │   ├── sonner.tsx         # BROKEN — imports next-themes (not installed). DO NOT USE.
│   │   ├── progress.tsx       # Used by ProcessingView
│   │   ├── input.tsx          # Used by app.tsx for initials
│   │   └── label.tsx          # Used by app.tsx
│   ├── AppHeader.tsx          # Fixed top navigation (static)
│   ├── AppFooter.tsx          # Fixed bottom footer (static)
│   ├── UploadView.tsx         # Upload zone + image grid (193 lines) — NOT modified in this story
│   ├── ProcessingView.tsx     # Processing status grid (197 lines) — NOT modified in this story
│   └── ResultsView.tsx        # Placeholder (24 lines) ← PRIMARY EDIT TARGET — major rewrite
├── types/
│   └── index.ts               # UploadedImage, BatchStatusResponse, etc.
├── utils/
│   ├── csv.ts                 # generateCSV() and downloadCSV() — used for download
│   ├── format.ts              # formatFileSize()
│   └── validation.ts          # validateFiles()
├── app.tsx                    # Thin orchestrator (321 lines) — SECONDARY EDIT TARGET
├── index.css                  # Tailwind v4 + grain/lava-lamp effects
└── main.tsx                   # Entry point (untouched)
```

### Files to Modify

| File                                    | Change Type   | What Changes                                                                                     |
| --------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| `client/src/components/ResultsView.tsx` | MAJOR REWRITE | From 24 lines to ~250-300 lines. Summary banner, metadata table, download, batch history.        |
| `client/src/app.tsx`                    | MODIFY        | Update completion flow (keep batchStatus), pass new props to ResultsView, add handleDownloadCsv. |
| `client/src/api/client.ts`              | MODIFY        | Add `getBatches()` and `downloadBatchCsv()` functions.                                           |
| `client/src/types/index.ts`             | MODIFY        | Add `BatchHistoryItem` and `BatchHistoryResponse` interfaces.                                    |

### Current ResultsView.tsx (24 lines — to be rewritten)

```typescript
interface ResultsViewProps {
  onProcessMore: () => void;
}

export function ResultsView({ onProcessMore }: ResultsViewProps) {
  return (
    <div className="w-full max-w-3xl px-4 text-center space-y-6">
      <div className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-2 border-border/20 rounded-2xl p-8 space-y-4">
        <div className="text-[1.25rem] tracking-[-0.02em] opacity-90">Processing Complete</div>
        <p className="tracking-[-0.01em] opacity-50 text-[0.9rem]">
          Your CSV file has been downloaded.
        </p>
        <button onClick={onProcessMore} className="grain-gradient px-8 py-3 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] ...">
          <span className="relative z-10">Process More Images</span>
        </button>
      </div>
    </div>
  );
}
```

→ Rewrite to receive `images`, `batchStatus`, `initials`, callbacks and render summary banner, metadata table, download controls, and batch history.

### New ResultsView Props Interface

```typescript
interface ResultsViewProps {
  images: UploadedImage[];
  batchStatus: BatchStatusResponse | null;
  initials: string;
  processingDuration: number | null;
  onInitialsChange: (value: string) => void;
  onDownloadCsv: () => void;
  onProcessMore: () => void;
}
```

### Backend API Endpoints Used by ResultsView

| Endpoint                         | Method | Purpose                      | Response Shape                                   |
| -------------------------------- | ------ | ---------------------------- | ------------------------------------------------ |
| `GET /api/batches`               | GET    | List session's batch history | `{ success: true, batches: BatchHistoryItem[] }` |
| `GET /api/download-csv/:batchId` | GET    | Re-download CSV from history | Binary CSV file download                         |

### Backend Batch History Response Shape

From `batch.routes.ts` (`mapBatchRowToResponse`):

```typescript
interface BatchHistoryItem {
  batchId: string;
  status: string; // 'completed' | 'failed'
  imageCount: number;
  successfulCount: number;
  failedCount: number;
  csvFileName: string | null;
  createdAt: string; // ISO 8601 timestamp
  completedAt: string; // ISO 8601 timestamp
  expiresAt: string; // ISO 8601 timestamp
  csvAvailable: boolean; // Whether CSV file still exists on disk
}
```

### New API Client Functions

```typescript
// client/src/api/client.ts

export async function getBatches(): Promise<BatchHistoryResponse> {
  const response = await fetch('/api/batches');
  return handleResponse<BatchHistoryResponse>(response);
}

export async function downloadBatchCsv(batchId: string): Promise<void> {
  const response = await fetch(`/api/download-csv/${batchId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
    throw new ApiError(errorData.message || 'Download failed', response.status);
  }
  // Trigger browser download from blob
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] || `batch-${batchId}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

### App.tsx Changes

**Completion flow change — CRITICAL:**

Current `handleProcessingComplete`:

```typescript
const handleProcessingComplete = useCallback(() => {
  setView('results');
  setBatchStatus(null); // ← REMOVE THIS LINE
}, []);
```

New:

```typescript
const handleProcessingComplete = useCallback(() => {
  setView('results');
  // Do NOT clear batchStatus — ResultsView needs it for summary
}, []);
```

Move `setBatchStatus(null)` to `handleProcessMore`:

```typescript
const handleProcessMore = () => {
  handleClear();
  setBatchStatus(null); // Clear here instead
  setView('upload');
};
```

**New handler:**

```typescript
const handleDownloadCsv = useCallback(() => {
  const csvData = images
    .filter(img => img.title && img.keywords && img.category)
    .map(img => ({
      filename: img.file.name,
      title: img.title!,
      keywords: img.keywords!,
      category: img.category!,
    }));
  if (csvData.length > 0) {
    downloadCSV(generateCSV(csvData, initials), `${initials}_${Date.now()}.csv`);
  }
}, [images, initials]);
```

**Updated view routing:**

```tsx
{view === 'results' ? (
  <ResultsView
    images={images}
    batchStatus={batchStatus}
    initials={initials}
    onInitialsChange={setInitials}
    onDownloadCsv={handleDownloadCsv}
    onProcessMore={handleProcessMore}
  />
) : view === 'processing' ? (
  <ProcessingView ... />
) : (
  <>
    <UploadView ... />
    ...initials input + buttons...
  </>
)}
```

**Note:** The initials input in the upload view stays (needed before processing). ResultsView also shows it for re-downloads. The upload-view initials input is only visible when `view === 'upload'`, so there's no duplication visible to the user.

### ResultsView Layout Design

```
┌─────────────────────────────────────────────────────────────────┐
│ ✓ 8 of 10 images processed successfully (2 failed)             │
│   Completed in 42 seconds                                       │
└─────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ [img] │ photo.jpg  │ Sunset over ocean │ sunset, ocean... │ 18  │
│ [img] │ cat.png    │ Tabby cat sitting │ cat, tabby, pe...│ 2   │
│ [img] │ fail.jpg   │ ✗ Error: API timeout                       │
│ ...                                                               │
└───────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Initials: [OY___]    [   Download CSV   ]                     │
│                       [ Process More Images ]                  │
└────────────────────────────────────────────────────────────────┘

Recent Batches
┌────────────────────────────────────────────────────────────────┐
│ Mar 23, 2:15 PM  •  5 images  •  5 successful  [Re-download] │
│ Mar 22, 10:30 AM •  3 images  •  2 successful  [Re-download] │
└────────────────────────────────────────────────────────────────┘
```

### Metadata Table Columns

| Column    | Content                                     | Width      | Notes                                    |
| --------- | ------------------------------------------- | ---------- | ---------------------------------------- |
| Thumbnail | 40x40 rounded `object-cover` from `preview` | `w-10`     | Object URL from `image.preview`          |
| Filename  | `image.file.name` truncated                 | `max-w-32` | `truncate` class with full name on hover |
| Title     | `image.title` from AI metadata              | flex       | Full text visible (wraps if needed)      |
| Keywords  | First ~50 chars of `image.keywords`         | `max-w-48` | `truncate` + `title` for full text       |
| Category  | `image.category` number                     | `w-16`     | Adobe Stock category ID                  |

For **failed images**, span columns 3-5 with error text in red.

### Mapping Images to Results

Images with metadata populated:

```typescript
const successImages = images.filter(img => img.title && img.keywords && img.category);
```

Failed images — need to cross-reference with `batchStatus.images`:

```typescript
const failedBatchImages = batchStatus?.images.filter(bi => bi.status === 'failed') ?? [];
```

To match a failed batch image to an UploadedImage for its preview:

```typescript
const failedImage = images.find(img => img.fileId === batchImg.id);
```

### Processing Time Calculation

The `batchStatus` doesn't include explicit start/end timestamps on the frontend. Options:

1. Track `processingStartTime` in app.tsx when processing begins
2. Calculate from batch status timing

**Recommended approach:** Add `processingStartTime` state to app.tsx:

```typescript
const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);

// In handleGenerateMetadata, before setting view to processing:
setProcessingStartTime(Date.now());

// Pass to ResultsView as prop for "Completed in X seconds" calculation
```

Or simpler: store elapsed time when processing completes:

```typescript
const [processingDuration, setProcessingDuration] = useState<number | null>(null);

// In handleProcessingComplete, or right before it's called
```

**Simplest approach (recommended):** Use ProcessingView's `startTime` pattern — track in app.tsx:

```typescript
// Add to handleGenerateMetadata, right before setView('processing'):
setProcessingStartTime(Date.now());

// In handleProcessingComplete:
setProcessingDuration(
  processingStartTime ? Math.round((Date.now() - processingStartTime) / 1000) : null
);
```

Then pass `processingDuration` to ResultsView.

### Download Button Feedback Pattern

```typescript
const [downloadFeedback, setDownloadFeedback] = useState(false);

const handleDownload = () => {
  onDownloadCsv();
  setDownloadFeedback(true);
  setTimeout(() => setDownloadFeedback(false), 2000);
};

// Button text:
{
  downloadFeedback ? 'Downloaded!' : 'Download CSV';
}
```

### Batch History Date Formatting

```typescript
function formatBatchDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
// Output: "Mar 23, 2:15 PM"
```

### Sonner Toast — NOT AVAILABLE

The `client/src/components/ui/sonner.tsx` imports:

```typescript
import { useTheme } from 'next-themes@0.4.6';
import { Toaster as Sonner, ToasterProps } from 'sonner@2.0.3';
```

Neither `next-themes` nor `sonner` are in `package.json`. This component is BROKEN and CANNOT be used. Toast notifications are deferred to Story 5.7 which will:

1. Install `sonner` package
2. Rewrite `sonner.tsx` without `next-themes` dependency (or install it)
3. Add `<Toaster />` to App

For this story, download feedback uses inline button text change ("Downloaded!") instead of toast.

### What NOT to Do

- Do NOT install `sonner` or `next-themes` — that's Story 5.7 scope
- Do NOT modify ProcessingView.tsx — completed in Story 5.3
- Do NOT modify UploadView.tsx — completed in Story 5.2
- Do NOT add dark mode toggle — that's Story 5.5
- Do NOT add responsive breakpoints — that's Story 5.6
- Do NOT modify shadcn/ui components in `client/src/components/ui/`
- Do NOT write frontend tests — no frontend test infrastructure exists yet
- Do NOT touch backend code — this is a frontend-only story
- Do NOT add Framer Motion or any animation library — CSS transitions only
- Do NOT create custom React hooks — premature abstraction for this scope
- Do NOT change `main.tsx` or Vite config
- Do NOT add `alert()` calls — use inline feedback patterns
- Do NOT remove the CSV auto-download during processing (it stays in the polling loop)
- Do NOT use the `batch-status` endpoint in ResultsView — use the `batchStatus` prop passed from app.tsx

### Project Structure Notes

- ResultsView.tsx is the primary edit target — major rewrite from 24 to ~250-300 lines
- app.tsx changes are moderate — update completion flow, add new handler, pass props
- client.ts gets 2 new API functions
- types/index.ts gets 2 new interfaces
- No new files needed — all changes to existing files
- The metadata table should use shadcn/ui Table for consistency with the design system
- Alignment with architecture: ResultsView stays as a presentational component, app.tsx manages state

### References

- [Source: docs/epics.md#Story-5.4-Results-View-Metadata-Preview] — User story and acceptance criteria
- [Source: docs/stories/5-3-processing-view-and-real-time-status.md] — Previous story with completion flow, ProcessingView patterns, code review learnings
- [Source: docs/stories/5-2-upload-experience-and-file-validation.md] — Upload view patterns, thumbnail card styling
- [Source: docs/stories/5-1-component-architecture-and-app-decomposition.md] — Architecture patterns, component boundaries
- [Source: docs/PRD.md#FR-8-Simple-Progress-Feedback] — Progress and results requirements
- [Source: docs/architecture/architecture-client.md] — Frontend component architecture, design system
- [Source: client/src/components/ResultsView.tsx] — Current placeholder implementation (24 lines)
- [Source: client/src/app.tsx] — Current orchestrator with completion flow (lines 126-192, 217-230, 250-312)
- [Source: client/src/types/index.ts] — Existing type definitions (UploadedImage, BatchStatusResponse)
- [Source: client/src/api/client.ts] — API client (needs getBatches, downloadBatchCsv additions)
- [Source: client/src/utils/csv.ts] — generateCSV() and downloadCSV() for re-download
- [Source: client/src/components/ui/table.tsx] — shadcn/ui Table component (installed, ready to use)
- [Source: client/src/components/ui/sonner.tsx] — BROKEN — imports uninstalled packages (next-themes, sonner). DO NOT USE.
- [Source: src/api/routes/batch.routes.ts] — Backend GET /api/batches (lines 325-343) and batch history response shape
- [Source: src/api/routes/csv.routes.ts] — Backend GET /api/download-csv/:batchId (lines 134-232) for re-download
- [Source: src/services/batch-persistence.service.ts] — BatchRow interface, getBatchesBySession() query

### Previous Story Intelligence (Stories 5.1–5.3)

**Patterns established:**

- Prop drilling from App to view components (no Context/Redux needed)
- Functional state updaters for concurrent-safe updates: `setImages(prev => prev.filter(...))`
- API client in `client/src/api/client.ts` with `ApiError` class for centralized error handling
- Pure utilities in `client/src/utils/` (csv.ts, format.ts, validation.ts)
- Static presentational components (AppHeader, AppFooter) vs stateful view components
- View state routing: `const [view, setView] = useState<AppView>('upload')`
- Thumbnail card pattern: `grain-gradient` + `rounded-2xl` + `overflow-hidden`
- Three-way view routing: results / processing / upload (from Story 5.3)
- Status maps with `useMemo` for O(1) lookups
- `useCallback` for handlers passed as props to prevent unnecessary re-renders

**Code review fixes to learn from (accumulated across 5.1-5.3):**

- Always use functional updaters for state that depends on previous value (stale closure fix)
- Use `type: unknown` over `any` for better safety
- Disable non-functional placeholder UI elements
- Add cleanup in useEffect returns (timers, object URLs)
- Use `tabular-nums` class for numeric displays to prevent layout shift
- `Math.max(0, ...)` guards for values that could go negative
- Wrap handlers in `useCallback` when passed as props
- Memoize derived data with `useMemo` (e.g., statusMap)
- Use context-aware header text (different messages for different states)
- Add `aria-label` for accessibility on interactive/status elements

**Build/test baseline:**

- Build: `npm run build` — 1807 modules
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

**React 19 (current):** `useState` functional updaters, `useEffect` cleanup patterns, `useCallback` and `useMemo` all standard. `useEffect` with empty deps for one-time fetch (batch history) is the correct pattern.

**Tailwind CSS v4 (current):** All utility classes work dynamically. `tabular-nums`, `truncate`, `max-w-*`, `overflow-y-auto` all available. No custom CSS needed.

**lucide-react v0.553.0 (current):** Icons import as React components. Useful icons for this story: `Download`, `RefreshCw`, `CheckCircle`, `Clock`, `AlertCircle`. Usage: `import { Download } from 'lucide-react'`.

**shadcn/ui Table (current):** Components: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`. Import from `'./ui/table'`. The table container has built-in `overflow-x-auto` for horizontal scrolling.

**Backend batch history:** `GET /api/batches` returns `{ success: true, batches: [...] }` with up to 10 non-expired batches ordered by `created_at DESC`. Uses `better-sqlite3` with 24-hour anonymous expiry. The endpoint requires session middleware (cookie-based).

**Backend CSV download:** `GET /api/download-csv/:batchId` validates session ownership, checks CSV file exists on disk, and streams the file with `Content-Disposition` header. Returns 404 if expired or not owned.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Updated app.tsx completion flow — removed `setBatchStatus(null)` from `handleProcessingComplete`, added `processingDuration` state tracking via local `startTime` variable (avoids stale closure), created `handleDownloadCsv` with `useCallback`, passed all new props to ResultsView
- Task 2: Added `BatchHistoryItem` and `BatchHistoryResponse` interfaces to types/index.ts. Added `getBatches()` and `downloadBatchCsv()` to API client — `downloadBatchCsv` uses fetch+blob pattern with Content-Disposition filename extraction
- Task 3: Summary banner shows success/failure counts with `tabular-nums`, processing duration with clock icon, uses `grain-gradient` card styling, AlertCircle/CheckCircle icons for status
- Task 4: Metadata table uses shadcn/ui Table components, 40x40 rounded thumbnails, truncated keywords with title tooltip, failed images shown with red-tinted rows and error reason spanning columns 3-5, wrapped in `max-h-[400px] overflow-y-auto` container
- Task 5: Download button with "Downloaded!" feedback for 2s via useState+setTimeout, initials input pre-filled and editable, Download disabled when no successful images
- Task 6: Layout — initials + download button on same row (flex), "Process More Images" full-width below with RefreshCw icon
- Task 7: Batch history fetched on mount via useEffect with cancellation flag, loading/empty/error states hide section gracefully, compact card layout with formatted dates, re-download button for csvAvailable batches
- Task 8: Build passes (1808 modules), all 965 tests pass (30 files), no regressions. Manual verification items left for user.

### Change Log

- 2026-03-23: Implemented Story 5.4 — ResultsView rewrite with summary banner, metadata preview table, download experience, batch history section. Updated app.tsx completion flow to preserve batchStatus for ResultsView.
- 2026-03-23: Code review fixes (8 issues: 1H, 3M, 4L) — H1: Fixed timer leak in handleDownload (useRef+useEffect cleanup). M1: Removed duplicate handleProcessMore, reuse useCallback-wrapped handleBackToUpload. M2: Download CSV disabled when initials empty. M3: Added inline error feedback on batch re-download failure. L1: Consolidated duplicate handlers. L2: Added loading state text for batch history. L3: Reset processingDuration in handleClear. L4: Added comment explaining successCount formula.
- 2026-03-24: Code review 2 fixes (7 issues: 1H, 3M, 3L) — H1: Added Math.max(0) guard on successCount. M2: AbortController for batch history fetch. M3+L1: Specific error messages and multi-batch error tracking for re-download failures. L3: Semantic aria-labelledby landmark on batch history section. M1: Unchecked Task 8 (manual verification pending). L2: Updated props interface in spec.
- 2026-03-24: Code review 3 fixes (7 issues: 3M, 4L) — M1: Added useMemo for successImages/failedBatchImages derived arrays. M2: Added loading+disabled state for batch re-download button. M3: Sticky table headers in scrollable container. L1: "Completed in less than a second" for 0s duration. L2: Success feedback on batch re-download. L3: Disabled download button during feedback period. L4: Updated File List line count.

### File List

- `client/src/components/ResultsView.tsx` — MAJOR REWRITE (24 → ~350 lines): summary banner, metadata table, download controls, batch history
- `client/src/app.tsx` — MODIFIED: completion flow (keep batchStatus), processingDuration state, handleDownloadCsv handler, new ResultsView props
- `client/src/api/client.ts` — MODIFIED: added getBatches() and downloadBatchCsv() functions
- `client/src/types/index.ts` — MODIFIED: added BatchHistoryItem and BatchHistoryResponse interfaces
- `docs/sprint-status.yaml` — MODIFIED: story status updated to in-progress
