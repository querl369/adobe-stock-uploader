/**
 * Metadata Models
 *
 * Defines TypeScript interfaces for image metadata and processing results.
 * These models are used throughout the application for type safety and consistency.
 */

import { z } from 'zod';

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

  /**
   * Number of retry attempts for failed images (recoverable errors only)
   * Story 2.5: Error recovery with retry
   * @default 1
   */
  retryAttempts?: number;

  /**
   * Callback for progress updates during batch processing
   * Story 2.5: Progress tracking support
   * @param progress - Current batch progress state
   */
  onProgress?: (progress: BatchProgress) => void;
}

/**
 * Progress state for batch processing
 * Story 2.5: Real-time progress tracking
 */
export interface BatchProgress {
  /**
   * Total number of images in the batch
   */
  total: number;

  /**
   * Number of images completed (success + failed)
   */
  completed: number;

  /**
   * Number of successfully processed images
   */
  successful: number;

  /**
   * Number of failed images
   */
  failed: number;

  /**
   * Number of images currently being processed
   */
  processing: number;

  /**
   * Number of images waiting to be processed
   */
  pending: number;

  /**
   * Name of the current file being processed (if any)
   */
  currentFile?: string;

  /**
   * Estimated time remaining in milliseconds
   */
  estimatedTimeRemaining?: number;

  /**
   * Average processing time per image in milliseconds
   */
  avgProcessingTimeMs?: number;

  /**
   * Results for completed images (available so far)
   */
  results: ProcessingResult[];
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

/**
 * Zod schema for validating raw AI metadata responses (AC5)
 *
 * Handles flexible AI responses:
 * - title: Must be non-empty string
 * - keywords: Can be array of strings OR comma-separated string (transformed to array)
 * - category: Can be number OR string (e.g., "1045" or 1045)
 *
 * @example
 * const result = rawAIMetadataSchema.safeParse(aiResponse);
 * if (!result.success) throw new Error('Invalid AI response');
 */
export const rawAIMetadataSchema = z.object({
  title: z
    .string({ message: 'title field is required' })
    .min(1, 'title must be a non-empty string'),

  keywords: z
    .union([
      z.array(z.string()).min(1, 'keywords array must not be empty'),
      z.string().min(1, 'keywords string must not be empty'),
    ])
    .transform(val => {
      // Transform comma-separated string to array if needed
      if (typeof val === 'string') {
        return val
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0);
      }
      return val;
    }),

  category: z.union([
    z.number(),
    z.string().min(1, 'category must be a non-empty string or number'),
  ]),
});

/**
 * Type inferred from Zod schema for type-safe validation results
 */
export type ValidatedRawAIMetadata = z.infer<typeof rawAIMetadataSchema>;
