# Epic 2: Anonymous Image Processing Pipeline - Smoke Test Guide

**Epic:** Epic 2 - Anonymous Image Processing Pipeline  
**Created:** 2025-11-27  
**Author:** Murat (Master Test Architect)  
**Testing Type:** Manual Smoke Testing  
**Stories Covered:** 2.1, 2.2, 2.3, 2.4, 2.5, 2.6

---

## Overview

This smoke test guide validates the core functionality of the Anonymous Image Processing Pipeline. The goal is to verify that anonymous users can upload, process, and track batch processing of images without authentication.

### Prerequisites

- [ ] Server is running (`npm run dev` or `npm start`)
- [ ] OpenAI API key is configured in `.env`
- [ ] Test images available (JPG, PNG, or WEBP format)
- [ ] HTTP client tool available (curl, Postman, Insomnia, or browser DevTools)
- [ ] Browser with DevTools for cookie inspection

### Test Environment

- **Base URL:** `http://localhost:3000`
- **API Endpoints:**
  - `POST /api/upload-images` - Batch upload
  - `POST /api/process-batch-v2` - Start processing
  - `GET /api/batch-status/:batchId` - Check progress
  - `GET /health` - Health check
  - `GET /metrics` - Prometheus metrics

---

## Pre-Test Checks

### PT-1: Server Health Check

| Step | Action                                    | Expected Result                                                         |
| ---- | ----------------------------------------- | ----------------------------------------------------------------------- |
| 1    | `curl http://localhost:3000/health`       | Returns `{ "status": "ok", "timestamp": "..." }`                        |
| 2    | `curl http://localhost:3000/health/ready` | Returns `{ "status": "ready", "checks": {...} }` with all checks `true` |
| 3    | Check server logs                         | No error messages at startup                                            |

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

## Smoke Test Checklist

### ST-1: Session Cookie Creation (Story 2.2)

**Objective:** Verify anonymous session is created on first request

| Step | Action                                                    | Expected Result                                       |
| ---- | --------------------------------------------------------- | ----------------------------------------------------- |
| 1    | Clear browser cookies for localhost                       | Cookies cleared                                       |
| 2    | Make request to `/api/upload-images` (even without files) | Response includes `Set-Cookie` header                 |
| 3    | Inspect cookie                                            | Cookie named `session_id` with UUID value             |
| 4    | Check cookie attributes                                   | `HttpOnly=true`, `SameSite=Strict`, expires in 1 hour |
| 5    | Make second request with same cookie                      | Same session ID maintained                            |

**curl command:**

```bash
curl -v -X POST http://localhost:3000/api/upload-images \
  -H "Content-Type: multipart/form-data" \
  -F "images=@test.jpg" 2>&1 | grep -i "set-cookie"
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-2: Single Image Upload (Story 2.1)

**Objective:** Verify single image upload with validation

| Step | Action                             | Expected Result                             |
| ---- | ---------------------------------- | ------------------------------------------- |
| 1    | Upload 1 valid JPG image           | Success response with file ID               |
| 2    | Response includes `files` array    | Array has 1 entry with `id`, `name`, `size` |
| 3    | Response includes `sessionUsage`   | Shows "1 of 10 free images used"            |
| 4    | File saved to `/uploads` directory | File exists with UUID-prefixed name         |

**curl command:**

```bash
curl -X POST http://localhost:3000/api/upload-images \
  -H "Content-Type: multipart/form-data" \
  -F "images=@test.jpg" \
  -c cookies.txt -b cookies.txt
```

**Expected response:**

```json
{
  "success": true,
  "files": [{ "id": "uuid-test.jpg", "name": "test.jpg", "size": 123456 }],
  "message": "Successfully uploaded 1 file(s)",
  "sessionUsage": "1 of 10 free images used"
}
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-3: Batch Image Upload (Story 2.1)

**Objective:** Verify batch upload of multiple images (up to 10)

| Step | Action                          | Expected Result                                      |
| ---- | ------------------------------- | ---------------------------------------------------- |
| 1    | Upload 3-5 valid images at once | Success response with all file IDs                   |
| 2    | Check `files` array             | Contains entry for each uploaded image               |
| 3    | Check `sessionUsage`            | Updated correctly (e.g., "4 of 10 free images used") |
| 4    | Verify files in `/uploads`      | All files exist with UUID-prefixed names             |

**curl command:**

```bash
curl -X POST http://localhost:3000/api/upload-images \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg" \
  -F "images=@image3.png" \
  -c cookies.txt -b cookies.txt
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-4: File Type Validation (Story 2.1)

**Objective:** Verify only JPG, PNG, WEBP are accepted

| Step | Action                                           | Expected Result                            |
| ---- | ------------------------------------------------ | ------------------------------------------ |
| 1    | Upload valid JPG file                            | Success (200)                              |
| 2    | Upload valid PNG file                            | Success (200)                              |
| 3    | Upload valid WEBP file                           | Success (200)                              |
| 4    | Upload invalid file (PDF, GIF, etc.)             | Error 400 with "Invalid file type" message |
| 5    | Upload file with wrong extension but valid image | Should still work (MIME type checked)      |

**Test invalid file:**

```bash
curl -X POST http://localhost:3000/api/upload-images \
  -F "images=@document.pdf" \
  -c cookies.txt -b cookies.txt
```

**Expected error response:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid file type: application/pdf. Only JPG, PNG, and WEBP are allowed."
  }
}
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-5: File Size Limit (Story 2.1)

**Objective:** Verify 50MB file size limit

| Step | Action                      | Expected Result                 |
| ---- | --------------------------- | ------------------------------- |
| 1    | Upload file under 50MB      | Success (200)                   |
| 2    | Upload file over 50MB       | Error 413 "File too large"      |
| 3    | Check error response format | Consistent JSON error structure |

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-6: Session Rate Limiting - Anonymous Limit (Story 2.2, 2.3)

**Objective:** Verify 10-image limit per anonymous session

| Step | Action                                                    | Expected Result                   |
| ---- | --------------------------------------------------------- | --------------------------------- |
| 1    | Start with fresh session (clear cookies)                  | Session created                   |
| 2    | Upload 10 images (can be spread across multiple requests) | All succeed                       |
| 3    | Check `sessionUsage`                                      | Shows "10 of 10 free images used" |
| 4    | Try to upload 11th image                                  | Error 429 "Rate limit exceeded"   |
| 5    | Check rate limit headers                                  | `X-RateLimit-Remaining: 0`        |
| 6    | Verify error message mentions account upgrade             | Message suggests creating account |

**curl command for 11th image (should fail):**

```bash
curl -X POST http://localhost:3000/api/upload-images \
  -F "images=@test11.jpg" \
  -c cookies.txt -b cookies.txt
```

**Expected error:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Upload would exceed anonymous limit. You have 0 of 10 free images remaining...",
    "retryAfter": 3600
  }
}
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-7: IP Rate Limiting (Story 2.3)

**Objective:** Verify per-IP rate limiting (50 requests/minute)

| Step | Action                                      | Expected Result                 |
| ---- | ------------------------------------------- | ------------------------------- |
| 1    | Make rapid requests to `/api/upload-images` | Initial requests succeed        |
| 2    | Check response headers                      | Include rate limit headers      |
| 3    | Exceed 50 requests in 1 minute              | Returns 429 "Too many requests" |
| 4    | Wait 1 minute, retry                        | Request succeeds again          |

**Rate limit headers to verify:**

- `X-RateLimit-Limit: 50`
- `X-RateLimit-Remaining: N`
- `X-RateLimit-Reset: <timestamp>`

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-8: Image Integrity Validation (Story 2.1, 2.4)

**Objective:** Verify corrupted images are detected and rejected

| Step | Action                                        | Expected Result                              |
| ---- | --------------------------------------------- | -------------------------------------------- |
| 1    | Upload valid image                            | Success                                      |
| 2    | Upload corrupted image (e.g., truncated file) | Error or warning about corruption            |
| 3    | Check response for corruption warning         | Response includes `warning` field if partial |
| 4    | Verify corrupted file is deleted              | File not in `/uploads`                       |

**Create corrupted test file:**

```bash
head -c 1000 valid.jpg > corrupted.jpg
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-9: Start Batch Processing (Story 2.5, 2.6)

**Objective:** Verify batch processing initiation and batchId return

| Step | Action                                          | Expected Result                               |
| ---- | ----------------------------------------------- | --------------------------------------------- |
| 1    | Upload 3 images first                           | Get file IDs                                  |
| 2    | Call `POST /api/process-batch-v2` with file IDs | Success with batchId                          |
| 3    | Response is immediate (async processing)        | Returns within 100ms                          |
| 4    | Response includes batchId (UUID format)         | Valid UUID returned                           |
| 5    | Response includes polling instruction           | Message mentions `/api/batch-status/:batchId` |

**curl command:**

```bash
# First upload
curl -X POST http://localhost:3000/api/upload-images \
  -F "images=@img1.jpg" \
  -F "images=@img2.jpg" \
  -F "images=@img3.jpg" \
  -c cookies.txt -b cookies.txt

# Then process (use file IDs from upload response)
curl -X POST http://localhost:3000/api/process-batch-v2 \
  -H "Content-Type: application/json" \
  -d '{"fileIds": ["uuid1-img1.jpg", "uuid2-img2.jpg", "uuid3-img3.jpg"]}' \
  -c cookies.txt -b cookies.txt
```

**Expected response:**

```json
{
  "success": true,
  "batchId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "message": "Processing started for 3 file(s). Poll /api/batch-status/... for progress."
}
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-10: Batch Status Polling (Story 2.6)

**Objective:** Verify real-time progress tracking

| Step | Action                                            | Expected Result                                         |
| ---- | ------------------------------------------------- | ------------------------------------------------------- |
| 1    | Start batch processing (ST-9)                     | Get batchId                                             |
| 2    | Call `GET /api/batch-status/:batchId` immediately | Status is "pending" or "processing"                     |
| 3    | Poll every 2 seconds                              | Progress updates with each poll                         |
| 4    | Verify progress counts                            | `total`, `completed`, `failed`, `processing`, `pending` |
| 5    | Verify per-image status array                     | Each image has `id`, `filename`, `status`               |
| 6    | Wait for completion                               | Status changes to "completed"                           |
| 7    | Final response shows all images done              | `completed + failed = total`                            |

**curl command:**

```bash
curl http://localhost:3000/api/batch-status/<batchId> \
  -b cookies.txt
```

**Expected response during processing:**

```json
{
  "batchId": "uuid",
  "status": "processing",
  "progress": {
    "total": 3,
    "completed": 1,
    "failed": 0,
    "processing": 1,
    "pending": 1
  },
  "images": [
    { "id": "...", "filename": "img1.jpg", "status": "completed" },
    { "id": "...", "filename": "img2.jpg", "status": "processing" },
    { "id": "...", "filename": "img3.jpg", "status": "pending" }
  ],
  "estimatedTimeRemaining": 10,
  "createdAt": "2025-11-27T10:00:00.000Z"
}
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-11: Batch Completion Detection (Story 2.6)

**Objective:** Verify batch status changes to "completed" when done

| Step | Action                          | Expected Result                    |
| ---- | ------------------------------- | ---------------------------------- |
| 1    | Start batch and poll until done | Batch completes                    |
| 2    | Final status is "completed"     | `status: "completed"`              |
| 3    | All images show final status    | Each is "completed" or "failed"    |
| 4    | `estimatedTimeRemaining` is 0   | `estimatedTimeRemaining: 0`        |
| 5    | Check server logs               | Shows "Batch processing completed" |

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-12: Batch Session Ownership (Story 2.6)

**Objective:** Verify users can only access their own batches

| Step | Action                                                 | Expected Result             |
| ---- | ------------------------------------------------------ | --------------------------- |
| 1    | Create batch with Session A                            | Get batchId                 |
| 2    | Try to access batch with different session (Session B) | Error 404 "Batch not found" |
| 3    | Access with original session (Session A)               | Success with batch status   |

**curl command (different session):**

```bash
# New session (no cookies)
curl http://localhost:3000/api/batch-status/<batchId>
```

**Expected error:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Batch not found"
  }
}
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-13: Batch ID Validation (Story 2.6)

**Objective:** Verify invalid batch ID format is rejected

| Step | Action                                  | Expected Result                     |
| ---- | --------------------------------------- | ----------------------------------- |
| 1    | Request with invalid batchId (not UUID) | Error 400 "Invalid batch ID format" |
| 2    | Request with non-existent UUID          | Error 404 "Batch not found"         |
| 3    | Request with SQL injection attempt      | Error 400 (validation fails)        |

**Test commands:**

```bash
# Invalid format
curl http://localhost:3000/api/batch-status/invalid-id -b cookies.txt

# Non-existent UUID
curl http://localhost:3000/api/batch-status/00000000-0000-0000-0000-000000000000 -b cookies.txt
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-14: Parallel Processing Performance (Story 2.5)

**Objective:** Verify batch processing uses parallel execution

| Step | Action                        | Expected Result                                       |
| ---- | ----------------------------- | ----------------------------------------------------- |
| 1    | Upload 5 images               | Files ready                                           |
| 2    | Start batch processing        | Processing starts                                     |
| 3    | Check status while processing | Shows 2-5 images in "processing" state simultaneously |
| 4    | Measure total time            | Should be ~4-6s per image (not sequential ~30s)       |
| 5    | Calculate speedup             | At least 3x faster than sequential                    |

**Performance metrics to capture:**

- Start time: **\_\_\_**
- End time: **\_\_\_**
- Total duration: **\_\_\_**
- Expected sequential time (5 images × 5s): 25s
- Actual speedup factor: **\_\_\_**

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-15: ETA Calculation (Story 2.6)

**Objective:** Verify estimated time remaining is calculated

| Step | Action                          | Expected Result                                    |
| ---- | ------------------------------- | -------------------------------------------------- |
| 1    | Start batch with 5+ images      | Processing starts                                  |
| 2    | Poll status early in processing | `estimatedTimeRemaining` > 0                       |
| 3    | ETA decreases with each poll    | Value decreases as images complete                 |
| 4    | ETA is reasonable               | Within expected range (not negative, not infinite) |
| 5    | On completion                   | `estimatedTimeRemaining: 0`                        |

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-16: Error Recovery in Batch (Story 2.5, 2.6)

**Objective:** Verify graceful handling of individual image failures

| Step | Action                                     | Expected Result                 |
| ---- | ------------------------------------------ | ------------------------------- |
| 1    | Upload mix of valid and problematic images | Files ready                     |
| 2    | Start batch processing                     | Processing starts               |
| 3    | If one image fails, others continue        | Batch doesn't abort             |
| 4    | Final status shows partial success         | Some "completed", some "failed" |
| 5    | Failed images have error messages          | `error` field populated         |

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-17: File Cleanup After Processing (Story 2.6)

**Objective:** Verify uploaded files are cleaned up after processing

| Step | Action                              | Expected Result                           |
| ---- | ----------------------------------- | ----------------------------------------- |
| 1    | Upload images                       | Files in `/uploads`                       |
| 2    | Start and complete batch processing | Processing completes                      |
| 3    | Check `/uploads` directory          | Processed files are deleted               |
| 4    | Check `/temp` directory             | Compressed files cleaned up (after delay) |

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

### ST-18: Process Batch Validation (Story 2.6)

**Objective:** Verify input validation for process-batch endpoint

| Step | Action                          | Expected Result                        |
| ---- | ------------------------------- | -------------------------------------- |
| 1    | Call with empty `fileIds` array | Error 400 "fileIds array is required"  |
| 2    | Call with more than 10 files    | Error 400 "Maximum 10 files"           |
| 3    | Call with non-existent file IDs | Error 400 "Files not found"            |
| 4    | Call without session cookie     | Session created, then validation error |

**Test commands:**

```bash
# Empty array
curl -X POST http://localhost:3000/api/process-batch-v2 \
  -H "Content-Type: application/json" \
  -d '{"fileIds": []}' \
  -c cookies.txt -b cookies.txt

# Non-existent files
curl -X POST http://localhost:3000/api/process-batch-v2 \
  -H "Content-Type: application/json" \
  -d '{"fileIds": ["fake-id.jpg"]}' \
  -c cookies.txt -b cookies.txt
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

## End-to-End Flow Test

### E2E-1: Complete Anonymous User Journey

**Objective:** Test full workflow from upload to completion

| Step | Action                           | Expected Result                  |
| ---- | -------------------------------- | -------------------------------- |
| 1    | Clear cookies (fresh session)    | Start clean                      |
| 2    | Upload 3 test images             | Success, get file IDs            |
| 3    | Start batch processing           | Get batchId                      |
| 4    | Poll status until complete       | See progress updates             |
| 5    | Final status shows all completed | All images have results          |
| 6    | Check sessionUsage               | Shows "3 of 10 free images used" |
| 7    | Verify files cleaned up          | `/uploads` directory empty       |

**Total time for E2E test:** **\_\_\_** seconds

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

## Metrics Verification

### MV-1: Prometheus Metrics (Story 1.10 Integration)

**Objective:** Verify processing metrics are captured

| Step | Action                                   | Expected Result                         |
| ---- | ---------------------------------------- | --------------------------------------- |
| 1    | Process a batch of images                | Complete successfully                   |
| 2    | Check `/metrics` endpoint                | Contains custom metrics                 |
| 3    | Verify `asu_images_processed_total`      | Counter incremented                     |
| 4    | Verify `asu_processing_duration_seconds` | Histogram populated                     |
| 5    | Check labels                             | Status labels (success/failure) present |

**curl command:**

```bash
curl http://localhost:3000/metrics | grep asu_
```

**Pass:** [ ] **Fail:** [ ] **Notes:** ********\_********

---

## Test Summary

### Test Results Summary

| Test ID | Name                            | Status              | Notes |
| ------- | ------------------------------- | ------------------- | ----- |
| PT-1    | Server Health Check             | [ ] Pass / [ ] Fail |       |
| ST-1    | Session Cookie Creation         | [ ] Pass / [ ] Fail |       |
| ST-2    | Single Image Upload             | [ ] Pass / [ ] Fail |       |
| ST-3    | Batch Image Upload              | [ ] Pass / [ ] Fail |       |
| ST-4    | File Type Validation            | [ ] Pass / [ ] Fail |       |
| ST-5    | File Size Limit                 | [ ] Pass / [ ] Fail |       |
| ST-6    | Session Rate Limiting           | [ ] Pass / [ ] Fail |       |
| ST-7    | IP Rate Limiting                | [ ] Pass / [ ] Fail |       |
| ST-8    | Image Integrity Validation      | [ ] Pass / [ ] Fail |       |
| ST-9    | Start Batch Processing          | [ ] Pass / [ ] Fail |       |
| ST-10   | Batch Status Polling            | [ ] Pass / [ ] Fail |       |
| ST-11   | Batch Completion Detection      | [ ] Pass / [ ] Fail |       |
| ST-12   | Batch Session Ownership         | [ ] Pass / [ ] Fail |       |
| ST-13   | Batch ID Validation             | [ ] Pass / [ ] Fail |       |
| ST-14   | Parallel Processing Performance | [ ] Pass / [ ] Fail |       |
| ST-15   | ETA Calculation                 | [ ] Pass / [ ] Fail |       |
| ST-16   | Error Recovery in Batch         | [ ] Pass / [ ] Fail |       |
| ST-17   | File Cleanup After Processing   | [ ] Pass / [ ] Fail |       |
| ST-18   | Process Batch Validation        | [ ] Pass / [ ] Fail |       |
| E2E-1   | Complete Anonymous User Journey | [ ] Pass / [ ] Fail |       |
| MV-1    | Prometheus Metrics              | [ ] Pass / [ ] Fail |       |

### Totals

- **Total Tests:** 21
- **Passed:** \_\_\_
- **Failed:** \_\_\_
- **Pass Rate:** \_\_\_%

### Acceptance Criteria Coverage

| Story | AC Coverage | Status                                                |
| ----- | ----------- | ----------------------------------------------------- |
| 2.1   | AC1-AC8     | ST-2, ST-3, ST-4, ST-5, ST-8                          |
| 2.2   | AC1-AC6     | ST-1, ST-6                                            |
| 2.3   | AC1-AC4     | ST-6, ST-7                                            |
| 2.4   | AC1-AC7     | ST-8, ST-17                                           |
| 2.5   | AC1-AC6     | ST-14, ST-16                                          |
| 2.6   | AC1-AC8     | ST-9, ST-10, ST-11, ST-12, ST-13, ST-15, ST-17, ST-18 |

---

## Bugs Found

### Bug Template

```
Bug ID: EPIC2-BUG-XXX
Story: 2.X
Test: ST-XX
Severity: Critical/High/Medium/Low
Description:
Steps to Reproduce:
1.
2.
3.
Expected Result:
Actual Result:
Screenshot/Logs:
```

### Bug List

| Bug ID | Story | Severity | Description | Status |
| ------ | ----- | -------- | ----------- | ------ |
|        |       |          |             |        |

---

## Tester Sign-Off

**Tester Name:** ********\_\_\_\_********  
**Date:** ********\_\_\_\_********  
**Epic Status:** [ ] VERIFIED / [ ] NEEDS WORK

**Comments:**

---

_Created by TEA (Master Test Architect) following BMAD BMM methodology_  
_Document Version: 1.0_
