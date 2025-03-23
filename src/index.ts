import fs from 'fs';
import path from 'path';
import { uploadImage, deleteImage } from './cloudinary';
import { generateMetadata } from './openai';

import { writeMetadataToCSV, Metadata } from './csv-writer';

async function processImages(imageDir: string, outputCsvPath: string) {
    const metadataList: Metadata[] = [];

    const files = fs.readdirSync(imageDir).filter(file => /\.(jpg|jpeg|png)$/i.test(file));
    
    // Define a concurrency limit to avoid overwhelming the APIs
    const CONCURRENCY_LIMIT = 3;
    
    // Process images in batches
    for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
        const batch = files.slice(i, i + CONCURRENCY_LIMIT);
        
        console.log(`Processing batch ${i / CONCURRENCY_LIMIT + 1} of ${Math.ceil(files.length / CONCURRENCY_LIMIT)}`);
        
        // Process this batch in parallel
        const batchResults = await Promise.all(
            batch.map(async (file) => {
                try {
                    console.log(`Processing ${file}...`);
                    const filePath = path.join(imageDir, file);
                    const { url, publicId } = await uploadImage(filePath);
                    console.log(`Uploaded ${file} to ${url}`);
                    
                    const metadata = await generateMetadata(url);
                    console.log(`Generated metadata for ${file}`);
                    
                    // Delete uploaded image from Cloudinary
                    await deleteImage(publicId);
                    
                    return {
                        filename: file,
                        title: metadata.title,
                        keywords: metadata.keywords,
                        category: metadata.category,
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

    await writeMetadataToCSV(metadataList, outputCsvPath);
    console.log(`Processed ${metadataList.length} of ${files.length} images successfully.`);
}
  
const imageDirectory = path.resolve(__dirname, '../images');
const outputCsv = path.resolve(__dirname, `../csv_output/Oleksii_Yemets_${Date.now()}.csv`);

(async () => {
  try {
    await processImages(imageDirectory, outputCsv);
    console.log('All images processed successfully.');
  } catch (error) {
    console.error('Error processing images:', error);
  }
})();