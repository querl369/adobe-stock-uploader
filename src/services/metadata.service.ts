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
import { logger } from '@/utils/logger';
import { recordOpenAICall, recordOpenAIFailure } from '@/utils/metrics';
import type { RawAIMetadata } from '@/models/metadata.model';
import { rawAIMetadataSchema } from '@/models/metadata.model';

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
   * @throws ExternalServiceError if OpenAI API fails or times out
   *
   * @example
   * const metadata = await metadataService.generateMetadata('https://example.com/image.jpg');
   * logger.info({ title: metadata.title, keywords: metadata.keywords }, 'Metadata generated');
   */
  async generateMetadata(imageUrl: string): Promise<RawAIMetadata> {
    const startTime = Date.now();
    const timeoutMs = config.openai.timeoutMs;

    // Create AbortController for timeout handling (AC4)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Wrap OpenAI call with retry logic for resilience
      const response = await withRetry(
        async () => {
          const callStart = Date.now();
          logger.debug({ imageUrl, timeoutMs }, 'Starting OpenAI API call');

          const result = await this.openai.chat.completions.create(
            {
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
                        detail: 'low', // Reduces cost, sufficient for metadata (AC2)
                      },
                    },
                  ],
                },
              ],
              max_completion_tokens: config.openai.maxTokens,
              temperature: config.openai.temperature,
            },
            { signal: controller.signal }
          );

          const callDuration = Date.now() - callStart;
          logger.debug({ callDurationMs: callDuration }, 'OpenAI API call completed');

          return result;
        },
        {
          maxAttempts: 3,
          retryableErrors: err => {
            // Classify error for retry decision (AC6)
            const status = err?.status || err?.response?.status;
            const errorName = err?.name;
            const isAbortError = errorName === 'AbortError' || err?.message?.includes('aborted');

            // Log error classification decision
            logger.warn(
              {
                status,
                errorName,
                isAbortError,
                willRetry: !isAbortError && (status === 429 || (status >= 500 && status < 600)),
                errorMessage: err?.message,
              },
              'OpenAI error classification for retry decision'
            );

            // Do NOT retry on abort/timeout errors
            if (isAbortError) {
              return false;
            }

            // Record retry attempt for retryable errors
            if (status === 429 || (status >= 500 && status < 600)) {
              recordOpenAIFailure(true);
              return true;
            }

            // Do NOT retry on 401 (auth) or 400 (validation) errors (AC6)
            if (status === 401 || status === 400) {
              logger.error({ status }, 'Non-retryable OpenAI error - auth or validation failure');
              return false;
            }

            // Default: retry on network errors
            const networkError = err?.code === 'ETIMEDOUT' || err?.code === 'ECONNRESET';
            if (networkError) {
              recordOpenAIFailure(true);
              return true;
            }

            return false;
          },
        }
      );

      // Clear timeout after successful completion
      clearTimeout(timeoutId);

      // Extract and parse the response
      const responseText = response.choices[0].message.content || '';
      const parsedMetadata = this.parseAIResponse(responseText);

      // Record successful API call with duration and cost (AC7, AC8)
      const duration = (Date.now() - startTime) / 1000;
      logger.info(
        { durationSeconds: duration, imageUrl: imageUrl.substring(0, 50) },
        'Metadata generation completed'
      );
      recordOpenAICall(duration, 0.002); // $0.002 per image for gpt-5-mini

      return parsedMetadata;
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);

      // Record failure
      recordOpenAIFailure(false);

      // Check if this was a timeout/abort error (AC4)
      const isAbortError =
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'));

      if (isAbortError) {
        logger.error(
          { imageUrl, timeoutMs, durationMs: Date.now() - startTime },
          'OpenAI API call timed out'
        );
        throw new ExternalServiceError('OpenAI API request timed out', {
          imageUrl,
          service: 'openai',
          model: config.openai.model,
          timeoutMs,
          reason: 'timeout',
        });
      }

      // Transform all other errors into ExternalServiceError for consistent handling
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
   * Uses Zod schema validation for robust response parsing (AC5)
   *
   * @param responseText - Raw text response from OpenAI
   * @returns Parsed and validated metadata object
   * @throws Error if JSON parsing or validation fails
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

      // Validate with Zod schema (AC5)
      const validationResult = rawAIMetadataSchema.safeParse(parsed);

      if (!validationResult.success) {
        const errors = validationResult.error.issues
          .map(issue => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');

        logger.error(
          {
            responseText: responseText.substring(0, 200),
            validationErrors: validationResult.error.issues,
          },
          'Zod validation failed for AI response'
        );

        throw new Error(`Response validation failed: ${errors}`);
      }

      // Return validated and transformed data
      return validationResult.data as RawAIMetadata;
    } catch (error) {
      // If it's already our validation error, rethrow
      if (error instanceof Error && error.message.startsWith('Response validation failed')) {
        throw error;
      }

      // JSON parsing error
      logger.error(
        {
          responseText: responseText.substring(0, 200),
          error: error instanceof Error ? error.message : 'Unknown',
        },
        'Failed to parse JSON from OpenAI response'
      );
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
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown' },
        'OpenAI API connection validation failed'
      );
      return false;
    }
  }
}
