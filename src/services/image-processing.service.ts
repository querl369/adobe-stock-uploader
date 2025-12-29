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
 *
 * Story 2.5: Parallel Processing Orchestration
 * - Uses p-limit for 5 concurrent operations (configurable)
 * - Progress tracking via callback
 * - Error recovery with single retry
 * - 30s timeout per image
 */

import type { Express } from 'express';
import pLimit from 'p-limit';
import { config } from '@/config/app.config';
import { TempUrlService } from './temp-url.service';
import { MetadataService } from './metadata.service';
import type {
  ProcessingResult,
  Metadata,
  BatchProcessingOptions,
  BatchProgress,
} from '@/models/metadata.model';
import { ProcessingError } from '@/models/errors';
import { withRetry } from '@/utils/retry';
import { logger } from '@/utils/logger';
import { recordImageSuccess, recordImageFailure, recordTempUrlCreation } from '@/utils/metrics';
import { getUserFriendlyErrorForException } from '@/utils/error-messages';
import {
  classifyOpenAIError,
  isRetryableOpenAIError,
  OpenAIErrorType,
} from '@/utils/openai-error-classifier';

/**
 * Internal state for tracking batch processing
 * Story 2.5: Progress tracking
 */
interface BatchState {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  processing: number;
  results: ProcessingResult[];
  processingTimes: number[];
  startTime: number;
}

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
    const startTime = Date.now();

    try {
      // Step 1: Create temporary URL (compresses and hosts image)
      const tempUrlStart = Date.now();
      tempUrl = await this.tempUrlService.createTempUrl(file);
      const tempUrlDuration = (Date.now() - tempUrlStart) / 1000;
      recordTempUrlCreation(tempUrlDuration);

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

      // Step 4: Record success metrics and return result
      const totalDuration = (Date.now() - startTime) / 1000;
      recordImageSuccess(totalDuration);

      return {
        success: true,
        filename,
        metadata,
      };
    } catch (error) {
      // Determine error stage and context
      const stage = tempUrl ? 'generate-metadata' : 'create-temp-url';

      // Record failure metrics
      recordImageFailure(stage);

      // Story 3.5: Classify error for retry decisions
      const errorType = classifyOpenAIError(error);
      const isRecoverable = isRetryableOpenAIError(errorType);

      // Story 3.5 (AC4): Log detailed technical error for debugging
      logger.error(
        {
          filename,
          stage,
          tempUrl: tempUrl?.substring(0, 50),
          technicalError: error instanceof Error ? error.message : String(error),
          errorType,
          isRecoverable,
        },
        'Image processing failed'
      );

      // AC4: Include context for debugging, AC7: Use user-friendly message
      // Include errorType for retry recovery decisions in batch processing
      return {
        success: false,
        filename,
        error: {
          code: 'PROCESSING_FAILED',
          message: getUserFriendlyErrorForException(error),
          stage,
          context: { filename, tempUrl },
          // Story 3.5: Include error type for recovery decisions
          errorType,
          isRecoverable,
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
   * Story 2.5: Parallel Processing Orchestration
   * - Uses p-limit for configurable concurrent operations (default: 5)
   * - Failed images don't block successful ones (graceful degradation)
   * - Progress updates via onProgress callback
   * - Error recovery with single retry for recoverable errors
   * - 30s timeout per image (configurable)
   *
   * @param files - Array of Multer file objects
   * @param options - Optional batch processing options
   * @returns Promise resolving to array of processing results
   *
   * @example
   * const results = await imageProcessingService.processBatch(req.files, {
   *   concurrency: 5,
   *   continueOnError: true,
   *   timeoutMs: 30000,
   *   retryAttempts: 1,
   *   onProgress: (progress) => {
   *     console.log(`Processed ${progress.completed}/${progress.total}`);
   *   }
   * });
   *
   * const successful = results.filter(r => r.success);
   * const failed = results.filter(r => !r.success);
   */
  async processBatch(
    files: Express.Multer.File[],
    options?: BatchProcessingOptions
  ): Promise<ProcessingResult[]> {
    const {
      concurrency = config.processing.concurrencyLimit,
      continueOnError = true,
      timeoutMs = 30000,
      retryAttempts = 1,
      onProgress,
    } = options || {};

    // Validate input
    if (!files || files.length === 0) {
      throw new ProcessingError('EMPTY_FILE_LIST', 'Cannot process empty file list', 400);
    }

    logger.info(
      { count: files.length, concurrency, timeoutMs, retryAttempts },
      'Starting parallel batch processing'
    );

    // Story 2.5: Initialize batch state for progress tracking
    const state: BatchState = {
      total: files.length,
      completed: 0,
      successful: 0,
      failed: 0,
      processing: 0,
      results: [],
      processingTimes: [],
      startTime: Date.now(),
    };

    // Story 2.5: Create concurrency limiter with p-limit
    const limit = pLimit(concurrency);

    // Report initial progress
    this.reportProgress(state, onProgress);

    // Story 2.5: Create parallel tasks with concurrency control
    const tasks = files.map((file, index) =>
      limit(async () => {
        // Track that this image is now processing
        state.processing++;
        this.reportProgress(state, onProgress, file.originalname);

        const imageStartTime = Date.now();
        let result: ProcessingResult;

        try {
          // Story 2.5: Process with retry and timeout
          result = await this.processWithRetryAndTimeout(file, timeoutMs, retryAttempts);
        } catch (error) {
          // Handle unexpected errors (shouldn't happen, but safety net)
          result = {
            success: false,
            filename: file.originalname,
            error: {
              code: 'UNEXPECTED_ERROR',
              message: error instanceof Error ? error.message : 'Unexpected processing error',
              stage: 'batch-processing',
            },
          };
        }

        // Track processing time for ETA calculation
        const processingTime = Date.now() - imageStartTime;
        state.processingTimes.push(processingTime);

        // Update state
        state.processing--;
        state.completed++;
        state.results.push(result);

        if (result.success) {
          state.successful++;
        } else {
          state.failed++;
        }

        // Report progress after completion
        this.reportProgress(state, onProgress, undefined);

        logger.debug(
          {
            filename: file.originalname,
            success: result.success,
            processingTimeMs: processingTime,
            completed: state.completed,
            total: state.total,
          },
          'Image processing completed'
        );

        return result;
      })
    );

    // Story 2.5: Execute all tasks in parallel (respecting concurrency limit)
    const results = await Promise.all(tasks);

    // Log final summary
    const totalDuration = Date.now() - state.startTime;
    const avgTimePerImage =
      state.processingTimes.length > 0
        ? Math.round(
            state.processingTimes.reduce((a, b) => a + b, 0) / state.processingTimes.length
          )
        : 0;

    logger.info(
      {
        successful: state.successful,
        failed: state.failed,
        total: state.total,
        totalDurationMs: totalDuration,
        avgTimePerImageMs: avgTimePerImage,
        concurrency,
        speedupVsSequential:
          avgTimePerImage > 0
            ? ((avgTimePerImage * state.total) / totalDuration).toFixed(2) + 'x'
            : 'N/A',
      },
      'Parallel batch processing complete'
    );

    return results;
  }

  /**
   * Processes a single image with retry and timeout
   *
   * Story 2.5: Error recovery and timeout handling
   * - Retries recoverable errors (network, 5xx, 429) up to retryAttempts times
   * - Enforces timeout per image (default 30s)
   * - Returns failure result instead of throwing on timeout/exhausted retries
   *
   * @param file - File to process
   * @param timeoutMs - Timeout in milliseconds
   * @param retryAttempts - Number of retry attempts for recoverable errors
   * @returns Promise resolving to processing result
   */
  private async processWithRetryAndTimeout(
    file: Express.Multer.File,
    timeoutMs: number,
    retryAttempts: number
  ): Promise<ProcessingResult> {
    const filename = file.originalname;
    let lastError: Error | undefined;

    // Story 2.5: Retry loop for error recovery
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        // Story 2.5: Timeout handling with Promise.race
        const result = await Promise.race([
          this.processImage(file),
          this.createTimeoutPromise(timeoutMs, filename),
        ]);

        // If we got a result (success or failure from processImage), return it
        // Note: processImage never throws, it returns { success: false } on error
        if (result.success || !this.isRecoverableError(result.error)) {
          // Success or non-recoverable error - don't retry
          return result;
        }

        // Recoverable error - try again if we have attempts left
        if (attempt < retryAttempts) {
          logger.warn(
            {
              filename,
              attempt: attempt + 1,
              maxAttempts: retryAttempts + 1,
              error: result.error?.message,
            },
            'Recoverable error, retrying image processing'
          );

          // Brief delay before retry
          await this.delay(1000 * (attempt + 1)); // 1s, 2s, etc.
          continue;
        }

        // Out of retries
        return result;
      } catch (error) {
        // This catches timeout errors from Promise.race
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retryAttempts && this.isRecoverableException(lastError)) {
          logger.warn(
            {
              filename,
              attempt: attempt + 1,
              maxAttempts: retryAttempts + 1,
              error: lastError.message,
            },
            'Caught exception, retrying image processing'
          );

          await this.delay(1000 * (attempt + 1));
          continue;
        }
      }
    }

    // All retries exhausted
    // Story 3.5 (AC4): Log detailed technical error for debugging
    logger.warn(
      {
        filename,
        retriesAttempted: retryAttempts,
        technicalError: lastError?.message,
      },
      'All retries exhausted for image processing'
    );

    // AC4: Include context for debugging, AC7: Use user-friendly message
    return {
      success: false,
      filename,
      error: {
        code: 'PROCESSING_FAILED',
        message: lastError
          ? getUserFriendlyErrorForException(lastError)
          : 'Processing failed - please try again',
        stage: 'batch-processing',
        context: { retriesAttempted: retryAttempts },
        isRecoverable: false, // All retries exhausted, no more recovery possible
      },
    };
  }

  /**
   * Creates a timeout promise for use with Promise.race
   *
   * Story 2.5: Timeout handling (30s max per image)
   *
   * @param timeoutMs - Timeout in milliseconds
   * @param filename - Filename for error context
   * @returns Promise that rejects after timeout
   */
  private createTimeoutPromise(timeoutMs: number, filename: string): Promise<ProcessingResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Processing timeout after ${timeoutMs}ms for ${filename}`));
      }, timeoutMs);
    });
  }

  /**
   * Checks if a processing error is recoverable (should retry)
   *
   * Story 2.5: Error recovery
   * Story 3.5: Enhanced error classification
   * Recoverable: network issues, server errors (5xx), rate limits (429)
   * Not recoverable: validation errors, auth errors, corrupted files
   *
   * @param error - Processing error to check
   * @returns true if error is recoverable
   */
  private isRecoverableError(error?: {
    code?: string;
    message?: string;
    stage?: string;
    isRecoverable?: boolean;
    errorType?: string;
  }): boolean {
    if (!error) return false;

    // Story 3.5: Use pre-classified recoverability if available
    if (typeof error.isRecoverable === 'boolean') {
      return error.isRecoverable;
    }

    // Fallback to pattern matching for backward compatibility
    const recoverableCodes = ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR', 'RATE_LIMITED'];
    const recoverablePatterns = [
      /timeout/i,
      /network/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /429/,
      /5\d{2}/,
    ];

    if (recoverableCodes.includes(error.code || '')) {
      return true;
    }

    const message = error.message || '';
    return recoverablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Checks if an exception is recoverable
   *
   * @param error - Exception to check
   * @returns true if exception is recoverable
   */
  private isRecoverableException(error: Error): boolean {
    const message = error.message || '';
    const recoverablePatterns = [/timeout/i, /network/i, /ECONNRESET/i, /ETIMEDOUT/i];
    return recoverablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Reports progress to the onProgress callback
   *
   * Story 2.5: Progress tracking
   *
   * @param state - Current batch state
   * @param onProgress - Optional progress callback
   * @param currentFile - Currently processing file (if any)
   */
  private reportProgress(
    state: BatchState,
    onProgress?: (progress: BatchProgress) => void,
    currentFile?: string
  ): void {
    if (!onProgress) return;

    // Calculate average processing time and ETA
    const avgProcessingTimeMs =
      state.processingTimes.length > 0
        ? Math.round(
            state.processingTimes.reduce((a, b) => a + b, 0) / state.processingTimes.length
          )
        : 0;

    const remaining = state.total - state.completed;
    const estimatedTimeRemaining =
      avgProcessingTimeMs > 0
        ? Math.round((remaining * avgProcessingTimeMs) / Math.max(1, state.processing || 1))
        : undefined;

    const progress: BatchProgress = {
      total: state.total,
      completed: state.completed,
      successful: state.successful,
      failed: state.failed,
      processing: state.processing,
      pending: state.total - state.completed - state.processing,
      currentFile,
      estimatedTimeRemaining,
      avgProcessingTimeMs: avgProcessingTimeMs || undefined,
      results: [...state.results], // Copy to prevent mutation
    };

    try {
      onProgress(progress);
    } catch (error) {
      logger.warn({ error }, 'Error in onProgress callback');
    }
  }

  /**
   * Delay utility for retry backoff
   *
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wraps image processing with a timeout (legacy method for backwards compatibility)
   *
   * @param file - File to process
   * @param timeoutMs - Timeout in milliseconds
   * @returns Promise resolving to processing result
   * @throws Error if timeout is exceeded
   * @deprecated Use processWithRetryAndTimeout instead
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
