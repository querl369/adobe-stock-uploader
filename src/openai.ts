import OpenAI from 'openai';
import { config } from './config/app.config';
import { PROMPT_TEXT } from './prompt-text';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export async function generateMetadata(imageUrl: string): Promise<any> {
  try {
    // Using Chat Completions API with GPT-5-mini (supports vision)
    const response = await openai.chat.completions.create({
      model: config.openai.model,
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
      max_completion_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
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
