/**
 * CSV Export Service
 *
 * Handles generation of Adobe Stock-compliant CSV files from metadata.
 * Follows RFC 4180 CSV format with proper escaping and UTF-8 encoding.
 */

import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs/promises';
import path from 'path';
import type { Metadata } from '@/models/metadata.model';
import { ProcessingError } from '@/models/errors';
import { logger } from '@/utils/logger';
import { recordCsvExport } from '@/utils/metrics';

/**
 * Default max age for CSV cleanup (24 hours in milliseconds)
 */
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * CSV output directory
 */
const CSV_OUTPUT_DIR = 'csv_output';

/**
 * Service for exporting metadata to CSV files
 */
export class CsvExportService {
  /**
   * Generates a CSV file from a list of metadata objects
   *
   * Creates an Adobe Stock-compliant CSV with columns:
   * - Filename
   * - Title
   * - Keywords
   * - Category
   * - Releases
   *
   * The CSV is UTF-8 encoded and follows RFC 4180 format.
   *
   * @param metadataList - Array of metadata objects to export
   * @param outputPath - Absolute path where CSV file should be saved
   * @throws ProcessingError if CSV generation fails
   *
   * @example
   * const metadataList = [
   *   { filename: 'image1.jpg', title: 'Sunset', keywords: 'sunset,sky', category: 1045 },
   *   { filename: 'image2.jpg', title: 'Mountain', keywords: 'mountain,peak', category: 1045 }
   * ];
   * await csvExportService.generateCSV(metadataList, '/path/to/output.csv');
   */
  async generateCSV(metadataList: Metadata[], outputPath: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate input
      if (!metadataList || metadataList.length === 0) {
        throw new ProcessingError(
          'EMPTY_METADATA_LIST',
          'Cannot generate CSV: metadata list is empty',
          500,
          { outputPath }
        );
      }

      // Create CSV writer with Adobe Stock column structure
      const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: [
          { id: 'filename', title: 'Filename' },
          { id: 'title', title: 'Title' },
          { id: 'keywords', title: 'Keywords' },
          { id: 'category', title: 'Category' },
          { id: 'releases', title: 'Releases' },
        ],
      });

      // Write metadata to CSV file
      await csvWriter.writeRecords(metadataList);

      // Record metrics for CSV export
      const duration = (Date.now() - startTime) / 1000;
      recordCsvExport(duration, metadataList.length);

      logger.info(
        { outputPath, recordCount: metadataList.length },
        'Metadata successfully written to CSV'
      );
    } catch (error) {
      // Wrap filesystem errors in ProcessingError
      if (error instanceof ProcessingError) {
        throw error;
      }

      throw new ProcessingError('CSV_GENERATION_FAILED', 'Failed to generate CSV file', 500, {
        outputPath,
        recordCount: metadataList.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Validates that a metadata object is CSV-exportable
   *
   * Checks for:
   * - Required fields (filename, title, keywords, category)
   * - Valid data types
   * - No empty required values
   *
   * @param metadata - Metadata object to validate
   * @returns Validation result with errors if any
   */
  validateMetadata(metadata: Metadata): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check required fields
    if (!metadata.filename || metadata.filename.trim() === '') {
      errors.push('Filename is required and cannot be empty');
    }

    if (!metadata.title || metadata.title.trim() === '') {
      errors.push('Title is required and cannot be empty');
    }

    if (!metadata.keywords || metadata.keywords.trim() === '') {
      errors.push('Keywords are required and cannot be empty');
    }

    if (!metadata.category || typeof metadata.category !== 'number') {
      errors.push('Category must be a valid number');
    }

    // Check title length (Adobe Stock requirement: 50-200 characters)
    if (metadata.title && (metadata.title.length < 50 || metadata.title.length > 200)) {
      errors.push('Title must be between 50 and 200 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates an entire metadata list before CSV generation
   *
   * @param metadataList - List of metadata objects to validate
   * @returns Validation result with indices of invalid items
   */
  validateMetadataList(metadataList: Metadata[]): {
    valid: boolean;
    invalidItems: Array<{ index: number; errors: string[] }>;
  } {
    const invalidItems: Array<{ index: number; errors: string[] }> = [];

    metadataList.forEach((metadata, index) => {
      const validation = this.validateMetadata(metadata);
      if (!validation.valid) {
        invalidItems.push({ index, errors: validation.errors });
      }
    });

    return {
      valid: invalidItems.length === 0,
      invalidItems,
    };
  }

  /**
   * Cleans up CSV files older than the specified max age
   * Story 4.1 AC6: Auto-cleanup of old CSV files
   *
   * Deletes CSV files from the /csv_output directory that are older
   * than the specified threshold (default: 24 hours).
   *
   * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
   * @returns Number of files deleted
   *
   * @example
   * // Cleanup files older than 24 hours
   * const deletedCount = await csvExportService.cleanupOldFiles();
   *
   * // Cleanup files older than 1 hour
   * const deletedCount = await csvExportService.cleanupOldFiles(60 * 60 * 1000);
   */
  async cleanupOldFiles(maxAgeMs: number = DEFAULT_MAX_AGE_MS): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;

    try {
      // Check if directory exists
      try {
        await fs.access(CSV_OUTPUT_DIR);
      } catch {
        // Directory doesn't exist, nothing to clean up
        logger.debug({ directory: CSV_OUTPUT_DIR }, 'CSV output directory does not exist, skipping cleanup');
        return 0;
      }

      const files = await fs.readdir(CSV_OUTPUT_DIR);

      for (const file of files) {
        // Only process .csv files
        if (!file.endsWith('.csv')) {
          continue;
        }

        const filePath = path.join(CSV_OUTPUT_DIR, file);

        try {
          const stats = await fs.stat(filePath);

          // Check if file is older than max age
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.unlink(filePath);
            deletedCount++;
            logger.info({ file, ageMs: now - stats.mtimeMs }, 'Cleaned up old CSV file');
          }
        } catch (error) {
          // Log error but continue with other files
          logger.warn(
            { file, error: error instanceof Error ? error.message : 'Unknown' },
            'Failed to process file during cleanup'
          );
        }
      }

      if (deletedCount > 0) {
        logger.info({ deletedCount, maxAgeMs }, 'CSV cleanup completed');
      }

      return deletedCount;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown', directory: CSV_OUTPUT_DIR },
        'CSV cleanup failed'
      );
      throw new ProcessingError(
        'CSV_CLEANUP_FAILED',
        'Failed to clean up old CSV files',
        500,
        { stage: 'cleanup', originalError: error instanceof Error ? error.message : 'Unknown' }
      );
    }
  }
}
