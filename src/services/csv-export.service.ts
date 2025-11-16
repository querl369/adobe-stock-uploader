/**
 * CSV Export Service
 *
 * Handles generation of Adobe Stock-compliant CSV files from metadata.
 * Follows RFC 4180 CSV format with proper escaping and UTF-8 encoding.
 */

import { createObjectCsvWriter } from 'csv-writer';
import type { Metadata } from '@/models/metadata.model';
import { ProcessingError } from '@/models/errors';
import { logger } from '@/utils/logger';

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
}
