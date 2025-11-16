/**
 * CLI Batch Processing Utility
 *
 * ⚠️  Admin/Development Tool - Not the primary customer interface
 *
 * This script processes images from a local directory using the same
 * service layer as the web application. Useful for:
 * - Batch processing large image sets
 * - Testing/debugging the processing pipeline
 * - Admin operations without web UI
 *
 * Usage:
 *   npm run process-batch
 *   or: node dist/index.js
 *
 * Configuration:
 *   Set INITIALS environment variable or edit the default below
 *   Requires same .env configuration as web server
 *
 * For customer-facing usage, see: http://localhost:3000
 */

import fs from 'fs';
import path from 'path';
import { services } from './config/container';
import { renameImages, convertPngToJpeg } from './files-manipulation';
import type { Metadata } from './models/metadata.model';
import { logger } from './utils/logger';

// Configuration
const initials = process.env.INITIALS || 'OY';
const imageDirectory = path.resolve(__dirname, '../images');
const outputCsv = path.resolve(__dirname, `../csv_output/${initials}_${Date.now()}.csv`);

/**
 * Process images from a directory and generate Adobe Stock CSV
 *
 * @param imageDir - Directory containing images to process
 * @param outputCsvPath - Path where CSV file should be saved
 * @param initials - User initials for filename prefix
 * @returns Promise that resolves when processing is complete
 */
async function processImages(
  imageDir: string,
  outputCsvPath: string,
  initials: string
): Promise<void> {
  const metadataList: Metadata[] = [];
  const failedImages: Array<{ file: string; error: string }> = [];

  logger.info({ imageDir, outputCsvPath, initials }, 'Starting batch processing');

  // Optional: Convert PNG to JPEG (currently disabled)
  // await convertPngToJpeg({ inputDir: imageDir, outputDir: imageDir });

  // Rename images with standard format
  const renamedFiles = renameImages(imageDir, initials);
  logger.info({ count: renamedFiles.length }, 'Found images to process');

  if (renamedFiles.length === 0) {
    logger.warn('No images found in directory');
    return;
  }

  // Define a concurrency limit to avoid overwhelming the APIs
  const CONCURRENCY_LIMIT = 5;

  // Process images in batches
  for (let i = 0; i < renamedFiles.length; i += CONCURRENCY_LIMIT) {
    const batch = renamedFiles.slice(i, i + CONCURRENCY_LIMIT);
    const batchNumber = i / CONCURRENCY_LIMIT + 1;
    const totalBatches = Math.ceil(renamedFiles.length / CONCURRENCY_LIMIT);

    logger.info({ batchNumber, totalBatches, batchSize: batch.length }, 'Processing batch');

    // Process this batch in parallel
    const batchResults = await Promise.all(
      batch.map(async file => {
        try {
          logger.debug({ file }, 'Processing image');
          const filePath = path.join(imageDir, file);

          // Create temporary URL (self-hosted, automatic cleanup)
          const url = await services.tempUrl.createTempUrlFromPath(filePath);

          // Generate metadata using AI service
          const rawMetadata = await services.metadata.generateMetadata(url);

          logger.info({ file }, 'Completed processing');

          return {
            filename: file,
            title: rawMetadata.title,
            keywords: Array.isArray(rawMetadata.keywords)
              ? rawMetadata.keywords.join(',')
              : String(rawMetadata.keywords),
            category: Number(rawMetadata.category),
            releases: 'Oleksii Yemets',
          } as Metadata;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error({ file, error: errorMessage }, 'Failed processing');
          failedImages.push({ file, error: errorMessage });
          return null;
        }
      })
    );

    // Add successful results to the metadata list
    const successful = batchResults.filter((result): result is Metadata => result !== null);
    metadataList.push(...successful);

    logger.info(
      { succeeded: successful.length, failed: batch.length - successful.length },
      'Batch complete'
    );
  }

  // Generate CSV file
  if (metadataList.length > 0) {
    await services.csvExport.generateCSV(metadataList, outputCsvPath);
    logger.info({ outputCsvPath }, 'CSV file created');
  } else {
    logger.warn('No successful processing results - CSV not generated');
  }

  // Print summary
  logger.info(
    {
      successful: metadataList.length,
      total: renamedFiles.length,
      failed: failedImages.length,
    },
    'Processing summary'
  );

  if (failedImages.length > 0) {
    logger.error({ failedImages }, 'Failed images');
  }

  // Throw error if all images failed
  if (metadataList.length === 0 && renamedFiles.length > 0) {
    throw new Error('All images failed to process');
  }
}

/**
 * Main entry point with proper error handling and cleanup
 */
async function main(): Promise<void> {
  const startTime = Date.now();

  try {
    await processImages(imageDirectory, outputCsv, initials);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info({ durationSeconds: duration }, 'All images processed successfully');
  } finally {
    // Always cleanup resources, even on error
    logger.info('Cleaning up resources');
    services.tempUrl.stopBackgroundCleanup();
  }
}

// Execute main function with proper exit codes
main()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Script failed with error'
    );
    process.exit(1);
  });
