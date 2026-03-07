/**
 * CSV API Routes
 * Story 4.1: CSV Generation Service (AC8)
 * Story 4.2: Instant Download Endpoint
 *
 * Handles CSV generation and download for Adobe Stock metadata export
 * - POST /api/generate-csv - Generate CSV file from metadata
 * - GET /api/download-csv/:batchId - Download CSV file by batch ID
 */

import express, { Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../middleware/error-handler';
import { ipRateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { sessionMiddleware, SessionRequest } from '../middleware/session.middleware';
import { ValidationError, NotFoundError } from '../../models/errors';
import { logger } from '../../utils/logger';
import { recordCsvDownload } from '../../utils/metrics';
import { services } from '../../config/container';
import { CSV_OUTPUT_DIR } from '../../services/csv-export.service';
import { batchTrackingService } from '../../services/batch-tracking.service';
import type { Metadata } from '../../models/metadata.model';

/**
 * Maximum number of metadata items allowed per CSV generation request.
 * Prevents memory exhaustion from oversized payloads.
 */
const MAX_METADATA_ITEMS = 1000;

/**
 * UUID v4 format regex for batchId validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router: Router = express.Router();

/**
 * Request body for CSV generation endpoint
 */
interface GenerateCsvRequest {
  metadataList: Metadata[];
  batchId?: string;
}

/**
 * POST /api/generate-csv
 * Story 4.1 AC8: Generate CSV file from processed metadata
 *
 * Creates an Adobe Stock-compliant CSV file from a list of metadata.
 * The CSV is saved to /csv_output directory with timestamp-based filename.
 *
 * @body { metadataList: Metadata[], batchId?: string }
 * @returns { success: true, csvFileName: string, csvPath: string, recordCount: number }
 * @throws ValidationError (400) if metadataList is empty or invalid
 */
router.post(
  '/generate-csv',
  ipRateLimitMiddleware,
  asyncHandler(async (req: express.Request, res: Response) => {
    const { metadataList, batchId } = req.body as GenerateCsvRequest;

    // AC7: Validate input - return user-friendly error for empty batch
    if (!metadataList || !Array.isArray(metadataList) || metadataList.length === 0) {
      logger.info({ batchId }, 'CSV generation attempted with empty metadata list');
      throw new ValidationError('No images were processed successfully', {
        code: 'EMPTY_METADATA',
        batchId,
      });
    }

    // Prevent memory exhaustion from oversized payloads
    if (metadataList.length > MAX_METADATA_ITEMS) {
      throw new ValidationError(
        `Too many items: maximum ${MAX_METADATA_ITEMS} metadata entries per request`,
        { code: 'TOO_MANY_ITEMS', count: metadataList.length, max: MAX_METADATA_ITEMS }
      );
    }

    // Validate metadata fields before CSV generation
    const validation = services.csvExport.validateMetadataList(metadataList);
    if (!validation.valid) {
      logger.info(
        { batchId, invalidItems: validation.invalidItems },
        'CSV generation attempted with invalid metadata'
      );
      throw new ValidationError('Invalid metadata: some items have missing or invalid fields', {
        code: 'INVALID_METADATA',
        invalidItems: validation.invalidItems,
      });
    }

    // AC3: Generate filename with timestamp pattern
    const timestamp = Date.now();
    const csvFileName = `adobe-stock-metadata-${timestamp}.csv`;
    const absoluteCsvPath = path.join(CSV_OUTPUT_DIR, csvFileName);

    logger.info({ csvFileName, recordCount: metadataList.length, batchId }, 'Generating CSV file');

    // Generate CSV using the service (AC1, AC2, AC4 handled by service)
    await services.csvExport.generateCSV(metadataList, absoluteCsvPath);

    const relativeCsvPath = `csv_output/${csvFileName}`;

    // AC5: Associate CSV file with batch record (if batchId provided)
    if (batchId) {
      batchTrackingService.associateCsv(batchId, relativeCsvPath, csvFileName);
    }

    logger.info(
      { csvFileName, recordCount: metadataList.length },
      'CSV file generated successfully'
    );

    res.json({
      success: true,
      csvFileName,
      csvPath: relativeCsvPath,
      recordCount: metadataList.length,
    });
  })
);

/**
 * GET /api/download-csv/:batchId
 * Story 4.2: Instant Download Endpoint (AC1, AC2, AC3, AC4, AC5, AC6, AC7)
 *
 * Downloads the CSV file associated with a completed batch.
 * Validates session ownership, batch existence, and path safety.
 *
 * @param batchId - Batch identifier (UUID)
 * @returns CSV file download with Content-Type: text/csv
 */
router.get(
  '/download-csv/:batchId',
  ipRateLimitMiddleware,
  sessionMiddleware,
  asyncHandler(async (req: SessionRequest, res: Response) => {
    const { batchId } = req.params;
    const sessionId = req.sessionId;

    if (!sessionId) {
      throw new NotFoundError('Batch not found');
    }

    // AC3: Validate batchId UUID format
    if (!batchId || !UUID_REGEX.test(batchId)) {
      throw new ValidationError('Invalid batch ID format');
    }

    // AC3: Batch must exist
    const batch = batchTrackingService.getBatch(batchId);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    // AC2: Session ownership check — return 404 (not 403) to prevent enumeration
    if (batch.sessionId !== sessionId) {
      logger.warn(
        { batchId, requestSessionId: sessionId, ownerSessionId: batch.sessionId },
        'Unauthorized download attempt: session mismatch'
      );
      throw new NotFoundError('Batch not found');
    }

    // AC3: Batch must have an associated CSV file
    if (!batch.csvPath || !batch.csvFileName) {
      throw new NotFoundError('CSV not yet generated');
    }

    // AC5: Path traversal prevention — resolve and validate
    const absoluteCsvPath = path.resolve(batch.csvPath);
    const resolvedOutputDir = path.resolve(CSV_OUTPUT_DIR);

    if (
      !absoluteCsvPath.startsWith(resolvedOutputDir + path.sep) &&
      absoluteCsvPath !== resolvedOutputDir
    ) {
      logger.error({ batchId, csvPath: batch.csvPath }, 'Path traversal attempt detected');
      throw new NotFoundError('CSV file not found');
    }

    // AC4: Check file exists on disk
    if (!fs.existsSync(absoluteCsvPath)) {
      logger.info(
        { batchId, csvFileName: batch.csvFileName },
        'CSV file expired or unavailable on disk'
      );
      throw new NotFoundError('CSV file has expired. Please reprocess your images.');
    }

    // AC1: Serve file with correct headers
    res.setHeader('Content-Type', 'text/csv');
    res.download(absoluteCsvPath, batch.csvFileName, err => {
      if (err) {
        logger.error(
          { batchId, csvFileName: batch.csvFileName, error: err.message },
          'Error sending CSV download'
        );
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: { code: 'DOWNLOAD_ERROR', message: 'Download failed' },
          });
        }
        return;
      }

      // AC6: Record download metric and log only on successful transfer
      recordCsvDownload();
      logger.info(
        { batchId, sessionId, csvFileName: batch.csvFileName, timestamp: new Date().toISOString() },
        'CSV file downloaded'
      );
    });
  })
);

export { router as csvRoutes };
