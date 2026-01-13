/**
 * CSV API Routes
 * Story 4.1: CSV Generation Service (AC8)
 *
 * Handles CSV generation for Adobe Stock metadata export
 * - POST /api/generate-csv - Generate CSV file from metadata
 */

import express, { Response, Router } from 'express';
import path from 'path';
import { asyncHandler } from '../middleware/error-handler';
import { ValidationError } from '../../models/errors';
import { logger } from '../../utils/logger';
import { services } from '../../config/container';
import type { Metadata } from '../../models/metadata.model';

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

    // AC3: Generate filename with timestamp pattern
    const timestamp = Date.now();
    const csvFileName = `adobe-stock-metadata-${timestamp}.csv`;
    const csvPath = path.join('csv_output', csvFileName);

    logger.info(
      { csvFileName, recordCount: metadataList.length, batchId },
      'Generating CSV file'
    );

    // Generate CSV using the service (AC1, AC2, AC4 handled by service)
    await services.csvExport.generateCSV(metadataList, csvPath);

    // AC5: Return CSV path and filename for batch association
    logger.info(
      { csvFileName, csvPath, recordCount: metadataList.length },
      'CSV file generated successfully'
    );

    res.json({
      success: true,
      csvFileName,
      csvPath,
      recordCount: metadataList.length,
    });
  })
);

export { router as csvRoutes };
