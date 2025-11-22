# Epic 1 Smoke Test Guide - Quick Verification

**Purpose:** 10-minute smoke test to verify all Epic 1 stories (1.2-1.10) are working  
**When to use:** After refactoring, before commits, after deployment  
**Time:** ~10 minutes for full suite, ~2 minutes for quick check

---

## Prerequisites

```bash
# 1. Ensure dependencies installed
npm install

# 2. Ensure .env file exists with valid OPENAI_API_KEY
cat .env | grep OPENAI_API_KEY
# Should show: OPENAI_API_KEY=sk-...

# 3. Start server in development mode
npm run dev
# Server should start on http://localhost:3000
```

---

## Quick Health Check (30 seconds)

Run these 4 commands to verify server is healthy:

```bash
# 1. Server responds
curl http://localhost:3000

# 2. Metrics endpoint works (Story 1.10)
curl -s http://localhost:3000/metrics | head -5

# 3. Temp directory exists (Story 1.4)
ls -la temp/

# 4. Logs are structured JSON (Story 1.9)
# Look at terminal running npm run dev - should see JSON logs
```

✅ **Pass if:** All commands succeed, no errors in terminal

---

## Story 1.2: Configuration Service ✅

**What:** Validates config loads correctly with Zod validation

### Test:

```bash
# Check server started without config errors
# Look for log line in server output:
npm run dev | grep -i "config"

# Should see something like:
# {"level":"info","msg":"Configuration loaded successfully"}
```

### Manual Check:

```bash
# Verify config values are used (not hardcoded)
grep -r "process.env" src/services/ | wc -l
# Should be 0 (all config goes through ConfigService)
```

✅ **Pass if:** Server starts without config errors, no direct process.env usage

---

## Story 1.3: Directory Structure ✅

**What:** Validates new modular directory structure exists

### Test:

```bash
# Check directory structure
ls -la src/

# Should see:
# - api/
# - services/
# - models/
# - utils/
# - config/

# Verify TypeScript path aliases work
grep -r "@/" src/ | head -3
# Should see imports like: import { ... } from '@/services/...'
```

✅ **Pass if:** All directories exist, path aliases used in imports

---

## Story 1.4: Self-Hosted Temporary URL Service ✅

**What:** Validates image compression and temp URL generation (Cloudinary replacement)

### Test:

```bash
# Test image upload and compression
curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg" \
  | jq '.'

# Expected response:
# {
#   "success": true,
#   "file": {
#     "id": "...",
#     "name": "...",
#     "size": ...
#   }
# }

# Verify temp file created
ls -lh temp/ | head -5
# Should see compressed JPEG files (<500KB typically)

# Test temp URL accessibility
# Get a UUID from temp directory
TEMP_FILE=$(ls temp/ | head -1)
curl -I http://localhost:3000/temp/$TEMP_FILE

# Should return: HTTP/1.1 200 OK
```

✅ **Pass if:** Upload succeeds, temp file created and accessible via HTTP

**Performance Check:**

- Original file: ~500KB
- Compressed file: <100KB (80%+ reduction)
- Processing time: <1 second

---

## Story 1.5: Remove Cloudinary Dependency ✅

**What:** Validates Cloudinary completely removed, no external API calls

### Test:

```bash
# 1. Verify Cloudinary package removed
cat package.json | grep cloudinary
# Should return nothing (empty)

# 2. Verify no Cloudinary imports in code
grep -r "cloudinary" src/
# Should return nothing (empty)

# 3. Verify no CLOUDINARY env vars in .env.example
cat .env.example | grep CLOUDINARY
# Should return nothing (empty)

# 4. Test image processing works without Cloudinary
curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0113.jpg"

# Should succeed with temp URL (not Cloudinary URL)
```

✅ **Pass if:** No Cloudinary traces found, image processing works

**Cost Savings Validated:** ✅ $0.01-0.02 per image eliminated

---

## Story 1.6: Error Architecture & Typed Errors ✅

**What:** Validates typed errors and graceful error handling (no silent failures)

### Test 1: Validation Error (400)

```bash
# Send invalid request
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}' \
  | jq '.'

# Expected response:
# {
#   "success": false,
#   "error": {
#     "code": "VALIDATION_ERROR",
#     "message": "Invalid request format",
#     "statusCode": 400
#   }
# }
```

### Test 2: File Not Found Error

```bash
# Try to upload non-existent file
curl -X POST http://localhost:3000/api/upload \
  -F "image=@nonexistent.jpg" 2>&1 | head -3

# Should fail gracefully with error message (not crash)
```

### Test 3: Error Response Format

```bash
# Trigger any error and verify format
curl -X POST http://localhost:3000/api/upload | jq '.'

# Should have consistent format:
# - success: false
# - error: { code, message, statusCode }
```

✅ **Pass if:** Errors return consistent JSON format, no server crashes

---

## Story 1.7: Retry Logic & Resilience ✅

**What:** Validates retry logic for OpenAI API calls

### Test:

```bash
# Process image (OpenAI call happens internally)
curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg"

# Check logs for retry behavior
# In server terminal, look for:
# {"level":"info","msg":"OpenAI API call succeeded"}
# or
# {"level":"warn","attempt":1,"msg":"Retrying OpenAI call"}
```

### Simulate Failure (Optional):

```bash
# Temporarily set invalid OpenAI key in .env
# OPENAI_API_KEY=invalid_key_for_testing

# Restart server and upload image
curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg"

# Should see retry attempts in logs:
# {"level":"warn","attempt":1,"msg":"Retrying..."}
# {"level":"warn","attempt":2,"msg":"Retrying..."}
# {"level":"error","msg":"Max retries exceeded"}
```

✅ **Pass if:** Retries happen on failures, graceful error after max attempts

**Restore valid OPENAI_API_KEY after test!**

---

## Story 1.8: Service Layer & Dependency Injection ✅

**What:** Validates service architecture and DI container

### Test 1: Services Initialized

```bash
# Check DI container logs on startup
npm run dev | grep -i "container"

# Should see:
# {"level":"info","msg":"Initializing service container"}
# {"level":"info","msg":"Service container initialized successfully"}
```

### Test 2: Service Integration

```bash
# Test full service chain: Upload → TempURL → Metadata → CSV
curl -X POST http://localhost:3000/api/process-batch \
  -F "images=@reference_images/_MG_0024-2.jpg" \
  -F "images=@reference_images/_MG_0113.jpg" \
  -F "initials=TEST"

# Expected flow (check logs):
# 1. TempUrlService: Creates temp URLs
# 2. MetadataService: Calls OpenAI
# 3. ImageProcessingService: Orchestrates batch
# 4. CsvExportService: Generates CSV
```

### Test 3: Services Available

```bash
# Check services exist
ls -la src/services/

# Should see:
# - temp-url.service.ts
# - metadata.service.ts
# - image-processing.service.ts
# - csv-export.service.ts
```

✅ **Pass if:** Container initializes, services integrated, batch processing works

---

## Story 1.9: Structured Logging with Pino ✅

**What:** Validates structured JSON logs and correlation IDs

### Test 1: Log Format

```bash
# Start server and observe log format
npm run dev

# Logs should be JSON in this format:
# {"level":"info","time":1234567890,"msg":"Server started"}
# NOT: console.log("Server started")
```

### Test 2: Correlation IDs

```bash
# Make a request and capture correlation ID
curl -v http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg" 2>&1 | grep -i "x-request-id"

# Server should return X-Request-Id header
# Example: X-Request-Id: 550e8400-e29b-41d4-a716-446655440000

# Check logs for same correlation ID throughout request
# All log lines for this request should have "reqId":"550e8400..."
```

### Test 3: No Console.log

```bash
# Verify no console.log in production code
grep -r "console\.log\|console\.error" src/ --include="*.ts"

# Should return nothing (or only TypeScript files with type definitions)
```

### Test 4: Sensitive Data Redaction

```bash
# Check logs don't contain API keys
npm run dev | grep -i "sk-" | grep -i "api"

# Should see [REDACTED] instead of actual API key
# Example: {"apiKey":"[REDACTED]"}
```

✅ **Pass if:** Logs are JSON format, correlation IDs present, no console.log, secrets redacted

---

## Story 1.10: Metrics Collection with Prometheus ✅

**What:** Validates Prometheus metrics collection and exposure

### Test 1: Metrics Endpoint

```bash
# Access metrics endpoint
curl -s http://localhost:3000/metrics | head -20

# Should see Prometheus format:
# # HELP asu_images_processed_total Total images processed
# # TYPE asu_images_processed_total counter
# asu_images_processed_total{status="success"} 0
```

### Test 2: Custom Metrics Present

```bash
# Check for custom application metrics
curl -s http://localhost:3000/metrics | grep "asu_"

# Should see:
# - asu_images_processed_total
# - asu_processing_duration_seconds
# - asu_openai_cost_usd
# - asu_openai_calls_total
```

### Test 3: Default Node.js Metrics

```bash
# Check for Node.js runtime metrics
curl -s http://localhost:3000/metrics | grep "asu_nodejs_"

# Should see metrics like:
# - asu_nodejs_heap_size_used_bytes
# - asu_nodejs_eventloop_lag_seconds
# - asu_nodejs_version_info
```

### Test 4: Metrics Update

```bash
# Process an image
curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg"

# Check metrics updated
curl -s http://localhost:3000/metrics | grep "asu_images_processed_total"

# Counter should have incremented:
# asu_images_processed_total{status="success"} 1
```

✅ **Pass if:** Metrics endpoint works, custom metrics present, counters increment

---

## Full Integration Test (2 minutes)

**Test the complete Epic 1 flow end-to-end:**

```bash
# 1. Upload image
curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg" \
  -o response.json

# 2. Verify temp file created
ls -lh temp/ | tail -1

# 3. Check structured logs (in server terminal)
# Look for JSON logs with reqId

# 4. Check metrics updated
curl -s http://localhost:3000/metrics | grep "asu_images_processed_total"

# 5. Verify no errors in logs
# Server terminal should show no ERROR level logs

# 6. Clean up
rm response.json
```

✅ **Pass if:** All 6 steps succeed without errors

---

## Performance Smoke Test (30 seconds)

**Validate "2-3x faster" claim from Epic 1 goals:**

```bash
# Test processing speed
time curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg" \
  -o /dev/null -s

# Should complete in:
# - Compression: <1 second
# - OpenAI call: 2-4 seconds
# - Total: <5 seconds

# Before (with Cloudinary): 5-10 seconds
# After (local Sharp): 3-5 seconds
# ✅ 2x faster achieved
```

---

## Quick Regression Check

**Verify no Epic 1 changes broke existing functionality:**

```bash
# Run test suite
npm test

# Should show:
# Tests: 272 passed, 272 total
# All tests passing ✅
```

---

## Master Smoke Test Checklist

Run through this checklist in **10 minutes:**

### Server Startup (1 min)

- [ ] Server starts without errors: `npm run dev`
- [ ] Configuration loads successfully (check logs)
- [ ] DI container initializes (check logs)
- [ ] No console.log statements (only JSON logs)

### Endpoints Available (1 min)

- [ ] Root endpoint responds: `curl http://localhost:3000`
- [ ] Upload endpoint works: `/api/upload`
- [ ] Metrics endpoint works: `/metrics`
- [ ] Temp directory static serving works: `/temp/{uuid}.jpg`

### Story-Specific Validations (5 min)

- [ ] **1.2:** Config service used (no process.env in services)
- [ ] **1.3:** Directory structure exists (api/, services/, models/, utils/, config/)
- [ ] **1.4:** Temp URLs work (image compressed and accessible)
- [ ] **1.5:** Cloudinary removed (no traces in code/package.json)
- [ ] **1.6:** Typed errors return consistent JSON format
- [ ] **1.7:** Retry logic present (check logs)
- [ ] **1.8:** Services initialized in DI container
- [ ] **1.9:** Structured logging (JSON format with correlation IDs)
- [ ] **1.10:** Metrics endpoint returns Prometheus format

### Integration Tests (2 min)

- [ ] Image upload → compression → temp URL → accessible
- [ ] Metrics increment after processing
- [ ] Logs show full request lifecycle with reqId
- [ ] No errors in server logs

### Performance (1 min)

- [ ] Image upload completes in <5 seconds
- [ ] Temp file <100KB (compressed from ~500KB)
- [ ] Test suite passes in <30 seconds: `npm test`

---

## Quick Commands Reference

Copy-paste these for fastest smoke test:

```bash
# 1. Start server
npm run dev

# 2. Quick health check
curl http://localhost:3000/metrics | head -3

# 3. Upload test image
curl -X POST http://localhost:3000/api/upload -F "image=@reference_images/_MG_0024-2.jpg"

# 4. Check temp file
ls -lh temp/ | tail -1

# 5. Verify metrics updated
curl -s http://localhost:3000/metrics | grep "asu_images_processed_total"

# 6. Run tests
npm test

# ✅ If all 6 commands succeed, Epic 1 is working!
```

---

## What "Success" Looks Like

### Terminal Output (Server):

```json
{"level":"info","msg":"Configuration loaded successfully"}
{"level":"info","msg":"Initializing service container"}
{"level":"info","msg":"Service container initialized successfully"}
{"level":"info","msg":"Server listening on port 3000"}
{"level":"info","reqId":"550e8400...","msg":"Request started","method":"POST","url":"/api/upload"}
{"level":"info","reqId":"550e8400...","msg":"Image compressed","originalSize":512000,"compressedSize":98000}
{"level":"info","reqId":"550e8400...","msg":"Temp URL created","uuid":"..."}
{"level":"info","reqId":"550e8400...","msg":"Request completed","duration":1234}
```

### Test Results:

```
Test Suites: 13 passed, 13 total
Tests:       272 passed, 272 total
Snapshots:   0 total
Time:        28.5 s
```

### Metrics Output:

```
# HELP asu_images_processed_total Total images processed
# TYPE asu_images_processed_total counter
asu_images_processed_total{status="success"} 5
asu_images_processed_total{status="failure"} 0

# HELP asu_processing_duration_seconds Processing duration
# TYPE asu_processing_duration_seconds histogram
asu_processing_duration_seconds_bucket{stage="temp_url",le="0.1"} 3
asu_processing_duration_seconds_bucket{stage="openai",le="5"} 5

# HELP asu_openai_cost_usd Cumulative OpenAI API cost
# TYPE asu_openai_cost_usd counter
asu_openai_cost_usd 0.01
```

---

## Troubleshooting

### Issue: Server won't start

```bash
# Check for missing dependencies
npm install

# Check .env file exists
cat .env

# Check port 3000 not in use
lsof -i :3000
# If occupied: kill -9 <PID>
```

### Issue: Tests failing

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Run tests with output
npm test -- --verbose
```

### Issue: Upload returns 500 error

```bash
# Check OPENAI_API_KEY is valid
echo $OPENAI_API_KEY

# Check temp directory exists and writable
ls -la temp/
chmod 755 temp/
```

### Issue: Metrics endpoint empty

```bash
# Verify prom-client installed
npm list prom-client

# Check server logs for errors
npm run dev | grep -i metric
```

---

## Success Criteria Summary

✅ **Epic 1 Smoke Test PASSES if:**

1. **Server Starts:** No config errors, DI container initialized
2. **Endpoints Work:** Upload, metrics, temp URLs all accessible
3. **Cloudinary Gone:** No traces in code or package.json
4. **Logging Structured:** JSON format with correlation IDs
5. **Metrics Active:** Prometheus endpoint returns data, counters increment
6. **Errors Graceful:** Typed errors return consistent JSON
7. **Tests Pass:** 272/272 tests passing
8. **Performance Good:** Upload <5s, compression <1s
9. **No Regressions:** Existing functionality still works

---

## Time Budget

- **Quick Check (2 min):** Commands 1-6 in Quick Commands Reference
- **Standard Smoke Test (10 min):** Master Smoke Test Checklist
- **Full Validation (30 min):** All story-specific tests + integration
- **With Manual Inspection:** Add 15 min for log review and metrics analysis

---

**Happy Smoke Testing!** 🧪

This is your **confidence builder** - run this before every commit, after every deployment, and whenever you want to verify Epic 1 is healthy.

---

<!-- Epic 1 Smoke Test Guide -->
<!-- Generated: 2025-11-22 -->
<!-- Test Architect: Murat (TEA) -->
