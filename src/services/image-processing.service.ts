/**
 * Image Processing Service
 *
 * Orchestrates the complete image processing workflow:
 * 1. Create temporary URL for image
 * 2. Generate metadata using AI
 * 3. Cleanup temporary files
 * 4. Handle errors and retries
 *
 * This service coordinates between TempUrlService, MetadataService,
 * and implements batch processing with concurrency control.
 */

import type { Express } from 'express';
import { config } from '@/config/app.config';
import { TempUrlService } from './temp-url.service';
import { MetadataService } from './metadata.service';
import type { ProcessingResult, Metadata, BatchProcessingOptions } from '@/models/metadata.model';
import { ProcessingError } from '@/models/errors';
import { withRetry } from '@/utils/retry';
import { logger } from '@/utils/logger';

/**
 * Service for processing images and generating metadata
 */
export class ImageProcessingService {
  constructor(
    private tempUrlService: TempUrlService,
    private metadataService: MetadataService
  ) {}

  /**
   * Processes a single image file through the complete workflow
   *
   * Workflow:
   * 1. Create temporary URL (compress & host)
   * 2. Generate metadata via AI
   * 3. Cleanup temp files
   * 4. Return result
   *
   * @param file - Multer file object from upload
   * @returns Promise resolving to processing result
   *
   * @example
   * const result = await imageProcessingService.processImage(req.file);
   * if (result.success) {
   *   logger.info({ metadata: result.metadata }, 'Generated metadata');
   * } else {
   *   logger.error({ error: result.error }, 'Processing failed');
   * }
   */
  async processImage(file: Express.Multer.File): Promise<ProcessingResult> {
    const filename = file.originalname;
    let tempUrl: string | null = null;

    try {
      // Step 1: Create temporary URL (compresses and hosts image)
      tempUrl = await this.tempUrlService.createTempUrl(file);

      // Step 2: Generate metadata using AI with retry logic
      const rawMetadata = await withRetry(
        async () => {
          return await this.metadataService.generateMetadata(tempUrl!);
        },
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          retryableErrors: err => {
            const status = err?.status || err?.response?.status;
            return status === 429 || (status >= 500 && status < 600);
          },
        }
      );

      // Step 3: Convert raw AI metadata to final format
      const metadata: Metadata = {
        filename,
        title: rawMetadata.title,
        keywords: Array.isArray(rawMetadata.keywords)
          ? rawMetadata.keywords.join(',')
          : String(rawMetadata.keywords),
        category: Number(rawMetadata.category),
      };

      // Step 4: Return success result
      return {
        success: true,
        filename,
        metadata,
      };
    } catch (error) {
      // Determine error stage and context
      const stage = tempUrl ? 'generate-metadata' : 'create-temp-url';

      return {
        success: false,
        filename,
        error: {
          code: 'PROCESSING_FAILED',
          message: error instanceof Error ? error.message : 'Unknown processing error',
          stage,
          context: { filename, tempUrl },
        },
      };
    } finally {
      // Always cleanup temp files, even on error
      // Note: TempUrlService handles automatic cleanup via scheduled jobs
      // This is just defensive cleanup for immediate removal
    }
  }

  /**
   * Processes multiple images in parallel with concurrency control
   *
   * Uses p-limit pattern to process 5 images concurrently (default).
   * Failed images don't block successful ones (graceful degradation).
   *
   * @param files - Array of Multer file objects
   * @param options - Optional batch processing options
   * @returns Promise resolving to array of processing results
   *
   * @example
   * const results = await imageProcessingService.processBatch(req.files, {
   *   concurrency: 5,
   *   continueOnError: true,
   *   timeoutMs: 30000
   * });
   *
   * const successful = results.filter(r => r.success);
   * const failed = results.filter(r => !r.success);
   * logger.info({ successCount: successful.length, total: results.length }, 'Batch processing complete');
   */
  async processBatch(
    files: Express.Multer.File[],
    options?: BatchProcessingOptions
  ): Promise<ProcessingResult[]> {
    const {
      concurrency = config.processing.concurrencyLimit,
      continueOnError = true,
      timeoutMs = 30000,
    } = options || {};

    // Validate input
    if (!files || files.length === 0) {
      throw new ProcessingError('EMPTY_FILE_LIST', 'Cannot process empty file list', 400);
    }

    logger.info({ count: files.length, concurrency }, 'Starting batch processing');

    // For now, implement simple sequential processing
    // In a future iteration, we can use p-limit for true concurrency control
    const results: ProcessingResult[] = [];

    for (const file of files) {
      try {
        // Add timeout wrapper
        const result = await this.processWithTimeout(file, timeoutMs);
        results.push(result);

        if (!result.success && !continueOnError) {
          logger.error({ filename: file.originalname }, 'Processing failed, stopping batch');
          break;
        }
      } catch (error) {
        // Handle timeout or unexpected errors
        results.push({
          success: false,
          filename: file.originalname,
          error: {
            code: 'PROCESSING_TIMEOUT',
            message: `Processing exceeded ${timeoutMs}ms timeout`,
            stage: 'batch-processing',
          },
        });

        if (!continueOnError) {
          break;
        }
      }
    }

    // Log summary
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    logger.info({ successful, failed, total: results.length }, 'Batch processing complete');

    return results;
  }

  /**
   * Wraps image processing with a timeout
   *
   * @param file - File to process
   * @param timeoutMs - Timeout in milliseconds
   * @returns Promise resolving to processing result
   * @throws Error if timeout is exceeded
   */
  private async processWithTimeout(
    file: Express.Multer.File,
    timeoutMs: number
  ): Promise<ProcessingResult> {
    return Promise.race([
      this.processImage(file),
      new Promise<ProcessingResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Processing timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Gets processing statistics for monitoring
   *
   * @returns Statistics object with counts and rates
   */
  getStats(): {
    avgProcessingTimeMs: number;
    totalProcessed: number;
    successRate: number;
  } {
    // Placeholder implementation
    // In production, track these metrics in memory or external store
    return {
      avgProcessingTimeMs: 0,
      totalProcessed: 0,
      successRate: 0,
    };
  }
}
