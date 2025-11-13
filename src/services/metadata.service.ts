/**
 * Metadata Service
 *
 * Handles AI-powered metadata generation using OpenAI Vision API.
 * This service wraps OpenAI API calls with error handling, retry logic,
 * and response parsing for Adobe Stock-compliant metadata.
 */

import OpenAI from 'openai';
import { config } from '@/config/app.config';
import { PROMPT_TEXT } from '@/prompt-text';
import { ExternalServiceError } from '@/models/errors';
import { withRetry } from '@/utils/retry';
import type { RawAIMetadata } from '@/models/metadata.model';

/**
 * Service for generating image metadata using AI
 */
export class MetadataService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  /**
   * Generates metadata for an image using OpenAI Vision API
   *
   * @param imageUrl - Public HTTPS URL of the image to analyze
   * @returns Promise resolving to parsed metadata
   * @throws ExternalServiceError if OpenAI API fails
   *
   * @example
   * const metadata = await metadataService.generateMetadata('https://example.com/image.jpg');
   * console.log(metadata.title, metadata.keywords, metadata.category);
   */
  async generateMetadata(imageUrl: string): Promise<RawAIMetadata> {
    try {
      // Wrap OpenAI call with retry logic for resilience
      const response = await withRetry(
        async () => {
          return await this.openai.chat.completions.create({
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
                      detail: 'low', // Reduces cost, sufficient for metadata
                    },
                  },
                ],
              },
            ],
            max_completion_tokens: config.openai.maxTokens,
            temperature: config.openai.temperature,
          });
        },
        {
          maxAttempts: 3,
          retryableErrors: err => {
            // Retry on rate limits and server errors
            const status = err?.status || err?.response?.status;
            return status === 429 || (status >= 500 && status < 600);
          },
        }
      );

      // Extract and parse the response
      const responseText = response.choices[0].message.content || '';
      return this.parseAIResponse(responseText);
    } catch (error) {
      // Transform all errors into ExternalServiceError for consistent handling
      throw new ExternalServiceError('Failed to generate metadata from OpenAI', {
        imageUrl,
        service: 'openai',
        model: config.openai.model,
        originalError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Parses OpenAI response text into structured metadata
   *
   * Handles both:
   * 1. JSON wrapped in markdown code blocks (```json ... ```)
   * 2. Raw JSON responses
   *
   * @param responseText - Raw text response from OpenAI
   * @returns Parsed metadata object
   * @throws Error if JSON parsing fails
   */
  private parseAIResponse(responseText: string): RawAIMetadata {
    // Check if the response contains JSON wrapped in markdown code block
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);

    let jsonText: string;
    if (jsonMatch && jsonMatch[1]) {
      // Extract JSON from markdown code block
      jsonText = jsonMatch[1];
    } else {
      // Assume entire response is JSON
      jsonText = responseText;
    }

    try {
      const parsed = JSON.parse(jsonText);

      // Validate that the response has the expected structure
      if (!parsed.title || !parsed.keywords || !parsed.category) {
        throw new Error('Response missing required fields (title, keywords, category)');
      }

      return parsed as RawAIMetadata;
    } catch (error) {
      console.error('Failed to parse JSON from OpenAI response:', responseText);
      throw new Error(
        `Invalid JSON response from OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validates OpenAI API connectivity
   *
   * Useful for health checks and startup validation.
   * Makes a lightweight API call to verify credentials and connectivity.
   *
   * @returns Promise resolving to true if API is accessible
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.openai.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI API connection validation failed:', error);
      return false;
    }
  }
}
