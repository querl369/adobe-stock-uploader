# Story 5.2: Upload Experience & File Validation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want clear feedback when selecting images — file counts, sizes, and validation errors,
so that I understand what I've selected and catch problems before processing.

## Acceptance Criteria

### AC1: Client-Side File Validation with Inline Feedback

**Given** the user selects or drops files into the upload zone
**When** any file fails validation
**Then** inline error messages appear near the upload zone (NOT `alert()` dialogs):

- Invalid file type: "File type not supported. Use JPG, PNG, or WEBP." — shown per rejected file
- Oversized file: "File too large. Maximum 50MB per image." — shown per rejected file
- Over-limit: "Too many files. Anonymous users can process 10 images." — shown once if total would exceed 10

**And** valid files from the same selection are still accepted (partial rejection)
**And** error messages auto-dismiss after 5 seconds or when user adds new files
**And** validation runs entirely client-side before any API call
**And** validation constants match backend: MIME types `image/jpeg, image/png, image/webp`, max size 50MB, max count 10

### AC2: Upload Zone Metadata Display

**Given** the user has added images
**When** the UploadView shows the image grid
**Then** the following metadata is displayed above the grid:

- File count with limit context: "3 of 10 images added" (replaces current "3 images" display)
- Total file size: "Total: 12.5 MB" (sum of all original file sizes)

**And** when the 10-image limit is reached:

- The "Add more images" link is hidden or visually disabled
- The upload zone shows "Limit reached" state (muted styling)
- The file input `accept` still works but the count validation blocks excess

### AC3: Thumbnail Enhancements

**Given** images are displayed in the thumbnail grid
**When** viewing the grid
**Then** each thumbnail card shows:

- File name (truncated with ellipsis if longer than ~15 chars) below the image
- File size in human-readable format (e.g., "2.4 MB") below the file name
- Smooth fade-in animation when newly added (CSS `opacity` + `translate` transition, 300ms)

**And** the delete button hover behavior:

- Delete (X) button appears on hover (existing behavior, preserved)
- On click, image is deleted immediately (current behavior preserved — no confirmation dialog needed per simplicity principle)

### AC4: File Size Formatting Utility

**Given** the need to display human-readable file sizes in multiple places
**When** a utility function is created
**Then** `client/src/utils/format.ts` exports `formatFileSize(bytes: number): string`:

- Bytes < 1024 → "X B"
- Bytes < 1MB → "X.X KB"
- Bytes >= 1MB → "X.X MB"
- Used in both metadata display (AC2) and thumbnail captions (AC3)

### AC5: Validation Utility Module

**Given** the need for reusable client-side validation
**When** a validation module is created
**Then** `client/src/utils/validation.ts` exports:

- `ALLOWED_MIME_TYPES: string[]` — `['image/jpeg', 'image/png', 'image/webp']`
- `MAX_FILE_SIZE_BYTES: number` — `50 * 1024 * 1024` (50MB)
- `MAX_IMAGE_COUNT: number` — `10`
- `validateFiles(files: File[], currentCount: number): { valid: File[]; errors: ValidationError[] }` — validates type, size, and count
- `ValidationError` interface: `{ fileName: string; reason: string }`

### AC6: Existing Functionality Preserved

**Given** all current features work from Story 5.1
**When** validation and UI enhancements are added
**Then** the following MUST still work identically:

- Drag-and-drop image upload via react-dnd (full-page DropZone in App)
- Click-to-open file picker via hidden `<input type="file">`
- Visual drag hover feedback (isDragging state)
- Thumbnail grid with 4-column layout in scrollable container
- Individual image delete button (X) on hover
- "Add more images" link (when under limit)
- `alert()` for API errors (server-side failures) — NOT replaced until Story 5.7
- All custom CSS effects (grain texture, grain-gradient, lava lamp button)
- Object URL memory management (revokeObjectURL on delete and clear)

### AC7: No New Dependencies

**Given** the existing dependency list
**When** the story is complete
**Then** NO new npm packages are added. Uses only existing packages.

## Tasks / Subtasks

- [x] Task 1: Create file size formatting utility (AC: #4)
  - [x] Create `client/src/utils/format.ts` with `formatFileSize()` function
  - [x] Handle B, KB, MB ranges with 1 decimal place

- [x] Task 2: Create file validation utility (AC: #5)
  - [x] Create `client/src/utils/validation.ts`
  - [x] Export constants: `ALLOWED_MIME_TYPES`, `MAX_FILE_SIZE_BYTES`, `MAX_IMAGE_COUNT`
  - [x] Export `ValidationError` interface and `validateFiles()` function
  - [x] Validate file MIME type against allowed list
  - [x] Validate file size against 50MB limit
  - [x] Validate total count (current images + new files) against 10-image limit
  - [x] Return `{ valid, errors }` — partial acceptance of valid files

- [x] Task 3: Add validation to file selection flow in App (AC: #1)
  - [x] In `handleFileSelect()` in `app.tsx`: call `validateFiles()` before `uploadImages()`
  - [x] Store validation errors in new state: `const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])`
  - [x] Pass only valid files to `uploadImages()` (skip if none valid)
  - [x] Clear validation errors when user adds new files or after 5-second timeout
  - [x] Pass `validationErrors` and `setValidationErrors` to UploadView as props

- [x] Task 4: Display inline validation errors in UploadView (AC: #1)
  - [x] Add validation error display section below the upload zone / above the grid
  - [x] Style as subtle inline messages (red-tinted text, small font, near the upload zone)
  - [x] Show each error: file name + reason
  - [x] Auto-dismiss after 5 seconds (via useEffect timeout in App)

- [x] Task 5: Update upload zone metadata display (AC: #2)
  - [x] Change image count from "3 images" to "3 of 10 images added"
  - [x] Add total file size display: "Total: 12.5 MB" using `formatFileSize()`
  - [x] When at 10-image limit: hide "Add more images" link, show "Limit reached" text
  - [x] Mute the file input (disable or hide) when at limit

- [x] Task 6: Add file info under thumbnails (AC: #3)
  - [x] Display truncated file name below each thumbnail image
  - [x] Display file size (e.g., "2.4 MB") below file name
  - [x] Use `formatFileSize()` utility
  - [x] Ensure text doesn't overflow thumbnail card (truncate with ellipsis)

- [x] Task 7: Add thumbnail appearance animation (AC: #3)
  - [x] Add CSS transition for newly added images: fade-in + slight slide-up
  - [x] Use Tailwind `transition-all duration-300` + initial opacity/transform state
  - [x] No animation libraries — CSS transitions only

- [x] Task 8: Update shared types if needed (AC: #1, #5)
  - [x] Add `ValidationError` to types if shared across components
  - [x] Ensure UploadView props interface includes validation error props

- [x] Task 9: Verify all existing functionality (AC: #6)
  - [x] Build passes: `npm run build`
  - [x] All backend tests pass: `npm test`
  - [ ] Manual verification: drag-and-drop still works
  - [ ] Manual verification: click-to-upload still works
  - [ ] Manual verification: delete individual images works
  - [ ] Manual verification: validation errors display inline for bad files
  - [ ] Manual verification: valid files from mixed selection are accepted
  - [ ] Manual verification: "3 of 10 images added" displays correctly
  - [ ] Manual verification: file name and size show under thumbnails

## Dev Notes

### Current Frontend Architecture (from Story 5.1)

Story 5.1 decomposed the monolithic `client/src/app.tsx` (644 lines) into focused modules:

```
client/src/
├── api/
│   └── client.ts              # ApiError class + uploadImages, startBatchProcessing, getBatchStatus, cleanup
├── components/
│   ├── ui/                    # shadcn/ui (DO NOT MODIFY)
│   ├── AppHeader.tsx          # Fixed top navigation (static)
│   ├── AppFooter.tsx          # Fixed bottom footer (static)
│   ├── UploadView.tsx         # Upload zone + image grid (143 lines) ← PRIMARY EDIT TARGET
│   ├── ProcessingView.tsx     # Progress bar and status
│   └── ResultsView.tsx        # Results placeholder
├── types/
│   └── index.ts               # UploadedImage, ProcessingState, AppView, etc.
├── utils/
│   ├── csv.ts                 # generateCSV() and downloadCSV()
│   ├── format.ts              # NEW in this story: formatFileSize()
│   └── validation.ts          # NEW in this story: validateFiles()
├── app.tsx                    # Thin orchestrator (282 lines) — state, handlers, DropZone, view routing
├── index.css                  # Tailwind v4 + grain/lava-lamp effects
└── main.tsx                   # Entry point (untouched)
```

### Files to Modify

| File                                   | Change Type | What Changes                                                                                                                                  |
| -------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/utils/format.ts`           | NEW         | `formatFileSize()` utility                                                                                                                    |
| `client/src/utils/validation.ts`       | NEW         | `validateFiles()`, constants, `ValidationError` interface                                                                                     |
| `client/src/app.tsx`                   | MODIFY      | Add `validationErrors` state, integrate `validateFiles()` into `handleFileSelect()`, pass errors to UploadView, add auto-dismiss timeout      |
| `client/src/components/UploadView.tsx` | MODIFY      | Add inline validation errors, update metadata display ("X of 10"), add file info under thumbnails, add appearance animation, accept new props |
| `client/src/types/index.ts`            | MODIFY      | Add `ValidationError` interface if shared                                                                                                     |

### Current UploadView.tsx Key Structure (143 lines)

```typescript
// Two render paths:
// 1. Empty state (images.length === 0): drag zone with lava-button "Select Images"
// 2. Image grid state: header row + scrollable 4-col grid

// Props interface:
interface UploadViewProps {
  images: UploadedImage[];
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSelectImagesClick: () => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onImageDelete: (id: string) => void;
}
// NEW PROPS NEEDED: validationErrors, totalFileSize (or compute from images)
```

**Current image count display** (UploadView.tsx line 96-98):

```tsx
<span className="tracking-[-0.01em] opacity-40 text-[0.875rem] uppercase">
  {images.length} {images.length === 1 ? 'image' : 'images'}
</span>
```

→ Change to: `"3 of 10 images added"` + add total size

**Current thumbnail card** (UploadView.tsx lines 108-137):

```tsx
<div key={image.id} className="grain-gradient relative aspect-square rounded-2xl ...">
  <img src={image.preview} alt={image.file.name} className="w-full h-full object-cover" />
  <button onClick={() => onImageDelete(image.id)} className="absolute top-3 right-3 ...">
    X
  </button>
</div>
```

→ Add file name + size text below the image inside the card. Note: current card uses `aspect-square` — file info needs to fit below or overlay.

### Current handleFileSelect in app.tsx (lines 84-105)

```typescript
const handleFileSelect = async (files: File[]) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  if (imageFiles.length === 0) return;
  try {
    const result = await uploadImages(imageFiles);
    const newImages = imageFiles.map((file, index) => ({ ... }));
    setImages(prev => [...prev, ...newImages]);
    setIsDragging(false);
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Failed to upload images.');
  }
};
```

→ Insert `validateFiles()` call before `uploadImages()`. Replace `files.filter(file => file.type.startsWith('image/'))` with the validation utility. Set `validationErrors` state. Pass only `valid` files to `uploadImages()`.

### Backend Validation Constants (must match client-side)

From `src/api/routes/upload.routes.ts` and `src/config/app.config.ts`:

- **ALLOWED_MIME_TYPES**: `['image/jpeg', 'image/jpg', 'image/png', 'image/webp']`
- **MAX_FILE_SIZE**: `50 * 1024 * 1024` bytes (50MB, from `config.processing.maxFileSizeMB`)
- **MAX_FILES**: `10` (anonymous session limit, from `config.rateLimits.anonymous`)
- Note: backend also accepts `image/jpg` — include it in client validation for parity

### Thumbnail Card Layout Decision

Current thumbnails use `aspect-square` which fills the entire card with the image. To add file name + size below:

**Option A (Recommended):** Remove `aspect-square`, use a fixed height for the image area, and add a text section below. The card height grows slightly but file info is always visible.

```tsx
<div className="grain-gradient relative rounded-2xl overflow-hidden ...">
  <div className="aspect-square">
    <img src={image.preview} alt={image.file.name} className="w-full h-full object-cover" />
  </div>
  <div className="px-2 py-1.5 space-y-0.5">
    <p className="text-[0.7rem] opacity-60 truncate">{image.file.name}</p>
    <p className="text-[0.65rem] opacity-40">{formatFileSize(image.file.size)}</p>
  </div>
  <button ...>X</button>
</div>
```

**Option B:** Overlay text at the bottom of the image with a gradient scrim. Preserves aspect-square but text might be hard to read on light images.

### Validation Error Display Pattern

Show errors as a compact list between the upload zone header and the grid:

```tsx
{
  validationErrors.length > 0 && (
    <div className="space-y-1 mb-4">
      {validationErrors.map((err, i) => (
        <p key={i} className="text-[0.8rem] text-red-500/80 tracking-[-0.01em]">
          {err.fileName}: {err.reason}
        </p>
      ))}
    </div>
  );
}
```

Keep it minimal — no shadcn/ui Alert component needed for this (Alert is heavier than a simple text list). Consistent with the app's minimalist aesthetic.

### Appearance Animation Approach

For smooth fade-in of new thumbnails, use CSS only:

```tsx
// Add to each thumbnail card
className = '... animate-in';

// In index.css or as inline Tailwind:
// opacity-0 → opacity-100 with transition
```

Simplest approach: add `animate-fade-in` class with a CSS `@keyframes` in `index.css`, or use Tailwind's built-in `animate-` utilities. Since Tailwind v4 supports `@keyframes` in the theme, define a simple fade-in there or inline with Tailwind utilities.

### UploadedImage Type — File Size Access

The `UploadedImage` interface stores a `file: File` property. `File.size` gives bytes. No type changes needed for file size — it's already accessible via `image.file.size`.

For total file size calculation:

```typescript
const totalSize = images.reduce((sum, img) => sum + img.file.size, 0);
```

### What NOT to Do

- Do NOT add react-dropzone — project uses react-dnd
- Do NOT add any animation library (Framer Motion, etc.) — CSS transitions only
- Do NOT replace `alert()` for API errors — that's Story 5.7
- Do NOT add dark mode toggle — that's Story 5.5
- Do NOT add responsive breakpoints — that's Story 5.6
- Do NOT modify shadcn/ui components in `client/src/components/ui/`
- Do NOT write frontend tests — no frontend test infrastructure exists yet
- Do NOT touch backend code — this is a frontend-only story
- Do NOT add Sonner/toast notifications — that's Story 5.7
- Do NOT create custom React hooks — premature abstraction for this scope
- Do NOT change `main.tsx` or Vite config

### Project Structure Notes

- New files go in `client/src/utils/` (format.ts, validation.ts) — directory exists from Story 5.1
- Modified files: `client/src/app.tsx`, `client/src/components/UploadView.tsx`, possibly `client/src/types/index.ts`
- All Tailwind utility classes work dynamically (Tailwind CSS v4 with `@tailwindcss/vite` plugin)
- No pre-built CSS limitations — any Tailwind class is available
- Alignment with architecture: `client/src/utils/` is the correct location for pure utility functions

### References

- [Source: docs/epics.md#Story-5.2-Upload-Experience-File-Validation] — User story and acceptance criteria
- [Source: docs/stories/5-1-component-architecture-and-app-decomposition.md] — Previous story with full dev record and patterns
- [Source: docs/PRD.md#FR-2-Batch-Image-Upload] — Upload UX requirements
- [Source: docs/architecture/architecture-client.md] — Frontend component architecture
- [Source: src/api/routes/upload.routes.ts] — Backend validation constants (MIME types, file size, count limits)
- [Source: src/config/app.config.ts] — Backend config schema (MAX_FILE_SIZE_MB=50, ANONYMOUS_LIMIT=10)
- [Source: client/src/app.tsx] — Current orchestrator (282 lines) with handleFileSelect at lines 84-105
- [Source: client/src/components/UploadView.tsx] — Current upload view (143 lines) — primary edit target
- [Source: client/src/types/index.ts] — Shared type definitions (UploadedImage has file.size accessible)
- [Source: client/src/index.css] — Tailwind v4 config + custom effects (grain, lava-lamp)

### Previous Story Intelligence (Story 5.1)

**Patterns established:**

- Prop drilling from App to view components (no Context/Redux needed)
- Functional state updaters for concurrent-safe updates: `setImages(prev => prev.filter(...))`
- API client in `client/src/api/client.ts` with `ApiError` class for centralized error handling
- Pure utilities in `client/src/utils/` (csv.ts pattern)
- Static presentational components (AppHeader, AppFooter) vs stateful view components
- View state routing: `const [view, setView] = useState<AppView>('upload')`

**Code review fixes to learn from:**

- Always use functional updaters for state that depends on previous value (stale closure fix)
- RFC 4180 compliance for CSV (escape double quotes)
- Dynamic values preferred over hardcoded (copyright year)
- Replace deprecated APIs (`substr` → `substring`)
- Type `unknown` over `any` for better safety
- Disable non-functional placeholder UI elements

**Build/test baseline:**

- Build: `npm run build` — 152 modules, 281.87 KB JS + 37.34 KB CSS
- Tests: `npm test` — 965 tests passing across 30 test files
- No frontend tests exist or are expected

### Git Intelligence (Recent Commits)

```
f0f29a3 ASU-Complete Story 5.1 component architecture and app decomposition with code review fixes
f9147c8 ASU-Complete Story 4.3 batch history persistence with sprint planning updates
4f6f65f ASU-Complete Story 4.2 instant download endpoint with code review fixes
```

Commit format: `ASU-{short description}`

### Latest Tech Notes

**React 19 (current):** No special considerations. `useState` functional updaters, `useEffect` cleanup patterns all standard. No React 19 specific APIs needed for this story.

**Tailwind CSS v4 (current):** Utility classes like `text-red-500/80`, `animate-*`, `truncate`, `opacity-*` all work dynamically. Custom `@keyframes` can be added to `index.css` and referenced via class. The `@theme inline` block in `index.css` supports adding custom animations if needed, but inline Tailwind utilities should be sufficient.

**File API:** `File.type` returns MIME string (e.g., `"image/jpeg"`). `File.size` returns bytes as number. `File.name` returns original filename. All standard Web API — no polyfills needed.

**MIME type note:** Browsers may report JPEG files as either `image/jpeg` or `image/jpg`. The backend accepts both. The client validation should accept both: `['image/jpeg', 'image/jpg', 'image/png', 'image/webp']`.

### Validation Flow Diagram

```
User selects/drops files
        ↓
validateFiles(files, images.length)
        ↓
    ┌──────────┐
    │ For each  │
    │   file:   │
    └──────────┘
        ↓
  Check MIME type → fail → add to errors[]
        ↓ pass
  Check file size → fail → add to errors[]
        ↓ pass
  Add to valid[]
        ↓
  Check total count (valid[] + currentImages > 10)
        → truncate valid[] to fit, add count error
        ↓
  Return { valid, errors }
        ↓
  If errors.length > 0 → setValidationErrors(errors) + auto-dismiss timer
  If valid.length > 0 → uploadImages(valid) → setImages(prev => [...prev, ...newImages])
  If valid.length === 0 && errors.length > 0 → show errors only, no API call
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- No debug issues encountered. Build and tests passed on every iteration.

### Completion Notes List

- **Task 1:** Created `client/src/utils/format.ts` with `formatFileSize()` — handles B, KB, MB ranges with 1 decimal place
- **Task 2:** Created `client/src/utils/validation.ts` — exports `ALLOWED_MIME_TYPES` (including `image/jpg` for browser parity), `MAX_FILE_SIZE_BYTES` (50MB), `MAX_IMAGE_COUNT` (10), `ValidationError` interface, and `validateFiles()` with partial acceptance
- **Task 3:** Integrated `validateFiles()` into `handleFileSelect()` in `app.tsx` — replaces manual `file.type.startsWith('image/')` filter, adds validation error state with 5-second auto-dismiss timer
- **Task 4:** Added inline validation error display in both empty and grid states of UploadView — red-tinted text, compact list format
- **Task 5:** Updated metadata display from "3 images" to "3 of 10 images added" + "Total: X MB". At limit: hides "Add more" link, shows "Limit reached", disables file input
- **Task 6:** Restructured thumbnail card from `aspect-square` to image area + text section using Option A from Dev Notes. File name truncated with ellipsis, file size below
- **Task 7:** Added `fadeSlideIn` CSS keyframe animation in `index.css` — 300ms fade-in with 8px slide-up, referenced via `animate-[fadeSlideIn_300ms_ease-out]` Tailwind arbitrary value
- **Task 8:** `ValidationError` exported from `utils/validation.ts`, imported directly by `app.tsx` and `UploadView.tsx` — no changes to shared `types/index.ts` needed
- **Task 9:** Build passes (154 modules), 965 backend tests pass (no regressions). Manual verification pending user testing.

### Implementation Notes

- **No new dependencies added** (AC7 satisfied)
- **Backend code untouched** — frontend-only story
- **No shadcn/ui modifications** — all changes in app files and utilities
- **Validation error auto-dismiss:** Uses `useRef` for timer to avoid stale closures, cleared on new file selection
- **MIME type parity:** Client validation includes `image/jpg` alongside `image/jpeg` to match backend acceptance
- **Thumbnail card restructure:** Moved from `aspect-square` on the outer div to `aspect-square` on the inner image container, adding text below. This changes card height slightly but keeps all content visible.

### File List

| File                                                        | Change Type |
| ----------------------------------------------------------- | ----------- |
| `client/src/utils/format.ts`                                | NEW         |
| `client/src/utils/validation.ts`                            | NEW         |
| `client/src/app.tsx`                                        | MODIFIED    |
| `client/src/components/UploadView.tsx`                      | MODIFIED    |
| `client/src/index.css`                                      | MODIFIED    |
| `docs/stories/5-2-upload-experience-and-file-validation.md` | MODIFIED    |
| `docs/sprint-status.yaml`                                   | MODIFIED    |

## Change Log

- **2026-03-20:** Implemented Story 5.2 — client-side file validation, upload zone metadata display, thumbnail file info, fade-in animation. Created 2 new utility files, modified 3 existing files. All 965 backend tests pass, build successful. Manual verification pending.
- **2026-03-20:** Code review fixes — 7 issues found (3H/3M/1L), all fixed: removed DropZone pre-filter hiding validation errors (AC1 fix), added Math.max guard for negative availableSlots RangeError, tightened file input accept to match validation constants, added validationTimerRef cleanup on unmount, added formatFileSize edge case guard, corrected Task 9 manual verification marks to unchecked, fixed sprint-status comment.
- **2026-03-21:** Second code review (adversarial) — 6 issues found (0H/3M/3L), 3M fixed + 1L fixed: (M1) added `e.target.value = ''` in handleFileInputChange to allow re-selecting same file after validation rejection, (M2) added `both` fill-mode to fadeSlideIn animation preventing flash before fade-in, (M3) added MIME types to file input accept attribute for better cross-browser compat, (L1) corrected Story 5.1 status from `review` to `done` in sprint-status.yaml. Remaining LOW: validation error JSX duplication (minor DRY), stale images ref in useEffect cleanup (pre-existing from 5.1). Build passes (154 modules), 965 tests pass.
