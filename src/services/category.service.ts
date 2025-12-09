/**
 * Category Service
 *
 * Maps AI-generated categories to Adobe Stock's official taxonomy.
 * Provides fuzzy matching for category names and validation for category IDs.
 *
 * Story 3.2: Adobe Stock Category Taxonomy (AC2, AC3, AC4)
 */

import { logger } from '@/utils/logger';
import {
  ADOBE_STOCK_CATEGORIES,
  CATEGORY_NAME_TO_ID,
  CATEGORY_ALIASES,
  MIN_CATEGORY_ID,
  MAX_CATEGORY_ID,
  DEFAULT_CATEGORY_ID,
  type CategoryId,
} from '@/utils/adobe-stock-categories';

/**
 * Service for mapping and validating Adobe Stock categories
 *
 * @example
 * const categoryService = new CategoryService();
 *
 * // Map category name to ID
 * const id = categoryService.mapNameToId('Animals'); // → 1
 * const id2 = categoryService.mapNameToId('animal'); // → 1 (fuzzy match)
 *
 * // Validate category ID
 * const isValid = categoryService.validateId(1); // → true
 * const isInvalid = categoryService.validateId(99); // → false
 */
export class CategoryService {
  /**
   * Maps a category name to its Adobe Stock category ID
   *
   * Matching priority:
   * 1. Exact match (case-insensitive) against official category names
   * 2. Alias match against common variations
   * 3. Partial match (word starts with) against official names
   * 4. Default to category 1 ("Animals") if no match found
   *
   * @param name - Category name from AI response
   * @returns Category ID (1-21), defaults to 1 if no match
   *
   * @example
   * mapNameToId('Animals') // → 1 (exact match)
   * mapNameToId('ANIMALS') // → 1 (case-insensitive)
   * mapNameToId('animal')  // → 1 (alias match)
   * mapNameToId('tech')    // → 19 (alias for Technology)
   * mapNameToId('unknown') // → 1 (default fallback)
   */
  mapNameToId(name: string): number {
    if (!name || typeof name !== 'string') {
      logger.warn({ input: name }, 'Invalid category name input, using default category');
      return DEFAULT_CATEGORY_ID;
    }

    const normalizedName = name.trim().toLowerCase();

    if (!normalizedName) {
      logger.warn({ input: name }, 'Empty category name after normalization, using default');
      return DEFAULT_CATEGORY_ID;
    }

    // Step 1: Exact match against official category names (case-insensitive)
    const exactMatch = CATEGORY_NAME_TO_ID[normalizedName];
    if (exactMatch !== undefined) {
      logger.debug({ name, categoryId: exactMatch, matchType: 'exact' }, 'Category exact match');
      return exactMatch;
    }

    // Step 2: Alias match
    const aliasMatch = CATEGORY_ALIASES[normalizedName];
    if (aliasMatch !== undefined) {
      logger.debug({ name, categoryId: aliasMatch, matchType: 'alias' }, 'Category alias match');
      return aliasMatch;
    }

    // Step 3: Partial match - check if any official name starts with the input
    // or if input starts with any official name word
    for (const [officialName, id] of Object.entries(CATEGORY_NAME_TO_ID)) {
      // Check if official name starts with input
      if (officialName.startsWith(normalizedName)) {
        logger.debug(
          { name, categoryId: id, matchType: 'partial-start', officialName },
          'Category partial match (name starts)'
        );
        return id;
      }

      // Check if any word in official name starts with input
      const words = officialName.split(/\s+/);
      for (const word of words) {
        if (word.startsWith(normalizedName) && normalizedName.length >= 3) {
          logger.debug(
            { name, categoryId: id, matchType: 'partial-word', officialName, matchedWord: word },
            'Category partial match (word starts)'
          );
          return id;
        }
      }
    }

    // Step 4: Check if input contains any official category name
    for (const [officialName, id] of Object.entries(CATEGORY_NAME_TO_ID)) {
      if (normalizedName.includes(officialName) || officialName.includes(normalizedName)) {
        logger.debug(
          { name, categoryId: id, matchType: 'contains', officialName },
          'Category contains match'
        );
        return id;
      }
    }

    // Step 5: Default fallback
    logger.warn(
      { name, defaultCategoryId: DEFAULT_CATEGORY_ID },
      'No category match found, using default category'
    );
    return DEFAULT_CATEGORY_ID;
  }

  /**
   * Validates if a category ID is valid (1-21)
   *
   * Supports both number and string inputs since AI may return either.
   *
   * @param id - Category ID to validate (number or string)
   * @returns true if valid (1-21), false otherwise
   *
   * @example
   * validateId(1)    // → true
   * validateId('21') // → true
   * validateId(0)    // → false
   * validateId(22)   // → false
   * validateId(-1)   // → false
   * validateId('abc') // → false
   */
  validateId(id: number | string): boolean {
    // Handle string inputs
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

    // Check for non-integer values
    if (!Number.isInteger(numericId)) {
      return false;
    }

    // Check range
    return numericId >= MIN_CATEGORY_ID && numericId <= MAX_CATEGORY_ID;
  }

  /**
   * Gets the category name for a given ID
   *
   * @param id - Category ID (1-21)
   * @returns Category name or undefined if ID is invalid
   *
   * @example
   * getNameById(1)  // → 'Animals'
   * getNameById(21) // → 'Travel'
   * getNameById(99) // → undefined
   */
  getNameById(id: number): string | undefined {
    if (!this.validateId(id)) {
      return undefined;
    }
    return ADOBE_STOCK_CATEGORIES[id as CategoryId];
  }

  /**
   * Returns all categories as a record
   *
   * @returns Record of category ID → name mappings
   *
   * @example
   * const categories = getAllCategories();
   * // { 1: 'Animals', 2: 'Buildings and Architecture', ... }
   */
  getAllCategories(): Record<number, string> {
    // Return a copy to prevent external mutation
    return { ...ADOBE_STOCK_CATEGORIES };
  }

  /**
   * Converts a category value (ID or name) to a valid category ID
   *
   * This is the main entry point for processing AI-generated category values.
   * Handles both numeric IDs and string category names.
   *
   * @param value - Category value from AI (number, string ID, or category name)
   * @returns Valid category ID (1-21)
   *
   * @example
   * toValidCategoryId(1)           // → 1 (valid ID passthrough)
   * toValidCategoryId('1')         // → 1 (string ID parsed)
   * toValidCategoryId('Animals')   // → 1 (name mapped)
   * toValidCategoryId('animal')    // → 1 (fuzzy name match)
   * toValidCategoryId(99)          // → 1 (invalid ID, default)
   * toValidCategoryId('unknown')   // → 1 (no match, default)
   */
  toValidCategoryId(value: number | string): number {
    // Handle numeric input
    if (typeof value === 'number') {
      if (this.validateId(value)) {
        logger.debug({ value, categoryId: value }, 'Category ID validated');
        return value;
      }
      logger.warn(
        { value, defaultCategoryId: DEFAULT_CATEGORY_ID },
        'Invalid category ID, using default'
      );
      return DEFAULT_CATEGORY_ID;
    }

    // Handle string input - could be numeric string or category name
    const trimmedValue = value.trim();

    // Try parsing as numeric ID first
    const numericValue = parseInt(trimmedValue, 10);
    if (!isNaN(numericValue) && this.validateId(numericValue)) {
      logger.debug({ value, categoryId: numericValue }, 'Category string ID validated');
      return numericValue;
    }

    // If not a valid numeric ID, treat as category name
    return this.mapNameToId(trimmedValue);
  }
}
