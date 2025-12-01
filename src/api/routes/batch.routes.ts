/**
 * Batch API Routes
 * Story 2.6: Processing Status & Progress Tracking
 *
 * Handles batch processing status tracking and process initiation
 * - GET /api/batch-status/:batchId - Get batch processing status
 * - POST /api/process-batch-v2 - Start batch processing (new endpoint using file IDs)
 */

import express, { Response, Router } from 'express';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../middleware/error-handler';
import { ValidationError, NotFoundError } from '../../models/errors';
import { logger } from '../../utils/logger';
import { config } from '../../config/app.config';
import { sessionMiddleware, SessionRequest } from '../middleware/session.middleware';
import { batchTrackingService } from '../../services/batch-tracking.service';
import { services } from '../../config/container';
import type { ProcessBatchRequest } from '../../models/batch.model';

const router: Router = express.Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/**
 * GET /api/batch-status/:batchId
 * Story 2.6 AC1, AC2, AC3, AC4, AC5: Get batch processing status
 *
 * Returns real-time progress information for a processing batch
 * Client should poll every 2 seconds during processing
 *
 * @param batchId - Batch identifier (UUID)
 * @returns BatchStatusResponse with progress and per-image status
 */
router.get(
  '/batch-status/:batchId',
  sessionMiddleware,
  asyncHandler(async (req: SessionRequest, res: Response) => {
    const { batchId } = req.params;
    const sessionId = req.sessionId!;

    // Validate batchId format (UUID)
    if (
      !batchId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchId)
    ) {
      throw new ValidationError('Invalid batch ID format');
    }

    // Get batch status
    const batchStatus = batchTrackingService.getBatchStatus(batchId);

    if (!batchStatus) {
      throw new NotFoundError('Batch not found', { batchId });
    }

    // Verify session ownership (security check)
    if (!batchTrackingService.isBatchOwnedBySession(batchId, sessionId)) {
      throw new NotFoundError('Batch not found', { batchId });
    }

    req.log.debug(
      {
        batchId,
        status: batchStatus.status,
        progress: batchStatus.progress,
      },
      'Batch status requested'
    );

    res.json(batchStatus);
  })
);

/**
 * POST /api/process-batch-v2
 * Story 2.6 AC8: Start batch processing with file IDs from upload
 *
 * Takes file IDs from upload response and initiates processing
 * Returns batchId for status tracking
 *
 * @body { fileIds: string[] } - Array of file IDs from upload
 * @returns { success: true, batchId: string }
 */
router.post(
  '/process-batch-v2',
  sessionMiddleware,
  asyncHandler(async (req: SessionRequest, res: Response) => {
    const sessionId = req.sessionId!;
    const { fileIds } = req.body as ProcessBatchRequest;

    // Validate request
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new ValidationError('fileIds array is required and must not be empty');
    }

    if (fileIds.length > 10) {
      throw new ValidationError('Maximum 10 files can be processed at once');
    }

    req.log.info({ fileIds: fileIds.length, sessionId }, 'Starting batch processing');

    // Validate files exist and build file list
    const files: Array<{ id: string; filename: string; path: string }> = [];
    const missingFiles: string[] = [];

    for (const fileId of fileIds) {
      const filePath = path.join(UPLOADS_DIR, fileId);

      if (!fs.existsSync(filePath)) {
        missingFiles.push(fileId);
        continue;
      }

      // Extract original filename from fileId (format: uuid-originalname)
      const parts = fileId.split('-');
      // UUID is first 5 parts (8-4-4-4-12), rest is original name
      const originalName = parts.slice(5).join('-') || fileId;

      files.push({
        id: fileId,
        filename: originalName,
        path: filePath,
      });
    }

    if (missingFiles.length > 0) {
      throw new ValidationError(
        `Files not found: ${missingFiles.join(', ')}. Files may have expired or been processed already.`
      );
    }

    // Create batch for tracking
    const batch = batchTrackingService.createBatch({
      sessionId,
      files: files.map(f => ({ id: f.id, filename: f.filename })),
    });

    req.log.info({ batchId: batch.batchId, fileCount: files.length }, 'Batch created');

    // Start processing asynchronously
    // Don't await - return immediately with batchId
    processFilesAsync(batch.batchId, files, req.log);

    res.json({
      success: true,
      batchId: batch.batchId,
      message: `Processing started for ${files.length} file(s). Poll /api/batch-status/${batch.batchId} for progress.`,
    });
  })
);

/**
 * Process files asynchronously and update batch tracking
 * This runs in the background after the endpoint returns
 */
async function processFilesAsync(
  batchId: string,
  files: Array<{ id: string; filename: string; path: string }>,
  log: typeof logger
): Promise<void> {
  try {
    // Mark batch as processing
    batchTrackingService.startBatch(batchId);

    // Create Multer-like file objects for ImageProcessingService
    // Use lazy buffer loading to avoid loading all files into memory at once
    // Only files actively being processed (up to concurrency limit) will have buffers in memory
    const multerFiles: Express.Multer.File[] = files.map(f => {
      const stats = fs.statSync(f.path);
      const fileObj = {
        fieldname: 'image',
        originalname: f.filename,
        encoding: '7bit',
        mimetype: getMimeType(f.filename),
        size: stats.size,
        destination: UPLOADS_DIR,
        filename: f.id,
        path: f.path,
      } as Express.Multer.File;

      // Lazy buffer loading - only read file when buffer is actually accessed
      // This ensures only concurrent files (p-limit: 5) have buffers in memory
      let cachedBuffer: Buffer | undefined;
      Object.defineProperty(fileObj, 'buffer', {
        get: () => {
          if (!cachedBuffer) {
            cachedBuffer = fs.readFileSync(f.path);
          }
          return cachedBuffer;
        },
        enumerable: true,
        configurable: true,
      });

      return fileObj;
    });

    // Process batch with progress callback
    const results = await services.imageProcessing.processBatch(multerFiles, {
      concurrency: config.processing.concurrencyLimit,
      continueOnError: true,
      timeoutMs: 30000,
      retryAttempts: 1,
      onProgress: progress => {
        // Update batch tracking with progress
        batchTrackingService.updateBatchProgress(
          batchId,
          progress.completed,
          progress.successful,
          progress.failed,
          progress.processing,
          progress.estimatedTimeRemaining,
          progress.avgProcessingTimeMs
        );

        // Update individual image status from results
        for (const result of progress.results) {
          batchTrackingService.updateImageResult(batchId, result.filename, result);
        }

        // Mark currently processing file
        if (progress.currentFile) {
          batchTrackingService.markImageProcessing(batchId, progress.currentFile);
        }
      },
    });

    // Update final results for all images
    for (const result of results) {
      batchTrackingService.updateImageResult(batchId, result.filename, result);
    }

    log.info(
      {
        batchId,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total: results.length,
      },
      'Batch processing completed'
    );

    // Clean up uploaded files after processing
    for (const file of files) {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (error) {
        log.warn({ filePath: file.path, error }, 'Failed to cleanup uploaded file');
      }
    }
  } catch (error) {
    log.error(
      { batchId, error: error instanceof Error ? error.message : 'Unknown' },
      'Batch processing failed'
    );

    // Mark batch as failed
    const batch = batchTrackingService.getBatch(batchId);
    if (batch) {
      // Update all pending images as failed
      for (const image of batch.images) {
        if (image.status === 'pending' || image.status === 'processing') {
          batchTrackingService.updateImageStatus(
            batchId,
            image.id,
            'failed',
            error instanceof Error ? error.message : 'Processing failed'
          );
        }
      }
    }
  }
}

/**
 * Get MIME type from filename extension
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export default router;
