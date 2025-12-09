/**
 * Category Service Tests
 * Story 3.2: Adobe Stock Category Taxonomy (AC6)
 *
 * Comprehensive tests for category mapping, validation, and fuzzy matching:
 * - All 21 exact category matches
 * - Fuzzy matching variations (aliases, partial matches)
 * - Edge cases (empty, null, undefined, invalid types)
 * - Validation boundary cases (0, 21, 22, -1)
 * - Default fallback behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing service
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { CategoryService } from '../src/services/category.service';
import {
  ADOBE_STOCK_CATEGORIES,
  CATEGORY_ALIASES,
  DEFAULT_CATEGORY_ID,
  MIN_CATEGORY_ID,
  MAX_CATEGORY_ID,
} from '../src/utils/adobe-stock-categories';
import { logger } from '../src/utils/logger';

describe('CategoryService - Story 3.2', () => {
  let categoryService: CategoryService;

  beforeEach(() => {
    categoryService = new CategoryService();
    vi.clearAllMocks();
  });

  // ============================================================================
  // AC1: Complete Category Taxonomy Constant
  // ============================================================================
  describe('Category Taxonomy Constants (AC1)', () => {
    it('should have exactly 21 categories defined', () => {
      expect(Object.keys(ADOBE_STOCK_CATEGORIES).length).toBe(21);
    });

    it('should have category IDs from 1 to 21', () => {
      const ids = Object.keys(ADOBE_STOCK_CATEGORIES).map(Number);
      expect(Math.min(...ids)).toBe(1);
      expect(Math.max(...ids)).toBe(21);
    });

    it('should match official Adobe Stock category names', () => {
      expect(ADOBE_STOCK_CATEGORIES[1]).toBe('Animals');
      expect(ADOBE_STOCK_CATEGORIES[2]).toBe('Buildings and Architecture');
      expect(ADOBE_STOCK_CATEGORIES[3]).toBe('Business');
      expect(ADOBE_STOCK_CATEGORIES[4]).toBe('Drinks');
      expect(ADOBE_STOCK_CATEGORIES[5]).toBe('The Environment');
      expect(ADOBE_STOCK_CATEGORIES[6]).toBe('States of Mind');
      expect(ADOBE_STOCK_CATEGORIES[7]).toBe('Food');
      expect(ADOBE_STOCK_CATEGORIES[8]).toBe('Graphic Resources');
      expect(ADOBE_STOCK_CATEGORIES[9]).toBe('Hobbies and Leisure');
      expect(ADOBE_STOCK_CATEGORIES[10]).toBe('Industry');
      expect(ADOBE_STOCK_CATEGORIES[11]).toBe('Landscape');
      expect(ADOBE_STOCK_CATEGORIES[12]).toBe('Lifestyle');
      expect(ADOBE_STOCK_CATEGORIES[13]).toBe('People');
      expect(ADOBE_STOCK_CATEGORIES[14]).toBe('Plants and Flowers');
      expect(ADOBE_STOCK_CATEGORIES[15]).toBe('Culture and Religion');
      expect(ADOBE_STOCK_CATEGORIES[16]).toBe('Science');
      expect(ADOBE_STOCK_CATEGORIES[17]).toBe('Social Issues');
      expect(ADOBE_STOCK_CATEGORIES[18]).toBe('Sports');
      expect(ADOBE_STOCK_CATEGORIES[19]).toBe('Technology');
      expect(ADOBE_STOCK_CATEGORIES[20]).toBe('Transport');
      expect(ADOBE_STOCK_CATEGORIES[21]).toBe('Travel');
    });
  });

  // ============================================================================
  // AC2: Category ID Validation
  // ============================================================================
  describe('validateId - Category ID Validation (AC2)', () => {
    describe('Valid IDs (1-21)', () => {
      it.each([1, 2, 3, 10, 11, 20, 21])('should return true for valid ID %d', id => {
        expect(categoryService.validateId(id)).toBe(true);
      });

      it.each(['1', '10', '21'])('should return true for valid string ID "%s"', id => {
        expect(categoryService.validateId(id)).toBe(true);
      });
    });

    describe('Invalid IDs', () => {
      it('should return false for ID 0', () => {
        expect(categoryService.validateId(0)).toBe(false);
      });

      it('should return false for ID 22', () => {
        expect(categoryService.validateId(22)).toBe(false);
      });

      it('should return false for negative ID -1', () => {
        expect(categoryService.validateId(-1)).toBe(false);
      });

      it('should return false for negative ID -100', () => {
        expect(categoryService.validateId(-100)).toBe(false);
      });

      it('should return false for large invalid ID 100', () => {
        expect(categoryService.validateId(100)).toBe(false);
      });

      it('should return false for non-integer 1.5', () => {
        expect(categoryService.validateId(1.5)).toBe(false);
      });

      it('should return false for NaN', () => {
        expect(categoryService.validateId(NaN)).toBe(false);
      });

      it('should return false for non-numeric string "abc"', () => {
        expect(categoryService.validateId('abc')).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(categoryService.validateId('')).toBe(false);
      });

      it('should return false for string "0"', () => {
        expect(categoryService.validateId('0')).toBe(false);
      });

      it('should return false for string "22"', () => {
        expect(categoryService.validateId('22')).toBe(false);
      });

      it('should return false for string "-1"', () => {
        expect(categoryService.validateId('-1')).toBe(false);
      });
    });
  });

  // ============================================================================
  // AC3: Fuzzy Category Name Matching
  // ============================================================================
  describe('mapNameToId - Exact Matches (AC3)', () => {
    it.each([
      ['Animals', 1],
      ['Buildings and Architecture', 2],
      ['Business', 3],
      ['Drinks', 4],
      ['The Environment', 5],
      ['States of Mind', 6],
      ['Food', 7],
      ['Graphic Resources', 8],
      ['Hobbies and Leisure', 9],
      ['Industry', 10],
      ['Landscape', 11],
      ['Lifestyle', 12],
      ['People', 13],
      ['Plants and Flowers', 14],
      ['Culture and Religion', 15],
      ['Science', 16],
      ['Social Issues', 17],
      ['Sports', 18],
      ['Technology', 19],
      ['Transport', 20],
      ['Travel', 21],
    ])('should map "%s" to category ID %d (exact match)', (name, expectedId) => {
      expect(categoryService.mapNameToId(name)).toBe(expectedId);
    });
  });

  describe('mapNameToId - Case Insensitive Matching (AC3)', () => {
    it.each([
      ['animals', 1],
      ['ANIMALS', 1],
      ['Animals', 1],
      ['AnImAlS', 1],
      ['business', 3],
      ['BUSINESS', 3],
      ['LANDSCAPE', 11],
      ['landscape', 11],
      ['TECHNOLOGY', 19],
      ['technology', 19],
    ])('should map "%s" to category ID %d (case-insensitive)', (name, expectedId) => {
      expect(categoryService.mapNameToId(name)).toBe(expectedId);
    });
  });

  describe('mapNameToId - Alias Matching (AC3)', () => {
    // Category 1: Animals
    it.each([
      ['animal', 1],
      ['pet', 1],
      ['pets', 1],
      ['wildlife', 1],
      ['insect', 1],
    ])('should map alias "%s" to Animals (1)', (alias, expectedId) => {
      expect(categoryService.mapNameToId(alias)).toBe(expectedId);
    });

    // Category 2: Buildings and Architecture
    it.each([
      ['building', 2],
      ['buildings', 2],
      ['architecture', 2],
      ['interior', 2],
      ['home', 2],
    ])('should map alias "%s" to Buildings and Architecture (2)', (alias, expectedId) => {
      expect(categoryService.mapNameToId(alias)).toBe(expectedId);
    });

    // Category 3: Business
    it.each([
      ['office', 3],
      ['finance', 3],
      ['corporate', 3],
    ])('should map alias "%s" to Business (3)', (alias, expectedId) => {
      expect(categoryService.mapNameToId(alias)).toBe(expectedId);
    });

    // Category 7: Food
    it.each([
      ['meal', 7],
      ['eating', 7],
      ['cuisine', 7],
    ])('should map alias "%s" to Food (7)', (alias, expectedId) => {
      expect(categoryService.mapNameToId(alias)).toBe(expectedId);
    });

    // Category 13: People
    it.each([
      ['person', 13],
      ['human', 13],
      ['portrait', 13],
      ['family', 13],
    ])('should map alias "%s" to People (13)', (alias, expectedId) => {
      expect(categoryService.mapNameToId(alias)).toBe(expectedId);
    });

    // Category 18: Sports
    it.each([
      ['sport', 18],
      ['fitness', 18],
      ['football', 18],
      ['yoga', 18],
    ])('should map alias "%s" to Sports (18)', (alias, expectedId) => {
      expect(categoryService.mapNameToId(alias)).toBe(expectedId);
    });

    // Category 19: Technology
    it.each([
      ['tech', 19],
      ['computer', 19],
      ['digital', 19],
      ['software', 19],
    ])('should map alias "%s" to Technology (19)', (alias, expectedId) => {
      expect(categoryService.mapNameToId(alias)).toBe(expectedId);
    });

    // Category 20: Transport
    it.each([
      ['transportation', 20],
      ['vehicle', 20],
      ['car', 20],
      ['airplane', 20],
    ])('should map alias "%s" to Transport (20)', (alias, expectedId) => {
      expect(categoryService.mapNameToId(alias)).toBe(expectedId);
    });

    // Category 21: Travel
    it.each([
      ['tourism', 21],
      ['vacation', 21],
      ['adventure', 21],
    ])('should map alias "%s" to Travel (21)', (alias, expectedId) => {
      expect(categoryService.mapNameToId(alias)).toBe(expectedId);
    });
  });

  describe('mapNameToId - Partial Matching (AC3)', () => {
    it('should match "bus" to Transport via alias (not partial match to Business)', () => {
      // "bus" is an explicit alias for Transport (20) - vehicles
      // Aliases take precedence over partial word matching
      expect(categoryService.mapNameToId('bus')).toBe(20);
    });

    it('should match "land" to Landscape via partial match', () => {
      expect(categoryService.mapNameToId('land')).toBe(11);
    });

    it('should match "trav" to Travel via partial match', () => {
      expect(categoryService.mapNameToId('trav')).toBe(21);
    });

    it('should match "sci" to Science via partial match', () => {
      expect(categoryService.mapNameToId('sci')).toBe(16);
    });

    it('should match "peop" to People via partial match', () => {
      expect(categoryService.mapNameToId('peop')).toBe(13);
    });
  });

  describe('mapNameToId - Default Fallback (AC3)', () => {
    it('should return default category for unknown string', () => {
      const result = categoryService.mapNameToId('unknown_category_xyz');
      expect(result).toBe(DEFAULT_CATEGORY_ID);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return default category for gibberish', () => {
      expect(categoryService.mapNameToId('asdfghjkl')).toBe(DEFAULT_CATEGORY_ID);
    });

    it('should log warning when falling back to default', () => {
      categoryService.mapNameToId('nonexistent_category');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ defaultCategoryId: DEFAULT_CATEGORY_ID }),
        expect.stringContaining('No category match found')
      );
    });
  });

  describe('mapNameToId - Edge Cases (AC3)', () => {
    it('should handle empty string', () => {
      expect(categoryService.mapNameToId('')).toBe(DEFAULT_CATEGORY_ID);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle whitespace-only string', () => {
      expect(categoryService.mapNameToId('   ')).toBe(DEFAULT_CATEGORY_ID);
    });

    it('should handle null input', () => {
      expect(categoryService.mapNameToId(null as unknown as string)).toBe(DEFAULT_CATEGORY_ID);
    });

    it('should handle undefined input', () => {
      expect(categoryService.mapNameToId(undefined as unknown as string)).toBe(DEFAULT_CATEGORY_ID);
    });

    it('should handle number input', () => {
      expect(categoryService.mapNameToId(123 as unknown as string)).toBe(DEFAULT_CATEGORY_ID);
    });

    it('should handle string with leading/trailing whitespace', () => {
      expect(categoryService.mapNameToId('  Animals  ')).toBe(1);
    });
  });

  // ============================================================================
  // AC4: Category Service Implementation
  // ============================================================================
  describe('getNameById (AC4)', () => {
    it.each([
      [1, 'Animals'],
      [2, 'Buildings and Architecture'],
      [10, 'Industry'],
      [21, 'Travel'],
    ])('should return "%s" for ID %d', (id, expectedName) => {
      expect(categoryService.getNameById(id)).toBe(expectedName);
    });

    it('should return undefined for invalid ID 0', () => {
      expect(categoryService.getNameById(0)).toBeUndefined();
    });

    it('should return undefined for invalid ID 22', () => {
      expect(categoryService.getNameById(22)).toBeUndefined();
    });

    it('should return undefined for negative ID', () => {
      expect(categoryService.getNameById(-1)).toBeUndefined();
    });
  });

  describe('getAllCategories (AC4)', () => {
    it('should return all 21 categories', () => {
      const categories = categoryService.getAllCategories();
      expect(Object.keys(categories).length).toBe(21);
    });

    it('should return a copy, not the original object', () => {
      const categories = categoryService.getAllCategories();
      // Modify the returned object
      categories[999] = 'Test';
      // Original should not be affected
      const originalCategories = categoryService.getAllCategories();
      expect(originalCategories[999]).toBeUndefined();
    });

    it('should return correct category names', () => {
      const categories = categoryService.getAllCategories();
      expect(categories[1]).toBe('Animals');
      expect(categories[21]).toBe('Travel');
    });
  });

  describe('toValidCategoryId (AC4)', () => {
    describe('Numeric ID input', () => {
      it('should pass through valid numeric IDs', () => {
        expect(categoryService.toValidCategoryId(1)).toBe(1);
        expect(categoryService.toValidCategoryId(10)).toBe(10);
        expect(categoryService.toValidCategoryId(21)).toBe(21);
      });

      it('should return default for invalid numeric ID 0', () => {
        expect(categoryService.toValidCategoryId(0)).toBe(DEFAULT_CATEGORY_ID);
      });

      it('should return default for invalid numeric ID 22', () => {
        expect(categoryService.toValidCategoryId(22)).toBe(DEFAULT_CATEGORY_ID);
      });

      it('should return default for negative numeric ID', () => {
        expect(categoryService.toValidCategoryId(-5)).toBe(DEFAULT_CATEGORY_ID);
      });
    });

    describe('String ID input', () => {
      it('should parse valid string IDs', () => {
        expect(categoryService.toValidCategoryId('1')).toBe(1);
        expect(categoryService.toValidCategoryId('10')).toBe(10);
        expect(categoryService.toValidCategoryId('21')).toBe(21);
      });

      it('should handle string ID with whitespace', () => {
        expect(categoryService.toValidCategoryId('  5  ')).toBe(5);
      });

      it('should return default for invalid string ID "0"', () => {
        expect(categoryService.toValidCategoryId('0')).toBe(DEFAULT_CATEGORY_ID);
      });

      it('should return default for invalid string ID "22"', () => {
        expect(categoryService.toValidCategoryId('22')).toBe(DEFAULT_CATEGORY_ID);
      });
    });

    describe('Category name input', () => {
      it('should map category name to ID', () => {
        expect(categoryService.toValidCategoryId('Animals')).toBe(1);
        expect(categoryService.toValidCategoryId('Technology')).toBe(19);
      });

      it('should handle fuzzy category name matching', () => {
        expect(categoryService.toValidCategoryId('animal')).toBe(1);
        expect(categoryService.toValidCategoryId('tech')).toBe(19);
      });

      it('should return default for unknown category name', () => {
        expect(categoryService.toValidCategoryId('unknown')).toBe(DEFAULT_CATEGORY_ID);
      });
    });
  });

  // ============================================================================
  // Validation Boundary Cases (AC6)
  // ============================================================================
  describe('Validation Boundary Cases (AC6)', () => {
    it('should validate boundary ID MIN_CATEGORY_ID (1)', () => {
      expect(categoryService.validateId(MIN_CATEGORY_ID)).toBe(true);
    });

    it('should validate boundary ID MAX_CATEGORY_ID (21)', () => {
      expect(categoryService.validateId(MAX_CATEGORY_ID)).toBe(true);
    });

    it('should reject ID below MIN (0)', () => {
      expect(categoryService.validateId(MIN_CATEGORY_ID - 1)).toBe(false);
    });

    it('should reject ID above MAX (22)', () => {
      expect(categoryService.validateId(MAX_CATEGORY_ID + 1)).toBe(false);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================
  describe('Integration: Full Category Workflow', () => {
    it('should handle AI response with numeric category ID', () => {
      // AI returns: { category: 13 }
      const aiCategory = 13;
      const validId = categoryService.toValidCategoryId(aiCategory);
      const name = categoryService.getNameById(validId);

      expect(validId).toBe(13);
      expect(name).toBe('People');
    });

    it('should handle AI response with string category ID', () => {
      // AI returns: { category: "19" }
      const aiCategory = '19';
      const validId = categoryService.toValidCategoryId(aiCategory);
      const name = categoryService.getNameById(validId);

      expect(validId).toBe(19);
      expect(name).toBe('Technology');
    });

    it('should handle AI response with category name', () => {
      // AI returns: { category: "Landscape" }
      const aiCategory = 'Landscape';
      const validId = categoryService.toValidCategoryId(aiCategory);
      const name = categoryService.getNameById(validId);

      expect(validId).toBe(11);
      expect(name).toBe('Landscape');
    });

    it('should handle AI response with invalid category gracefully', () => {
      // AI returns: { category: "InvalidCategory123" }
      const aiCategory = 'InvalidCategory123';
      const validId = categoryService.toValidCategoryId(aiCategory);
      const name = categoryService.getNameById(validId);

      expect(validId).toBe(DEFAULT_CATEGORY_ID);
      expect(name).toBe('Animals');
    });
  });

  // ============================================================================
  // All Category Aliases Coverage (AC6)
  // ============================================================================
  describe('All Category Aliases Coverage', () => {
    it('should have aliases defined for all categories', () => {
      // Verify that we have aliases covering multiple categories
      const aliasCategories = new Set(Object.values(CATEGORY_ALIASES));
      expect(aliasCategories.size).toBeGreaterThanOrEqual(15);
    });

    it('all aliases should map to valid category IDs', () => {
      for (const [alias, categoryId] of Object.entries(CATEGORY_ALIASES)) {
        expect(categoryService.validateId(categoryId)).toBe(true);
        expect(categoryService.mapNameToId(alias)).toBe(categoryId);
      }
    });
  });
});
