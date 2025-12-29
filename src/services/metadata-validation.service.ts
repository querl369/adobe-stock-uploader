/**
 * Metadata Validation Service
 *
 * Validates AI-generated metadata before saving to ensure Adobe Stock compliance.
 * Handles sanitization, validation, and fallback generation when AI output
 * doesn't meet requirements.
 *
 * Story 3.4: Metadata Validation & Quality Checks
 */

import { logger } from '@/utils/logger';
import { recordMetadataValidationFailure } from '@/utils/metrics';
import type { CategoryService } from '@/services/category.service';
import type { RawAIMetadata } from '@/models/metadata.model';

/**
 * Validation Constants
 * Based on Adobe Stock requirements
 */
export const TITLE_MIN_LENGTH = 50;
export const TITLE_MAX_LENGTH = 200;
export const KEYWORDS_MIN_COUNT = 30;
export const KEYWORDS_MAX_COUNT = 50;
export const KEYWORD_MAX_LENGTH = 50;
// CR-003 Note: Global flag is needed for .replace() to replace ALL commas.
// The original CR-003 issue was about using /g with .test() method which maintains
// lastIndex state. Since we removed the .test() call (CR-004 dead code removal),
// the global flag is safe to keep for .replace() usage in sanitize().
export const TITLE_FORBIDDEN_CHARS = /,/g; // Commas break CSV export

/**
 * Default fallback category for generated fallback metadata
 *
 * CR-006 Note: This intentionally differs from CategoryService.DEFAULT_CATEGORY_ID (1 = Animals).
 * - CategoryService uses category 1 (Animals) as default when mapping unknown category names/IDs.
 *   This is used during normal metadata processing when AI returns an invalid category.
 * - MetadataValidationService uses category 8 (Graphic Resources) for fallback metadata.
 *   This is a "safer" generic default when generating completely synthetic fallback metadata
 *   because the image couldn't be analyzed properly. Graphic Resources is broad and neutral.
 *
 * The distinction ensures:
 * - Invalid AI categories → mapped to Animals (common, safe default)
 * - Complete fallback metadata → uses Graphic Resources (generic, applicable to any image type)
 */
export const DEFAULT_FALLBACK_CATEGORY = 8; // Graphic Resources - safe default for fallback

/**
 * Fallback keywords used when AI-generated keywords fail validation
 * Provides 30 generic but useful stock photography keywords
 */
export const FALLBACK_KEYWORDS = [
  'stock',
  'image',
  'photo',
  'picture',
  'photograph',
  'asset',
  'media',
  'content',
  'visual',
  'graphic',
  'illustration',
  'creative',
  'design',
  'background',
  'abstract',
  'composition',
  'artistic',
  'professional',
  'commercial',
  'digital',
  'modern',
  'concept',
  'scene',
  'view',
  'shot',
  'capture',
  'snapshot',
  'frame',
  'pic',
  'imagery',
];

/**
 * Validation error codes for tracking and debugging
 */
export enum ValidationErrorCode {
  TITLE_TOO_SHORT = 'TITLE_TOO_SHORT',
  TITLE_TOO_LONG = 'TITLE_TOO_LONG',
  TITLE_EMPTY = 'TITLE_EMPTY',
  TITLE_FORBIDDEN_CHARS = 'TITLE_FORBIDDEN_CHARS',
  KEYWORDS_TOO_FEW = 'KEYWORDS_TOO_FEW',
  KEYWORDS_TOO_MANY = 'KEYWORDS_TOO_MANY',
  KEYWORD_TOO_LONG = 'KEYWORD_TOO_LONG',
  KEYWORD_EMPTY = 'KEYWORD_EMPTY',
  KEYWORDS_DUPLICATES = 'KEYWORDS_DUPLICATES',
  CATEGORY_INVALID = 'CATEGORY_INVALID',
}

/**
 * Single validation error
 */
export interface ValidationError {
  /** Field that failed validation */
  field: 'title' | 'keywords' | 'category';
  /** Error code for categorization */
  code: ValidationErrorCode;
  /** Human-readable error message */
  message: string;
  /** The invalid value (for debugging) */
  value?: unknown;
}

/**
 * Result of metadata validation
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Sanitized metadata (only if valid or partial fixes applied) */
  sanitizedMetadata?: RawAIMetadata;
  /** List of validation errors found */
  errors: ValidationError[];
}

/**
 * Service for validating and sanitizing AI-generated metadata
 *
 * @example
 * const validationService = new MetadataValidationService(categoryService);
 *
 * // Validate metadata
 * const result = validationService.validate(rawMetadata);
 * if (result.valid) {
 *   return result.sanitizedMetadata;
 * } else {
 *   logger.warn({ errors: result.errors }, 'Validation failed');
 *   return validationService.generateFallback('abc123');
 * }
 */
export class MetadataValidationService {
  private categoryService: CategoryService;

  /**
   * Creates a new MetadataValidationService
   *
   * @param categoryService - Service for validating Adobe Stock categories
   */
  constructor(categoryService: CategoryService) {
    this.categoryService = categoryService;
  }

  /**
   * Validates metadata against Adobe Stock requirements
   *
   * Validation rules:
   * - Title: 50-200 characters, no commas
   * - Keywords: 30-50 terms, no duplicates, each ≤50 chars
   * - Category: Valid Adobe Stock category ID (1-21)
   *
   * @param metadata - Raw AI-generated metadata
   * @returns Validation result with errors or sanitized metadata
   *
   * @example
   * const result = service.validate({
   *   title: 'Beautiful sunset...',
   *   keywords: ['sunset', 'nature', ...],
   *   category: 15
   * });
   */
  validate(metadata: RawAIMetadata): ValidationResult {
    const errors: ValidationError[] = [];

    // First, sanitize the metadata
    const sanitizedMetadata = this.sanitize(metadata);

    // Validate title (AC1)
    const titleErrors = this.validateTitle(sanitizedMetadata.title);
    errors.push(...titleErrors);

    // Validate keywords (AC2)
    const keywordErrors = this.validateKeywords(sanitizedMetadata.keywords);
    errors.push(...keywordErrors);

    // Validate category (AC3)
    const categoryErrors = this.validateCategory(sanitizedMetadata.category);
    errors.push(...categoryErrors);

    const valid = errors.length === 0;

    // Record validation failures in metrics (AC6)
    if (!valid) {
      for (const error of errors) {
        recordMetadataValidationFailure(error.field, error.code);
      }

      logger.warn(
        {
          errorCount: errors.length,
          errors: errors.map(e => ({ field: e.field, code: e.code })),
          originalTitle: metadata.title?.substring(0, 50),
          keywordCount: metadata.keywords?.length,
          category: metadata.category,
        },
        'Metadata validation failed'
      );
    }

    return {
      valid,
      sanitizedMetadata: valid ? sanitizedMetadata : undefined,
      errors,
    };
  }

  /**
   * Sanitizes metadata by cleaning up values
   *
   * Sanitization:
   * - Trims whitespace from title and keywords
   * - Replaces commas in title with semicolons
   * - Removes empty keywords
   * - Deduplicates keywords (case-insensitive, keeps first)
   * - Normalizes category to numeric ID
   *
   * @param metadata - Raw metadata to sanitize
   * @returns Sanitized metadata
   */
  sanitize(metadata: RawAIMetadata): RawAIMetadata {
    // Handle undefined/null metadata gracefully
    if (!metadata) {
      return {
        title: '',
        keywords: [],
        category: this.categoryService.toValidCategoryId(undefined as unknown as number),
      };
    }

    // Sanitize title (AC4)
    let title = '';
    if (metadata.title != null) {
      title = String(metadata.title).trim();
      // Replace commas with semicolons to avoid CSV issues
      title = title.replace(TITLE_FORBIDDEN_CHARS, ';');
    }

    // Sanitize keywords (AC4)
    let keywords: string[] = [];
    if (Array.isArray(metadata.keywords)) {
      keywords = metadata.keywords
        // Convert to string and trim each keyword
        .map(k => (k != null ? String(k).trim() : ''))
        // Remove empty keywords
        .filter(k => k.length > 0);

      // Deduplicate keywords (case-insensitive, keep first occurrence)
      const seenKeywords = new Set<string>();
      keywords = keywords.filter(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        if (seenKeywords.has(lowerKeyword)) {
          return false;
        }
        seenKeywords.add(lowerKeyword);
        return true;
      });
    }

    // Normalize category to numeric ID (AC4)
    // Handle undefined/null category by using 0 which CategoryService will convert to default
    const rawCategory = metadata.category;
    const categoryValue = rawCategory != null ? rawCategory : 0;
    const category = this.categoryService.toValidCategoryId(categoryValue);

    logger.debug(
      {
        originalTitleLength: metadata.title?.length,
        sanitizedTitleLength: title.length,
        originalKeywordCount: metadata.keywords?.length,
        sanitizedKeywordCount: keywords.length,
        originalCategory: metadata.category,
        normalizedCategory: category,
      },
      'Metadata sanitized'
    );

    return {
      title,
      keywords,
      category,
    };
  }

  /**
   * Generates fallback metadata when validation fails
   *
   * Fallback values:
   * - Title: "Stock Photo {uuid-short}" (8 chars from file UUID)
   * - Keywords: 30 generic stock photography keywords
   * - Category: 8 (Graphic Resources)
   *
   * @param fileId - UUID of the file (for title generation)
   * @returns Valid fallback metadata
   */
  generateFallback(fileId: string): RawAIMetadata {
    // Extract first 8 characters from UUID for short identifier
    const uuidShort = (fileId || 'unknown').substring(0, 8);

    // Generate title that meets minimum length requirement (50 chars)
    // "Stock Photo " = 12 chars, need 38+ more chars
    const title = `Stock Photo ${uuidShort} - Professional Commercial Asset Image`;

    logger.info(
      {
        fileId,
        uuidShort,
        titleLength: title.length,
        keywordCount: FALLBACK_KEYWORDS.length,
        category: DEFAULT_FALLBACK_CATEGORY,
      },
      'Generated fallback metadata'
    );

    return {
      title,
      keywords: [...FALLBACK_KEYWORDS],
      category: DEFAULT_FALLBACK_CATEGORY,
    };
  }

  /**
   * Validates title field
   *
   * Rules:
   * - Must not be empty
   * - Must be 50-200 characters after trimming
   * - Must not contain commas (breaks CSV)
   *
   * @param title - Title to validate
   * @returns Array of validation errors (empty if valid)
   */
  private validateTitle(title: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for empty title
    if (!title || title.trim().length === 0) {
      errors.push({
        field: 'title',
        code: ValidationErrorCode.TITLE_EMPTY,
        message: 'Title must not be empty',
        value: title,
      });
      return errors; // No point in further validation
    }

    // Check minimum length
    if (title.length < TITLE_MIN_LENGTH) {
      errors.push({
        field: 'title',
        code: ValidationErrorCode.TITLE_TOO_SHORT,
        message: `Title must be at least ${TITLE_MIN_LENGTH} characters (got ${title.length})`,
        value: title,
      });
    }

    // Check maximum length
    if (title.length > TITLE_MAX_LENGTH) {
      errors.push({
        field: 'title',
        code: ValidationErrorCode.TITLE_TOO_LONG,
        message: `Title must be at most ${TITLE_MAX_LENGTH} characters (got ${title.length})`,
        value: title,
      });
    }

    // CR-004 Fix: Removed dead code for comma validation.
    // Commas are replaced with semicolons in sanitize() before validateTitle() is called,
    // so this check could never trigger. The sanitization approach is preferred as it
    // auto-fixes the issue rather than just rejecting the metadata.

    return errors;
  }

  /**
   * Validates keywords array
   *
   * Rules:
   * - Must have 30-50 keywords
   * - Each keyword must be 1-50 characters
   * - No empty keywords
   * - No duplicates (case-insensitive)
   *
   * @param keywords - Keywords array to validate
   * @returns Array of validation errors (empty if valid)
   */
  private validateKeywords(keywords: string[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check minimum count
    if (keywords.length < KEYWORDS_MIN_COUNT) {
      errors.push({
        field: 'keywords',
        code: ValidationErrorCode.KEYWORDS_TOO_FEW,
        message: `At least ${KEYWORDS_MIN_COUNT} keywords required (got ${keywords.length})`,
        value: keywords.length,
      });
    }

    // Check maximum count
    if (keywords.length > KEYWORDS_MAX_COUNT) {
      errors.push({
        field: 'keywords',
        code: ValidationErrorCode.KEYWORDS_TOO_MANY,
        message: `At most ${KEYWORDS_MAX_COUNT} keywords allowed (got ${keywords.length})`,
        value: keywords.length,
      });
    }

    // Check individual keywords
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];

      // Check for empty keywords (should be sanitized out, but verify)
      if (!keyword || keyword.length === 0) {
        errors.push({
          field: 'keywords',
          code: ValidationErrorCode.KEYWORD_EMPTY,
          message: `Keyword at index ${i} is empty`,
          value: keyword,
        });
      }

      // Check keyword length
      if (keyword && keyword.length > KEYWORD_MAX_LENGTH) {
        errors.push({
          field: 'keywords',
          code: ValidationErrorCode.KEYWORD_TOO_LONG,
          message: `Keyword "${keyword.substring(0, 20)}..." exceeds ${KEYWORD_MAX_LENGTH} characters`,
          value: keyword,
        });
      }
    }

    // Check for duplicates (should be sanitized out, but verify)
    const lowercaseKeywords = keywords.map(k => k.toLowerCase());
    const uniqueKeywords = new Set(lowercaseKeywords);
    if (uniqueKeywords.size !== keywords.length) {
      errors.push({
        field: 'keywords',
        code: ValidationErrorCode.KEYWORDS_DUPLICATES,
        message: 'Keywords contain duplicates',
        value: keywords.length - uniqueKeywords.size,
      });
    }

    return errors;
  }

  /**
   * Validates category field
   *
   * Rules:
   * - Must be a valid Adobe Stock category ID (1-21)
   *
   * @param category - Category ID or string to validate
   * @returns Array of validation errors (empty if valid)
   */
  private validateCategory(category: number | string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Use CategoryService for validation
    const isValid = this.categoryService.validateId(category);

    if (!isValid) {
      errors.push({
        field: 'category',
        code: ValidationErrorCode.CATEGORY_INVALID,
        message: `Invalid category ID: ${category} (must be 1-21)`,
        value: category,
      });
    }

    return errors;
  }

  /**
   * Validates and sanitizes metadata, returning either valid metadata or fallback
   *
   * This is the main entry point for metadata validation in the processing pipeline.
   * It ensures we always return valid metadata, using fallback if necessary.
   *
   * @param metadata - Raw AI-generated metadata
   * @param fileId - File identifier for fallback generation
   * @returns Valid metadata (sanitized or fallback)
   */
  validateAndSanitize(metadata: RawAIMetadata, fileId: string): RawAIMetadata {
    const result = this.validate(metadata);

    if (result.valid && result.sanitizedMetadata) {
      logger.debug({ fileId }, 'Metadata validation passed');
      return result.sanitizedMetadata;
    }

    // Log original vs fallback for debugging
    logger.warn(
      {
        fileId,
        originalTitle: metadata.title?.substring(0, 50),
        originalKeywordCount: metadata.keywords?.length,
        originalCategory: metadata.category,
        errorCount: result.errors.length,
        errors: result.errors.map(e => e.code),
      },
      'Validation failed, using fallback metadata'
    );

    return this.generateFallback(fileId);
  }
}
