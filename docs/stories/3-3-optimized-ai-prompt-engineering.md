# Story 3.3: Optimized AI Prompt Engineering

**Epic:** Epic 3 - AI Metadata Generation Engine  
**Story ID:** 3-3  
**Status:** ready-for-dev  
**Priority:** HIGH  
**Estimated Time:** 2-3 hours

---

## Story

**As a** system,  
**I want** a carefully engineered prompt that produces accurate, Adobe Stock-compliant metadata,  
**So that** users get high-quality results that pass Adobe's requirements and maximize stock photo sales.

---

## Acceptance Criteria

### AC1: Restructured Prompt for JSON Compliance

**Given** the current `PROMPT_TEXT` in `src/prompt-text.ts`  
**When** the prompt is restructured  
**Then** it should:

- Use clear system/user message separation pattern
- Explicitly define JSON response schema with required fields
- Specify exact field types (string for title, array for keywords, number for category)
- Include format enforcement instructions to reduce malformed responses
- Request structured output mode with `response_format` parameter

### AC2: Adobe Stock Title Requirements

**Given** the title generation requirements  
**When** the prompt specifies title guidelines  
**Then** it should request:

- Descriptive, searchable titles (50-200 characters)
- Keyword-rich language optimized for stock photo search
- NO commas or special characters that break CSV export
- Focus on commercial/editorial usefulness
- Describe WHO, WHAT, WHERE when applicable

### AC3: Enhanced Keyword Requirements (30-50 Terms)

**Given** the need for comprehensive keyword coverage  
**When** the prompt specifies keyword guidelines  
**Then** it should request:

- **Quantity:** 30-50 relevant keywords (NOT 25 as currently)
- **Diversity requirements:**
  - Main subject/objects (primary focus)
  - Colors and visual elements
  - Mood and emotion descriptors
  - Industry/use case keywords (where image might be used)
  - Technical descriptors (aerial, close-up, wide-angle, etc.)
  - Seasonal/temporal if relevant
  - Location/cultural context if visible
- **Quality requirements:**
  - No duplicates (case-insensitive)
  - Ordered by relevance (most relevant first)
  - Single words or simple phrases (2-3 words max)
  - No compound sentences or full descriptions

### AC4: Few-Shot Examples

**Given** the need to guide AI model output quality  
**When** the prompt includes examples  
**Then** it should include:

- At least 2 high-quality example image descriptions with corresponding metadata
- Examples covering different category types (e.g., People, Landscape)
- Demonstration of proper title formatting
- Demonstration of diverse, well-ordered keyword arrays
- Demonstration of correct category selection

### AC5: Commercial Stock Photography Guidance

**Given** the target market is commercial stock photography  
**When** the prompt includes commercial guidance  
**Then** it should emphasize:

- Commercial licensing considerations (what buyers look for)
- Editorial vs commercial use distinctions
- Keywords that appeal to designers, marketers, advertisers
- Avoiding overly artistic/poetic descriptions
- Focus on utility and searchability over creativity
- Consider common search queries for similar images

### AC6: Category Selection Precision

**Given** the CategoryService now validates and maps categories  
**When** the prompt specifies category selection  
**Then** it should:

- List all 21 categories with clear descriptions (already exists)
- Request category as a NUMBER (not name) to reduce mapping errors
- Provide guidance on distinguishing similar categories
- Emphasize selecting the MOST specific applicable category

### AC7: Unit Tests for Prompt Structure

**Given** the enhanced prompt  
**When** tests are executed  
**Then** coverage should include:

- Prompt includes all required sections
- Prompt specifies 30-50 keyword range
- Prompt includes at least 2 examples
- Prompt requests JSON format
- Integration test validating MetadataService still works with new prompt

---

## Technical Notes

### Current PROMPT_TEXT Issues

Analysis of `src/prompt-text.ts` reveals:

| Issue | Current | Required |
|-------|---------|----------|
| Keyword count | "maximum of 25 keywords" | 30-50 keywords |
| Title length | "70 characters or fewer" | 50-200 characters |
| Examples | None | 2+ few-shot examples |
| Commercial guidance | None | Stock photography context |
| JSON enforcement | Basic | Explicit schema definition |

### Proposed Prompt Structure

```typescript
export const PROMPT_TEXT = `You are an expert Adobe Stock metadata generator...

## Response Format
Return ONLY valid JSON with this exact structure:
{
  "title": "string (50-200 chars, descriptive, no commas)",
  "keywords": ["array", "of", "30-50", "keywords"],
  "category": number (1-21)
}

## Examples
[Include 2-3 high-quality examples]

## Guidelines
[Detailed requirements for each field]

## Categories
[List of 21 categories]
`;
```

### Implementation Plan

1. **Refactor `src/prompt-text.ts`:**
   - Create structured prompt with clear sections
   - Add few-shot examples
   - Update title requirements (50-200 chars)
   - Update keyword requirements (30-50 terms)
   - Add commercial stock photography guidance

2. **Optional: Prompt Configuration:**
   - Consider making prompt configurable via config for A/B testing
   - Add prompt version identifier for tracking

3. **Test with Real Images:**
   - Validate improved output quality with test images
   - Verify JSON parsing continues to work
   - Check keyword quantity meets 30-50 target

### Files to Modify

**Modified Files:**
- `src/prompt-text.ts` - Complete prompt rewrite with enhanced guidelines

**Test Files:**
- `tests/metadata.service.test.ts` - Add/update integration tests for new prompt

### Few-Shot Example Structure

```json
{
  "image_description": "A professional businesswoman in a modern office, working on a laptop with city skyline through windows",
  "expected_output": {
    "title": "Professional businesswoman working on laptop in modern office with city view",
    "keywords": ["businesswoman", "professional", "office", "laptop", "work", "corporate", "city", "skyline", "modern", "business", "career", "technology", "computer", "window", "workspace", "female", "executive", "successful", "indoor", "workplace", "entrepreneur", "meeting", "productivity", "communication", "urban", "glass", "contemporary", "determined", "focused", "confident", "achievement", "ambition"],
    "category": 3
  }
}
```

### Prerequisites

- Story 3.1 (OpenAI Vision API Integration) ✅ DONE
- Story 3.2 (Adobe Stock Category Taxonomy) ✅ DONE

### Learnings from Previous Story

**From Story 3.2 (Status: done)**

- **CategoryService Integration:** Categories are now properly mapped via `toValidCategoryId()` in MetadataService
- **180+ Category Aliases:** Fuzzy matching handles variations in AI responses
- **Zod Validation:** `rawAIMetadataSchema` validates title, keywords (array or string), and category (number or string)
- **Service Pattern:** Follow existing patterns - no new services needed, just prompt enhancement
- **Testing Approach:** 136 category tests provide good coverage pattern to follow

**Files Created in 3.2:**
- `src/utils/adobe-stock-categories.ts` - Category constants (can reference for descriptions)
- `src/services/category.service.ts` - Category service (already integrated)

**Important:** The prompt should still request category as a NUMBER (1-21), but the CategoryService will handle string responses gracefully if the AI returns category names.

[Source: docs/stories/3-2-adobe-stock-category-taxonomy.md#Dev-Agent-Record]

### Project Structure Notes

- Prompt lives in `src/prompt-text.ts` (not in services or utils)
- No new files needed - this is a refinement of existing code
- MetadataService imports `PROMPT_TEXT` directly - no changes to import pattern

### References

- [Source: docs/epics.md#Story-3.3-Optimized-AI-Prompt-Engineering]
- [Source: src/prompt-text.ts] - Current prompt implementation
- [Source: src/services/metadata.service.ts] - MetadataService using prompt
- [Source: src/models/metadata.model.ts] - Zod schema for response validation
- [Adobe Stock Keyword Guidelines](https://helpx.adobe.com/stock/contributor/help/keywording-stock-content.html) - Official documentation

---

## Tasks

- [ ] Analyze current prompt and document specific improvements needed (AC1-AC6)
- [ ] Create new prompt structure with clear sections
  - [ ] Add JSON schema definition section (AC1)
  - [ ] Update title requirements to 50-200 chars (AC2)
  - [ ] Update keyword requirements to 30-50 terms (AC3)
  - [ ] Add keyword diversity guidance (AC3)
- [ ] Add few-shot examples (AC4)
  - [ ] Create "People/Business" category example
  - [ ] Create "Landscape/Nature" category example
  - [ ] Ensure examples demonstrate all guidelines
- [ ] Add commercial stock photography guidance (AC5)
  - [ ] Include buyer-focused language
  - [ ] Add searchability optimization tips
- [ ] Refine category selection instructions (AC6)
  - [ ] Emphasize returning category as NUMBER
  - [ ] Add guidance for similar category disambiguation
- [ ] Update `src/prompt-text.ts` with enhanced prompt
- [ ] Run existing metadata service tests to verify no regressions
- [ ] Add unit tests for prompt structure validation (AC7)
- [ ] Test with real images to validate improved output quality
- [ ] Update sprint-status.yaml to "review"

---

## Dev Agent Record

### Context Reference

- `docs/stories/3-3-optimized-ai-prompt-engineering.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date       | Change                                      | Author |
| ---------- | ------------------------------------------- | ------ |
| 2025-12-05 | Story drafted for Sprint 3 implementation   | SM     |

---

## Definition of Done

- [ ] All acceptance criteria met (7 of 7 ACs)
- [ ] Code follows Epic 1 architecture patterns
- [ ] Unit tests written and passing
- [ ] Prompt produces 30-50 keywords consistently
- [ ] Title length is within 50-200 characters
- [ ] JSON responses parse correctly in MetadataService
- [ ] Error handling works (no silent failures)
- [ ] Code review completed
- [ ] No regression in existing features
- [ ] Sprint status updated

---

## References

- [Source: docs/epics.md#Story-3.3-Optimized-AI-Prompt-Engineering]
- [Source: src/prompt-text.ts] - Current prompt to enhance
- [Source: src/services/metadata.service.ts] - Consumer of prompt
- [Source: src/utils/adobe-stock-categories.ts] - Category definitions for reference
- [Adobe Stock Contributor Help](https://helpx.adobe.com/stock/contributor/help/keywording-stock-content.html) - Official guidelines
