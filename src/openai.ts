import OpenAI from 'openai';
import dotenv from 'dotenv';

import { PROMPT_TEXT } from './prompt-text';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateMetadata(imageUrl: string): Promise<any> {
  try {
    // Using Chat Completions API with GPT-5-mini (supports vision)
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini', // GPT-5 mini model with vision capabilities
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: PROMPT_TEXT,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'low',
              },
            },
          ],
        },
      ],
      max_completion_tokens: 1000,
    });

    // Extract the JSON from the response
    const responseText = response.choices[0].message.content || '';

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
