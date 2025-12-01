/**
 * Batch Tracking Service
 * Story 2.6: Processing Status & Progress Tracking
 *
 * Manages batch processing state with in-memory storage (MVP)
 * Provides real-time progress tracking for client polling
 * Implements 1-hour cleanup job for completed batches
 */

import { randomUUID } from 'crypto';
import { logger } from '@utils/logger';
import type {
  BatchState,
  BatchStatus,
  BatchImage,
  ImageStatus,
  BatchProgressCounts,
  BatchStatusResponse,
  CreateBatchOptions,
} from '@/models/batch.model';
import type { ProcessingResult } from '@/models/metadata.model';

/**
 * Service for tracking batch processing state
 * Follows SessionService pattern for consistency
 */
class BatchTrackingService {
  private batches: Map<string, BatchState> = new Map();
  private readonly BATCH_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // Start cleanup job (runs every 10 minutes)
    this.startCleanupJob();
    logger.info('BatchTrackingService initialized');
  }

  /**
   * Create a new batch for tracking
   *
   * @param options - Batch creation options
   * @returns The created batch state with batchId
   */
  createBatch(options: CreateBatchOptions): BatchState {
    const { sessionId, files } = options;
    const batchId = randomUUID();
    const now = new Date();

    // Initialize per-image tracking
    const images: BatchImage[] = files.map(file => ({
      id: file.id,
      filename: file.filename,
      status: 'pending' as ImageStatus,
    }));

    const batch: BatchState = {
      batchId,
      sessionId,
      status: 'pending',
      progress: {
        total: files.length,
        completed: 0,
        failed: 0,
        processing: 0,
        pending: files.length,
      },
      images,
      createdAt: now,
      updatedAt: now,
    };

    this.batches.set(batchId, batch);

    logger.info({ batchId, sessionId, imageCount: files.length }, 'Batch created for tracking');

    return batch;
  }

  /**
   * Get batch state by ID
   *
   * @param batchId - Batch identifier
   * @returns Batch state or null if not found
   */
  getBatch(batchId: string): BatchState | null {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return null;
    }
    return batch;
  }

  /**
   * Get batch status response for API
   *
   * @param batchId - Batch identifier
   * @returns API response format or null if not found
   */
  getBatchStatus(batchId: string): BatchStatusResponse | null {
    const batch = this.getBatch(batchId);
    if (!batch) {
      return null;
    }

    return {
      batchId: batch.batchId,
      status: batch.status,
      progress: batch.progress,
      images: batch.images.map(img => ({
        id: img.id,
        filename: img.filename,
        status: img.status,
        error: img.error,
      })),
      estimatedTimeRemaining: batch.estimatedTimeRemaining,
      createdAt: batch.createdAt.toISOString(),
    };
  }

  /**
   * Start batch processing - update status to 'processing'
   *
   * @param batchId - Batch identifier
   */
  startBatch(batchId: string): void {
    const batch = this.batches.get(batchId);
    if (!batch) {
      logger.warn({ batchId }, 'Attempted to start non-existent batch');
      return;
    }

    batch.status = 'processing';
    batch.updatedAt = new Date();

    logger.info({ batchId }, 'Batch processing started');
  }

  /**
   * Update image status within a batch
   *
   * @param batchId - Batch identifier
   * @param imageId - Image identifier
   * @param status - New image status
   * @param error - Error message (if failed)
   * @param result - Processing result (if completed)
   */
  updateImageStatus(
    batchId: string,
    imageId: string,
    status: ImageStatus,
    error?: string,
    result?: ProcessingResult
  ): void {
    const batch = this.batches.get(batchId);
    if (!batch) {
      logger.warn({ batchId, imageId }, 'Attempted to update image in non-existent batch');
      return;
    }

    const image = batch.images.find(img => img.id === imageId);
    if (!image) {
      logger.warn({ batchId, imageId }, 'Attempted to update non-existent image');
      return;
    }

    // Get previous status for progress calculation
    const previousStatus = image.status;

    // Update image
    image.status = status;
    if (error) {
      image.error = error;
    }
    if (result) {
      image.result = result;
    }

    // Update progress counts
    this.updateProgressCounts(batch, previousStatus, status);
    batch.updatedAt = new Date();

    // Check if batch is complete
    if (this.isBatchComplete(batch)) {
      this.completeBatch(batch);
    }

    logger.debug({ batchId, imageId, status, progress: batch.progress }, 'Image status updated');
  }

  /**
   * Update batch progress from ImageProcessingService callback
   *
   * @param batchId - Batch identifier
   * @param completed - Number of completed images
   * @param successful - Number of successful images
   * @param failed - Number of failed images
   * @param processing - Number of images currently processing
   * @param estimatedTimeRemaining - ETA in milliseconds
   * @param avgProcessingTimeMs - Average processing time per image
   */
  updateBatchProgress(
    batchId: string,
    completed: number,
    successful: number,
    failed: number,
    processing: number,
    estimatedTimeRemaining?: number,
    avgProcessingTimeMs?: number
  ): void {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return;
    }

    batch.progress = {
      total: batch.progress.total,
      completed: successful + failed, // Both count as "done"
      failed,
      processing,
      pending: batch.progress.total - (successful + failed) - processing,
    };

    // Convert ms to seconds for API response
    if (estimatedTimeRemaining !== undefined) {
      batch.estimatedTimeRemaining = Math.round(estimatedTimeRemaining / 1000);
    }

    batch.avgProcessingTimeMs = avgProcessingTimeMs;
    batch.updatedAt = new Date();
  }

  /**
   * Update processing result for an image by filename
   *
   * @param batchId - Batch identifier
   * @param filename - Original filename
   * @param result - Processing result
   */
  updateImageResult(batchId: string, filename: string, result: ProcessingResult): void {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return;
    }

    const image = batch.images.find(img => img.filename === filename);
    if (!image) {
      logger.warn({ batchId, filename }, 'Image not found for result update');
      return;
    }

    image.result = result;
    image.status = result.success ? 'completed' : 'failed';
    if (!result.success && result.error) {
      image.error = result.error.message;
    }

    batch.updatedAt = new Date();
  }

  /**
   * Mark an image as processing
   *
   * @param batchId - Batch identifier
   * @param filename - Original filename
   */
  markImageProcessing(batchId: string, filename: string): void {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return;
    }

    const image = batch.images.find(img => img.filename === filename);
    if (image && image.status === 'pending') {
      const previousStatus = image.status;
      image.status = 'processing';
      this.updateProgressCounts(batch, previousStatus, 'processing');
      batch.updatedAt = new Date();
    }
  }

  /**
   * Get all batches for a session
   *
   * @param sessionId - Session identifier
   * @returns Array of batch states for the session
   */
  getBatchesBySession(sessionId: string): BatchState[] {
    const sessionBatches: BatchState[] = [];
    for (const batch of this.batches.values()) {
      if (batch.sessionId === sessionId) {
        sessionBatches.push(batch);
      }
    }
    return sessionBatches;
  }

  /**
   * Delete a batch
   *
   * @param batchId - Batch identifier
   */
  deleteBatch(batchId: string): void {
    this.batches.delete(batchId);
    logger.debug({ batchId }, 'Batch deleted');
  }

  /**
   * Get total active batch count
   */
  getActiveBatchCount(): number {
    return this.batches.size;
  }

  /**
   * Check if batch belongs to session
   *
   * @param batchId - Batch identifier
   * @param sessionId - Session identifier
   * @returns True if batch belongs to session
   */
  isBatchOwnedBySession(batchId: string, sessionId: string): boolean {
    const batch = this.batches.get(batchId);
    return batch?.sessionId === sessionId;
  }

  /**
   * Update progress counts based on status transition
   */
  private updateProgressCounts(
    batch: BatchState,
    previousStatus: ImageStatus,
    newStatus: ImageStatus
  ): void {
    // Decrement previous status count
    if (previousStatus === 'pending') {
      batch.progress.pending = Math.max(0, batch.progress.pending - 1);
    } else if (previousStatus === 'processing') {
      batch.progress.processing = Math.max(0, batch.progress.processing - 1);
    }

    // Increment new status count
    if (newStatus === 'processing') {
      batch.progress.processing++;
    } else if (newStatus === 'completed') {
      batch.progress.completed++;
    } else if (newStatus === 'failed') {
      batch.progress.failed++;
    }
  }

  /**
   * Check if all images in batch are done (completed or failed)
   */
  private isBatchComplete(batch: BatchState): boolean {
    return batch.images.every(img => img.status === 'completed' || img.status === 'failed');
  }

  /**
   * Mark batch as complete
   */
  private completeBatch(batch: BatchState): void {
    const allFailed = batch.progress.failed === batch.progress.total;

    batch.status = allFailed ? 'failed' : 'completed';
    batch.completedAt = new Date();
    batch.updatedAt = new Date();
    batch.estimatedTimeRemaining = 0;

    logger.info(
      {
        batchId: batch.batchId,
        status: batch.status,
        successful: batch.progress.completed,
        failed: batch.progress.failed,
        total: batch.progress.total,
      },
      'Batch processing completed'
    );
  }

  /**
   * Start background cleanup job
   * Runs every 10 minutes to remove old completed batches
   */
  private startCleanupJob(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldBatches();
      },
      10 * 60 * 1000 // 10 minutes
    );

    logger.info('Batch cleanup job started (interval: 10 minutes)');
  }

  /**
   * Clean up batches older than 1 hour
   */
  private cleanupOldBatches(): void {
    const now = Date.now();
    const beforeCount = this.batches.size;
    let removedCount = 0;

    for (const [batchId, batch] of this.batches) {
      // Only clean up completed batches older than 1 hour
      const age = now - batch.updatedAt.getTime();
      const isExpired = age > this.BATCH_EXPIRY_MS;
      const isComplete = batch.status === 'completed' || batch.status === 'failed';

      if (isExpired && isComplete) {
        this.batches.delete(batchId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info(
        { beforeCount, afterCount: this.batches.size, removedCount },
        'Old batches cleaned up'
      );
    }
  }

  /**
   * Stop cleanup job (for graceful shutdown)
   */
  stopCleanupJob(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      logger.info('Batch cleanup job stopped');
    }
  }

  /**
   * Clear all batches (for testing)
   */
  clearAll(): void {
    this.batches.clear();
    logger.debug('All batches cleared');
  }
}

// Singleton instance
export const batchTrackingService = new BatchTrackingService();
