import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateMetadata(imageUrl: string): Promise<any> {
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
Keywords: Put keywords in order of relevance and separate them by commas. Include a maximum of 25 keywords, and don't include technical data.
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