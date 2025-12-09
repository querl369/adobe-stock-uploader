# Story 3.2: Adobe Stock Category Taxonomy

**Epic:** Epic 3 - AI Metadata Generation Engine  
**Story ID:** 3-2  
**Status:** done  
**Priority:** HIGH  
**Estimated Time:** 2-3 hours

---

## Story

**As a** system,  
**I want** to map AI-generated categories to Adobe Stock's official taxonomy,  
**So that** exported CSVs use correct category IDs accepted by Adobe Stock.

---

## Acceptance Criteria

### AC1: Complete Category Taxonomy Constant

**Given** the need for Adobe Stock-compliant categories  
**When** the taxonomy is implemented  
**Then** `src/utils/adobe-stock-categories.ts` should contain:

- Complete mapping of all 21 official Adobe Stock categories
- Category ID → Name mapping (bidirectional lookup)
- Category names matching Adobe Stock documentation exactly
- TypeScript type safety with `as const` assertion

### AC2: Category ID Validation

**Given** a category ID from AI-generated metadata  
**When** validation is performed  
**Then** the validation should:

- Return `true` for valid category IDs (1-21)
- Return `false` for invalid IDs (0, 22+, negative, non-integer)
- Support both number and string inputs (AI may return either)

### AC3: Fuzzy Category Name Matching

**Given** a category name string from AI response  
**When** mapping to category ID  
**Then** the mapping should:

- Handle exact matches (case-insensitive): "Animals" → 1
- Handle common variations: "animal" → 1, "ANIMALS" → 1
- Handle partial matches: "business" → 3, "landscapes" → 11
- Default to category ID 1 ("Animals") if no match found
- Log a warning when falling back to default

### AC4: Category Service Implementation

**Given** the MetadataService needs category mapping  
**When** implementing the category service  
**Then** `src/services/category.service.ts` should provide:

```typescript
interface CategoryService {
  mapNameToId(name: string): number;
  validateId(id: number | string): boolean;
  getNameById(id: number): string | undefined;
  getAllCategories(): Record<number, string>;
}
```

### AC5: Integration with MetadataService

**Given** the MetadataService parses AI responses  
**When** category values are extracted  
**Then** integration should:

- Convert category names to IDs using CategoryService
- Validate category IDs against taxonomy
- Use fallback category (1) for invalid values
- Log category mapping decisions for debugging

### AC6: Unit Test Coverage

**Given** the category taxonomy implementation  
**When** tests are executed  
**Then** test coverage should include:

- All 21 category mappings (exact match)
- Fuzzy matching variations (at least 5 per category type)
- Edge cases: empty string, null, undefined, numbers as strings
- Validation for boundary cases (0, 21, 22, -1)
- Default fallback behavior

---

## Technical Notes

### Adobe Stock Official Categories

Based on the existing `PROMPT_TEXT` in `src/prompt-text.ts`, the official taxonomy is:

| ID | Category Name |
|----|---------------|
| 1 | Animals |
| 2 | Buildings and Architecture |
| 3 | Business |
| 4 | Drinks |
| 5 | The Environment |
| 6 | States of Mind |
| 7 | Food |
| 8 | Graphic Resources |
| 9 | Hobbies and Leisure |
| 10 | Industry |
| 11 | Landscape |
| 12 | Lifestyle |
| 13 | People |
| 14 | Plants and Flowers |
| 15 | Culture and Religion |
| 16 | Science |
| 17 | Social Issues |
| 18 | Sports |
| 19 | Technology |
| 20 | Transport |
| 21 | Travel |

### Existing Implementation Analysis

**Current State:**
- `src/prompt-text.ts` defines 21 categories in prompt text
- `src/models/metadata.model.ts` has `rawAIMetadataSchema` validating category as `z.union([z.number(), z.string()])`
- `src/services/metadata.service.ts` passes category through without ID validation

**Gap Analysis:**
- ❌ No category name → ID mapping function
- ❌ No fuzzy matching for category names
- ❌ No dedicated category service/utility
- ❌ No category validation in MetadataService
- ✅ Zod schema already handles string/number union (Story 3.1)

### Implementation Plan

1. **Create `src/utils/adobe-stock-categories.ts`:**
   ```typescript
   export const ADOBE_STOCK_CATEGORIES = {
     1: 'Animals',
     2: 'Buildings and Architecture',
     // ... all 21 categories
   } as const;
   
   export type CategoryId = keyof typeof ADOBE_STOCK_CATEGORIES;
   export type CategoryName = typeof ADOBE_STOCK_CATEGORIES[CategoryId];
   ```

2. **Create `src/services/category.service.ts`:**
   ```typescript
   export class CategoryService {
     private readonly categoryMap: Map<string, number>;
     
     mapNameToId(name: string): number {
       // Exact match first, then fuzzy match, then default
     }
     
     validateId(id: number | string): boolean {
       // Check if ID is in valid range 1-21
     }
   }
   ```

3. **Update DI Container:**
   - Add CategoryService to `src/config/container.ts`
   - Inject into MetadataService

4. **Update MetadataService:**
   - Use CategoryService to validate/map categories in `parseAIResponse()`

### Files to Create/Modify

**New Files:**
- `src/utils/adobe-stock-categories.ts` - Category constants and types
- `src/services/category.service.ts` - Category service implementation
- `tests/category.service.test.ts` - Unit tests

**Modified Files:**
- `src/config/container.ts` - Add CategoryService to DI container
- `src/services/metadata.service.ts` - Integrate CategoryService
- `tests/metadata.service.test.ts` - Add integration tests for category mapping

### Prerequisites

- Story 3.1 (OpenAI Vision API Integration) ✅ DONE
- Zod schema for RawAIMetadata validation ✅ Already exists

### Learnings from Previous Story

**From Story 3.1 (Status: done)**

- **Zod Validation Pattern:** Use `rawAIMetadataSchema.safeParse()` with detailed error logging
- **Service Singleton Pattern:** Follow existing pattern from MetadataService, SessionService
- **Testing Approach:** Comprehensive unit tests (19 new tests added in 3.1)
- **Error Handling:** Use typed errors, log with context
- **AbortController Timeout:** Pattern established for async operations

**New Files Created in 3.1:**
- `src/models/metadata.model.ts` - Contains `rawAIMetadataSchema` Zod schema
- Enhanced `src/services/metadata.service.ts` - Reference for service patterns

[Source: docs/stories/3-1-openai-vision-api-integration.md#Dev-Agent-Record]

### Project Structure Notes

- Category utility belongs in `src/utils/` (pure functions, constants)
- CategoryService belongs in `src/services/` (stateful, injectable)
- Follow existing patterns from `src/services/session.service.ts` for service class structure

### References

- [Source: docs/epics.md#Story-3.2-Adobe-Stock-Category-Taxonomy]
- [Source: src/prompt-text.ts] - Current category definitions
- [Source: src/models/metadata.model.ts] - Zod schema for category validation
- [Source: docs/architecture/architecture-api.md] - Service layer patterns

---

## Tasks

- [x] Create `src/utils/adobe-stock-categories.ts` with complete taxonomy (AC1)
  - [x] Define `ADOBE_STOCK_CATEGORIES` const with all 21 categories
  - [x] Add TypeScript types for CategoryId and CategoryName
  - [x] Create reverse lookup map (name → id)
  - [x] Add CATEGORY_ALIASES for fuzzy matching (180+ aliases covering all 21 categories)
- [x] Create `src/services/category.service.ts` (AC4)
  - [x] Implement `mapNameToId()` with fuzzy matching (AC3)
  - [x] Implement `validateId()` for category validation (AC2)
  - [x] Implement `getNameById()` for reverse lookup
  - [x] Implement `getAllCategories()` for full taxonomy access
  - [x] Implement `toValidCategoryId()` for AI response processing
  - [x] Add structured logging for mapping decisions
- [x] Register CategoryService in `src/config/container.ts`
- [x] Integrate CategoryService into MetadataService (AC5)
  - [x] Update `parseAIResponse()` to use category mapping
  - [x] Add fallback to default category on invalid values
- [x] Create comprehensive unit tests (AC6)
  - [x] Test all 21 exact category matches
  - [x] Test fuzzy matching variations (60+ alias tests)
  - [x] Test edge cases (empty, null, undefined)
  - [x] Test validation boundary cases
  - [x] Test category name case-insensitivity
- [x] Run full test suite and verify no regressions
- [x] Update sprint-status.yaml to "review"

---

## Dev Agent Record

### Context Reference

Context workflow skipped per user request - story documentation sufficient for implementation.

### Agent Model Used

Claude Opus 4.5 (Amelia - Developer Agent)

### Debug Log References

N/A - Implementation completed without blockers.

### Completion Notes List

1. **AC1 Complete:** Created `src/utils/adobe-stock-categories.ts` with:
   - Complete 21-category taxonomy as `ADOBE_STOCK_CATEGORIES` const
   - TypeScript types: `CategoryId`, `CategoryName`
   - Reverse lookup map: `CATEGORY_NAME_TO_ID`
   - 180+ aliases in `CATEGORY_ALIASES` for fuzzy matching

2. **AC2 Complete:** Category ID validation supports:
   - Valid IDs 1-21 (number and string inputs)
   - Rejects 0, 22+, negative, non-integer, NaN

3. **AC3 Complete:** Fuzzy matching priority:
   - Exact match (case-insensitive) against official names
   - Alias match against common variations
   - Partial match (word starts with)
   - Default fallback to category 1 with warning log

4. **AC4 Complete:** CategoryService implements full interface:
   - `mapNameToId()`, `validateId()`, `getNameById()`, `getAllCategories()`
   - Added `toValidCategoryId()` for unified AI response handling

5. **AC5 Complete:** MetadataService integration:
   - Constructor accepts CategoryService via DI
   - `parseAIResponse()` maps all categories via `toValidCategoryId()`
   - Debug logging for category mapping decisions

6. **AC6 Complete:** 136 category tests covering:
   - All 21 exact matches
   - 60+ alias variations
   - Edge cases (null, undefined, empty, whitespace)
   - Boundary validation (0, 1, 21, 22, -1)

### File List

**New Files Created:**
- `src/utils/adobe-stock-categories.ts` - Category taxonomy constants
- `src/services/category.service.ts` - Category mapping service
- `tests/category.service.test.ts` - 136 unit tests

**Modified Files:**
- `src/config/container.ts` - Added CategoryService to DI container
- `src/services/metadata.service.ts` - Integrated CategoryService
- `tests/metadata.service.test.ts` - Updated for CategoryService dependency
- `tests/container.test.ts` - Added CategoryService tests

---

## Change Log

| Date       | Change                                      | Author |
| ---------- | ------------------------------------------- | ------ |
| 2025-12-05 | Story drafted for Sprint 3 implementation   | SM     |
| 2025-12-05 | Implementation complete, ready for review   | Dev    |
| 2025-12-05 | Senior Developer Review notes appended - APPROVED | Dev    |

---

## Definition of Done

- [x] All acceptance criteria met (6 of 6 ACs)
- [x] Code follows Epic 1 architecture patterns
- [x] Unit tests written and passing (136 new tests, 622 total passing)
- [x] Category service integrated with MetadataService
- [x] Error handling implemented (no silent failures)
- [x] Logging added (structured logging with Pino)
- [x] Code review completed - APPROVED (2025-12-05)
- [x] No regression in existing features
- [x] Sprint status updated

---

## References

- [Source: docs/epics.md#Story-3.2-Adobe-Stock-Category-Taxonomy]
- [Source: src/prompt-text.ts] - Current 21 category definitions
- [Source: src/services/metadata.service.ts] - Integration target
- [Source: docs/architecture/architecture-api.md] - Architecture patterns
- [Adobe Stock Category Guidelines](https://helpx.adobe.com/stock/contributor/help/keywording-stock-content.html) - Official documentation

---

## Senior Developer Review (AI)

**Reviewer:** Alex  
**Date:** 2025-12-05  
**Outcome:** ✅ **APPROVE**

### Summary

Story 3.2 has been implemented with high quality and completeness. All 6 acceptance criteria are fully met with strong evidence in the code. The CategoryService provides robust fuzzy matching for AI-generated categories, proper validation, and clean integration with MetadataService via DI. Test coverage is excellent with 136 dedicated tests covering all scenarios.

### Key Findings

**No HIGH or MEDIUM severity issues found.**

#### Low Severity

| # | Finding | File | Recommendation |
|---|---------|------|----------------|
| 1 | `getAllCategories()` returns a shallow copy via spread | `category.service.ts:184` | Consider `Object.freeze()` for immutable guarantee (optional) |

#### Advisory Notes

- The 5-step matching priority in `mapNameToId()` is comprehensive but adds complexity - this is acceptable given the requirement for robust fuzzy matching of AI responses
- Excellent use of `as const` assertion and TypeScript type inference throughout

### Acceptance Criteria Coverage

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | Complete Category Taxonomy Constant | ✅ IMPLEMENTED | `src/utils/adobe-stock-categories.ts:18-40` |
| AC2 | Category ID Validation | ✅ IMPLEMENTED | `src/services/category.service.ts:142-153` |
| AC3 | Fuzzy Category Name Matching | ✅ IMPLEMENTED | `src/services/category.service.ts:55-124` |
| AC4 | Category Service Implementation | ✅ IMPLEMENTED | `src/services/category.service.ts:35-231` |
| AC5 | Integration with MetadataService | ✅ IMPLEMENTED | `src/services/metadata.service.ts:32-36,246-264` |
| AC6 | Unit Test Coverage | ✅ IMPLEMENTED | `tests/category.service.test.ts` - 136 tests |

**Summary: 6 of 6 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked As | Verified As | Evidence |
|------|-----------|-------------|----------|
| Create `adobe-stock-categories.ts` | ✅ Complete | ✅ VERIFIED | 337 lines, all 21 categories |
| Create `category.service.ts` | ✅ Complete | ✅ VERIFIED | 231 lines, full interface |
| Register in `container.ts` | ✅ Complete | ✅ VERIFIED | Lines 21,53,93,97,108 |
| Integrate into MetadataService | ✅ Complete | ✅ VERIFIED | Lines 18,32-36,246-264 |
| Create comprehensive tests | ✅ Complete | ✅ VERIFIED | 136 tests |
| Run full test suite | ✅ Complete | ✅ VERIFIED | 622 tests passing |
| Update sprint-status.yaml | ✅ Complete | ✅ VERIFIED | Status set to "review" |

**Summary: 17 of 17 completed tasks verified, 0 questionable, 0 false completions**

### Test Coverage and Gaps

- All 21 exact category matches tested ✅
- 60+ alias variations tested ✅
- Edge cases (null, undefined, empty) tested ✅
- Boundary validation (0, 1, 21, 22, -1) tested ✅
- MetadataService integration tests added ✅
- Container integration tests added ✅

**No test gaps identified.**

### Architectural Alignment

- ✅ Service layer pattern followed (matches SessionService, MetadataService)
- ✅ Dependency injection via container
- ✅ Utility placement (`src/utils/`) and service placement (`src/services/`)
- ✅ TypeScript conventions (`as const`, proper types, path aliases)
- ✅ Pino structured logging with context

### Security Notes

- ✅ No security vulnerabilities identified
- ✅ Input validation on all public methods
- ✅ Category IDs validated before use

### Action Items

**Code Changes Required:**
- None - all requirements met

**Advisory Notes:**
- Note: Consider `Object.freeze()` for `getAllCategories()` return value (optional)
- Note: Document the 180+ category aliases in architecture docs
