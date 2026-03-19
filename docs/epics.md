# Adobe Stock Uploader - Epic Breakdown

**Author:** Alex
**Date:** November 10, 2025
**Project Level:** Level 2 (Standard Web Application)
**Target Scale:** MVP → 100 users → 1,000+ users

---

## Overview

This document provides the complete epic and story breakdown for Adobe Stock Uploader, decomposing the requirements from the [PRD](./PRD.md) into implementable stories sized for single development sessions.

### Epic Structure

The project is organized into **6 strategic epics** that follow the natural product architecture and user journey:

1. **Architecture Review & Foundation Refactoring** - Assess and restructure for scalability
2. **Anonymous Image Processing Pipeline** - Core value: try-first, no-signup processing
3. **AI Metadata Generation Engine** - Intelligence layer with parallel processing
4. **CSV Export & Download** - Complete workflow: upload → Adobe Stock CSV
5. **User Interface & Experience** - Elegant, photographer-focused dark mode UI
6. **User Account System** - Optional free tier with history and enhanced limits

**Development Sequence:** Foundation Refactoring (Epic 1) → Core Processing → Intelligence → Export → UI → Accounts

**Total Estimated Stories:** ~40 stories across 6 epics

**Epic 1 Stories:** 11 stories (4-5 development days)

---

## Epic 1: Architecture Review & Foundation Refactoring

**🚨 PRIORITY: CRITICAL - START HERE FIRST**

**Goal:** Transform current prototype architecture into production-ready, scalable infrastructure following the comprehensive refactoring plan.

**Business Value:** Establishes technical foundation that enables all MVP features, eliminates external costs (Cloudinary), and improves processing speed 2-3x.

**Current State Issues (4.0/10 Production Readiness):**

- Flat `src/` structure with 6 utility files mixing concerns
- Cloudinary dependency ($0.01-0.02 per image cost)
- Silent error failures (lost work, no visibility)
- Configuration hardcoding (`initials = 'OY'`)
- No abstraction layers (tight coupling)
- Missing observability (only console.log)

**Target Architecture (8.5/10 Production Readiness):**

```
src/
├── api/
│   ├── routes/         # Express route handlers
│   ├── middleware/     # Error handling, validation, logging
│   └── types/          # Request/response types
├── services/           # Business logic layer (DI pattern)
├── models/             # Data models & interfaces
├── utils/              # Pure utility functions (retry, logger)
├── config/             # Configuration, validation, DI container
└── server.ts          # Application entry point
```

**Timeline:** 4-5 development days (Phases 1-3)

**Reference:** See [ARCHITECTURE_REFACTORING_GUIDE.md](./ARCHITECTURE_REFACTORING_GUIDE.md) for complete implementation details.

---

## 🚀 Development Starts Here

**Epic 1 Stories are the foundation. Complete these before any other epic.**

**Why This Matters:**

- Eliminates $0.01-0.02 per image cost (Cloudinary removal)
- Improves processing speed 2-3x
- Establishes production-ready patterns for all future code
- Provides visibility into errors (no more silent failures)
- Enables easy testing and maintenance

**Implementation Order:** Stories 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8 → 1.9 → 1.10 → 1.11

---

### Story 1.1: Architecture Audit & Refactoring Plan

**As a** developer,
**I want** to audit the current architecture against PRD requirements,
**So that** I can create a clear refactoring plan that enables all MVP features.

**Acceptance Criteria:**

**Given** the current codebase and PRD requirements
**When** I perform a comprehensive architecture review
**Then** I should document:

- Current structure analysis (src/ organization, dependencies, data flow)
- PRD requirements gap analysis (missing: auth, rate limiting, user mgmt, self-hosted URLs)
- Proposed modular structure (directories, responsibilities, separation of concerns)
- Migration strategy (what to keep, refactor, or rebuild)
- Cloudinary elimination plan (self-hosted temp URL approach)
- Database schema requirements (users, batches, usage tracking)

**And** the refactoring plan should prioritize backwards compatibility during transition
**And** identify which existing code can be preserved vs rewritten
**And** document new directories and their responsibilities

**Prerequisites:** None (first story)

**Reference Documentation:** See [ARCHITECTURE_REFACTORING_GUIDE.md](./ARCHITECTURE_REFACTORING_GUIDE.md) for complete implementation plan.

**Status:** ✅ COMPLETED - Comprehensive architectural review and refactoring plan created.

**Deliverables:**

- ✅ Code quality assessment (4.0/10 → 8.5/10 target)
- ✅ Critical issues identified (6 priority issues documented)
- ✅ 3-phase refactoring plan (Foundation → Services → Observability)
- ✅ Complete implementation guide with code examples
- ✅ Integration checklist and success criteria

**Technical Notes:**

- Review `src/index.ts`, `server.ts`, and all utility files
- Map current endpoints in `server.ts` to future route structure
- Identify reusable logic in `openai.ts`, `files-manipulation.ts`, `csv-writer.ts`
- Plan for Express middleware architecture (auth, rate limiting, error handling)
- Design temp file serving strategy (UUID-based, auto-cleanup)

---

### Story 1.2: Configuration Service & Environment Setup

**🔥 PHASE 1.1 - Start Here**

**As a** developer,
**I want** centralized, type-safe, validated configuration with Zod,
**So that** all settings are validated on startup and hardcoded values are eliminated.

**Acceptance Criteria:**

**Given** scattered `process.env` access and hardcoded values in the codebase
**When** I implement the configuration service
**Then** the following should be created:

- `src/config/app.config.ts` with Zod schema validation
- `.env.example` documenting all required environment variables
- Environment schema covering:
  - Server config (PORT, BASE_URL, NODE_ENV)
  - OpenAI config (API_KEY, MODEL, MAX_TOKENS, TEMPERATURE)
  - Processing config (CONCURRENCY_LIMIT, MAX_FILE_SIZE_MB, TEMP_FILE_LIFETIME_SECONDS)
  - Rate limiting config (ANONYMOUS_LIMIT, FREE_TIER_LIMIT)

**And** configuration service should provide typed access:

```typescript
config.server.port;
config.openai.apiKey;
config.processing.concurrencyLimit;
config.rateLimits.anonymous;
```

**And** server should fail fast with clear error messages if configuration is invalid
**And** hardcoded values removed from `src/openai.ts` (use config instead)
**And** Easter bug fixed (remove line 28 from `src/prompt-text.ts`)

**Prerequisites:** Story 1.1 (architecture plan approved)

**Estimated Time:** 2-3 hours

**Implementation Reference:** ARCHITECTURE_REFACTORING_GUIDE.md → Phase 1.1

**Technical Notes:**

```bash
npm install zod pino pino-pretty
```

- Create `ConfigService` class with zod validation
- Add typed getters for config sections
- Update `src/openai.ts` to import and use config
- Remove `const initials = 'OY'` hardcoding
- Server logs validated config on startup (without sensitive values)

---

### Story 1.3: Directory Structure & TypeScript Path Aliases

**🔥 PHASE 1.2**

**As a** developer,
**I want** to establish the new modular directory structure with TypeScript path aliases,
**So that** subsequent development can follow clean architecture patterns.

**Acceptance Criteria:**

**Given** the configuration service from Story 1.2
**When** I create the new directory structure
**Then** the following directories should exist with README files:

- `src/api/routes/` - Express route handlers (thin, delegate to services)
- `src/api/middleware/` - Request processing (auth, validation, errors)
- `src/api/types/` - Request/response TypeScript types
- `src/services/` - Business logic layer (DI pattern)
- `src/models/` - Data models & interfaces
- `src/utils/` - Pure utility functions
- `src/config/` - Configuration & DI container

**And** TypeScript path aliases should be configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@api/*": ["src/api/*"],
      "@services/*": ["src/services/*"],
      "@models/*": ["src/models/*"],
      "@config/*": ["src/config/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

**And** each directory should have a README.md explaining purpose and patterns
**And** existing code remains functional (no breaking changes yet)

**Prerequisites:** Story 1.2 (configuration service)

**Estimated Time:** 1 hour

**Implementation Reference:** ARCHITECTURE_REFACTORING_GUIDE.md → Phase 1.2

**Technical Notes:**

```bash
mkdir -p src/api/{routes,middleware,types}
mkdir -p src/{services,models,config}
```

- Add README.md to each directory
- Restart TypeScript server after tsconfig changes
- Test that path aliases work with sample import

---

### Story 1.4: Self-Hosted Temporary URL Service

**🔥 PHASE 1.3**

**As a** product owner,
**I want** images served temporarily from our server with secure UUID-based URLs,
**So that** we eliminate Cloudinary costs ($0.01-0.02 per image) and enable a generous free tier.

**Acceptance Criteria:**

**Given** an uploaded image needs processing
**When** the TempUrlService creates a temporary URL
**Then** the service should:

- Accept `Express.Multer.File` as input
- Compress image with Sharp (1024px max dimension, 85% quality JPEG)
- Generate cryptographically random UUID (`crypto.randomUUID()`)
- Save compressed image to `/temp/{uuid}.jpg`
- Return public URL: `${BASE_URL}/temp/{uuid}.jpg`
- Schedule automatic cleanup after configured lifetime (default: 10 seconds)

**And** Express should serve `/temp` directory as static files
**And** background cleanup job should run every 30 seconds
**And** old files (>1 minute) should be cleaned up automatically
**And** the `/temp` directory should be created if it doesn't exist

**And** the service should implement:

```typescript
class TempUrlService {
  createTempUrl(file: Express.Multer.File): Promise<string>;
  cleanup(uuid: string): Promise<void>;
  cleanupOldFiles(): Promise<void>;
}
```

**Prerequisites:** Story 1.3 (directory structure created)

**Estimated Time:** 2-3 hours

**Implementation Reference:** ARCHITECTURE_REFACTORING_GUIDE.md → Phase 1.3

**Technical Notes:**

- Create `src/services/temp-url.service.ts`
- Use Sharp for image compression
- Configure Express static middleware in `server.ts`:
  ```typescript
  app.use('/temp', express.static(path.join(process.cwd(), 'temp')));
  ```
- Implement `scheduleCleanup()` with `setTimeout`
- Start background cleanup job in constructor with `setInterval`
- Use config service for BASE_URL and TEMP_FILE_LIFETIME_SECONDS

---

### Story 1.5: Remove Cloudinary Dependency

**🔥 PHASE 1.3 (Part 2)**

**As a** developer,
**I want** to remove all Cloudinary integration code,
**So that** we use only self-hosted temp URLs and eliminate $0.01-0.02 per image cost.

**Acceptance Criteria:**

**Given** the self-hosted TempUrlService from Story 1.4 is operational
**When** I remove Cloudinary integration
**Then** the following should be completed:

- Delete `src/cloudinary.ts` file
- Uninstall Cloudinary npm package: `npm uninstall cloudinary`
- Remove Cloudinary environment variables from `.env` and `.env.example`:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- Update image processing code to use TempUrlService instead
- Remove all Cloudinary import statements

**And** the new processing flow should be:

1. Receive uploaded image (multer)
2. Call `tempUrlService.createTempUrl(file)` → compresses & saves to `/temp/{uuid}.jpg`
3. Receive public HTTPS URL
4. Send URL to OpenAI Vision API
5. Receive metadata
6. Cleanup handled automatically by TempUrlService
7. Return metadata to client

**And** zero external API calls except OpenAI (cost savings achieved)
**And** processing speed should improve (no Cloudinary network delay)
**And** all existing functionality should still work

**Prerequisites:** Story 1.4 (TempUrlService implemented and tested)

**Estimated Time:** 1 hour

**Implementation Reference:** ARCHITECTURE_REFACTORING_GUIDE.md → Phase 1.3

**Technical Notes:**

```bash
npm uninstall cloudinary
rm src/cloudinary.ts
```

- Update `src/openai.ts` or processing logic to use TempUrlService
- Ensure cleanup happens even on errors (try-finally patterns)
- Update any tests that mocked Cloudinary
- Verify no Cloudinary imports remain: `grep -r "cloudinary" src/`
- Test end-to-end image processing still works

---

### Story 1.6: Error Architecture & Typed Errors

**🔥 PHASE 2.1 - Service Layer Foundation**

**As a** developer,
**I want** typed error classes and centralized error handling middleware,
**So that** errors are handled gracefully with visibility instead of silent failures (`catch(error) { return null }`).

**Acceptance Criteria:**

**Given** the current codebase has silent error failures
**When** I implement typed error architecture
**Then** the following should be created:

- `src/models/errors.ts` with custom error classes:
  - `AppError` (base class with code, statusCode, context)
  - `ValidationError` (400 responses)
  - `ProcessingError` (500 responses, with filename & stage tracking)
  - `ExternalServiceError` (502 responses, for OpenAI/filesystem)
  - `RateLimitError` (429 responses)

**And** error handler middleware should be created:

- `src/api/middleware/error-handler.ts` with:
  - `errorHandler(err, req, res, next)` - Express error middleware
  - `asyncHandler(fn)` - Wrapper for async route handlers
- Consistent JSON response format:
  ```json
  {
    "success": false,
    "error": {
      "code": "PROCESSING_ERROR",
      "message": "User-friendly message",
      "context": { "filename": "image.jpg", "stage": "compress" }
    }
  }
  ```

**And** error middleware should be registered last in `server.ts`
**And** errors should never expose sensitive information in production
**And** all error codes should be documented

**Prerequisites:** Story 1.5 (Cloudinary removed)

**Estimated Time:** 2 hours

**Implementation Reference:** ARCHITECTURE_REFACTORING_GUIDE.md → Phase 2.1

**Technical Notes:**

- Base `AppError` class extends `Error` with additional fields
- Each error type has specific statusCode and operational flag
- Error handler distinguishes operational vs programming errors
- Use `Error.captureStackTrace()` for proper stack traces
- Add `asyncHandler` wrapper to avoid try-catch boilerplate:
  ```typescript
  router.post(
    '/process',
    asyncHandler(async (req, res) => {
      // Errors automatically caught and passed to error handler
    })
  );
  ```

---

### Story 1.7: Retry Logic & Resilience

**🔥 PHASE 2.2**

**As a** developer,
**I want** intelligent retry logic for OpenAI API calls,
**So that** temporary failures don't cause entire batch processing to fail.

**Acceptance Criteria:**

**Given** OpenAI API calls can fail due to network issues or rate limits
**When** I implement retry infrastructure
**Then** the following should be created:

- `src/utils/retry.ts` with `withRetry<T>()` function
- Support for exponential backoff (configurable delays)
- Retry options interface:
  ```typescript
  interface RetryOptions {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    retryableErrors?: (error: any) => boolean;
  }
  ```

**And** retry behavior should be:

- Default: 3 attempts with exponential backoff (1s, 2s, 4s)
- Retry on: Network timeouts, 5xx errors, 429 rate limits
- Do NOT retry on: 401 auth errors, 400 validation errors
- Log each retry attempt with context

**And** the function should be usable as:

```typescript
const metadata = await withRetry(() => metadataService.generateMetadata(tempUrl), {
  maxAttempts: 3,
  retryableErrors: err => err.status === 429,
});
```

**And** after all retries exhausted, throw the last error
**And** successful retries should be logged for monitoring

**Prerequisites:** Story 1.6 (error architecture)

**Estimated Time:** 1 hour

**Implementation Reference:** ARCHITECTURE_REFACTORING_GUIDE.md → Phase 2.2

**Technical Notes:**

- Use `setTimeout` wrapped in Promise for delays
- Implement exponential backoff: `delay = Math.min(delay * multiplier, maxDelay)`
- Allow custom retry logic via `retryableErrors` callback
- Log retry attempts with structured logging
- Consider adding jitter to prevent thundering herd (optional)

---

### Story 1.8: Service Layer & Dependency Injection

**🔥 PHASE 2.3 - Core Services**

**As a** developer,
**I want** service classes with dependency injection for all business logic,
**So that** code is testable, maintainable, and loosely coupled.

**Acceptance Criteria:**

**Given** current code has tight coupling and no abstraction
**When** I implement the service layer
**Then** the following services should be created:

- `src/models/metadata.model.ts`:
  - `Metadata` interface (filename, title, keywords, category, releases)
  - `ProcessingResult` interface (success, filename, metadata, error)

- `src/services/metadata.service.ts`:
  - `MetadataService` class with OpenAI client
  - `generateMetadata(imageUrl: string): Promise<any>` method
  - Wraps OpenAI API calls with error handling
  - Throws `ExternalServiceError` on failures

- `src/services/image-processing.service.ts`:
  - `ImageProcessingService` class (depends on TempUrlService, MetadataService)
  - `processImage(file: Express.Multer.File): Promise<ProcessingResult>`
  - `processBatch(files: Express.Multer.File[]): Promise<ProcessingResult[]>`
  - Implements retry logic for resilience
  - Handles concurrency (5 parallel max)

- `src/services/csv-export.service.ts`:
  - `CsvExportService` class
  - `generateCSV(metadataList: Metadata[], outputPath: string): Promise<void>`

- `src/config/container.ts`:
  - Dependency injection container
  - Singleton instances of all services
  - Export `services` object for easy access

**And** services should use constructor injection for dependencies
**And** all OpenAI logic should be moved from utilities to MetadataService
**And** existing routes should be updated to use services
**And** services should be easily mockable for testing

**Prerequisites:** Story 1.7 (retry logic)

**Estimated Time:** 4-5 hours

**Implementation Reference:** ARCHITECTURE_REFACTORING_GUIDE.md → Phase 2.3

**Technical Notes:**

- Services are plain TypeScript classes with constructor DI
- Container pattern for managing singleton instances
- Update routes to use: `services.imageProcessing.processBatch(files)`
- Move business logic out of route handlers (routes should be thin)
- Refactor existing `src/openai.ts` into MetadataService
- Use retry wrapper in ImageProcessingService for OpenAI calls

---

### Story 1.9: Structured Logging with Pino

**🔥 PHASE 3.1 - Observability**

**As a** developer,
**I want** structured logging with Pino instead of console.log,
**So that** logs are parseable, searchable, and production-ready.

**Acceptance Criteria:**

**Given** current logging uses console.log throughout
**When** I implement structured logging
**Then** the following should be created:

- `src/utils/logger.ts` with Pino configuration:
  - Development: Pretty-printed with colors
  - Production: JSON format for log aggregation
  - Log levels: debug, info, warn, error
  - Automatic environment detection

**And** logging should include context:

```typescript
logger.info({ filename: 'image.jpg', duration: 1234 }, 'Processing completed');
// Output: {"level":"info","filename":"image.jpg","duration":1234,"msg":"Processing completed"}
```

**And** correlation ID middleware should be added:

- `correlationIdMiddleware` generates UUID per request
- Attaches `req.id` and `req.log` (child logger) to request
- All logs within request include correlation ID

**And** all `console.log` should be replaced with logger calls:

- `console.log` → `logger.info`
- `console.error` → `logger.error`
- `console.warn` → `logger.warn`

**And** sensitive data should never be logged (API keys, passwords)

**Prerequisites:** Story 1.8 (service layer)

**Estimated Time:** 2 hours

**Implementation Reference:** ARCHITECTURE_REFACTORING_GUIDE.md → Phase 3.1

**Technical Notes:**

- Pino is already installed (Story 1.2 dependencies)
- Configure pretty-print in development with `pino-pretty`
- Use child loggers for correlation IDs
- Update all files to import logger instead of console
- Add redaction for sensitive fields (optional)

---

### Story 1.10: Metrics Collection with Prometheus

**🔥 PHASE 3.2 - Observability**

**As a** product owner,
**I want** Prometheus metrics for processing performance and costs,
**So that** we can monitor system health and optimize resource usage.

**Acceptance Criteria:**

**Given** the need to monitor application performance
**When** I implement metrics collection
**Then** the following should be created:

- `src/utils/metrics.ts` with Prometheus client
- Default Node.js metrics (CPU, memory, event loop)
- Custom metrics:
  - `asu_images_processed_total` (Counter, labeled by status: success/failure)
  - `asu_processing_duration_seconds` (Histogram, labeled by stage)
  - `asu_openai_cost_usd` (Counter, cumulative API cost)

**And** metrics should be exposed:

- `GET /metrics` endpoint returns Prometheus format
- Content-Type: `text/plain`
- Includes all collected metrics

**And** metrics should be incremented in services:

```typescript
metrics.imagesProcessed.inc({ status: 'success' });
metrics.processingDuration.observe({ stage: 'openai' }, duration);
metrics.openaiCost.inc(0.002); // $0.002 per image
```

**And** metrics endpoint should be unprotected (for scraping)

**Prerequisites:** Story 1.9 (structured logging)

**Estimated Time:** 2 hours

**Implementation Reference:** ARCHITECTURE_REFACTORING_GUIDE.md → Phase 3.2

**Technical Notes:**

```bash
npm install prom-client
```

- Create registry with default metrics
- Define custom metrics with appropriate types
- Add metric increments in ImageProcessingService
- Expose `/metrics` endpoint in server.ts
- Document metric names and purposes

---

### Story 1.11: Health Checks & Readiness Probes

**🔥 PHASE 3.3 - Observability**

**As a** DevOps engineer,
**I want** health check endpoints for liveness and readiness,
**So that** container orchestrators can manage the application correctly.

**Acceptance Criteria:**

**Given** deployment to Railway/Render requires health checks
**When** I implement health endpoints
**Then** the following should be created:

- `src/api/routes/health.routes.ts` with two endpoints:

**1. Liveness probe: `GET /health`**

- Returns 200 with: `{ "status": "ok", "timestamp": "..." }`
- Always succeeds if server is running
- Fast response (<50ms)

**2. Readiness probe: `GET /health/ready`**

- Checks critical dependencies:
  - Configuration loaded (config.openai.apiKey exists)
  - OpenAI API reachable (with timeout)
  - Filesystem writable (temp directory)
- Returns 200 if all checks pass
- Returns 503 if any check fails
- Response format:
  ```json
  {
    "status": "ready",
    "checks": {
      "config": true,
      "openai": true,
      "filesystem": true
    },
    "timestamp": "2025-11-11T10:00:00Z"
  }
  ```

**And** health routes should be registered in server.ts
**And** readiness checks should timeout after 5 seconds
**And** failed checks should log detailed errors

**Prerequisites:** Story 1.10 (metrics)

**Estimated Time:** 1 hour

**Implementation Reference:** ARCHITECTURE_REFACTORING_GUIDE.md → Phase 3.3

**Technical Notes:**

- Import health routes in server.ts
- Test OpenAI with `openai.models.list()` call
- Test filesystem with temp file write/delete
- Use Promise.race for timeout handling
- Document endpoints for deployment platform

---

## Epic 2: Anonymous Image Processing Pipeline

**Goal:** Enable the core value proposition - users can try the tool immediately by processing up to 10 images without creating an account.

**Business Value:** Zero friction trial builds trust and drives conversion. This is the primary competitive differentiator.

---

### Story 2.1: Batch Upload API Endpoint

**As a** user,
**I want** to upload multiple images (up to 10) via API,
**So that** I can process them in batch without signup.

**Acceptance Criteria:**

**Given** I am an anonymous user
**When** I send a POST request to `/api/upload-images` with multipart/form-data containing 1-10 image files
**Then** the API should:

- Accept JPG, PNG, WEBP formats (validate MIME types)
- Enforce max 50MB per file
- Enforce max 10 files for anonymous users (cookie-based tracking)
- Return success response with file IDs and upload confirmation
- Save files temporarily to `/uploads/{uuid}-{original-name}`
- Return error 400 if invalid file types or sizes
- Return error 429 if user exceeds anonymous limit

**And** the response format should be:

```json
{
  "success": true,
  "files": [{ "id": "uuid", "name": "original.jpg", "size": 1234567 }]
}
```

**And** uploaded files should be validated before processing (not corrupted)

**Prerequisites:** Story 1.6 (error handling), Story 1.7 (deployment config)

**Technical Notes:**

- Create `src/api/routes/upload.routes.ts`
- Use `multer` for multipart handling
- Implement file validation middleware
- Add cookie-based session tracking for anonymous users
- Create `src/api/middleware/upload-validation.middleware.ts`
- Limit: 10 images per anonymous session (cookie expires in 1 hour)

---

### Story 2.2: Cookie-Based Anonymous Session Tracking

**As a** product owner,
**I want** anonymous users tracked via secure cookies,
**So that** we can enforce limits without requiring authentication.

**Acceptance Criteria:**

**Given** an anonymous user visits the application
**When** they upload images for the first time
**Then** a secure HTTP-only cookie should be set:

- Cookie name: `session_id`
- Value: Cryptographically random UUID
- Expires: 1 hour
- Secure: true (HTTPS only)
- SameSite: Strict
- HttpOnly: true

**And** the cookie should track:

- Images processed in current session
- Session creation time
- Last activity timestamp

**And** session data should be stored in memory (MVP) or Redis (future)
**And** session should expire after 1 hour of inactivity
**And** users should see clear message: "X of 10 free images used"

**Prerequisites:** Story 2.1 (upload endpoint)

**Technical Notes:**

- Use `cookie-parser` middleware
- Create `src/services/session.service.ts`:
  - `createSession(): string`
  - `getSessionUsage(sessionId: string): number`
  - `incrementUsage(sessionId: string): void`
  - `isSessionExpired(sessionId: string): boolean`
- Store sessions in Map (in-memory for MVP)
- Add cleanup job for expired sessions (every 10 minutes)

---

### Story 2.3: Rate Limiting Middleware

**As a** product owner,
**I want** rate limiting to prevent abuse,
**So that** the free tier remains sustainable and users don't overwhelm the server.

**Acceptance Criteria:**

**Given** the need to prevent abuse and server overload
**When** I implement rate limiting
**Then** the following limits should be enforced:

- **Anonymous users:** 10 images per IP per hour
- **Logged-in free users:** 100 images per month (tracked in database)
- **Per-IP rate limit:** 50 requests per minute (prevents brute force)

**And** rate limit information should be returned in response headers:

- `X-RateLimit-Limit`: Total allowed
- `X-RateLimit-Remaining`: Remaining in period
- `X-RateLimit-Reset`: Unix timestamp when limit resets

**And** when limit is exceeded, return 429 with clear message:

```json
{
  "success": false,
  "error": "Rate limit exceeded. Try again in X minutes.",
  "retryAfter": 3600
}
```

**And** rate limits should reset automatically after the time period

**Prerequisites:** Story 2.2 (session tracking)

**Technical Notes:**

- Create `src/api/middleware/rate-limit.middleware.ts`
- Use `express-rate-limit` package or custom implementation
- Store rate limit data in memory (Map) for MVP
- Use IP address + session ID as rate limit key
- For authenticated users, use user ID from JWT
- Add bypass mechanism for testing (environment variable)

---

### Story 2.4: Image Compression Service

**As a** system,
**I want** to compress uploaded images before processing,
**So that** we reduce OpenAI API costs and improve processing speed.

**Acceptance Criteria:**

**Given** an uploaded image file
**When** the compression service processes it
**Then** the image should be:

- Resized to maximum 1024px dimension (maintain aspect ratio)
- Converted to JPEG format (if PNG/WEBP)
- Compressed to 85% quality
- Optimized for web (progressive JPEG)
- Saved as `/temp/{uuid}.jpg`

**And** the compressed size should be <500KB average
**And** compression should take <1 second per image
**And** original uploaded file should be deleted after compression
**And** compression errors should be caught and logged with context

**Prerequisites:** Story 1.3 (temp URL infrastructure), Story 2.1 (upload endpoint)

**Technical Notes:**

- Create `src/services/image-processing.service.ts`
- Use Sharp library with configuration:
  ```typescript
  sharp(inputPath)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toFile(outputPath);
  ```
- Handle various input formats (PNG transparency → white background)
- Add error handling for corrupted images
- Measure compression performance (log timing)

---

### Story 2.5: Parallel Processing Orchestration

**As a** user,
**I want** my batch of images processed in parallel,
**So that** I get results in under 1 minute instead of waiting sequentially.

**Acceptance Criteria:**

**Given** a batch of 10 images ready for processing
**When** the processing pipeline executes
**Then** images should be processed:

- 5 concurrent processes maximum (using `p-limit`)
- Each process: compress → temp URL → OpenAI API → cleanup
- Failed images don't block others (graceful degradation)
- Progress updates sent to client in real-time (SSE or polling)

**And** for 10 images:

- Target total time: 40-60 seconds (4-6s per image with parallelization)
- 3-4x faster than sequential processing (validated in testing)

**And** the processing service should handle:

- Memory management (don't load all images at once)
- Error recovery (retry failed images once)
- Timeout handling (30s max per image)
- Resource cleanup (temp files deleted in all cases)

**Prerequisites:** Story 2.4 (compression service), Story 1.3 (temp URLs)

**Technical Notes:**

- Install `p-limit` package
- Create `src/services/batch-processing.service.ts`:
  ```typescript
  async function processBatch(fileIds: string[]): Promise<ProcessResult[]> {
    const limit = pLimit(5); // 5 concurrent
    return Promise.all(fileIds.map(id => limit(() => processImage(id))));
  }
  ```
- Implement retry logic (1 retry on failure)
- Add timeout wrapper (30s per image)
- Track processing state (pending, processing, completed, failed)
- Create processing status endpoint: `GET /api/batch-status/:batchId`

---

### Story 2.6: Processing Status & Progress Tracking

**As a** user,
**I want** to see real-time progress of my batch processing,
**So that** I know the system is working and can estimate completion time.

**Acceptance Criteria:**

**Given** I have uploaded a batch of images that is being processed
**When** I poll the status endpoint `GET /api/batch-status/:batchId`
**Then** I should receive:

```json
{
  "batchId": "uuid",
  "status": "processing",
  "progress": {
    "total": 10,
    "completed": 3,
    "failed": 0,
    "processing": 2,
    "pending": 5
  },
  "images": [
    { "id": "uuid", "filename": "image1.jpg", "status": "completed" },
    { "id": "uuid", "filename": "image2.jpg", "status": "processing" },
    { "id": "uuid", "filename": "image3.jpg", "status": "failed", "error": "..." }
  ],
  "estimatedTimeRemaining": 30
}
```

**And** the client should poll every 2 seconds during processing
**And** when all images are completed/failed, status should change to "completed"
**And** batch records should be stored in `processing_batches` table

**Prerequisites:** Story 2.5 (parallel processing)

**Technical Notes:**

- Create `GET /api/batch-status/:batchId` endpoint
- Store batch state in memory (MVP) or Redis (future)
- Update state as each image completes
- Calculate ETA based on average processing time
- Clean up batch state after 1 hour of completion

---

## Epic 3: AI Metadata Generation Engine

**Goal:** Implement the intelligence layer that analyzes images and generates Adobe Stock-compliant metadata (title, keywords, category) using OpenAI Vision API.

**Business Value:** This is the core AI capability that saves photographers hours of manual work. Accuracy and speed are critical.

---

### Story 3.1: OpenAI Vision API Integration

**As a** system,
**I want** to send images to OpenAI Vision API and receive structured metadata,
**So that** we can automatically generate titles, keywords, and categories.

**Acceptance Criteria:**

**Given** a compressed image with public HTTPS temp URL
**When** the metadata generation service processes it
**Then** the OpenAI API should be called with:

- Model: `gpt-5-nano` (cost-effective vision model)
- Temperature: 0.3 (accuracy over creativity)
- Max tokens: 500 (sufficient for metadata)
- Image detail: "low" (reduces cost, sufficient for metadata)
- Structured prompt requesting JSON response

**And** the API response should be parsed into:

```typescript
interface ImageMetadata {
  title: string; // 50-200 characters, descriptive
  keywords: string[]; // 30-50 relevant terms
  category: number; // Adobe Stock category ID
}
```

**And** error handling should cover:

- API timeout (30s max)
- Rate limit errors (429)
- Invalid API key (401)
- Malformed responses (retry once)

**And** successful calls should complete in <5 seconds average

**Prerequisites:** Story 1.3 (temp URLs), Story 2.4 (image compression)

**Technical Notes:**

- Refactor existing `src/openai.ts` into `src/services/metadata-generation.service.ts`
- Update to use `gpt-5-nano` model (already in code)
- Improve prompt for Adobe Stock compliance
- Add response validation (ensure JSON structure)
- Implement exponential backoff for retries
- Log API usage and costs for monitoring

---

### Story 3.2: Adobe Stock Category Taxonomy

**As a** system,
**I want** to map AI-generated categories to Adobe Stock's official taxonomy,
**So that** exported CSVs use correct category IDs.

**Acceptance Criteria:**

**Given** the need for Adobe Stock-compliant categories
**When** the AI generates category suggestions
**Then** a mapping service should:

- Convert natural language categories to Adobe Stock category IDs
- Use a predefined taxonomy map (e.g., "landscape" → category ID 1045)
- Support top 50 most common categories
- Default to "Other" (category ID 1) if no match found

**And** the category taxonomy should be:

- Stored in `src/utils/adobe-stock-categories.ts`
- Documented with ID → Name mapping
- Validated against Adobe Stock official documentation

**And** the AI prompt should guide the model to use standard category names

**Prerequisites:** Story 3.1 (OpenAI integration)

**Technical Notes:**

- Research Adobe Stock category taxonomy (official documentation)
- Create mapping object:
  ```typescript
  export const ADOBE_CATEGORIES = {
    Animals: 1,
    'Buildings and Architecture': 2,
    Business: 3,
    // ... 50 categories
  };
  ```
- Update prompt to request one of the predefined categories
- Implement fuzzy matching for category names (handle variations)
- Add validation in metadata generation service

---

### Story 3.3: Optimized AI Prompt Engineering

**As a** system,
**I want** a carefully engineered prompt that produces accurate, Adobe Stock-compliant metadata,
**So that** users get high-quality results that pass Adobe's requirements.

**Acceptance Criteria:**

**Given** the need for accurate, compliant metadata
**When** designing the AI prompt
**Then** the prompt should:

- Specify Adobe Stock requirements explicitly (title length, keyword format, category)
- Request JSON structure (for reliable parsing)
- Guide the model to focus on:
  - Descriptive, searchable titles
  - Diverse, relevant keywords (30-50 terms)
  - Accurate category classification
  - Commercial stock photography language (not artistic descriptions)
- Include examples of good vs bad metadata
- Use temperature 0.3 for consistency

**And** the prompt should produce:

- Titles: 50-200 characters, descriptive, keyword-rich
- Keywords: Mix of specific and general terms, no duplicates
- Category: One primary category from Adobe Stock taxonomy

**And** keyword quality should include:

- Main subject/objects
- Colors, mood, concepts
- Industry/use case keywords
- Technical descriptors (aerial, close-up, etc.)

**Prerequisites:** Story 3.2 (category taxonomy)

**Technical Notes:**

- Refactor `src/prompt-text.ts` with improved structure
- Add few-shot examples in prompt
- Test with diverse image types (landscape, portrait, abstract, business, etc.)
- Validate output format with schema
- Document prompt design decisions
- Plan for A/B testing prompts (future optimization)

---

### Story 3.4: Metadata Validation & Quality Checks

**As a** system,
**I want** to validate AI-generated metadata before saving,
**So that** we catch errors early and ensure Adobe Stock compliance.

**Acceptance Criteria:**

**Given** AI-generated metadata for an image
**When** the validation service checks it
**Then** the following validations should pass:

- **Title:** 50-200 characters, non-empty, no special characters (except basic punctuation)
- **Keywords:**
  - Array of 30-50 strings
  - Each keyword: 1-50 characters
  - No duplicates (case-insensitive)
  - No empty strings
- **Category:** Valid Adobe Stock category ID (from taxonomy)

**And** if validation fails:

- Log the error with image ID and metadata
- Retry metadata generation once with adjusted prompt
- If retry fails, use fallback metadata:
  - Title: "Stock Photo [ID]"
  - Keywords: ["stock", "image", "photo"]
  - Category: 1 (Other)

**And** validation errors should be tracked for monitoring (improve prompts)

**Prerequisites:** Story 3.3 (prompt engineering)

**Technical Notes:**

- Create `src/services/metadata-validation.service.ts`
- Implement validation functions:
  ```typescript
  validateTitle(title: string): boolean
  validateKeywords(keywords: string[]): boolean
  validateCategory(categoryId: number): boolean
  ```
- Use Zod or Joi for schema validation
- Add sanitization (trim whitespace, remove special chars)
- Track validation failure rate (log to console or analytics)

---

### Story 3.5: Error Recovery & Retry Logic

**As a** system,
**I want** intelligent retry logic for failed AI API calls,
**So that** temporary failures don't cause batch processing to fail entirely.

**Acceptance Criteria:**

**Given** an image processing request that encounters an error
**When** the error recovery system handles it
**Then** the following retry strategy should apply:

- **Retry once** for:
  - Network timeouts
  - OpenAI 5xx server errors
  - Malformed JSON responses
- **Do NOT retry** for:
  - Invalid API key (401)
  - Rate limit exceeded (429) - wait and retry after delay
  - Invalid image format (400)
- **Exponential backoff:** Wait 2s, then 4s between retries

**And** after all retries exhausted, mark image as "failed" with error message
**And** continue processing other images (don't halt entire batch)
**And** return partial results (successful + failed images)

**And** error messages should be user-friendly:

- "Processing failed - please try again" (generic)
- Not: "OpenAI API returned 500" (technical)

**Prerequisites:** Story 3.4 (validation)

**Technical Notes:**

- Implement retry wrapper function:
  ```typescript
  async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 1): Promise<T>;
  ```
- Use try-catch with error classification
- Add delay utility: `await sleep(ms)`
- Log all retry attempts with context
- Track retry success rate for monitoring

---

## Epic 4: CSV Export & Download

**Goal:** Complete the user workflow by generating Adobe Stock-compliant CSV files and enabling instant download.

**Business Value:** This is the final deliverable - users get a CSV ready to upload to Adobe Stock immediately.

---

### Story 4.1: CSV Generation Service

**As a** user,
**I want** my processed metadata exported as a CSV file,
**So that** I can upload it directly to Adobe Stock without manual formatting.

**Acceptance Criteria:**

**Given** a batch of processed images with metadata
**When** the CSV generation service runs
**Then** it should create a CSV file with:

- **Columns:** Filename, Title, Keywords, Category
- **Format:** UTF-8 encoding
- **Keywords:** Comma-separated within single cell (Excel-compatible)
- **Filename:** `adobe-stock-metadata-{initials}-{timestamp}.csv`
- **Sample row:**
  ```
  IMG_OY_20250323_1.jpg,"Beautiful sunset over mountains","sunset,mountains,landscape,nature,sky,clouds",1045
  ```

**And** the CSV should:

- Include header row
- Quote fields containing commas (RFC 4180 compliant)
- Handle special characters correctly (no corruption)
- Be validated against Adobe Stock CSV spec

**And** CSV files should be saved to `/csv_output` directory
**And** old CSV files (>24 hours) should be cleaned up automatically

**Prerequisites:** Story 3.5 (metadata generation complete)

**Technical Notes:**

- Refactor existing `src/csv-writer.ts` into service
- Move to `src/services/csv-export.service.ts`
- Use `csv-writer` npm package or manual implementation
- Implement cleanup job for old CSV files
- Validate CSV format with Adobe Stock test uploads
- Add CSV preview endpoint (optional): `GET /api/preview-csv/:batchId`

---

### Story 4.2: Instant Download Endpoint

**As a** user,
**I want** to download my CSV file immediately after processing completes,
**So that** I can proceed to Adobe Stock upload without delay.

**Acceptance Criteria:**

**Given** a completed batch with generated CSV file
**When** I request `GET /api/download-csv/:batchId`
**Then** the browser should:

- Initiate immediate file download
- Filename: `adobe-stock-metadata-{initials}-{timestamp}.csv`
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="..."`

**And** the download should work for:

- Anonymous users (using session ID verification)
- Authenticated users (using JWT verification)

**And** security checks should prevent:

- Downloading other users' CSVs (authorization)
- Accessing expired batch CSVs (>24 hours)
- Path traversal attacks (validate batchId format)

**And** after download, track that CSV was retrieved (analytics)

**Prerequisites:** Story 4.1 (CSV generation)

**Technical Notes:**

- Create `GET /api/download-csv/:batchId` endpoint
- Use `res.download(filePath, filename)` Express method
- Verify batch ownership (session ID or user ID)
- Add rate limiting (prevent download spam)
- Log download events
- Return 404 if CSV file not found or expired

---

### Story 4.3: Batch History Persistence

**As an** authenticated user (future epic),
**I want** my processing batches saved to database,
**So that** I can re-download CSVs later without reprocessing.

**Acceptance Criteria:**

**Given** a completed processing batch
**When** the batch finishes successfully
**Then** it should be saved to `processing_batches` table with:

- `batch_id` (UUID)
- `user_id` (nullable - null for anonymous)
- `session_id` (for anonymous users)
- `image_count`
- `status` (completed)
- `csv_filename`
- `csv_path` (file system location)
- `created_at`
- `expires_at` (24 hours for anonymous, 30 days for users)

**And** anonymous users can access their batches via session cookie (24h expiry)
**And** authenticated users can access all their batches via user ID
**And** expired batches should be cleaned up (files deleted, records archived)

**And** a history endpoint should return batch list: `GET /api/batches`

**Prerequisites:** Story 1.5 (database setup), Story 4.2 (download endpoint)

**Technical Notes:**

- Create `src/models/processing-batch.model.ts`
- Implement database insert after batch completion
- Create batch cleanup job (runs daily, deletes expired files)
- Add index on `user_id` and `created_at` columns
- Implement `GET /api/batches` endpoint (returns last 10 batches)
- Add optional `GET /api/batches/:batchId` for single batch details

---

## Epic 5: User Interface & Experience

**Goal:** Decompose, integrate, and polish the existing React prototype into a professional, photographer-focused dark mode interface.

**Business Value:** UI quality signals tool quality. Photographers are visual creatives who appreciate beautiful design. The existing prototype works but needs component architecture, API integration, and UX polish to feel production-ready.

**Context:** A working React SPA already exists in `client/src/app.tsx` (~500 lines) with drag-and-drop upload (react-dnd), thumbnail grid, progress bar with polling, and CSV download. Dark mode CSS variables and custom animations (grain texture, lava lamp) are defined. The work is decomposition, integration with Epics 1–4 backend APIs, and polish — not greenfield development. See Sprint Change Proposal (2026-03-10) for full analysis.

---

### Story 5.1: Component Architecture & App Decomposition

**As a** developer,
**I want** the monolithic app.tsx decomposed into focused components with a shared API client,
**So that** subsequent UI stories can build on clean, maintainable architecture.

**Acceptance Criteria:**

**Given** the existing monolithic `client/src/app.tsx` (~500 lines)
**When** the decomposition is complete
**Then:**

- **Component extraction:**
  - `UploadView` — drag-and-drop zone, file picker, thumbnail grid, image deletion
  - `ProcessingView` — progress bar, status text, polling logic
  - `ResultsView` — CSV download, success messaging, "process more" flow
  - `AppHeader` and `AppFooter` — extracted from inline JSX
  - `App` — thin orchestrator managing view state transitions (upload → processing → results)
- **API client layer:**
  - Create `client/src/api/` module with typed functions for each endpoint
  - Replace all inline `fetch()` calls in components with API client calls
  - Centralized error handling in API layer
- **Shared types:**
  - Create `client/src/types/` with interfaces for `UploadedImage`, `ProcessingState`, `BatchStatus`
  - Remove duplicate type definitions from app.tsx
- **Existing functionality preserved:**
  - All current features (upload, process, download) work identically after decomposition
  - No visual changes — this is a refactoring story
  - react-dnd drag-and-drop preserved (do NOT switch to react-dropzone)

**Prerequisites:** None (first Epic 5 story)

**Technical Notes:**

- Keep shadcn/ui component imports in leaf components
- Use React Context or props for shared state (batch data, processing status)
- Each view component gets its own file in `client/src/components/`
- Existing custom CSS (grain texture, lava lamp) stays in globals.css

---

### Story 5.2: Upload Experience & File Validation

**As a** user,
**I want** clear feedback when selecting images — file counts, sizes, and validation errors,
**So that** I understand what I've selected and catch problems before processing.

**Acceptance Criteria:**

**Given** the UploadView component extracted in Story 5.1
**When** the user interacts with the upload zone
**Then** the following **new** features are added:

- **File validation with inline feedback:**
  - Rejected files show inline error: "File type not supported. Use JPG, PNG, or WEBP."
  - Oversized files show: "File too large. Maximum 50MB per image."
  - Over-limit shows: "Too many files. Anonymous users can process 10 images."
  - Validation errors appear near the upload zone (not alert() dialogs)
- **Upload zone metadata display:**
  - File count: "3 of 10 images added"
  - Total size: "Total: 12.5 MB"
  - Upload zone visually disabled when limit reached
- **Thumbnail improvements:**
  - File name and size displayed under each thumbnail
  - Smooth appearance animation when images are added (CSS transition)
  - Hover state shows delete button with confirmation

**Existing functionality preserved (already working):**

- Drag-and-drop via react-dnd
- Click-to-open file picker
- Visual highlight on drag hover
- Thumbnail grid with 4-column layout
- Delete button on individual images

**Prerequisites:** Story 5.1 (component decomposition)

**Technical Notes:**

- Client-side validation before any API call
- Use existing shadcn/ui Alert or inline styled messages for validation errors
- File size formatting utility (bytes → human readable)
- Validation logic should live in a small utility, not inline in the component
- Do NOT replace react-dnd with react-dropzone

---

### Story 5.3: Processing View & Real-Time Status

**As a** user,
**I want** per-image status indicators and time estimates during processing,
**So that** I can see exactly which images are done, in progress, or failed.

**Acceptance Criteria:**

**Given** the ProcessingView component extracted in Story 5.1
**When** a batch is being processed
**Then** the following **new** features are added:

- **Per-image status indicators:**
  - Completed — green checkmark with "Done"
  - Processing — spinner animation with "Processing..."
  - Failed — red icon with brief error reason
  - Pending — gray circle with "Waiting"
  - Each image thumbnail shows its individual status overlay
- **Enhanced progress information:**
  - Time estimate: "About 1 minute remaining" (calculated from average per-image time)
  - Processing speed: "~2.5s per image"
  - Completed count: "4 of 10 images processed"
- **Smooth transitions:**
  - Progress bar uses CSS transition for smooth movement (not jumpy increments)
  - Status changes animate smoothly (fade/slide)
- **Automatic transition:**
  - When all images complete, auto-transition to ResultsView after 1s delay
  - If partial failures, show summary before transitioning

**Existing functionality preserved (already working):**

- Overall progress bar (shadcn/ui Progress component)
- 2-second polling of `/api/batch-status/:batchId`
- Status text showing current filename
- Processing state management

**Prerequisites:** Story 5.1 (component decomposition), Story 2.6 (status API)

**Technical Notes:**

- Backend already returns per-image status and ETA in batch-status response
- Use CSS transitions (`transition-all duration-300`) not Framer Motion
- Status icons from lucide-react (already installed but unused)
- Poll response includes `estimatedTimeRemaining` — wire it to the UI
- Handle edge case: all images failed (show error summary, no auto-transition)

---

### Story 5.4: Results View & Metadata Preview

**As a** user,
**I want** to see the generated metadata before downloading the CSV,
**So that** I can verify the AI output and feel confident in the results.

**Acceptance Criteria:**

**Given** the ResultsView component extracted in Story 5.1
**When** batch processing completes
**Then** the following **new** features are added:

- **Results summary banner:**
  - Success: "10 of 10 images processed successfully"
  - Partial: "8 of 10 images processed (2 failed)"
  - Total processing time: "Completed in 42 seconds"
- **Metadata preview table:**
  - Scrollable table showing all processed images
  - Columns: Thumbnail, Filename, Title, Keywords (truncated), Category
  - Failed images shown with error reason instead of metadata
  - Uses shadcn/ui Table component
- **Enhanced download experience:**
  - Initials input moved to results view (closer to download action)
  - Prominent "Download CSV" button (primary CTA)
  - Success toast notification on download (shadcn/ui Sonner — already installed)
  - Download does not navigate away from page
- **Post-download actions:**
  - "Process More Images" button — returns to upload view, clears state
  - "Download Again" — re-downloads without re-processing
- **Batch history integration:**
  - Current batch appears in a "Recent Batches" section
  - Previous batches (from backend batch-history API, Epic 4.3) listed with re-download option

**Existing functionality preserved (already working):**

- CSV generation via `/api/process-batch-v2`
- File download trigger
- Initials input field
- Clear/reset functionality

**Prerequisites:** Story 5.1 (component decomposition), Story 4.2 (download endpoint), Story 4.3 (batch history)

**Technical Notes:**

- Metadata preview requires storing the batch-status response data (already polled in ProcessingView)
- Pass completed batch data from ProcessingView → ResultsView via state/context
- Sonner toast is already in shadcn/ui components — just import and add `<Toaster />` to App
- Batch history API: `GET /api/batches` (implemented in Epic 4.3)
- Table should be responsive — horizontal scroll on mobile
- No confetti or celebratory animations — keep it professional

---

### Story 5.5: Dark Mode Default & Visual Polish

**As a** photographer,
**I want** the app to default to a professional dark theme with a toggle for light mode,
**So that** the interface matches the tools I'm used to (Lightroom, Capture One).

**Acceptance Criteria:**

**Given** the existing dark mode CSS variables and custom styling
**When** the theme is finalized
**Then** the following changes are made:

- **Dark mode as default:**
  - App loads in dark mode on first visit (add `dark` class to `<html>` by default)
  - Preference persisted to localStorage
  - All components render correctly in dark mode (audit each extracted component)
- **Theme toggle:**
  - Sun/moon icon button in AppHeader
  - Smooth transition between modes (CSS `transition` on background/color)
  - Uses lucide-react icons (already installed)
- **Color palette audit:**
  - Review existing oklch() CSS variables for WCAG AA contrast (4.5:1 minimum)
  - Fix any contrast failures in both light and dark modes
  - Ensure shadcn/ui components inherit theme correctly
- **Visual polish pass:**
  - Consistent border radius across all components (align with shadcn/ui defaults)
  - Consistent spacing (audit padding/margin for 4px/8px grid alignment)
  - Hover states on all interactive elements
  - Focus indicators visible in both themes (accessibility)
- **Preserve existing styling:**
  - Grain texture effect stays (already working)
  - Lava lamp button animation stays (already working)
  - No new animation libraries

**Existing functionality preserved (already working):**

- Dark mode CSS variables defined in index.css (oklch color space)
- Light/dark theme structure via `.dark` class
- Custom grain texture and lava lamp animations in globals.css
- shadcn/ui components pre-configured for dark mode support

**Prerequisites:** Stories 5.1–5.4 (all components extracted and functional)

**Technical Notes:**

- Dark mode toggle: simple `document.documentElement.classList.toggle('dark')` + localStorage
- Audit tool: Chrome DevTools accessibility panel for contrast checks
- Do NOT add Framer Motion or any animation library
- Keep oklch() color space — it's modern and correct
- Test both themes end-to-end after all component work is done

---

### Story 5.6: Responsive Design & Mobile Optimization

**As a** user on a tablet or phone,
**I want** the upload, processing, and results views to work well on smaller screens,
**So that** I can process images from any device.

**Acceptance Criteria:**

**Given** the extracted components from Stories 5.1–5.4
**When** viewed on different screen sizes
**Then** the following responsive behavior is verified or added:

- **Breakpoint audit and fixes:**
  - Desktop (1024px+): Current layout preserved — no changes expected
  - Tablet (768–1023px): Thumbnail grid reduces from 4 to 3 columns, margins tightened
  - Mobile (< 768px): Single column layout, full-width elements, thumbnail grid 2 columns
- **Touch target compliance:**
  - All buttons minimum 44px height (tap target)
  - Delete buttons on thumbnails enlarged on touch devices
  - Upload zone: full-width tap area on mobile
- **Mobile upload experience:**
  - File picker falls back to native OS picker on mobile (already works via `<input type="file">`)
  - Drag-and-drop zone shows "Tap to select images" text on touch devices (detect via media query or `pointer: coarse`)
- **Metadata preview table (from 5.4):**
  - Horizontal scroll on mobile with visual scroll hint
  - Or collapse to card layout per image on narrow screens
- **Header/footer on mobile:**
  - Fixed header stays but reduces padding
  - Footer stacks links vertically

**Existing functionality preserved (already working):**

- Viewport meta tag in index.html
- clamp() fluid typography for hero text
- max-width containers (max-w-3xl, max-w-5xl, max-w-7xl)
- Flexible layout with no hardcoded widths

**Prerequisites:** Stories 5.1–5.5 (all components extracted, styled, themed)

**Technical Notes:**

- Use Tailwind responsive utilities (`sm:`, `md:`, `lg:`) — no custom media queries
- Test with Chrome DevTools device emulation (iPhone SE, iPad, Pixel 7)
- No PWA features in MVP — defer to post-launch
- No real-device testing required for MVP — emulation is sufficient
- Bundle size is already small (Vite + React + shadcn/ui) — no special mobile optimization needed

---

### Story 5.7: Error Handling & Toast Notifications

**As a** user,
**I want** clear, non-intrusive feedback for errors and successes,
**So that** I understand what happened without disruptive alert() popups.

**Acceptance Criteria:**

**Given** the extracted components from Stories 5.1–5.4
**When** errors or notable events occur
**Then** the following replaces existing alert() calls:

- **Toast notification system:**
  - Wire up Sonner (shadcn/ui toast — already installed, unused)
  - Success toasts: "CSV downloaded!", "Images uploaded successfully"
  - Error toasts: processing failures, network errors, API errors
  - Toasts auto-dismiss after 5 seconds, can be manually dismissed
  - Positioned bottom-right, stacking if multiple
- **API error handling:**
  - Network errors: "Connection lost. Check your internet and try again."
  - Server errors (500): "Something went wrong. Please try again."
  - Rate limit (429): "Free limit reached. Create an account for 100 images/month."
  - Timeout: "Request timed out. Please try again."
  - All error messages use plain language — no status codes or stack traces shown to user
- **React error boundary:**
  - Wrap App in an error boundary component
  - Fallback UI: "Something unexpected happened" with "Reload" button
  - Prevents white screen on uncaught React errors
- **Upload validation feedback:**
  - Already covered in Story 5.2 (inline validation)
  - This story ensures consistency: validation = inline, operations = toast
- **Loading states:**
  - "Generate & Export CSV" button shows spinner while processing
  - Upload zone shows upload progress indicator during file transfer
  - Disable interactive elements during async operations to prevent double-clicks

**Existing functionality to replace:**

- Remove all `alert()` calls — replace with appropriate toast or inline message
- Remove `console.error()` user-facing fallbacks — replace with toast

**Prerequisites:** Stories 5.1–5.6 (all components built and styled)

**Technical Notes:**

- Sonner is already in `client/src/components/ui/sonner.tsx` — just import and add `<Toaster />` to App
- Error boundary is a simple class component (~30 lines)
- No Sentry integration in MVP — defer to production monitoring epic
- No modal dialogs for errors — toasts and inline messages are sufficient
- Error message strings can live in the component files — no need for a separate constants file at this scale

---

## Epic 6: User Account System (Optional Free Tier)

**Goal:** Enable returning users to create free accounts with 100 images/month quota, processing history, and CSV re-downloads.

**Business Value:** Accounts drive retention and enable conversion to paid tiers. This is the foundation for monetization.

---

### Story 6.1: User Registration & Signup Flow

**As a** new user,
**I want** to create a free account with email and password,
**So that** I can process 100 images/month and save my history.

**Acceptance Criteria:**

**Given** I want to create an account
**When** I access the signup page (`/signup`)
**Then** I should see a form with:

- Email input (validated)
- Password input (minimum 8 characters, show/hide toggle)
- Confirm password
- "Create Free Account" button
- Link to login page

**And** validation should check:

- Email format is valid
- Email not already registered
- Password meets requirements (8+ chars, 1 uppercase, 1 number)
- Passwords match

**And** on successful signup:

- User record created in database (password hashed with bcrypt)
- Email verification sent (optional for MVP)
- User logged in automatically (JWT token issued)
- Redirect to dashboard or upload page

**And** the form should show clear error messages inline

**Prerequisites:** Story 1.5 (database schema)

**Technical Notes:**

- Create `POST /api/auth/signup` endpoint
- Use bcrypt for password hashing (12 rounds)
- Generate JWT token with user ID and tier
- Create `SignupForm.tsx` React component
- Use React Hook Form for validation
- Implement email uniqueness check
- Store JWT in httpOnly cookie or localStorage

---

### Story 6.2: User Login & Authentication

**As a** returning user,
**I want** to log in with my credentials,
**So that** I can access my account and processing history.

**Acceptance Criteria:**

**Given** I have an existing account
**When** I access the login page (`/login`)
**Then** I should see a form with:

- Email input
- Password input (show/hide toggle)
- "Log In" button
- "Forgot password?" link (placeholder for future)
- Link to signup page

**And** on successful login:

- Credentials validated against database
- JWT token issued (contains user ID, email, tier)
- Token stored securely (httpOnly cookie preferred)
- Redirect to dashboard or last visited page

**And** on failed login:

- Show error: "Invalid email or password" (generic for security)
- No indication whether email exists (prevent enumeration)
- Rate limit login attempts (max 5 per 15 minutes per IP)

**Prerequisites:** Story 6.1 (user registration)

**Technical Notes:**

- Create `POST /api/auth/login` endpoint
- Compare password with bcrypt.compare()
- Generate JWT with 7-day expiration
- Create `LoginForm.tsx` React component
- Implement session management (store user in React context)
- Add "Remember me" option (extends token expiration)
- Handle expired tokens gracefully (redirect to login)

---

### Story 6.3: JWT-Based Authentication Middleware

**As a** system,
**I want** to protect authenticated routes with JWT validation,
**So that** only logged-in users can access their data.

**Acceptance Criteria:**

**Given** protected API endpoints exist
**When** a request is made to a protected route
**Then** the authentication middleware should:

- Extract JWT from Authorization header or cookie
- Verify token signature (using JWT secret)
- Check token expiration
- Attach user data to request object: `req.user = { id, email, tier }`
- Return 401 if token invalid/expired/missing

**And** protected routes should include:

- `GET /api/batches` (user's processing history)
- `GET /api/usage` (monthly quota tracking)
- `POST /api/process-batch` (when authenticated)

**And** anonymous routes should remain accessible:

- `POST /api/upload-images` (anonymous processing)
- `POST /api/process-batch` (anonymous with session)

**Prerequisites:** Story 6.2 (login system)

**Technical Notes:**

- Create `src/api/middleware/auth.middleware.ts`:
  ```typescript
  export function requireAuth(req, res, next) {
    const token = req.cookies.jwt || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    // Verify token...
  }
  ```
- Use `jsonwebtoken` library
- Implement optional auth middleware (allows both authenticated and anonymous)
- Add user type definitions: `req.user: { id, email, tier }`

---

### Story 6.4: Monthly Usage Tracking & Quota Enforcement

**As a** free tier user,
**I want** my monthly usage tracked automatically,
**So that** I know how many images I have remaining.

**Acceptance Criteria:**

**Given** I am a logged-in free tier user
**When** I process images
**Then** the system should:

- Increment `usage_tracking` table for current month
- Check remaining quota before processing (100 - used)
- Return error if quota exceeded: "You've used all 100 free images this month. Upgrade or wait until next month."
- Reset quota automatically on 1st of each month

**And** I should be able to check my usage:

- `GET /api/usage` returns:
  ```json
  {
    "tier": "free",
    "monthlyLimit": 100,
    "used": 37,
    "remaining": 63,
    "resetsAt": "2025-12-01T00:00:00Z"
  }
  ```

**And** usage should be displayed in UI:

- Header: "37 / 100 images used this month"
- Progress bar showing quota

**Prerequisites:** Story 1.5 (database schema), Story 6.3 (auth middleware)

**Technical Notes:**

- Create `src/services/usage-tracking.service.ts`:
  ```typescript
  async function trackUsage(userId: string, imageCount: number);
  async function getUsage(userId: string): Promise<UsageStats>;
  async function hasQuota(userId: string, requestedCount: number): boolean;
  ```
- Implement monthly reset logic (cron job or check on-demand)
- Add database index on `(user_id, month_year)`
- Create `GET /api/usage` endpoint
- Display usage in React component (header or dashboard)

---

### Story 6.5: Processing History & CSV Re-Download

**As a** logged-in user,
**I want** to view my past processing batches and re-download CSVs,
**So that** I don't have to reprocess images if I lose the file.

**Acceptance Criteria:**

**Given** I am a logged-in user
**When** I access my history page (`/history`)
**Then** I should see a list of past batches:

- Date/time processed
- Number of images
- CSV filename
- Status (completed, failed)
- Download button for each batch

**And** the list should:

- Show most recent first (paginated, 10 per page)
- Include batches from last 30 days (free tier)
- Allow filtering by date or status

**And** clicking "Download" should:

- Re-download the CSV file
- Work even if processed weeks ago
- Track download event (analytics)

**And** expired batches (>30 days) should:

- Be archived (CSV file deleted)
- Show "Expired - CSV no longer available"

**Prerequisites:** Story 4.3 (batch persistence), Story 6.4 (usage tracking)

**Technical Notes:**

- Create `GET /api/batches` endpoint (returns user's batches)
- Query `processing_batches` table filtered by `user_id`
- Order by `created_at DESC`
- Implement pagination (limit/offset or cursor-based)
- Create `HistoryView.tsx` React component
- Display in table or card grid format
- Add filters (date range, status)

---

### Story 6.6: Account Settings & Profile Management

**As a** logged-in user,
**I want** to manage my account settings,
**So that** I can update my information or delete my account.

**Acceptance Criteria:**

**Given** I am logged in
**When** I access settings page (`/settings`)
**Then** I should be able to:

- View my email and account tier
- Change password (requires current password)
- Update email (with verification)
- View usage statistics (images processed, quota)
- Delete account (with confirmation dialog)

**And** changing password should:

- Require current password (security)
- Validate new password (8+ chars, strength)
- Confirm new password matches
- Hash and update in database
- Log out all sessions (invalidate tokens)

**And** deleting account should:

- Show warning: "This will permanently delete your data"
- Require password confirmation
- Delete user record, batches, usage data (GDPR compliance)
- Delete all CSV files associated with user
- Log out immediately

**Prerequisites:** Story 6.2 (login), Story 6.4 (usage tracking)

**Technical Notes:**

- Create `PATCH /api/user/password` endpoint
- Create `DELETE /api/user` endpoint
- Implement cascade delete in database (foreign keys)
- Create `SettingsView.tsx` React component
- Use React Hook Form for password change
- Add confirmation modal for account deletion
- Implement soft delete (optional - mark as deleted, clean up later)

---

### Story 6.7: Upgrade Prompt & Upsell Flow

**As a** product owner,
**I want** clear upgrade prompts shown at appropriate moments,
**So that** users understand the benefits of paid tiers (future monetization).

**Acceptance Criteria:**

**Given** various user scenarios
**When** upgrade opportunities arise
**Then** prompts should appear:

- **After anonymous processing:** "Want more? Create free account (100 images/month)"
- **When free quota exhausted:** "Upgrade to Pro for unlimited processing"
- **On history page:** "Pro users get unlimited history + priority processing"
- **Before large batch:** "Free tier: 100/month. Need more? Upgrade to Pro"

**And** prompts should:

- Be non-intrusive (not blocking modals)
- Show clear value proposition (what user gets)
- Include pricing (when paid tiers exist)
- Link to pricing page or upgrade flow
- Track clicks (conversion funnel analytics)

**And** the design should:

- Use subtle call-to-action styling
- Not feel pushy or aggressive
- Emphasize benefits (not limitations)

**Prerequisites:** Story 6.5 (history), Story 6.4 (usage tracking)

**Technical Notes:**

- Create reusable `UpgradePrompt.tsx` component
- Implement trigger logic (when to show prompts)
- Add analytics tracking for prompt impressions and clicks
- Design pricing tiers (Pro, Agency - not implemented yet)
- Create placeholder `/pricing` page
- Implement Stripe integration (future Epic 7)

---

## Epic Breakdown Summary

**Total Stories:** ~40 stories across 6 epics

### Story Count by Epic:

1. **Epic 1 (Foundation Refactoring):** 11 stories ⚡ **PRIORITY**
2. **Epic 2 (Processing):** 6 stories
3. **Epic 3 (AI Engine):** 5 stories
4. **Epic 4 (CSV Export):** 3 stories
5. **Epic 5 (UI/UX):** 7 stories
6. **Epic 6 (Accounts):** 7 stories

### Estimated Timeline:

- **Days 1-5:** Epic 1 (Foundation Refactoring) - **START HERE FIRST** 🚨
  - Phase 1: Configuration & Infrastructure (Days 1-2)
  - Phase 2: Service Layer & Errors (Days 2-3)
  - Phase 3: Observability (Days 4-5)
- **Week 2:** Epic 2 (Processing Pipeline) + Epic 3 (AI Engine)
- **Week 3:** Epic 4 (CSV Export) + Epic 5 (UI/UX)
- **Week 4:** Epic 6 (User Accounts)
- **Week 5:** Integration testing, bug fixes, polish

**MVP Completion:** 5 weeks for full implementation

**Critical Path:** Epic 1 MUST be completed before other epics begin.

---

## Implementation Sequence Recommendations

### 🚨 Phase 1: Foundation Refactoring (Days 1-5) - CRITICAL PATH

**Goal:** Transform prototype into production-ready architecture

**Critical Path:**

**Days 1-2: Foundation & Infrastructure**

1. ✅ Story 1.1: Architecture Audit (COMPLETED)
2. 🔥 Story 1.2: Configuration Service with Zod (2-3 hours)
3. 🔥 Story 1.3: Directory Structure & TypeScript Paths (1 hour)
4. 🔥 Story 1.4: Self-Hosted Temporary URL Service (2-3 hours)
5. 🔥 Story 1.5: Remove Cloudinary Dependency (1 hour)

**Days 2-3: Service Layer & Errors**

6. 🔥 Story 1.6: Error Architecture & Typed Errors (2 hours)
7. 🔥 Story 1.7: Retry Logic & Resilience (1 hour)
8. 🔥 Story 1.8: Service Layer & Dependency Injection (4-5 hours)

**Days 4-5: Observability**

9. 🔥 Story 1.9: Structured Logging with Pino (2 hours)
10. 🔥 Story 1.10: Metrics Collection with Prometheus (2 hours)
11. 🔥 Story 1.11: Health Checks & Readiness Probes (1 hour)

**Deliverable:** Production-ready codebase (8.5/10 quality) with:

- ✅ Zero Cloudinary costs (save $0.01-0.02 per image)
- ✅ 2-3x faster processing
- ✅ Typed errors with visibility
- ✅ Structured logging & metrics
- ✅ Testable, maintainable architecture

**Why This Must Be First:** All subsequent epics depend on this foundation. Without it, you'll build technical debt that becomes harder to fix later.

---

### Phase 2: Core Processing (Week 2)

**Goal:** Enable anonymous image processing with AI

**Prerequisites:** Epic 1 COMPLETED ✅

**Critical Path:**

1. Epic 2: Stories 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 (Upload + Processing)
2. Epic 3: Stories 3.1 → 3.2 → 3.3 → 3.4 → 3.5 (AI Engine)

**Deliverable:** Working end-to-end processing (upload → AI → results)

**Note:** These stories now leverage the refactored service layer from Epic 1.

---

### Phase 3: Export & UI (Week 3)

**Goal:** Complete user workflow with beautiful interface

**Prerequisites:** Epics 1-3 COMPLETED

**Critical Path:**

1. Epic 4: Stories 4.1 → 4.2 → 4.3 (CSV Export)
2. Epic 5: Stories 5.1 → 5.2 → 5.3 → 5.4 (Core UI)
3. Story 5.5 → 5.6 → 5.7 (Polish & Responsive)

**Deliverable:** Full anonymous user flow with production-ready UI

---

### Phase 4: User Accounts (Week 4)

**Goal:** Enable retention and monetization foundation

**Prerequisites:** Epics 1-5 COMPLETED

**Note:** Database setup (previously Story 1.5) should be done at the start of this phase.

**Critical Path:**

1. Database Setup (PostgreSQL with Prisma)
2. Stories 6.1 → 6.2 → 6.3 (Auth System)
3. Stories 6.4 → 6.5 (Usage Tracking + History)
4. Stories 6.6 → 6.7 (Settings + Upsell)

**Deliverable:** Complete free tier with accounts

---

### Phase 5: Testing & Polish (Week 5)

**Goal:** Production-ready quality

**Activities:**

- Integration testing across all epics
- Performance optimization (validate 2-3x speedup from Epic 1)
- Security audit (error messages, API keys, HTTPS)
- User acceptance testing with real photographers
- Bug fixes and edge cases
- Documentation finalization (deployment, API docs)
- Deployment to Railway/Render production
- Monitoring setup (Prometheus metrics)

**Deliverable:** Launch-ready MVP

---

## Next Steps

### 🚨 START HERE: Epic 1 Development (HIGHEST PRIORITY)

**Epic 1 is the critical path. All other epics depend on it. Start immediately.**

1. **Review the refactoring guide:**

   ```
   Read: docs/ARCHITECTURE_REFACTORING_GUIDE.md
   ```

   - Complete implementation details for all 11 stories
   - Code examples for each phase
   - Expected outcomes and metrics

2. **Start Epic 1, Story 1.2 (Configuration Service):**

   ```
   @dev.mdc *dev-story epic=1 story=2
   ```

   - Story 1.1 is already ✅ COMPLETED (Architecture Audit)
   - Begin with Story 1.2: Configuration Service with Zod
   - Follow sequentially through Epic 1 (Stories 1.2 → 1.11)
   - Estimated: 4-5 development days total

3. **For each story, validate readiness:**

   ```
   @dev.mdc *story-ready epic=1 story=N
   ```

   - Ensure all prerequisites completed
   - Review acceptance criteria
   - Check implementation reference in ARCHITECTURE_REFACTORING_GUIDE.md

4. **Track progress with git commits:**
   - Use format: `ASU-Story-1.2-Configuration-Service-with-Zod`
   - Commit after each story completion
   - Test thoroughly before moving to next story

### For Architecture & Database (DO LATER - Week 4):

Database setup (previously Story 1.5) has been deferred to Epic 6 (User Accounts). Focus on Epic 1 refactoring first.

### For UX Design:

1. **Run UX design workflow:**

   ```
   @ux-designer.mdc *create-ux-design
   ```

   - Design mockups for landing page
   - Create upload flow wireframes
   - Design processing progress screens
   - Prototype dark mode theme

### For Testing:

1. **Run test planning workflow:**

   ```
   @tea.mdc *epic-test-context epic=1
   ```

   - Create test strategy for each epic
   - Define acceptance test scenarios
   - Plan integration test coverage

---

## Success Criteria Validation

Each story includes BDD-style acceptance criteria to ensure quality and completeness. Before marking a story "Done," validate:

✅ **All acceptance criteria met** (Given/When/Then)
✅ **Prerequisites completed** (no forward dependencies)
✅ **Technical notes addressed** (implementation guidance followed)
✅ **Tests passing** (unit, integration, acceptance)
✅ **Code reviewed** (if team workflow requires it)
✅ **Documentation updated** (if user-facing changes)
✅ **No regression** (existing features still work)

---

_For implementation: Use the `dev-story` workflow to generate individual story implementation plans from this epic breakdown._

_Created through BMAD BMM methodology by Product Manager persona._

_Document Version: 1.0_  
_Last Updated: November 10, 2025_
