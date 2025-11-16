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

  console.log('📂 Starting batch processing...');
  console.log(`   Directory: ${imageDir}`);
  console.log(`   Output: ${outputCsvPath}`);
  console.log(`   Initials: ${initials}\n`);

  // Optional: Convert PNG to JPEG (currently disabled)
  // await convertPngToJpeg({ inputDir: imageDir, outputDir: imageDir });

  // Rename images with standard format
  const renamedFiles = renameImages(imageDir, initials);
  console.log(`📋 Found ${renamedFiles.length} images to process\n`);

  if (renamedFiles.length === 0) {
    console.warn('⚠️  No images found in directory');
    return;
  }

  // Define a concurrency limit to avoid overwhelming the APIs
  const CONCURRENCY_LIMIT = 5;

  // Process images in batches
  for (let i = 0; i < renamedFiles.length; i += CONCURRENCY_LIMIT) {
    const batch = renamedFiles.slice(i, i + CONCURRENCY_LIMIT);
    const batchNumber = i / CONCURRENCY_LIMIT + 1;
    const totalBatches = Math.ceil(renamedFiles.length / CONCURRENCY_LIMIT);

    console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} images)`);

    // Process this batch in parallel
    const batchResults = await Promise.all(
      batch.map(async file => {
        try {
          console.log(`   Processing ${file}...`);
          const filePath = path.join(imageDir, file);

          // Create temporary URL (self-hosted, automatic cleanup)
          const url = await services.tempUrl.createTempUrlFromPath(filePath);

          // Generate metadata using AI service
          const rawMetadata = await services.metadata.generateMetadata(url);

          console.log(`   ✅ Completed: ${file}`);

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
          console.error(`   ❌ Failed: ${file} - ${errorMessage}`);
          failedImages.push({ file, error: errorMessage });
          return null;
        }
      })
    );

    // Add successful results to the metadata list
    const successful = batchResults.filter((result): result is Metadata => result !== null);
    metadataList.push(...successful);

    console.log(
      `   Batch complete: ${successful.length} succeeded, ${batch.length - successful.length} failed\n`
    );
  }

  // Generate CSV file
  if (metadataList.length > 0) {
    await services.csvExport.generateCSV(metadataList, outputCsvPath);
    console.log(`\n✅ CSV file created: ${outputCsvPath}`);
  } else {
    console.warn('\n⚠️  No successful processing results - CSV not generated');
  }

  // Print summary
  console.log('\n📊 Processing Summary:');
  console.log(`   ✅ Successful: ${metadataList.length}/${renamedFiles.length}`);
  console.log(`   ❌ Failed: ${failedImages.length}/${renamedFiles.length}`);

  if (failedImages.length > 0) {
    console.log('\n❌ Failed Images:');
    failedImages.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`);
    });
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
    console.log(`\n🎉 All images processed successfully in ${duration}s`);
  } finally {
    // Always cleanup resources, even on error
    console.log('\n🧹 Cleaning up resources...');
    services.tempUrl.stopBackgroundCleanup();
  }
}

// Execute main function with proper exit codes
main()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Script failed with error:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  });
