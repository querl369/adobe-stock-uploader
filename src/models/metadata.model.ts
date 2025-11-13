/**
 * Metadata Models
 *
 * Defines TypeScript interfaces for image metadata and processing results.
 * These models are used throughout the application for type safety and consistency.
 */

/**
 * Image metadata structure for Adobe Stock CSV export
 *
 * All fields follow Adobe Stock requirements:
 * - Filename: Original image filename
 * - Title: 50-200 characters, descriptive
 * - Keywords: Array of 30-50 relevant terms
 * - Category: Adobe Stock category ID
 * - Releases: Optional model/property release information
 */
export interface Metadata {
  /**
   * Original filename of the image
   * @example "IMG_OY_20250323_1.jpg"
   */
  filename: string;

  /**
   * Descriptive title for the image (50-200 characters)
   * @example "Beautiful sunset over mountains with dramatic clouds"
   */
  title: string;

  /**
   * Comma-separated keywords for searchability
   * @example "sunset,mountains,landscape,nature,sky,clouds"
   */
  keywords: string;

  /**
   * Adobe Stock category ID
   * @example 1045
   */
  category: number;

  /**
   * Optional release information (model/property releases)
   * @example "Model Released"
   */
  releases?: string;
}

/**
 * Result of processing a single image
 *
 * Includes success/failure status, metadata if successful,
 * and error information if failed. Used for batch processing
 * where some images may succeed and others may fail.
 */
export interface ProcessingResult {
  /**
   * Whether the processing was successful
   */
  success: boolean;

  /**
   * Original filename that was processed
   */
  filename: string;

  /**
   * Generated metadata (only present if success = true)
   */
  metadata?: Metadata;

  /**
   * Error information (only present if success = false)
   */
  error?: ProcessingError;
}

/**
 * Detailed error information for failed processing
 */
export interface ProcessingError {
  /**
   * Error code for categorization
   */
  code: string;

  /**
   * User-friendly error message
   */
  message: string;

  /**
   * Processing stage where error occurred
   * @example "compress" | "generate-metadata" | "validate"
   */
  stage?: string;

  /**
   * Additional context for debugging
   */
  context?: Record<string, any>;
}

/**
 * Options for batch processing
 */
export interface BatchProcessingOptions {
  /**
   * Maximum number of concurrent processing operations
   * @default 5
   */
  concurrency?: number;

  /**
   * Whether to continue processing other images if one fails
   * @default true
   */
  continueOnError?: boolean;

  /**
   * Timeout in milliseconds for each image processing
   * @default 30000 (30 seconds)
   */
  timeoutMs?: number;
}

/**
 * Raw metadata response from AI service
 * This is the structure returned by OpenAI before conversion to Metadata
 */
export interface RawAIMetadata {
  title: string;
  keywords: string[];
  category: number | string;
}
