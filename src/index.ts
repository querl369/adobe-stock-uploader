import fs from 'fs';
import path from 'path';
import { services } from './config/container';
import { renameImages, convertPngToJpeg } from './files-manipulation';
import type { Metadata } from './models/metadata.model';

const initials = 'OY';
async function processImages(imageDir: string, outputCsvPath: string, initials: string) {
  const metadataList: Metadata[] = [];

  // await convertPngToJpeg({ inputDir: imageDir, outputDir: imageDir });
  const renamedFiles = renameImages(imageDir, initials);

  // Define a concurrency limit to avoid overwhelming the APIs
  const CONCURRENCY_LIMIT = 5;

  // Process images in batches
  for (let i = 0; i < renamedFiles.length; i += CONCURRENCY_LIMIT) {
    const batch = renamedFiles.slice(i, i + CONCURRENCY_LIMIT);

    console.log(
      `Processing batch ${i / CONCURRENCY_LIMIT + 1} of ${Math.ceil(renamedFiles.length / CONCURRENCY_LIMIT)}`
    );

    // Process this batch in parallel
    const batchResults = await Promise.all(
      batch.map(async file => {
        try {
          console.log(`Processing ${file}...`);
          const filePath = path.join(imageDir, file);
          const url = await services.tempUrl.createTempUrlFromPath(filePath);
          console.log(`Created temp URL for ${file}: ${url}`);

          const rawMetadata = await services.metadata.generateMetadata(url);
          console.log(`Generated metadata for ${file}`);

          // Note: Cleanup is automatic via TempUrlService

          return {
            filename: file,
            title: rawMetadata.title,
            keywords: Array.isArray(rawMetadata.keywords)
              ? rawMetadata.keywords.join(',')
              : String(rawMetadata.keywords),
            category: Number(rawMetadata.category),
            releases: 'Oleksii Yemets',
          };
        } catch (error) {
          console.error(`Error processing ${file}:`, error);
          // Return null for failed items
          return null;
        }
      })
    );

    // Add successful results to the metadata list
    metadataList.push(...batchResults.filter(result => result !== null));
  }

  await services.csvExport.generateCSV(metadataList, outputCsvPath);
  console.log(`Processed ${metadataList.length} of ${renamedFiles.length} images successfully.`);
}

const imageDirectory = path.resolve(__dirname, '../images');

const outputCsv = path.resolve(__dirname, `../csv_output/${initials}_${Date.now()}.csv`);

(async () => {
  try {
    await processImages(imageDirectory, outputCsv, initials);
    console.log('All images processed successfully.');
  } catch (error) {
    console.error('Error processing images:', error);
  }
})();
