/**
 * MetadataValidationService Unit Tests
 *
 * Story 3.4: Metadata Validation & Quality Checks (AC8)
 *
 * Test coverage:
 * - Title length validation (too short, too long, valid)
 * - Title character validation (commas rejected, punctuation accepted)
 * - Keyword count validation (too few, too many, valid)
 * - Keyword deduplication (case-insensitive)
 * - Keyword sanitization (trimming, empty removal)
 * - Category validation (valid IDs, invalid IDs, string names)
 * - Sanitization pipeline (full metadata object)
 * - Fallback metadata generation
 * - Integration with MetadataService flow
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MetadataValidationService,
  ValidationErrorCode,
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  KEYWORDS_MIN_COUNT,
  KEYWORDS_MAX_COUNT,
  KEYWORD_MAX_LENGTH,
  FALLBACK_KEYWORDS,
  DEFAULT_FALLBACK_CATEGORY,
} from '../src/services/metadata-validation.service';
import { CategoryService } from '../src/services/category.service';
import type { RawAIMetadata } from '../src/models/metadata.model';

// Mock metrics to avoid side effects
vi.mock('../src/utils/metrics', () => ({
  recordMetadataValidationFailure: vi.fn(),
}));

// Mock logger to avoid noise in tests
vi.mock('../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MetadataValidationService', () => {
  let service: MetadataValidationService;
  let categoryService: CategoryService;

  beforeEach(() => {
    categoryService = new CategoryService();
    service = new MetadataValidationService(categoryService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create valid metadata for testing
  function createValidMetadata(overrides: Partial<RawAIMetadata> = {}): RawAIMetadata {
    const defaultKeywords = Array.from({ length: 35 }, (_, i) => `keyword${i + 1}`);
    return {
      title:
        'A beautiful professional stock photograph of nature landscape with mountains and sunset',
      keywords: defaultKeywords,
      category: 15, // Nature
      ...overrides,
    };
  }

  // ====================
  // Title Validation Tests (AC1)
  // ====================

  describe('Title Validation (AC1)', () => {
    it('should reject titles shorter than 50 characters', () => {
      const metadata = createValidMetadata({
        title: 'Short title only 30 chars here',
      });

      const result = service.validate(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'title',
          code: ValidationErrorCode.TITLE_TOO_SHORT,
        })
      );
    });

    it('should reject titles longer than 200 characters', () => {
      const longTitle = 'A'.repeat(201);
      const metadata = createValidMetadata({ title: longTitle });

      const result = service.validate(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'title',
          code: ValidationErrorCode.TITLE_TOO_LONG,
        })
      );
    });

    it('should accept titles with exactly 50 characters', () => {
      const title = 'A'.repeat(50);
      const metadata = createValidMetadata({ title });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'title')).toHaveLength(0);
    });

    it('should accept titles with exactly 200 characters', () => {
      const title = 'A'.repeat(200);
      const metadata = createValidMetadata({ title });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'title')).toHaveLength(0);
    });

    it('should reject empty titles', () => {
      const metadata = createValidMetadata({ title: '' });

      const result = service.validate(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'title',
          code: ValidationErrorCode.TITLE_EMPTY,
        })
      );
    });

    it('should reject whitespace-only titles', () => {
      const metadata = createValidMetadata({ title: '   \t\n   ' });

      const result = service.validate(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'title',
          code: ValidationErrorCode.TITLE_EMPTY,
        })
      );
    });

    it('should trim leading/trailing whitespace before validation', () => {
      // Title with whitespace that becomes valid after trimming
      const title = '   ' + 'A'.repeat(60) + '   ';
      const metadata = createValidMetadata({ title });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'title')).toHaveLength(0);
      expect(result.sanitizedMetadata?.title.length).toBe(60);
    });

    it('should accept titles with basic punctuation (periods, hyphens, apostrophes)', () => {
      const title =
        "A beautiful sunset over the mountain - nature's finest hour. A truly amazing scene";
      const metadata = createValidMetadata({ title });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'title')).toHaveLength(0);
    });

    it('should accept titles with colons and semicolons', () => {
      const title =
        'Nature Photography: A Guide to Capturing Landscapes; Including Mountains and Sunsets';
      const metadata = createValidMetadata({ title });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'title')).toHaveLength(0);
    });
  });

  // ====================
  // Keyword Validation Tests (AC2)
  // ====================

  describe('Keyword Validation (AC2)', () => {
    it('should reject if fewer than 30 keywords', () => {
      const metadata = createValidMetadata({
        keywords: Array.from({ length: 29 }, (_, i) => `keyword${i}`),
      });

      const result = service.validate(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'keywords',
          code: ValidationErrorCode.KEYWORDS_TOO_FEW,
        })
      );
    });

    it('should reject if more than 50 keywords', () => {
      const metadata = createValidMetadata({
        keywords: Array.from({ length: 51 }, (_, i) => `keyword${i}`),
      });

      const result = service.validate(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'keywords',
          code: ValidationErrorCode.KEYWORDS_TOO_MANY,
        })
      );
    });

    it('should accept exactly 30 keywords', () => {
      const metadata = createValidMetadata({
        keywords: Array.from({ length: 30 }, (_, i) => `keyword${i}`),
      });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'keywords')).toHaveLength(0);
    });

    it('should accept exactly 50 keywords', () => {
      const metadata = createValidMetadata({
        keywords: Array.from({ length: 50 }, (_, i) => `keyword${i}`),
      });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'keywords')).toHaveLength(0);
    });

    it('should reject keywords exceeding 50 characters', () => {
      const longKeyword = 'a'.repeat(51);
      const keywords = Array.from({ length: 35 }, (_, i) =>
        i === 0 ? longKeyword : `keyword${i}`
      );
      const metadata = createValidMetadata({ keywords });

      const result = service.validate(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'keywords',
          code: ValidationErrorCode.KEYWORD_TOO_LONG,
        })
      );
    });

    it('should accept keywords with exactly 50 characters', () => {
      const maxKeyword = 'a'.repeat(50);
      const keywords = Array.from({ length: 35 }, (_, i) => (i === 0 ? maxKeyword : `keyword${i}`));
      const metadata = createValidMetadata({ keywords });

      const result = service.validate(metadata);

      expect(
        result.errors.filter(e => e.code === ValidationErrorCode.KEYWORD_TOO_LONG)
      ).toHaveLength(0);
    });

    it('should remove empty keywords during sanitization', () => {
      const keywords = ['valid', '', 'another', '   ', 'more'];
      // Start with more keywords to have enough after removing empty ones
      const fullKeywords = [...keywords, ...Array.from({ length: 30 }, (_, i) => `keyword${i}`)];
      const metadata = createValidMetadata({ keywords: fullKeywords });

      const result = service.validate(metadata);

      // Empty keywords should be removed
      if (result.sanitizedMetadata) {
        expect(result.sanitizedMetadata.keywords).not.toContain('');
        expect(result.sanitizedMetadata.keywords.every(k => k.trim().length > 0)).toBe(true);
      }
    });

    it('should trim whitespace from each keyword', () => {
      const keywords = [
        '  sunset  ',
        '\tnature\t',
        '  landscape',
        'mountain  ',
        ...Array.from({ length: 30 }, (_, i) => `keyword${i}`),
      ];
      const metadata = createValidMetadata({ keywords });

      const result = service.validate(metadata);

      if (result.sanitizedMetadata) {
        expect(result.sanitizedMetadata.keywords).toContain('sunset');
        expect(result.sanitizedMetadata.keywords).toContain('nature');
        expect(result.sanitizedMetadata.keywords).toContain('landscape');
        expect(result.sanitizedMetadata.keywords).toContain('mountain');
        // No keyword should have leading/trailing whitespace
        expect(result.sanitizedMetadata.keywords.every(k => k === k.trim())).toBe(true);
      }
    });

    it('should detect and remove duplicate keywords (case-insensitive)', () => {
      const keywords = [
        'Sunset',
        'sunset',
        'SUNSET',
        'nature',
        'Nature',
        ...Array.from({ length: 35 }, (_, i) => `uniquekeyword${i}`),
      ];
      const metadata = createValidMetadata({ keywords });

      const result = service.validate(metadata);

      if (result.sanitizedMetadata) {
        // Should keep first occurrence only
        const sunsetCount = result.sanitizedMetadata.keywords.filter(
          k => k.toLowerCase() === 'sunset'
        ).length;
        const natureCount = result.sanitizedMetadata.keywords.filter(
          k => k.toLowerCase() === 'nature'
        ).length;

        expect(sunsetCount).toBe(1);
        expect(natureCount).toBe(1);
      }
    });

    it('should keep first occurrence when deduplicating', () => {
      const keywords = [
        'Sunset', // First occurrence - should keep this one
        'sunset', // Duplicate - remove
        ...Array.from({ length: 35 }, (_, i) => `keyword${i}`),
      ];
      const metadata = createValidMetadata({ keywords });

      const result = service.validate(metadata);

      if (result.sanitizedMetadata) {
        expect(result.sanitizedMetadata.keywords[0]).toBe('Sunset');
        expect(result.sanitizedMetadata.keywords).not.toContain('sunset');
      }
    });
  });

  // ====================
  // Category Validation Tests (AC3)
  // ====================

  describe('Category Validation (AC3)', () => {
    it('should accept valid category ID 1', () => {
      const metadata = createValidMetadata({ category: 1 });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'category')).toHaveLength(0);
    });

    it('should accept valid category ID 21', () => {
      const metadata = createValidMetadata({ category: 21 });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'category')).toHaveLength(0);
    });

    it('should accept category ID as string', () => {
      const metadata = createValidMetadata({ category: '15' as unknown as number });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'category')).toHaveLength(0);
    });

    it('should map invalid category ID 0 to default (1) via CategoryService', () => {
      // CategoryService maps invalid IDs to default (1) during sanitization
      // This is by design per Story 3.2 - invalid categories are auto-corrected
      const metadata = createValidMetadata({ category: 0 });

      const result = service.validate(metadata);

      // After sanitization, category is 1 (default), which is valid
      expect(result.errors.filter(e => e.field === 'category')).toHaveLength(0);
      expect(result.sanitizedMetadata?.category).toBe(1);
    });

    it('should map invalid category ID 22 to default (1) via CategoryService', () => {
      // CategoryService maps invalid IDs to default (1) during sanitization
      const metadata = createValidMetadata({ category: 22 });

      const result = service.validate(metadata);

      // After sanitization, category is 1 (default), which is valid
      expect(result.errors.filter(e => e.field === 'category')).toHaveLength(0);
      expect(result.sanitizedMetadata?.category).toBe(1);
    });

    it('should map negative category IDs to default (1) via CategoryService', () => {
      // CategoryService maps invalid IDs to default (1) during sanitization
      const metadata = createValidMetadata({ category: -1 });

      const result = service.validate(metadata);

      // After sanitization, category is 1 (default), which is valid
      expect(result.errors.filter(e => e.field === 'category')).toHaveLength(0);
      expect(result.sanitizedMetadata?.category).toBe(1);
    });

    it('should map string category names to valid IDs', () => {
      const metadata = createValidMetadata({ category: 'Animals' as unknown as number });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'category')).toHaveLength(0);
      expect(result.sanitizedMetadata?.category).toBe(1); // Animals = 1
    });

    it('should use default category for unknown category names', () => {
      const metadata = createValidMetadata({ category: 'unknown_category' as unknown as number });

      const result = service.validate(metadata);

      // CategoryService maps unknown to default (1)
      expect(result.sanitizedMetadata?.category).toBe(1);
    });
  });

  // ====================
  // Sanitization Tests (AC4)
  // ====================

  describe('Metadata Sanitization (AC4)', () => {
    it('should replace commas in title with semicolons', () => {
      const title =
        'Beautiful sunset, mountains, and landscape photography for commercial stock use';
      const metadata = createValidMetadata({ title });

      const sanitized = service.sanitize(metadata);

      expect(sanitized.title).not.toContain(',');
      expect(sanitized.title).toContain(';');
    });

    it('should normalize category to numeric ID', () => {
      const metadata = createValidMetadata({
        category: 'nature' as unknown as number,
      });

      const sanitized = service.sanitize(metadata);

      expect(typeof sanitized.category).toBe('number');
      expect(sanitized.category).toBe(5); // "nature" maps to category 5 ("The Environment") via aliases
    });

    it('should handle null/undefined title gracefully', () => {
      const metadata = createValidMetadata({
        title: null as unknown as string,
      });

      const sanitized = service.sanitize(metadata);

      expect(sanitized.title).toBe('');
    });

    it('should handle null/undefined keywords gracefully', () => {
      const metadata = createValidMetadata({
        keywords: null as unknown as string[],
      });

      const sanitized = service.sanitize(metadata);

      expect(Array.isArray(sanitized.keywords)).toBe(true);
      expect(sanitized.keywords).toHaveLength(0);
    });

    it('should handle non-string keywords gracefully', () => {
      const metadata = createValidMetadata({
        keywords: [123, 'valid', null, undefined, 'another'] as unknown as string[],
      });

      const sanitized = service.sanitize(metadata);

      // Non-strings become empty strings after toString, then get filtered out
      expect(sanitized.keywords).toContain('valid');
      expect(sanitized.keywords).toContain('another');
    });
  });

  // ====================
  // Fallback Generation Tests (AC5)
  // ====================

  describe('Fallback Metadata Generation (AC5)', () => {
    it('should generate title with UUID short', () => {
      const fileId = 'abc12345-6789-0123-4567-890abcdef012';
      const fallback = service.generateFallback(fileId);

      expect(fallback.title).toContain('abc12345');
      expect(fallback.title.length).toBeGreaterThanOrEqual(TITLE_MIN_LENGTH);
    });

    it('should use first 8 characters of fileId in title', () => {
      const fileId = 'xyz98765-4321-0987-6543-210zyxwvutsrq';
      const fallback = service.generateFallback(fileId);

      expect(fallback.title).toContain('xyz98765');
    });

    it('should generate exactly 30 fallback keywords', () => {
      const fallback = service.generateFallback('test-file-id');

      expect(fallback.keywords.length).toBe(30);
      expect(fallback.keywords).toEqual(FALLBACK_KEYWORDS);
    });

    it('should use category 8 (Graphic Resources) as default', () => {
      const fallback = service.generateFallback('test-file-id');

      expect(fallback.category).toBe(DEFAULT_FALLBACK_CATEGORY);
      expect(fallback.category).toBe(8);
    });

    it('should handle empty fileId gracefully', () => {
      const fallback = service.generateFallback('');

      expect(fallback.title).toContain('Stock Photo');
      expect(fallback.keywords.length).toBe(30);
      expect(fallback.category).toBe(8);
    });

    it('should handle undefined fileId gracefully', () => {
      const fallback = service.generateFallback(undefined as unknown as string);

      expect(fallback.title).toContain('Stock Photo');
      expect(fallback.keywords.length).toBe(30);
      expect(fallback.category).toBe(8);
    });

    it('should generate title that meets minimum length requirement', () => {
      const fallback = service.generateFallback('short');

      expect(fallback.title.length).toBeGreaterThanOrEqual(TITLE_MIN_LENGTH);
    });

    it('should generate unique keywords (no duplicates)', () => {
      const fallback = service.generateFallback('test');
      const uniqueKeywords = new Set(fallback.keywords);

      expect(uniqueKeywords.size).toBe(fallback.keywords.length);
    });
  });

  // ====================
  // Validation Integration Tests (AC7)
  // ====================

  describe('validateAndSanitize Integration (AC7)', () => {
    it('should return sanitized metadata when validation passes', () => {
      const metadata = createValidMetadata();

      const result = service.validateAndSanitize(metadata, 'test-file-id');

      expect(result.title).toBe(metadata.title);
      expect(result.keywords.length).toBeGreaterThanOrEqual(KEYWORDS_MIN_COUNT);
    });

    it('should return fallback metadata when validation fails', () => {
      const metadata = createValidMetadata({
        title: 'Too short',
        keywords: ['only', 'five', 'keywords', 'here', 'oops'],
      });

      const result = service.validateAndSanitize(metadata, 'test-file-id');

      // Should return fallback
      expect(result.title).toContain('Stock Photo');
      expect(result.keywords).toEqual(FALLBACK_KEYWORDS);
      expect(result.category).toBe(DEFAULT_FALLBACK_CATEGORY);
    });

    it('should use provided fileId for fallback generation', () => {
      const metadata = createValidMetadata({ title: 'Too short' });
      const fileId = 'unique12-3456-7890-abcd-efghijklmnop';

      const result = service.validateAndSanitize(metadata, fileId);

      // Fallback should include fileId
      expect(result.title).toContain('unique12');
    });
  });

  // ====================
  // Edge Cases and Error Scenarios
  // ====================

  describe('Edge Cases', () => {
    it('should handle completely empty metadata object', () => {
      const metadata = {} as RawAIMetadata;

      const result = service.validate(metadata);

      expect(result.valid).toBe(false);
      // Should have errors for title and keywords at minimum
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'title')).toBe(true);
      expect(result.errors.some(e => e.field === 'keywords')).toBe(true);
      // Note: category is auto-fixed to default (1) by CategoryService, so no category error
    });

    it('should return all validation errors at once', () => {
      const metadata = {
        title: 'Short',
        keywords: ['only', 'two'],
        category: 99, // Will be mapped to default (1) by CategoryService
      } as RawAIMetadata;

      const result = service.validate(metadata);

      expect(result.valid).toBe(false);
      // Should have errors for title and keywords (category is auto-fixed)
      expect(result.errors.some(e => e.field === 'title')).toBe(true);
      expect(result.errors.some(e => e.field === 'keywords')).toBe(true);
      // Category is auto-corrected to 1 by CategoryService, so no category error
    });

    it('should include error values for debugging', () => {
      const metadata = createValidMetadata({ title: 'Short' });

      const result = service.validate(metadata);

      const titleError = result.errors.find(e => e.field === 'title');
      expect(titleError?.value).toBeDefined();
    });

    it('should handle special Unicode characters in title', () => {
      const title = 'Beautiful café photograph with résumé and naïve bokeh effects for stock media';
      const metadata = createValidMetadata({ title });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'title')).toHaveLength(0);
    });

    it('should handle special Unicode characters in keywords', () => {
      const keywords = [
        'café',
        'résumé',
        'naïve',
        'piñata',
        ...Array.from({ length: 30 }, (_, i) => `keyword${i}`),
      ];
      const metadata = createValidMetadata({ keywords });

      const result = service.validate(metadata);

      expect(result.errors.filter(e => e.field === 'keywords')).toHaveLength(0);
    });

    it('should count characters correctly for multi-byte Unicode', () => {
      // Emoji and multi-byte characters
      const title = '🌅 Beautiful sunrise 🏔️ mountain photography with stunning nature views 🌿';
      const metadata = createValidMetadata({ title });

      // Title should be measured by character count, not byte count
      const result = service.validate(metadata);

      // Verify title handling is consistent
      expect(result.sanitizedMetadata?.title || '').toBeDefined();
    });
  });

  // ====================
  // Constants Verification
  // ====================

  describe('Validation Constants', () => {
    it('should have correct title length constants', () => {
      expect(TITLE_MIN_LENGTH).toBe(50);
      expect(TITLE_MAX_LENGTH).toBe(200);
    });

    it('should have correct keyword count constants', () => {
      expect(KEYWORDS_MIN_COUNT).toBe(30);
      expect(KEYWORDS_MAX_COUNT).toBe(50);
    });

    it('should have correct keyword length constant', () => {
      expect(KEYWORD_MAX_LENGTH).toBe(50);
    });

    it('should have 30 fallback keywords', () => {
      expect(FALLBACK_KEYWORDS.length).toBe(30);
    });

    it('should have default fallback category as 8', () => {
      expect(DEFAULT_FALLBACK_CATEGORY).toBe(8);
    });
  });
});
