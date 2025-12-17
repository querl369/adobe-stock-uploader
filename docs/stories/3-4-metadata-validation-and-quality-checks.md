# Story 3.4: Metadata Validation & Quality Checks

**Epic:** Epic 3 - AI Metadata Generation Engine  
**Story ID:** 3-4  
**Status:** ready-for-dev  
**Priority:** HIGH  
**Estimated Time:** 2-3 hours

---

## Story

**As a** system,  
**I want** to validate AI-generated metadata before saving,  
**So that** we catch errors early and ensure Adobe Stock compliance.

---

## Acceptance Criteria

### AC1: Title Validation (50-200 Characters)

**Given** AI-generated metadata with a title field  
**When** the MetadataValidationService validates it  
**Then** it should:

- Reject titles shorter than 50 characters
- Reject titles longer than 200 characters
- Reject empty or whitespace-only titles
- Reject titles containing special characters that break CSV export (commas specifically)
- Accept titles with basic punctuation (periods, hyphens, apostrophes, colons, semicolons)
- Trim leading/trailing whitespace before validation

### AC2: Keyword Validation (30-50 Terms)

**Given** AI-generated metadata with a keywords array  
**When** the MetadataValidationService validates it  
**Then** it should:

- Reject if fewer than 30 keywords
- Reject if more than 50 keywords
- Reject if any keyword exceeds 50 characters
- Reject if any keyword is empty string
- Detect and flag duplicate keywords (case-insensitive)
- Remove duplicates automatically (keep first occurrence)
- Trim whitespace from each keyword
- Ensure all keywords are non-empty after trimming

### AC3: Category Validation Against Taxonomy

**Given** AI-generated metadata with a category field  
**When** the MetadataValidationService validates it  
**Then** it should:

- Verify category ID is between 1-21 (Adobe Stock taxonomy range)
- Use existing CategoryService for validation
- Accept both numeric IDs and string category names
- Return validation error for invalid categories

### AC4: Metadata Sanitization

**Given** raw AI-generated metadata  
**When** the MetadataValidationService sanitizes it  
**Then** it should:

- Trim whitespace from title
- Remove commas from title (replace with semicolons or spaces)
- Trim whitespace from each keyword
- Remove empty keywords after trimming
- Deduplicate keywords (case-insensitive, keep first)
- Normalize category to numeric ID
- Return sanitized metadata ready for use

### AC5: Fallback Metadata Generation

**Given** metadata that fails validation after retry  
**When** the fallback mechanism activates  
**Then** it should generate fallback metadata:

- Title: "Stock Photo {uuid-short}" (8 chars from file UUID)
- Keywords: ["stock", "image", "photo", "picture", "photograph", "asset", "media", "content", "visual", "graphic", "illustration", "creative", "design", "background", "abstract", "composition", "artistic", "professional", "commercial", "digital", "modern", "concept", "scene", "view", "shot", "capture", "snapshot", "frame", "pic", "imagery"]
- Category: 8 (Graphic Resources - safe default)

### AC6: Validation Error Tracking

**Given** metadata validation runs  
**When** validation fails  
**Then** the system should:

- Log validation errors with image ID and metadata
- Track validation failure rate in metrics
- Include error details: which field(s) failed, what values were invalid
- Enable monitoring dashboard visibility for prompt optimization

### AC7: Integration with MetadataService

**Given** the MetadataService generates raw AI metadata  
**When** metadata is returned from OpenAI  
**Then** it should:

- Pass through MetadataValidationService.validate() before returning
- Apply sanitization automatically
- Use fallback metadata if validation fails after retry
- Log both original and sanitized/fallback values for debugging

### AC8: Unit Tests for Validation

**Given** the MetadataValidationService implementation  
**When** tests are executed  
**Then** coverage should include:

- Title length validation (too short, too long, valid)
- Title character validation (commas rejected, punctuation accepted)
- Keyword count validation (too few, too many, valid)
- Keyword deduplication (case-insensitive)
- Keyword sanitization (trimming, empty removal)
- Category validation (valid IDs, invalid IDs, string names)
- Sanitization pipeline (full metadata object)
- Fallback metadata generation
- Integration with MetadataService flow

---

## Technical Notes

### Current Validation State

The existing `rawAIMetadataSchema` in `src/models/metadata.model.ts` provides basic structure validation:

| Field    | Current Validation                   | Required Enhancement               |
| -------- | ------------------------------------ | ---------------------------------- |
| title    | Non-empty string required            | 50-200 chars, no commas, sanitize  |
| keywords | Array or string, transforms to array | 30-50 count, dedup, no empty, trim |
| category | Number or string accepted            | Validate against 1-21 range        |

### Proposed Architecture

Create `src/services/metadata-validation.service.ts`:

```typescript
interface ValidationResult {
  valid: boolean;
  sanitizedMetadata?: RawAIMetadata;
  errors: ValidationError[];
}

interface ValidationError {
  field: 'title' | 'keywords' | 'category';
  code: string;
  message: string;
  value?: any;
}

class MetadataValidationService {
  constructor(private categoryService: CategoryService) {}

  validate(metadata: RawAIMetadata): ValidationResult;
  sanitize(metadata: RawAIMetadata): RawAIMetadata;
  generateFallback(fileId: string): RawAIMetadata;
}
```

### Validation Constants

```typescript
const TITLE_MIN_LENGTH = 50;
const TITLE_MAX_LENGTH = 200;
const KEYWORDS_MIN_COUNT = 30;
const KEYWORDS_MAX_COUNT = 50;
const KEYWORD_MAX_LENGTH = 50;
const TITLE_FORBIDDEN_CHARS = /,/g; // Commas break CSV export
```

### Integration Pattern

Update MetadataService.generateMetadata() flow:

```
OpenAI API → parseAIResponse() → MetadataValidationService.validate()
                                        ↓
                           ┌───── valid? ─────┐
                           ↓                   ↓
                      Return metadata    Retry once with adjusted prompt
                                               ↓
                                          Still invalid?
                                               ↓
                                      Use fallback metadata
                                               ↓
                                      Log for monitoring
```

### Files to Create

- `src/services/metadata-validation.service.ts` - Main validation service
- `tests/metadata-validation.service.test.ts` - Comprehensive unit tests

### Files to Modify

- `src/services/metadata.service.ts` - Integrate validation after parsing
- `src/config/container.ts` - Register MetadataValidationService
- `src/utils/metrics.ts` - Add validation failure counter

### New Metrics

```typescript
// In src/utils/metrics.ts
export const metadataValidationFailures = new Counter({
  name: 'asu_metadata_validation_failures_total',
  help: 'Total metadata validation failures by field',
  labelNames: ['field', 'error_code'],
});
```

### Zod Schema Enhancement (Optional)

Consider enhancing `rawAIMetadataSchema` with stricter rules:

```typescript
export const validatedMetadataSchema = z.object({
  title: z
    .string()
    .min(TITLE_MIN_LENGTH, `Title must be at least ${TITLE_MIN_LENGTH} characters`)
    .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`)
    .refine(val => !val.includes(','), 'Title must not contain commas'),

  keywords: z
    .array(z.string().max(KEYWORD_MAX_LENGTH))
    .min(KEYWORDS_MIN_COUNT, `At least ${KEYWORDS_MIN_COUNT} keywords required`)
    .max(KEYWORDS_MAX_COUNT, `At most ${KEYWORDS_MAX_COUNT} keywords allowed`)
    .refine(
      arr => new Set(arr.map(k => k.toLowerCase())).size === arr.length,
      'Keywords must not contain duplicates'
    ),

  category: z.number().int().min(1).max(21),
});
```

### Prerequisites

- Story 3.1 (OpenAI Vision API Integration) ✅ DONE
- Story 3.2 (Adobe Stock Category Taxonomy) ✅ DONE
- Story 3.3 (Optimized AI Prompt Engineering) ✅ DONE

### Learnings from Previous Story

**From Story 3.3 (Status: done)**

- **Enhanced Prompt**: PROMPT_TEXT now requests 30-50 keywords, 50-200 char titles, NO commas
- **JSON Schema**: Response format strictly defined with field types
- **Few-Shot Examples**: Two examples guide AI toward compliant output
- **CategoryService Integration**: `toValidCategoryId()` already validates/maps categories
- **Test Coverage**: 34 prompt tests + 36 metadata tests + 136 category tests = 206 total

**Files Available from 3.2/3.3:**

- `src/services/category.service.ts` - Use for category validation (don't recreate)
- `src/utils/adobe-stock-categories.ts` - Category constants available
- `src/models/metadata.model.ts` - Base Zod schema to enhance
- `src/prompt-text.ts` - Already requests compliant format

**Important:** The prompt already requests proper formatting (no commas, 30-50 keywords), but validation ensures compliance even when AI deviates from instructions.

[Source: docs/stories/3-3-optimized-ai-prompt-engineering.md#Dev-Agent-Record]

### Project Structure Notes

- Service lives in `src/services/` following existing patterns
- Tests in `tests/` matching service filename pattern
- Use dependency injection via container for CategoryService
- Follow existing logging patterns with structured context

### References

- [Source: docs/epics.md#Story-3.4-Metadata-Validation-Quality-Checks]
- [Source: src/services/metadata.service.ts] - Integration point for validation
- [Source: src/services/category.service.ts] - Existing category validation (reuse)
- [Source: src/models/metadata.model.ts] - Base validation schema to enhance
- [Source: src/prompt-text.ts] - Prompt requirements for reference

---

## Tasks

- [x] Create MetadataValidationService class structure (AC1-AC4)
  - [x] Implement `validate()` method with all validation rules
  - [x] Implement `sanitize()` method for metadata cleanup
  - [x] Implement title validation (length, forbidden chars)
  - [x] Implement keyword validation (count, dedup, length, empty)
  - [x] Implement category validation using CategoryService
- [x] Implement fallback metadata generation (AC5)
  - [x] Create fallback title with file UUID
  - [x] Define comprehensive fallback keyword set (30 terms)
  - [x] Use category 8 (Graphic Resources) as safe default
- [x] Add validation failure metrics (AC6)
  - [x] Add counter in metrics.ts
  - [x] Instrument validation failures with field and error code
- [x] Integrate with MetadataService (AC7)
  - [x] Add validation step after parseAIResponse()
  - [x] Implement validateAndSanitize() for automatic fallback
  - [x] Log original vs sanitized/fallback values
- [x] Register MetadataValidationService in container.ts
- [x] Write comprehensive unit tests (AC8)
  - [x] Title validation tests (length boundaries, forbidden chars)
  - [x] Keyword validation tests (count, dedup, sanitization)
  - [x] Category validation tests
  - [x] Sanitization pipeline tests
  - [x] Fallback generation tests
  - [x] Integration flow tests
- [x] Run all tests to verify no regressions (710 tests passing)
- [x] Update sprint-status.yaml to "in-progress"

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

N/A

### Completion Notes List

1. Created MetadataValidationService with comprehensive validation logic
2. Implemented title validation (50-200 chars, no commas)
3. Implemented keyword validation (30-50 count, deduplication, max 50 chars each)
4. Implemented category validation using existing CategoryService
5. Added sanitization pipeline (trim, comma replacement, dedup)
6. Created fallback metadata generation with 30 generic keywords
7. Added validation failure metrics to Prometheus
8. Integrated validation into MetadataService.generateMetadata()
9. Updated container.ts with MetadataValidationService
10. Written 50+ comprehensive unit tests
11. Updated existing MetadataService tests to use valid test data

### File List

**Created:**

- `src/services/metadata-validation.service.ts` - Main validation service
- `tests/metadata-validation.service.test.ts` - Unit tests (50+ tests)

**Modified:**

- `src/services/metadata.service.ts` - Added validation integration
- `src/config/container.ts` - Registered MetadataValidationService
- `src/utils/metrics.ts` - Added validation failure metrics
- `tests/metadata.service.test.ts` - Updated to use valid test metadata

---

## Change Log

| Date       | Change                                     | Author |
| ---------- | ------------------------------------------ | ------ |
| 2025-12-17 | Story drafted for Sprint 3 implementation  | SM     |
| 2025-12-17 | Implementation complete, 710 tests passing | Dev    |

---

## Definition of Done

- [x] All acceptance criteria met (8 of 8 ACs)
- [x] Code follows Epic 1 architecture patterns
- [x] Unit tests written and passing (710 total tests)
- [x] Title validation catches non-compliant titles
- [x] Keyword validation ensures 30-50 range with deduplication
- [x] Category validation uses existing CategoryService
- [x] Fallback metadata generation works correctly
- [x] Validation metrics tracking in Prometheus
- [x] Integration with MetadataService verified
- [x] Error handling works (no silent failures)
- [ ] Code review completed
- [x] No regression in existing features
- [x] Sprint status updated

---

## References

- [Source: docs/epics.md#Story-3.4-Metadata-Validation-Quality-Checks]
- [Source: src/services/metadata.service.ts] - Consumer of validation
- [Source: src/services/category.service.ts] - Existing category service to reuse
- [Source: src/models/metadata.model.ts] - Base schema to enhance
- [Adobe Stock CSV Requirements](https://helpx.adobe.com/stock/contributor/help/metadata-tips.html) - Official guidelines
