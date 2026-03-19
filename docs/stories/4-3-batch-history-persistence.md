# Story 4.3: Batch History Persistence

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want my completed processing batches persisted beyond server restarts and in-memory expiry,
so that I can view batch history and re-download CSVs within the expiry window.

## Acceptance Criteria

### AC1: Persist Completed Batches to SQLite Database

**Given** a batch that finishes processing (status: completed or failed)
**When** the batch completion handler fires in BatchTrackingService
**Then** the system should persist to a `processing_batches` table:

- `batch_id` (TEXT, PK) — UUID from in-memory batch
- `session_id` (TEXT, NOT NULL) — cookie-based session ownership
- `user_id` (TEXT, nullable) — null for anonymous users (future Epic 6)
- `image_count` (INTEGER) — total images in batch
- `successful_count` (INTEGER) — images that completed successfully
- `failed_count` (INTEGER) — images that failed processing
- `status` (TEXT) — 'completed' or 'failed'
- `csv_filename` (TEXT, nullable) — filename if CSV was generated
- `csv_path` (TEXT, nullable) — relative path to CSV file
- `created_at` (TEXT) — ISO 8601 timestamp from batch creation
- `completed_at` (TEXT) — ISO 8601 timestamp of completion
- `expires_at` (TEXT) — 24 hours after creation for anonymous, 30 days for authenticated (future)

### AC2: Batch History Endpoint

**Given** a user with a valid session cookie
**When** they request `GET /api/batches`
**Then** the endpoint should return:

- Last 10 completed batches for the current session (ordered by created_at DESC)
- Each batch includes: batchId, status, imageCount, successfulCount, failedCount, csvFileName, createdAt, completedAt, expiresAt
- Only batches owned by the requesting session (session_id match)
- Only non-expired batches (expires_at > now)

**And** the response format should be:

```json
{
  "success": true,
  "batches": [
    {
      "batchId": "uuid",
      "status": "completed",
      "imageCount": 5,
      "successfulCount": 4,
      "failedCount": 1,
      "csvFileName": "adobe-stock-metadata-1234.csv",
      "createdAt": "2026-03-08T12:00:00.000Z",
      "completedAt": "2026-03-08T12:01:30.000Z",
      "expiresAt": "2026-03-09T12:00:00.000Z",
      "csvAvailable": true
    }
  ]
}
```

### AC3: Single Batch Detail Endpoint

**Given** a valid batchId owned by the requesting session
**When** they request `GET /api/batches/:batchId`
**Then** the endpoint should return the full batch detail including per-image results

**And** return 404 if:

- batchId does not exist in database
- Batch is not owned by the requesting session (do NOT return 403)
- Batch has expired

### AC4: Expired Batch Cleanup Job

**Given** the server is running
**When** the cleanup job executes (every 1 hour)
**Then** it should:

- Find all batches where `expires_at < NOW()`
- Delete the associated CSV file from disk (if it exists)
- Delete the batch record from the database
- Log cleanup actions with count of removed batches and files
- Record a Prometheus metric for cleanup operations

### AC5: Database Initialization and Migration

**Given** the server starts up
**When** the persistence service initializes
**Then** it should:

- Create the SQLite database file at `data/batches.db` (configurable via `DB_PATH` env var)
- Create the `processing_batches` table if it doesn't exist (auto-migration)
- Create indexes on `session_id` and `expires_at` columns
- Log successful initialization
- NOT block server startup if database initialization fails (graceful degradation — fall back to in-memory only with a warning)

### AC6: CSV Availability Check

**Given** a persisted batch with a csv_path
**When** the batch is returned via API
**Then** the response should include a `csvAvailable` boolean field that checks:

- csv_path is not null/empty
- The actual file exists on disk (handles cases where CSV was cleaned up but record persists)

### AC7: Integration with Existing Download Endpoint

**Given** a batch persisted in the database
**When** `GET /api/download-csv/:batchId` is called (Story 4.2 endpoint)
**Then** the download endpoint should:

- First check in-memory BatchTrackingService (for active/recent batches)
- Fall back to database lookup if not found in memory
- Maintain all existing security checks (session ownership, path traversal prevention)

### AC8: Unit and Integration Tests

**Given** the batch persistence implementation
**When** tests are executed
**Then** coverage should include:

- Database initialization and table creation
- Batch persistence on completion
- Batch history retrieval (GET /api/batches)
- Single batch detail (GET /api/batches/:batchId)
- Session ownership enforcement (404 for wrong session)
- Expired batch filtering
- Cleanup job execution (deletes records + files)
- CSV availability check (file exists vs. missing)
- Fallback behavior when database unavailable
- Download endpoint fallback to database

## Tasks / Subtasks

- [x] Task 1: Create BatchPersistenceService with better-sqlite3 (AC1, AC5)
  - [x] Install `better-sqlite3` and `@types/better-sqlite3` dev dependency
  - [x] Create `src/services/batch-persistence.service.ts`
  - [x] Implement `initialize()` — create DB file, table, and indexes
  - [x] Implement `persistBatch(batch: BatchState)` — insert completed batch record
  - [x] Implement `getBatchesBySession(sessionId, limit)` — query with expiry filter
  - [x] Implement `getBatchById(batchId)` — single batch lookup
  - [x] Implement `isBatchOwnedBySession(batchId, sessionId)` — ownership check
  - [x] Implement `deleteExpiredBatches()` — cleanup with CSV file deletion
  - [x] Implement `close()` — graceful DB close for shutdown
  - [x] Add `DB_PATH` to Zod config schema in `app.config.ts` with default `data/batches.db`

- [x] Task 2: Integrate persistence into BatchTrackingService (AC1)
  - [x] Import BatchPersistenceService in batch-tracking.service.ts
  - [x] Call `persistBatch()` inside `completeBatch()` private method (after status set)
  - [x] Add try/catch — persistence failure should NOT break in-memory tracking (log warning)

- [x] Task 3: Create batch history routes (AC2, AC3, AC6)
  - [x] Add `GET /api/batches` to `batch.routes.ts`
  - [x] Add `GET /api/batches/:batchId` to `batch.routes.ts`
  - [x] Apply `sessionMiddleware` for session extraction
  - [x] Implement `csvAvailable` check using `fs.existsSync()` on resolved path
  - [x] Apply `ipRateLimitMiddleware` to both endpoints

- [x] Task 4: Update download endpoint with DB fallback (AC7)
  - [x] In `csv.routes.ts` GET `/api/download-csv/:batchId`, add fallback:
    - Try `batchTrackingService.getBatch()` first (existing behavior)
    - If null, try `batchPersistenceService.getBatchById()` for DB lookup
  - [x] Maintain all existing security and validation checks

- [x] Task 5: Implement cleanup job for expired batches (AC4)
  - [x] Add `scheduleBatchCleanup()` in server.ts (runs every 1 hour)
  - [x] Delete CSV files from disk before deleting records
  - [x] Add `asu_batch_cleanup_total` Prometheus counter in metrics.ts
  - [x] Integrate with server.ts graceful shutdown (clear interval)

- [x] Task 6: Register service in DI container (AC5)
  - [x] Add BatchPersistenceService to ServiceContainer interface in container.ts
  - [x] Initialize in `initializeServices()` as first step (no dependencies)
  - [x] Call `initialize()` during container init
  - [x] Ensure `data/` directory is created in server.ts directory initialization

- [x] Task 7: Write comprehensive tests (AC8)
  - [x] Create `tests/batch-persistence.service.test.ts` — unit tests for persistence service (20 tests)
  - [x] Create `tests/batch-history.routes.test.ts` — route tests for GET /api/batches (9 tests)
  - [x] Add fallback tests to `tests/csv-download.routes.test.ts`
  - [x] Use in-memory SQLite (`:memory:`) for test isolation
  - [x] Mock fs for CSV availability checks
  - [x] Test graceful degradation when DB init fails

- [x] Task 8: Run full test suite to verify no regressions (956 tests passing, 30 test files)

## Dev Notes

### Why better-sqlite3 (Not PostgreSQL)

The architecture docs reference PostgreSQL + Prisma as the target state, but that's planned for Epic 6 (User Account System) which introduces real user accounts, JWT auth, and multi-table schemas. For Story 4.3:

- **No user accounts exist yet** — only anonymous session-based access
- **Single table needed** — `processing_batches` only
- **No external database server** — reduces operational complexity for MVP
- **better-sqlite3 is synchronous** — simpler code, no async connection pools
- **Easy migration path** — when Epic 6 arrives, data can be migrated to PostgreSQL
- **Zero config** — just a file path, no connection strings or credentials

### Existing Infrastructure to Use

| Component                                    | Location                                         | How to Use                                                                        |
| -------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `BatchTrackingService.completeBatch()`       | `src/services/batch-tracking.service.ts:385-403` | Hook persistence call here — this is where status transitions to completed/failed |
| `BatchState` interface                       | `src/models/batch.model.ts:84-146`               | Input to `persistBatch()` — extract fields for DB insert                          |
| `batchTrackingService.getBatch()`            | `src/services/batch-tracking.service.ts:85-91`   | Primary lookup (in-memory), DB is fallback                                        |
| `batchTrackingService.getBatchesBySession()` | `src/services/batch-tracking.service.ts:289-297` | Similar pattern for history endpoint                                              |
| `CSV_OUTPUT_DIR`                             | `src/services/csv-export.service.ts:25`          | Resolve csvPath for file existence checks and cleanup                             |
| `sessionMiddleware`                          | `src/api/middleware/session.middleware.ts:30-60` | Apply to new routes for session extraction                                        |
| `asyncHandler`                               | `src/api/middleware/error-handler.ts`            | Wrap all route handlers                                                           |
| `ValidationError` / `NotFoundError`          | `src/models/errors.ts`                           | Typed errors for bad input / missing batches                                      |
| `ipRateLimitMiddleware`                      | `src/api/middleware/rate-limit.ts`               | Apply to history endpoints                                                        |
| DI Container                                 | `src/config/container.ts:96-121`                 | Register BatchPersistenceService                                                  |
| Config schema                                | `src/config/app.config.ts:7-28`                  | Add `DB_PATH` with Zod default                                                    |
| Metrics pattern                              | `src/utils/metrics.ts`                           | Add cleanup counter following existing pattern                                    |
| Directory init                               | `server.ts:117-121`                              | Add `data/` to directory creation list                                            |
| Cleanup scheduler                            | `server.ts:454-488`                              | Pattern for scheduling periodic cleanup                                           |
| Graceful shutdown                            | `server.ts:503-514`                              | Add DB close and cleanup interval clearing                                        |

### Implementation Approach

1. **Create BatchPersistenceService** as a standalone service with its own SQLite connection. It should NOT replace BatchTrackingService — the in-memory service remains the primary source for active batches. The persistence service is a write-behind cache for completed batches.

2. **Hook into `completeBatch()`** — this private method in BatchTrackingService already handles batch completion logic (lines 385-403). Add a call to `batchPersistenceService.persistBatch(batch)` wrapped in try/catch so persistence failures are non-fatal.

3. **Session extraction** — use the exact same pattern from `batch.routes.ts` line 41: `const sessionId = req.sessionId!` after applying `sessionMiddleware`.

4. **UUID validation** — reuse the `UUID_REGEX` pattern from `csv.routes.ts` line 34.

5. **Cleanup job** — follow the `scheduleCsvCleanup()` pattern from `server.ts:454-488`. The batch cleanup should run on a separate interval. When deleting expired batches, resolve csvPath relative to `CSV_OUTPUT_DIR` and delete the file first, then the record.

6. **Download fallback** — in the existing `GET /api/download-csv/:batchId` handler (csv.routes.ts:134-217), after `batchTrackingService.getBatch()` returns null (line 152), add a secondary lookup from the database. The returned DB record must be mapped to the same shape expected by the rest of the handler (needs sessionId, csvPath, csvFileName).

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS processing_batches (
  batch_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  image_count INTEGER NOT NULL,
  successful_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  csv_filename TEXT,
  csv_path TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_id ON processing_batches(session_id);
CREATE INDEX IF NOT EXISTS idx_expires_at ON processing_batches(expires_at);
```

### Key Patterns from Story 4.2

- Download endpoint in `csv.routes.ts` uses `batchTrackingService.getBatch()` which returns `BatchState | null` — the fallback needs to return a compatible shape
- Session ownership returns 404 (not 403) to prevent batch enumeration
- Path traversal prevention uses `path.resolve()` + `startsWith(CSV_OUTPUT_DIR)` check
- Metrics recorded via helper functions in `metrics.ts`

### Testing Strategy

- **Unit tests** for BatchPersistenceService: use `:memory:` SQLite database for speed and isolation
- **Route tests** for history endpoints: mock BatchPersistenceService, follow patterns from `tests/batch.routes.test.ts`
- **Integration tests** for download fallback: mock both batchTrackingService and batchPersistenceService
- **Cleanup tests**: use fake timers (vi.useFakeTimers) following pattern from `tests/batch-tracking.service.test.ts:572-594`
- **Graceful degradation**: mock better-sqlite3 to throw on construction, verify service continues with warning

### What NOT to Do

- Do NOT replace BatchTrackingService with a database-backed version — keep in-memory for active batches (performance)
- Do NOT add PostgreSQL, Prisma, or other heavy ORM — that's Epic 6 scope
- Do NOT create user authentication checks — only session-based auth exists (Epic 6 adds JWT)
- Do NOT persist in-progress or pending batches — only completed/failed
- Do NOT store per-image results in the database — only aggregate counts (keeps schema simple)
- Do NOT block batch completion if database write fails — log warning and continue
- Do NOT expose internal file paths in API responses — only csvFileName and csvAvailable boolean
- Do NOT create a new route file — add history endpoints to existing `batch.routes.ts`

### Project Structure Notes

- New service: `src/services/batch-persistence.service.ts` (new file, required)
- New dependency: `better-sqlite3` + `@types/better-sqlite3`
- Modified: `src/services/batch-tracking.service.ts` (hook persistence in completeBatch)
- Modified: `src/api/routes/batch.routes.ts` (add GET /api/batches, GET /api/batches/:batchId)
- Modified: `src/api/routes/csv.routes.ts` (add DB fallback to download endpoint)
- Modified: `src/config/container.ts` (register BatchPersistenceService)
- Modified: `src/config/app.config.ts` (add DB_PATH env var)
- Modified: `src/utils/metrics.ts` (add cleanup counter)
- Modified: `server.ts` (add data/ directory init, cleanup scheduler, graceful shutdown)
- New data directory: `data/` (for batches.db, add to .gitignore)
- New tests: `tests/batch-persistence.service.test.ts`, `tests/batch-history.routes.test.ts`

### References

- [Source: docs/epics.md#Story-4.3-Batch-History-Persistence] — User story, acceptance criteria, technical notes
- [Source: docs/PRD.md#FR-5-User-Account-System] — "User can re-download previous CSVs"
- [Source: docs/architecture/architecture-api.md#Data-Layer] — PostgreSQL target (deferred to Epic 6)
- [Source: src/services/batch-tracking.service.ts:385-403] — completeBatch() hook point
- [Source: src/services/batch-tracking.service.ts:409-446] — Cleanup job pattern
- [Source: src/api/routes/batch.routes.ts:36-74] — Session extraction and ownership pattern
- [Source: src/api/routes/csv.routes.ts:134-217] — Download endpoint to add DB fallback
- [Source: src/config/container.ts:96-121] — DI container registration pattern
- [Source: src/config/app.config.ts:7-28] — Zod config schema pattern
- [Source: server.ts:454-488] — Cleanup scheduler pattern
- [Source: server.ts:503-514] — Graceful shutdown pattern
- [Source: tests/batch-tracking.service.test.ts] — Testing patterns (mocks, fake timers, module reset)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — implementation was clean with no blocking issues.

### Completion Notes List

- Implemented BatchPersistenceService with better-sqlite3 for SQLite persistence of completed batches
- Service uses WAL mode for concurrent read performance and auto-creates table with indexes
- Graceful degradation: if DB init fails, service logs warning and falls back to in-memory only
- Hooked persistence into BatchTrackingService.completeBatch() with try/catch (non-fatal)
- Added GET /api/batches (session history, last 10, expiry-filtered) and GET /api/batches/:batchId (detail with ownership + expiry checks)
- Both new endpoints apply sessionMiddleware and ipRateLimitMiddleware
- csvAvailable field checks actual file existence on disk via fs.existsSync
- Download endpoint (GET /api/download-csv/:batchId) now falls back to DB lookup when in-memory batch not found
- Added asu_batch_cleanup_total Prometheus counter and recordBatchCleanup() helper
- Cleanup scheduler runs every 1 hour, deletes expired batch CSV files then DB records
- Registered BatchPersistenceService in DI container (initialized as step 0, before other services)
- Added DB_PATH env var with default 'data/batches.db' to Zod config schema
- Added data/ directory to .gitignore and server.ts directory initialization
- Wired persistence service into BatchTrackingService at server startup
- Graceful shutdown closes DB connection and clears batch cleanup interval
- 965 tests passing across 30 test files — zero regressions (Round 2: +6 tests from second code review)

### Code Review Fixes Applied (Round 1)

- **H1**: Removed duplicate SQLite instances in batch.routes.ts and csv.routes.ts — now use DI container's `services.batchPersistence`
- **H2**: Added expiry check to download endpoint DB fallback path (csv.routes.ts)
- **H3**: Split `deleteExpiredBatches()` into `getExpiredBatches()` + `deleteExpiredBatches()` — CSV files deleted before DB records to prevent orphans
- **M1**: `csvAvailable` now resolves paths via `CSV_OUTPUT_DIR` + `path.basename()` instead of fragile `path.resolve()`
- **M2**: Fixed `successful_count` to store actual successes (`completed - failed`) instead of total completed
- **M3**: Added 2 positive-path tests for download DB fallback (success + expired rejection)
- **L1**: Added trailing newline to .gitignore

### Code Review Fixes Applied (Round 2)

- **H1**: Added 4 persistence integration tests to `batch-tracking.service.test.ts` — covers `setPersistenceService()`, `completeBatch()` calling `persistBatch()`, non-fatal persistence failure, and failed batch persistence
- **M1**: Fixed `BatchProgressCounts.completed` doc comment to accurately reflect semantics (done = successful + failed, not just successful)
- **M3**: Cleanup scheduler in `server.ts` now resolves CSV paths via `CSV_OUTPUT_DIR + path.basename()` matching the route pattern
- **M4**: `getBatchById()` now filters expired batches by default (`includeExpired` param, default false) — removed redundant expiry checks from route handlers

### File List

**New files:**

- `src/services/batch-persistence.service.ts` — SQLite persistence service
- `tests/batch-persistence.service.test.ts` — 23 unit tests for persistence service
- `tests/batch-history.routes.test.ts` — 9 route tests for batch history endpoints

**Modified files:**

- `src/config/app.config.ts` — Added DB_PATH env var with Zod default + database getter
- `src/config/container.ts` — Registered BatchPersistenceService in DI container
- `src/services/batch-tracking.service.ts` — Added setPersistenceService() + persistence call in completeBatch()
- `src/api/routes/batch.routes.ts` — Added GET /api/batches and GET /api/batches/:batchId endpoints
- `src/api/routes/csv.routes.ts` — Added DB fallback to download endpoint
- `src/utils/metrics.ts` — Added asu_batch_cleanup_total counter + recordBatchCleanup()
- `server.ts` — Added data/ dir init, batch cleanup scheduler, persistence wiring, graceful shutdown
- `.gitignore` — Added data/ directory
- `package.json` — Added better-sqlite3 dependency
- `package-lock.json` — Updated lock file
- `tests/container.test.ts` — Added database config mock + batchPersistence to expected services
- `tests/csv-download.routes.test.ts` — Added persistence service mock + database config for DB fallback
- `docs/sprint-status.yaml` — Updated story status to in-progress → review
