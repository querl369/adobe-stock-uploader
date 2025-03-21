import fs from 'fs';
import path from 'path';
import cloudinary from './cloudinary';
import openai from './openai';

import { writeMetadataToCSV, Metadata } from './csv-writer';

async function uploadImage(filePath: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'adobe_stock', // Optional: organizes your files in Cloudinary
    });
    return result.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}

async function generateMetadata(imageUrl: string): Promise<any> {
    try {
        const response = await openai.responses.create({
            model: "gpt-4o-mini",
            input: [{
                role: "user",
                content: [
                    { 
                        type: "input_text", 
                        text: `Generate metadata for this image for Adobe Stock by following these guidelines: 
Title: This should be a simple description of the image that's 70 characters or fewer. Don't include commas.
Keywords: Put keywords in order of relevance and separate them by commas. Include a maximum of 50 keywords, and don't include technical data.
Category: Enter the number of the category that most accurately describes the image.
Here are all available categories:
1. Animals: Content related to animals, insects, or pets — at home or in the wild.
2. Buildings and Architecture: Structures like homes, interiors, offices, temples, barns, factories, and shelters.
3. Business: People in business settings, offices, business concepts, finance, and money
4. Drinks: Content related to beer, wine, spirits, and other drinks.
5. The Environment: Depictions of nature or the places we work and live.
6. States of Mind: Content related to people's emotions and inner voices.
7. Food: Anything focused on food and eating.
8. Graphic Resources: Backgrounds, textures, and symbols.
9. Hobbies and Leisure: Pastime activities that bring joy and/or relaxation, such as knitting, building model airplanes, and sailing.
10. Industry: Depictions of work and manufacturing, like building cars, forging steel, producing clothing, or producing energy.
11. Landscape: Vistas, cities, nature, and other locations.
12. Lifestyle: The environments and activities of people at home, work, and play.
13. People: People of all ages, ethnicities, cultures, genders, and abilities.
14. Plants and Flowers: Close-ups of the natural world.
15. Culture and Religion: Depictions of the traditions, beliefs, and cultures of people around the world.
16. Science: Content with a focus on the applied, natural, medical, and theoretical sciences.
17. Social Issues: Poverty, inequality, politics, violence, and other depictions of social issues.
18. Sports: Content focused on sports and fitness, including football, basketball, hunting, yoga, and skiing.
19. Technology: Computers, smartphones, virtual reality, and other tools designed to increase productivity.
20. Transport: Different types of transportation, including cars, buses, trains, planes, and highway systems.
21. Travel: Local and worldwide travel, culture, and lifestyles.
Please chose the category that best describes the image insert the number of the category.
Please return response in JSON format with structure: { "title": "some title", "keywords": "some keywords", "category": "some category" }`
                    },
                    {
                        type: "input_image",
                        image_url: imageUrl,
                        detail: 'low'
                    },
                ],
            }],
        });
  
      // Extract the JSON from the response
      const responseText = response.output_text;
      // Check if the response contains JSON wrapped in markdown code block
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (jsonMatch && jsonMatch[1]) {
        // Parse the JSON inside the code block
        return JSON.parse(jsonMatch[1]);
      } else {
        // Try to parse the entire response as JSON
        try {
          return JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse JSON from response:', responseText);
          throw new Error('Invalid JSON response from OpenAI');
        }
      }
    } catch (error) {
      console.error('Error generating metadata:', error);
      throw error;
    }
}
  
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
                    const imageUrl = await uploadImage(filePath);
                    console.log(`Uploaded ${file} to ${imageUrl}`);
                    
                    const metadata = await generateMetadata(imageUrl);
                    console.log(`Generated metadata for ${file}`);
                    
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
const outputCsv = path.resolve(__dirname, `../Oleksii_Yemets_${new Date().toISOString()}.csv`);
  
processImages(imageDirectory, outputCsv)
    .then(() => console.log('All images processed successfully.'))
    .catch(error => console.error('Error processing images:', error));