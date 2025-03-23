import OpenAI from 'openai';
import dotenv from 'dotenv';

import { PROMPT_TEXT } from './prompt-text';

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
                        text: PROMPT_TEXT
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