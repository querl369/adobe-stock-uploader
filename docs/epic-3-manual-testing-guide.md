# Epic 3: AI Metadata Generation Engine - Manual Testing Guide

**Tester:** TEA (Test Architect)  
**Date:** December 25, 2025  
**Epic Status:** All 5 Stories DONE (ready for verification)  
**Test Type:** Manual smoke testing + requirements validation

---

## Overview

This guide provides comprehensive manual test cases for validating Epic 3: AI Metadata Generation Engine. Epic 3 implements the core intelligence layer that analyzes images and generates Adobe Stock-compliant metadata using OpenAI Vision API.

### Epic 3 Stories

| Story | Description                          | Status  |
| ----- | ------------------------------------ | ------- |
| 3.1   | OpenAI Vision API Integration        | ✅ Done |
| 3.2   | Adobe Stock Category Taxonomy        | ✅ Done |
| 3.3   | Optimized AI Prompt Engineering      | ✅ Done |
| 3.4   | Metadata Validation & Quality Checks | ✅ Done |
| 3.5   | Error Recovery & Retry Logic         | ✅ Done |

### Prerequisites

1. Server running (`npm run dev`)
2. Valid OpenAI API key configured in `.env`
3. Server deployed to public URL (ngrok or Railway) for OpenAI image access
4. Test images in `reference_images/` folder
5. Session cookie from previous Epic 2 testing (or new session)

---

## Test Environment Setup

### 1. Start the Server

```bash
cd /Users/oleksii/Documents_local/adobe-stock-uploader
npm run dev
```

Expected output:

```
Server started on port 3000
Service container initialized
```

### 2. Set Up Public URL (Required for OpenAI)

OpenAI Vision API cannot access localhost URLs. You need a tunneling service to expose your local server.

**Option A: ngrok (recommended - stable and reliable)**

1. Install ngrok (if not already installed):

```bash
npm install @ngrok/ngrok
# or globally: brew install ngrok
```

2. Sign up for free at [ngrok.com](https://ngrok.com) and get your auth token

3. Configure auth token (one-time):

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

4. Start tunnel (in a separate terminal):

```bash
ngrok http 3000
```

You'll receive a stable URL like `https://abc123.ngrok-free.app`.

**Option B: localtunnel (free, but unreliable)**

> ⚠️ **Not recommended** - localtunnel frequently drops connections and returns 503 errors during testing.

```bash
npm install -g localtunnel
lt --port 3000
```

**Option C: Deploy to Railway/Render (for persistent testing)**

For production-like testing, deploy to a cloud platform.

---

**After starting your tunnel**, set environment variables in BOTH terminals:

**Terminal 1 (Server)** - Required for image URLs sent to OpenAI:

```bash
export BASE_URL="https://your-tunnel-url.ngrok-free.app"
npm run dev
```

**Terminal 2 (curl commands)** - Required for API calls:

```bash
export TEST_BASE_URL="https://your-tunnel-url.ngrok-free.app"
```

> **Important:** The server needs `BASE_URL` to generate public image URLs that OpenAI can access. Without it, OpenAI receives `localhost` URLs and fails with "Error while downloading" errors.

---

## Story 3.1: OpenAI Vision API Integration

### TC-3.1.1: Basic Metadata Generation

**Purpose:** Verify OpenAI Vision API generates metadata for a valid image.

**Steps:**

1. Upload an image:

```bash
curl -X POST "${TEST_BASE_URL}/api/upload-images" \
  -F "images=@./reference_images/_MG_7942.jpg" \
  -c cookies.txt
```

2. Process the uploaded batch:

```bash
curl -X POST "${TEST_BASE_URL}/api/process-batch-v2" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -c cookies.txt
```

3. Check batch status until complete:

```bash
curl -X GET "${TEST_BASE_URL}/api/batch-status/{batchId}" \
  -b cookies.txt
```

**Expected Results:**

- ✅ Upload returns file ID and batch reference
- ✅ Processing completes within 30 seconds per image
- ✅ Metadata includes `title`, `keywords`, and `category`
- ✅ No timeout errors (30s max configured)

---

### TC-3.1.2: Image Detail Level Configuration

**Purpose:** Verify service uses "low" detail for cost efficiency.

**Verification Method:** Check server terminal output for OpenAI API parameters.

Look in the server terminal (where `npm run dev` is running) for log entries like:

```
DEBUG: OpenAI response structure
    hasContent: true
    contentLength: 981
    finishReason: "stop"
    model: "gpt-5-nano-..."
```

**Expected Results:**

- ✅ Image detail is set to "low" in code (`src/services/metadata.service.ts` line 201)
- ✅ Processing cost approximately $0.002 per image (shown in logs as `cost: 0.002`)

---

### TC-3.1.3: Connection Validation

**Purpose:** Verify health check validates OpenAI connectivity.

```bash
curl -X GET "${TEST_BASE_URL}/health/ready"
```

**Expected Results:**

```json
{
  "status": "ready",
  "checks": {
    "config": true,
    "openai": true,
    "filesystem": true
  }
}
```

---

## Story 3.2: Adobe Stock Category Taxonomy

### TC-3.2.1: Category ID Validation (1-21)

**Purpose:** Verify only valid Adobe Stock category IDs are accepted.

**Unit Test Verification:**

```bash
npm test -- tests/category.service.test.ts
```

**Expected Results:**

- ✅ 76 tests passing in category.service.test.ts
- ✅ IDs 1-21 accepted as valid
- ✅ IDs 0, 22, -1, 99 rejected

---

### TC-3.2.2: Category Name Mapping

**Purpose:** Verify fuzzy matching of category names to IDs.

**Test Cases (verified via manual API call with debug logging):**

| Input          | Expected ID | Category Name                      |
| -------------- | ----------- | ---------------------------------- |
| "Animals"      | 1           | Animals                            |
| "animals"      | 1           | Animals (case-insensitive)         |
| "pet"          | 1           | Animals (alias)                    |
| "wildlife"     | 1           | Animals (alias)                    |
| "architecture" | 2           | Buildings and Architecture (alias) |
| "tech"         | 19          | Technology (alias)                 |
| "tech"         | 19          | Technology (alias)                 |
| "unknown_xyz"  | 1           | Animals (default fallback)         |

**Verification:** Check server terminal output for category mapping. Look for:

```
DEBUG: Category mapped to Adobe Stock taxonomy
    rawCategory: 2
    validCategoryId: 2
    categoryName: "Buildings and Architecture"
```

---

### TC-3.2.3: Complete Category Coverage

**Purpose:** Verify all 21 Adobe Stock categories are defined.

**Manual Check:**

```bash
grep -c ":" src/utils/adobe-stock-categories.ts
```

**Expected:** 21 categories defined with exact Adobe Stock names.

---

## Story 3.3: Optimized AI Prompt Engineering

### TC-3.3.1: Prompt Structure Validation

**Purpose:** Verify prompt includes all required sections.

**Unit Test Verification:**

```bash
npm test -- tests/prompt-text.test.ts
```

**Expected Results:**

- ✅ 42 tests passing
- ✅ JSON response format section present
- ✅ Title guidelines (50-200 chars, no commas)
- ✅ Keyword guidelines (30-50 keywords)
- ✅ Few-shot examples (at least 2)
- ✅ Category selection guide (1-21)

---

### TC-3.3.2: Title Generation Quality

**Purpose:** Verify generated titles meet Adobe Stock requirements.

**Process an image and check the title:**

```bash
# Process and get metadata from batch status response
curl -X GET "${TEST_BASE_URL}/api/batch-status/{batchId}" -b cookies.txt | jq '.images[0].metadata.title'
```

**Acceptance Criteria:**

- ✅ Title is 50-200 characters long
- ✅ Title does NOT contain commas (breaks CSV)
- ✅ Title is descriptive (WHO, WHAT, WHERE)
- ✅ Title uses keyword-rich language

---

### TC-3.3.3: Keyword Generation Quality

**Purpose:** Verify generated keywords meet Adobe Stock requirements.

```bash
curl -X GET "${TEST_BASE_URL}/api/batch-status/{batchId}" -b cookies.txt | jq '.images[0].metadata.keywords | length'
```

**Acceptance Criteria:**

- ✅ 30-50 keywords generated
- ✅ No duplicate keywords (case-insensitive)
- ✅ Keywords ordered by relevance
- ✅ Mix of specific and general terms

---

### TC-3.3.4: Category Selection Accuracy

**Purpose:** Verify AI selects appropriate categories.

**Test with different image types:**

| Image Type         | Expected Category |
| ------------------ | ----------------- |
| Mountain landscape | 11 (Landscape)    |
| Business meeting   | 3 (Business)      |
| Cat/dog photo      | 1 (Animals)       |
| Smartphone         | 19 (Technology)   |
| Food plating       | 7 (Food)          |

---

## Story 3.4: Metadata Validation & Quality Checks

### TC-3.4.1: Title Validation Rules

**Purpose:** Verify title validation catches invalid titles.

**Unit Test Verification:**

```bash
npm test -- tests/metadata-validation.service.test.ts
```

**Test Cases:**

| Title Length | Expected Result    |
| ------------ | ------------------ |
| 30 chars     | ❌ TITLE_TOO_SHORT |
| 49 chars     | ❌ TITLE_TOO_SHORT |
| 50 chars     | ✅ Valid           |
| 200 chars    | ✅ Valid           |
| 201 chars    | ❌ TITLE_TOO_LONG  |
| Empty        | ❌ TITLE_EMPTY     |

---

### TC-3.4.2: Keyword Validation Rules

**Test Cases:**

| Keyword Count            | Expected Result      |
| ------------------------ | -------------------- |
| 29 keywords              | ❌ KEYWORDS_TOO_FEW  |
| 30 keywords              | ✅ Valid             |
| 50 keywords              | ✅ Valid             |
| 51 keywords              | ❌ KEYWORDS_TOO_MANY |
| Contains 51-char keyword | ❌ KEYWORD_TOO_LONG  |
| Contains duplicates      | Auto-deduplicated    |

---

### TC-3.4.3: Sanitization Pipeline

**Purpose:** Verify automatic sanitization fixes common issues.

**Auto-fixes Applied:**

- ✅ Commas in title → replaced with semicolons
- ✅ Whitespace trimmed from title and keywords
- ✅ Empty keywords removed
- ✅ Duplicate keywords deduplicated (case-insensitive)
- ✅ Invalid category IDs → mapped to default (1)

---

### TC-3.4.4: Fallback Metadata Generation

**Purpose:** Verify fallback metadata is valid when AI fails.

**Fallback Metadata Format:**

- Title: `"Stock Photo {uuid-short} - Professional Commercial Asset Image"`
- Keywords: 30 generic stock photography keywords
- Category: 8 (Graphic Resources)

```bash
npm test -- tests/metadata-validation.service.test.ts -t "Fallback Metadata"
```

---

### TC-3.4.5: Retry-Before-Fallback Pattern (AC5, AC7)

**Purpose:** Verify service retries with adjusted prompt before using fallback.

**Test Flow:**

1. First attempt returns invalid metadata (e.g., short title)
2. Service retries with adjusted prompt including error feedback
3. If retry succeeds → use retry result
4. If retry also fails → use fallback metadata

**Unit Test Verification:**

```bash
npm test -- tests/metadata.service.test.ts -t "retry before fallback"
```

**Expected Results:**

- ✅ 6 tests passing for retry-before-fallback pattern
- ✅ Adjusted prompt includes specific error feedback
- ✅ OpenAI called exactly twice when first attempt fails validation

---

## Story 3.5: Error Recovery & Retry Logic

### TC-3.5.1: Error Classification

**Purpose:** Verify correct classification of OpenAI API errors.

**Unit Test Verification:**

```bash
npm test -- tests/openai-error-classifier.test.ts
```

**Error Types:**

| Error                     | Classification | Retryable |
| ------------------------- | -------------- | --------- |
| 401 Unauthorized          | AUTH           | ❌ No     |
| 429 Too Many Requests     | RATE_LIMIT     | ✅ Yes    |
| 500 Internal Server Error | SERVER_ERROR   | ✅ Yes    |
| 502 Bad Gateway           | SERVER_ERROR   | ✅ Yes    |
| 400 Bad Request           | VALIDATION     | ❌ No     |
| AbortError                | TIMEOUT        | ✅ Yes    |
| ETIMEDOUT                 | TIMEOUT        | ✅ Yes    |
| SyntaxError (JSON)        | MALFORMED      | ✅ Yes    |

---

### TC-3.5.2: Exponential Backoff (AC3)

**Purpose:** Verify retry delays follow exponential backoff.

| Attempt               | Delay        |
| --------------------- | ------------ |
| 1st retry (attempt 0) | 2000ms       |
| 2nd retry (attempt 1) | 4000ms       |
| 3rd+ retry            | 8000ms (max) |

**Verification:**

```bash
npm test -- tests/openai-error-classifier.test.ts -t "exponential backoff"
```

---

### TC-3.5.3: Rate Limit Handling (AC2)

**Purpose:** Verify rate limit errors respect retry-after header.

**Expected Behavior:**

- Extract `retry-after` header from 429 responses
- Wait specified duration (capped at 60 seconds)
- Log retry-after for monitoring

---

### TC-3.5.4: User-Friendly Error Messages (AC7)

**Purpose:** Verify error messages are user-friendly, not technical.

**Message Mapping:**

| Error Type   | User Message                                                  |
| ------------ | ------------------------------------------------------------- |
| AUTH         | "Service configuration error - please contact support"        |
| RATE_LIMIT   | "Service is busy - please try again in a moment"              |
| TIMEOUT      | "Processing took too long - please try again"                 |
| SERVER_ERROR | "Processing failed - please try again"                        |
| VALIDATION   | "Image could not be processed - please try a different image" |

**Unit Test Verification:**

```bash
npm test -- tests/error-messages.test.ts
```

---

### TC-3.5.5: Graceful Degradation

**Purpose:** Verify failed images don't block batch processing.

**Steps:**

1. Upload batch with 3 images (one corrupted/invalid)
2. Start processing
3. Verify successful images complete
4. Verify failed image shows error without blocking others

**Expected:**

- ✅ Successful images have metadata
- ✅ Failed image has status: "failed" with error message
- ✅ Batch continues processing despite failure

---

## Test Coverage Summary

### Unit Test Coverage

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "Test Files|Tests"
```

**Epic 3 Related Test Files:**

- `tests/metadata.service.test.ts` - 52 test cases
- `tests/category.service.test.ts` - 76 test cases
- `tests/metadata-validation.service.test.ts` - 82 test cases
- `tests/openai-error-classifier.test.ts` - 77 test cases
- `tests/prompt-text.test.ts` - 42 test cases
- `tests/error-messages.test.ts` - 55 test cases

**Total Epic 3 Tests:** ~384 test cases

---

## Requirements Traceability Matrix (RTM)

### Story 3.1: OpenAI Vision API Integration

| AC  | Requirement              | Implementation              | Test Coverage   |
| --- | ------------------------ | --------------------------- | --------------- |
| AC1 | gpt-5-mini model         | `config.openai.model`       | ✅ Config tests |
| AC2 | Temperature 0.3          | `config.openai.temperature` | ✅ Config tests |
| AC3 | Max tokens 500           | `config.openai.maxTokens`   | ✅ Config tests |
| AC4 | Image detail "low"       | `detail: 'low'` in API call | ✅ Unit tests   |
| AC5 | API timeout 30s          | `config.openai.timeoutMs`   | ✅ Unit tests   |
| AC6 | Structured JSON response | Zod schema validation       | ✅ Unit tests   |

### Story 3.2: Adobe Stock Category Taxonomy

| AC  | Requirement             | Implementation                  | Test Coverage          |
| --- | ----------------------- | ------------------------------- | ---------------------- |
| AC1 | 21 categories defined   | `ADOBE_STOCK_CATEGORIES`        | ✅ 21 entries verified |
| AC2 | Category ID validation  | `CategoryService.validateId()`  | ✅ Boundary tests      |
| AC3 | Fuzzy matching          | `CategoryService.mapNameToId()` | ✅ 70+ alias tests     |
| AC4 | Default fallback        | `DEFAULT_CATEGORY_ID = 1`       | ✅ Fallback tests      |
| AC5 | Integration with prompt | Category in prompt              | ✅ Prompt tests        |
| AC6 | Unit tests              | category.service.test.ts        | ✅ 76 tests            |

### Story 3.3: Optimized AI Prompt Engineering

| AC  | Requirement                   | Implementation         | Test Coverage      |
| --- | ----------------------------- | ---------------------- | ------------------ |
| AC1 | JSON format request           | PROMPT_TEXT structure  | ✅ Structure tests |
| AC2 | Title guidelines 50-200 chars | Prompt content         | ✅ Prompt tests    |
| AC3 | Keyword guidelines 30-50      | Prompt content         | ✅ Prompt tests    |
| AC4 | Few-shot examples             | 2 complete examples    | ✅ Example tests   |
| AC5 | Commercial guidance           | Buyer-focused language | ✅ Content tests   |
| AC6 | Category selection guide      | 21 categories listed   | ✅ Category tests  |
| AC7 | Prompt validation tests       | prompt-text.test.ts    | ✅ 42 tests        |

### Story 3.4: Metadata Validation & Quality Checks

| AC  | Requirement             | Implementation                      | Test Coverage         |
| --- | ----------------------- | ----------------------------------- | --------------------- |
| AC1 | Title length validation | `validateTitle()`                   | ✅ Boundary tests     |
| AC2 | Keyword validation      | `validateKeywords()`                | ✅ Count/length tests |
| AC3 | Category validation     | `validateCategory()`                | ✅ ID validation      |
| AC4 | Sanitization pipeline   | `sanitize()` method                 | ✅ Transform tests    |
| AC5 | Retry-before-fallback   | `generateMetadata()`                | ✅ Retry tests        |
| AC6 | Metrics recording       | `recordMetadataValidationFailure`   | ✅ Metrics tests      |
| AC7 | Integration tests       | `validateAndSanitize()`             | ✅ E2E validation     |
| AC8 | Unit tests              | metadata-validation.service.test.ts | ✅ 82 tests           |

### Story 3.5: Error Recovery & Retry Logic

| AC  | Requirement                      | Implementation                  | Test Coverage           |
| --- | -------------------------------- | ------------------------------- | ----------------------- |
| AC1 | Retry for timeout/5xx/malformed  | `isRetryableOpenAIError()`      | ✅ Classification tests |
| AC2 | No retry for 401/400             | Error type mapping              | ✅ Non-retry tests      |
| AC3 | Exponential backoff 2s, 4s, 8s   | `getRetryDelayForError()`       | ✅ Delay tests          |
| AC4 | Log technical errors             | `logger.error()` with context   | ✅ Logging tests        |
| AC5 | Fallback after retries exhausted | Fallback generation             | ✅ Fallback tests       |
| AC6 | Partial results returned         | Batch continues                 | ✅ Integration tests    |
| AC7 | User-friendly messages           | `getUserFriendlyErrorMessage()` | ✅ Message tests        |
| AC8 | Enhanced metrics                 | `recordRetryAttempt()`          | ✅ Metrics tests        |
| AC9 | Unit tests                       | openai-error-classifier.test.ts | ✅ 77 tests             |

---

## Verification Checklist

### Pre-Testing Checklist

- [ ] ngrok tunnel running (`ngrok http 3000`)
- [ ] Server running with `BASE_URL` set to ngrok URL
- [ ] `TEST_BASE_URL` environment variable exported in curl terminal
- [ ] OpenAI API key valid and has quota (check `${TEST_BASE_URL}/health/ready`)
- [ ] Test images available in `reference_images/`
- [ ] Cookies file available for session

### Story 3.1 Checklist

- [ ] TC-3.1.1: Basic metadata generation works
- [ ] TC-3.1.2: Low detail parameter used
- [ ] TC-3.1.3: Health check validates OpenAI

### Story 3.2 Checklist

- [ ] TC-3.2.1: Category ID validation passes (1-21)
- [ ] TC-3.2.2: Category name mapping works
- [ ] TC-3.2.3: All 21 categories defined

### Story 3.3 Checklist

- [ ] TC-3.3.1: Prompt structure validated
- [ ] TC-3.3.2: Title quality meets requirements
- [ ] TC-3.3.3: Keyword count 30-50
- [ ] TC-3.3.4: Category selection accurate

### Story 3.4 Checklist

- [ ] TC-3.4.1: Title validation rules work
- [ ] TC-3.4.2: Keyword validation rules work
- [ ] TC-3.4.3: Sanitization pipeline works
- [ ] TC-3.4.4: Fallback metadata valid
- [ ] TC-3.4.5: Retry-before-fallback pattern works

### Story 3.5 Checklist

- [ ] TC-3.5.1: Error classification correct
- [ ] TC-3.5.2: Exponential backoff implemented
- [ ] TC-3.5.3: Rate limit handling works
- [ ] TC-3.5.4: User-friendly error messages
- [ ] TC-3.5.5: Graceful degradation for failed images

---

## Known Limitations

1. **Localhost URLs**: OpenAI Vision API cannot access `localhost` URLs. Use ngrok (`ngrok http 3000`) to expose your local server. Set `BASE_URL` environment variable for the server.

2. **API Costs**: Each test image costs ~$0.002 (GPT-5-mini). Monitor usage during testing.

3. **Rate Limits**: Heavy testing may trigger OpenAI rate limits. Allow time between test runs.

4. **Network Dependency**: Tests require stable internet for OpenAI API calls.

5. **Tunneling Services**:
   - **ngrok** (recommended): Stable and reliable, requires free account signup
   - **localtunnel**: Free but unreliable - frequently returns 503 errors and drops connections

---

## Recommendations

1. **Immediate:** Run full unit test suite to verify 700+ tests pass:

   ```bash
   npm test -- --reporter=verbose
   ```

2. **Local E2E Testing:** Use ngrok for reliable local E2E testing:

   ```bash
   # Terminal 1: Start ngrok tunnel
   ngrok http 3000
   # Note the URL (e.g., https://abc123.ngrok-free.app)

   # Terminal 2: Start server with BASE_URL
   export BASE_URL="https://abc123.ngrok-free.app"
   npm run dev

   # Terminal 3: Run curl tests
   export TEST_BASE_URL="https://abc123.ngrok-free.app"
   curl -X POST "${TEST_BASE_URL}/api/upload-images" -F "images=@./reference_images/_MG_7942.jpg" -c cookies.txt
   ```

3. **Before Production:** Deploy to staging and run full E2E test with real OpenAI calls.

4. **Monitoring:** After deployment, monitor:
   - `asu_openai_cost_usd` metric
   - `asu_metadata_validation_failures` metric
   - Average processing time per image

5. **Next Steps:** Epic 4 (CSV Export) depends on Epic 3 metadata generation.

---

**Document Version:** 1.1  
**Created:** December 25, 2025  
**Updated:** December 29, 2025 - Changed primary tunneling recommendation from localtunnel to ngrok  
**Author:** TEA (Test Architect)
