# Story 4.2: Instant Download Endpoint

Status: done

## Story

As a user,
I want to download my CSV file immediately after processing completes,
so that I can proceed to Adobe Stock upload without delay.

## Acceptance Criteria

### AC1: Download Endpoint

**Given** a completed batch with a generated CSV file
**When** I request `GET /api/download-csv/:batchId`
**Then** the browser should:

- Initiate immediate file download
- Serve the file with `Content-Type: text/csv`
- Set `Content-Disposition: attachment; filename="adobe-stock-metadata-{timestamp}.csv"`
- Return the actual CSV content as the response body

### AC2: Session-Based Authorization

**Given** a batch owned by session A
**When** session B requests `GET /api/download-csv/:batchId`
**Then** the endpoint should:

- Return 404 (not 403, to avoid leaking batch existence)
- Log the unauthorized access attempt with session details

**And given** the correct session owner requests download
**Then** the download should succeed with the associated CSV file

### AC3: Batch Validation

**Given** a download request with `batchId`
**When** the endpoint processes the request
**Then** it should validate:

- `batchId` is a valid UUID format (reject malformed IDs with 400)
- Batch exists in tracking service (return 404 if not found)
- Batch has an associated CSV file (return 404 with message "CSV not yet generated" if missing)
- CSV file exists on disk (return 404 with message "CSV file expired or unavailable" if missing)

### AC4: Expired CSV Handling

**Given** a batch whose CSV file has been cleaned up (>24 hours old)
**When** download is requested
**Then** the endpoint should:

- Return 404 with user-friendly message: "CSV file has expired. Please reprocess your images."
- Log the expired access attempt for monitoring

### AC5: Path Traversal Prevention

**Given** a download request
**When** resolving the CSV file path
**Then** the endpoint should:

- Only serve files from the `CSV_OUTPUT_DIR` directory
- Validate the resolved path starts with `CSV_OUTPUT_DIR` (prevent `../../` attacks)
- Never expose internal file paths in error responses

### AC6: Download Tracking

**Given** a successful CSV download
**When** the file is served
**Then** the system should:

- Log the download event with batchId, sessionId, filename, and timestamp
- Record a Prometheus metric for download count (`asu_csv_downloads_total`)

### AC7: Rate Limiting

**Given** download requests from a single IP/session
**When** rate limits are exceeded
**Then** the endpoint should:

- Apply the existing `ipRateLimitMiddleware`
- Return 429 with appropriate retry-after header

### AC8: Legacy Endpoint Deprecation

**Given** the new `GET /api/download-csv/:batchId` endpoint is active
**When** `POST /api/export-csv` is called (legacy)
**Then** the legacy endpoint should remain functional but:

- Be marked as deprecated in code comments
- Log a deprecation warning on each call
- No new features added to it

### AC9: Unit and Integration Tests

**Given** the download endpoint implementation
**When** tests are executed
**Then** coverage should include:

- Successful download with correct headers
- Session ownership enforcement (404 for wrong session)
- Invalid/malformed batchId (400)
- Missing batch (404)
- Missing CSV association (404)
- Missing CSV file on disk (404)
- Path traversal prevention
- Rate limiting enforcement
- Download metric recording

## Tasks / Subtasks

- [x] Create download route in csv.routes.ts (AC1, AC3)
  - [x] Add `GET /api/download-csv/:batchId` handler
  - [x] Validate batchId UUID format
  - [x] Look up batch via `batchTrackingService.getBatch(batchId)`
  - [x] Verify CSV file association exists on batch record
  - [x] Resolve and validate file path (path traversal check)
  - [x] Serve file with `res.download()` and correct headers

- [x] Implement session ownership check (AC2)
  - [x] Extract sessionId from request cookie
  - [x] Compare with batch's sessionId
  - [x] Return 404 on mismatch (not 403)
  - [x] Log unauthorized attempts

- [x] Add expired CSV handling (AC4)
  - [x] Check file existence on disk before serving
  - [x] Return user-friendly expiration message

- [x] Add path traversal prevention (AC5)
  - [x] Resolve CSV path to absolute
  - [x] Verify resolved path starts with CSV_OUTPUT_DIR
  - [x] Reject requests that escape the CSV directory

- [x] Add download tracking (AC6)
  - [x] Create `asu_csv_downloads_total` Prometheus counter in metrics.ts
  - [x] Create `recordCsvDownload()` helper function
  - [x] Log download events with structured context

- [x] Apply rate limiting (AC7)
  - [x] Add `ipRateLimitMiddleware` to download route

- [x] Mark legacy endpoint as deprecated (AC8)
  - [x] Add deprecation comment and log warning in `POST /api/export-csv`

- [x] Write comprehensive tests (AC9)
  - [x] Test successful download (headers, content-type, content-disposition)
  - [x] Test session ownership enforcement
  - [x] Test invalid batchId format
  - [x] Test missing batch
  - [x] Test missing CSV association
  - [x] Test missing CSV file on disk
  - [x] Test path traversal prevention
  - [x] Test download metric increment

- [x] Run full test suite to verify no regressions

## Dev Notes

### Existing Infrastructure to Use

| Component                             | Location                                         | How to Use                                                  |
| ------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| `CSV_OUTPUT_DIR`                      | `src/services/csv-export.service.ts`             | Import for path resolution and validation                   |
| `BatchTrackingService.getBatch()`     | `src/services/batch-tracking.service.ts`         | Look up batch by ID, get sessionId + csvPath + csvFileName  |
| `BatchTrackingService.associateCsv()` | `src/services/batch-tracking.service.ts:307-319` | Already wired — CSV path stored when generated in Story 4.1 |
| `BatchState.csvPath` / `csvFileName`  | `src/models/batch.model.ts`                      | Fields added in Story 4.1 AC5                               |
| `ipRateLimitMiddleware`               | `src/api/middleware/rate-limit.ts`               | Apply to download route                                     |
| `asyncHandler`                        | `src/api/middleware/error-handler.ts`            | Wrap route handler                                          |
| `ValidationError` / `NotFoundError`   | `src/models/errors.ts`                           | Typed errors for invalid input / missing resources          |
| `csvRoutes`                           | `src/api/routes/csv.routes.ts`                   | Add download route to existing CSV router                   |
| Session cookie                        | Cookie-based session (Epic 2)                    | Extract via `req.cookies` or session middleware             |
| Prometheus metrics                    | `src/utils/metrics.ts`                           | Add new counter for downloads                               |

### Implementation Approach

1. **Add route to existing `csv.routes.ts`** — do NOT create a new route file. The download endpoint belongs with the CSV routes.

2. **Session extraction** — use the same session mechanism from Epic 2 (`req.cookies.sessionId` or the session middleware). Check `batch-tracking.service.ts` and `batch.routes.ts` for the exact session extraction pattern used in `GET /api/batch-status/:batchId`.

3. **Path safety** — use `path.resolve()` on the stored csvPath, then verify it starts with `CSV_OUTPUT_DIR`. This is the critical security check.

4. **File serving** — use Express `res.download(absolutePath, filename, callback)` which sets Content-Disposition automatically. Set `Content-Type: text/csv` explicitly.

5. **UUID validation** — use a regex like `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` for batchId format check.

### Key Patterns from Story 4.1

- CsvExportService uses `CSV_OUTPUT_DIR = path.resolve('csv_output')` — reuse this constant
- Batch association: `batchTrackingService.associateCsv(batchId, csvPath, csvFileName)` already stores both path and filename
- Route tests in `tests/csv.routes.test.ts` — add download tests to same file or create `tests/csv-download.routes.test.ts`
- Error handling: use `ValidationError` for bad input, `NotFoundError` for missing resources
- All routes use `asyncHandler` wrapper

### Git Intelligence (Recent Commits)

- `cb18e22` — Story 4.1 complete: CSV export with RFC 4180, batch status tracking. 903 tests.
- `197bd6e` — Updated OpenAI model to gpt-5-nano, sprint status for 4.1
- `625ca5f` — Story 4.1 implementation: API endpoint + cleanup
- Pattern: routes in `src/api/routes/`, tests in `tests/`, services in `src/services/`

### Legacy Endpoint Context

The existing `POST /api/export-csv` in `server.ts` (lines 353-381):

- Takes `{ csvFileName }` in request body
- Does NOT verify session ownership
- Does NOT validate path traversal
- Has NO rate limiting
- Should be deprecated but kept functional for backwards compatibility

### What NOT to Do

- Do NOT create a new route file — add to existing `csv.routes.ts`
- Do NOT rebuild batch tracking — use existing `getBatch()` method
- Do NOT remove the legacy `POST /api/export-csv` — just deprecate it
- Do NOT expose internal file paths in error messages
- Do NOT return 403 for wrong session — use 404 to prevent enumeration
- Do NOT add authentication/JWT checks — that's Epic 6 (future). Only session-based for now.

### Project Structure Notes

- Route addition goes in `src/api/routes/csv.routes.ts` (existing file)
- Metrics addition goes in `src/utils/metrics.ts` (existing file)
- Tests go in `tests/` directory following `*.test.ts` naming
- All imports use path aliases: `@services/`, `@models/`, `@config/`, `@utils/`, `@api/`

### References

- [Source: docs/epics.md#Story-4.2-Instant-Download-Endpoint]
- [Source: docs/PRD.md#FR-4-Adobe-Stock-CSV-Export] — "instant one-click download"
- [Source: docs/architecture/architecture-api.md#POST-api-export-csv] — legacy endpoint spec
- [Source: docs/architecture/api-contracts-api.md#POST-api-export-csv] — API contract
- [Source: src/api/routes/csv.routes.ts] — existing CSV routes (add download here)
- [Source: src/services/batch-tracking.service.ts#associateCsv] — batch-CSV association from Story 4.1
- [Source: src/services/csv-export.service.ts#CSV_OUTPUT_DIR] — shared output directory constant
- [Source: server.ts:353-381] — legacy POST /api/export-csv to deprecate

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Implemented `GET /api/download-csv/:batchId` in existing `csv.routes.ts` with full validation chain: UUID format, batch existence, session ownership, CSV association, path traversal prevention, and file existence
- Session ownership returns 404 (not 403) to prevent batch enumeration — matches existing pattern from `batch.routes.ts`
- Path traversal prevention uses `path.resolve()` + `startsWith(CSV_OUTPUT_DIR)` check
- Added `asu_csv_downloads_total` Prometheus counter and `recordCsvDownload()` helper in `metrics.ts`
- Legacy `POST /api/export-csv` in `server.ts` marked as deprecated with warning log on each call
- 18 new tests in `csv-download.routes.test.ts` covering all 9 acceptance criteria
- Full test suite: 926 tests passing, 0 regressions
- Code review fixes: metric moved to download success callback, error response handling added, defensive sessionId check, 429 rate limit test added (19 tests total, 927 suite)

### File List

- `src/api/routes/csv.routes.ts` — Added download route with session, validation, path safety, and metrics
- `src/utils/metrics.ts` — Added `csvDownloadsTotal` counter and `recordCsvDownload()` helper
- `server.ts` — Marked legacy `POST /api/export-csv` as deprecated with warning log
- `tests/csv-download.routes.test.ts` — New: 18 tests for download endpoint (AC1-AC9)
- `docs/stories/4-2-instant-download-endpoint.md` — Updated tasks, status, dev agent record
- `docs/sprint-status.yaml` — Updated story status to in-progress

## Change Log

- 2026-03-07: Story 4.2 implementation complete — instant download endpoint with session-based auth, path traversal prevention, metrics, and 18 tests
- 2026-03-07: Code review (Claude Opus 4.6) — 6 issues found (2H, 2M, 2L). Fixed: H1 metric now recorded after successful transfer, H2 res.download error callback sends response, M1 added 429 rate limit test, M2 defensive sessionId check. 927 tests passing.
