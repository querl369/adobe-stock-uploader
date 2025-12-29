/**
 * Metadata Service
 *
 * Handles AI-powered metadata generation using OpenAI Vision API.
 * This service wraps OpenAI API calls with error handling, retry logic,
 * and response parsing for Adobe Stock-compliant metadata.
 *
 * Story 3.4: Implements validation with retry-before-fallback pattern.
 */

import OpenAI from 'openai';
import { config } from '@/config/app.config';
import { PROMPT_TEXT } from '@/prompt-text';
import { ExternalServiceError } from '@/models/errors';
import { withRetry } from '@/utils/retry';
import { logger } from '@/utils/logger';
import {
  recordOpenAICall,
  recordOpenAIFailure,
  recordRetryAttempt,
  recordRetrySuccess,
  recordRetryExhausted,
} from '@/utils/metrics';
import {
  classifyOpenAIError,
  isRetryableOpenAIError,
  getRetryDelayForError,
  extractRetryAfter,
  OpenAIErrorType,
} from '@/utils/openai-error-classifier';
import { getUserFriendlyErrorMessage, createErrorContext } from '@/utils/error-messages';
import type { RawAIMetadata } from '@/models/metadata.model';
import { rawAIMetadataSchema } from '@/models/metadata.model';
import type { CategoryService } from '@/services/category.service';
import type {
  MetadataValidationService,
  ValidationError,
} from '@/services/metadata-validation.service';

/**
 * Service for generating image metadata using AI
 */
export class MetadataService {
  private openai: OpenAI;
  private categoryService: CategoryService;
  private validationService: MetadataValidationService;

  /**
   * Creates a new MetadataService instance
   *
   * @param categoryService - Service for mapping and validating Adobe Stock categories
   * @param validationService - Service for validating and sanitizing metadata (Story 3.4)
   */
  constructor(categoryService: CategoryService, validationService: MetadataValidationService) {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.categoryService = categoryService;
    this.validationService = validationService;
  }

  /**
   * Generates metadata for an image using OpenAI Vision API
   *
   * Story 3.4 (AC5, AC7): Implements retry-before-fallback pattern:
   * 1. First attempt with standard prompt
   * 2. If validation fails, retry with adjusted prompt including error feedback
   * 3. Only use fallback metadata if retry also fails
   *
   * @param imageUrl - Public HTTPS URL of the image to analyze
   * @param fileId - Optional file identifier for fallback metadata generation
   * @returns Promise resolving to validated and sanitized metadata
   * @throws ExternalServiceError if OpenAI API fails or times out
   *
   * @example
   * const metadata = await metadataService.generateMetadata('https://example.com/image.jpg', 'abc123');
   * logger.info({ title: metadata.title, keywords: metadata.keywords }, 'Metadata generated');
   */
  async generateMetadata(imageUrl: string, fileId?: string): Promise<RawAIMetadata> {
    const effectiveFileId = fileId || this.extractFileIdFromUrl(imageUrl);

    try {
      // First attempt with standard prompt
      const firstResponse = await this.callOpenAI(imageUrl, PROMPT_TEXT);
      const firstParsed = this.parseAIResponse(firstResponse);
      const firstValidation = this.validationService.validate(firstParsed);

      if (firstValidation.valid && firstValidation.sanitizedMetadata) {
        logger.debug(
          {
            fileId: effectiveFileId,
            titleLength: firstValidation.sanitizedMetadata.title.length,
            keywordCount: firstValidation.sanitizedMetadata.keywords.length,
          },
          'Metadata validated on first attempt'
        );
        return firstValidation.sanitizedMetadata;
      }

      // Story 3.4 (AC5, AC7): Retry with adjusted prompt including error feedback
      logger.info(
        {
          fileId: effectiveFileId,
          errors: firstValidation.errors.map(e => e.code),
          errorCount: firstValidation.errors.length,
        },
        'Validation failed on first attempt, retrying with adjusted prompt'
      );

      const adjustedPrompt = this.buildAdjustedPrompt(firstValidation.errors);
      const retryResponse = await this.callOpenAI(imageUrl, adjustedPrompt);
      const retryParsed = this.parseAIResponse(retryResponse);
      const retryValidation = this.validationService.validate(retryParsed);

      if (retryValidation.valid && retryValidation.sanitizedMetadata) {
        logger.info(
          {
            fileId: effectiveFileId,
            titleLength: retryValidation.sanitizedMetadata.title.length,
            keywordCount: retryValidation.sanitizedMetadata.keywords.length,
          },
          'Metadata validated on retry attempt'
        );
        return retryValidation.sanitizedMetadata;
      }

      // Story 3.4 (AC5): Only use fallback after retry also fails
      logger.warn(
        {
          fileId: effectiveFileId,
          firstErrors: firstValidation.errors.map(e => e.code),
          retryErrors: retryValidation.errors.map(e => e.code),
          originalTitle: firstParsed.title?.substring(0, 50),
          retryTitle: retryParsed.title?.substring(0, 50),
        },
        'Both validation attempts failed, using fallback metadata'
      );

      return this.validationService.generateFallback(effectiveFileId);
    } catch (error) {
      // If it's already an ExternalServiceError (from callOpenAI), rethrow
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      // Wrap parsing errors in ExternalServiceError for consistent handling
      throw new ExternalServiceError('Failed to generate metadata from OpenAI', {
        imageUrl,
        service: 'openai',
        model: config.openai.model,
        originalError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Calls OpenAI API with the given prompt
   *
   * Story 3.5: Enhanced error classification and retry logic
   * - AC1: Retry once for network timeouts, 5xx, malformed JSON
   * - AC2: Handle rate limits with retry-after, no retry for 401/400
   * - AC3: Exponential backoff (2s, 4s, max 8s)
   * - AC8: Record enhanced retry metrics
   *
   * @param imageUrl - Image URL to analyze
   * @param promptText - Prompt text to use
   * @returns Raw response text from OpenAI
   * @throws ExternalServiceError on API failure
   */
  private async callOpenAI(imageUrl: string, promptText: string): Promise<string> {
    const startTime = Date.now();
    const timeoutMs = config.openai.timeoutMs;

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Track if we've retried (for metrics)
    let hasRetried = false;
    let lastErrorType: OpenAIErrorType | null = null;

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
                      text: promptText,
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
            },
            { signal: controller.signal }
          );

          const callDuration = Date.now() - callStart;
          logger.debug({ callDurationMs: callDuration }, 'OpenAI API call completed');

          return result;
        },
        {
          maxAttempts: 3,
          // AC3: Use exponential backoff from error classifier
          initialDelayMs: 2000,
          maxDelayMs: 8000,
          backoffMultiplier: 2,
          retryableErrors: err => {
            // Story 3.5 (AC1, AC2, AC8): Use enhanced error classification
            const errorType = classifyOpenAIError(err);
            const isRetryable = isRetryableOpenAIError(errorType);

            // Log error classification decision with full context
            logger.warn(
              {
                errorType,
                isRetryable,
                errorMessage: err?.message,
                status: err?.status || err?.response?.status,
              },
              'OpenAI error classification for retry decision'
            );

            // Record retry attempt metrics (AC8)
            if (isRetryable) {
              hasRetried = true;
              lastErrorType = errorType;
              recordRetryAttempt(errorType, 'failure');
              recordOpenAIFailure(true);

              // AC2: For rate limits, log retry-after if present
              if (errorType === OpenAIErrorType.RATE_LIMIT) {
                const retryAfter = extractRetryAfter(err);
                if (retryAfter !== undefined) {
                  logger.info(
                    { retryAfterSeconds: retryAfter },
                    'Rate limit with retry-after header'
                  );
                }
              }
            }

            return isRetryable;
          },
        }
      );

      // Clear timeout after successful completion
      clearTimeout(timeoutId);

      // Record successful API call with duration and cost
      const duration = (Date.now() - startTime) / 1000;
      logger.info(
        { durationSeconds: duration, imageUrl: imageUrl.substring(0, 50) },
        'OpenAI API call completed successfully'
      );
      recordOpenAICall(duration, 0.002); // $0.002 per image for gpt-5-mini

      // AC8: Record retry success if we had retried
      if (hasRetried && lastErrorType) {
        recordRetryAttempt(lastErrorType, 'success');
        recordRetrySuccess(lastErrorType);
      }

      // Extract and return the response text
      const messageContent = response.choices[0]?.message?.content;
      const refusal = response.choices[0]?.message?.refusal;

      // Debug logging to see actual response structure
      logger.debug(
        {
          hasContent: !!messageContent,
          contentLength: messageContent?.length || 0,
          refusal: refusal || null,
          finishReason: response.choices[0]?.finish_reason,
          model: response.model,
        },
        'OpenAI response structure'
      );

      if (refusal) {
        logger.warn({ refusal }, 'OpenAI refused to process image');
        throw new Error(`OpenAI refused: ${refusal}`);
      }

      return messageContent || '';
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);

      // Story 3.5: Enhanced error classification and user-friendly messages
      const errorType = classifyOpenAIError(error);
      const errorContext = createErrorContext(error, {
        imageUrl,
        service: 'openai',
        model: config.openai.model,
        timeoutMs,
        durationMs: Date.now() - startTime,
      });

      // Record final failure
      recordOpenAIFailure(false);

      // AC8: Record retry exhaustion if we had retried
      if (hasRetried && lastErrorType) {
        recordRetryExhausted(lastErrorType);
      }

      // Log technical details for debugging (AC4)
      logger.error(
        {
          errorType,
          userMessage: errorContext.userMessage,
          technicalDescription: errorContext.technicalDescription,
          originalError: errorContext.originalError,
          imageUrl: imageUrl.substring(0, 50),
          durationMs: Date.now() - startTime,
        },
        'OpenAI API call failed'
      );

      // AC7: Throw with user-friendly message
      // Include both errorType (new) and reason (backward compat) for timeout errors
      throw new ExternalServiceError(getUserFriendlyErrorMessage(errorType), {
        imageUrl,
        service: 'openai',
        model: config.openai.model,
        errorType,
        timeoutMs,
        // Backward compatibility: add reason for timeout errors
        ...(errorType === OpenAIErrorType.TIMEOUT && { reason: 'timeout' }),
        // Include technical details for debugging but not in user message
        originalError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Builds an adjusted prompt that includes feedback about validation errors
   *
   * Story 3.4 (AC5): Creates a prompt that explicitly addresses the validation
   * issues from the first attempt to help the AI correct its output.
   *
   * @param errors - Validation errors from the first attempt
   * @returns Adjusted prompt with error feedback
   */
  private buildAdjustedPrompt(errors: ValidationError[]): string {
    const errorFeedback: string[] = [];

    for (const error of errors) {
      switch (error.code) {
        case 'TITLE_TOO_SHORT':
          errorFeedback.push(
            '- Your title was TOO SHORT. The title MUST be at least 50 characters. Make it more descriptive.'
          );
          break;
        case 'TITLE_TOO_LONG':
          errorFeedback.push(
            '- Your title was TOO LONG. The title MUST be at most 200 characters. Make it more concise.'
          );
          break;
        case 'TITLE_EMPTY':
          errorFeedback.push(
            '- The title was MISSING or empty. You MUST provide a descriptive title.'
          );
          break;
        case 'TITLE_FORBIDDEN_CHARS':
          errorFeedback.push(
            '- Your title contained COMMAS which are not allowed. Use semicolons or reword to avoid commas.'
          );
          break;
        case 'KEYWORDS_TOO_FEW':
          errorFeedback.push(
            `- You provided only ${error.value} keywords. You MUST provide at least 30 keywords. Add more relevant keywords.`
          );
          break;
        case 'KEYWORDS_TOO_MANY':
          errorFeedback.push(
            `- You provided ${error.value} keywords. You MUST provide at most 50 keywords. Remove less relevant ones.`
          );
          break;
        case 'KEYWORD_TOO_LONG':
          errorFeedback.push(
            '- Some keywords exceeded 50 characters. Each keyword must be 50 characters or less.'
          );
          break;
        case 'KEYWORD_EMPTY':
          errorFeedback.push(
            '- Some keywords were empty. Ensure all keywords are non-empty strings.'
          );
          break;
        case 'KEYWORDS_DUPLICATES':
          errorFeedback.push(
            '- Your keywords contained duplicates. Ensure all keywords are unique (case-insensitive).'
          );
          break;
        case 'CATEGORY_INVALID':
          errorFeedback.push(
            '- The category was invalid. You MUST use a category number between 1 and 21.'
          );
          break;
      }
    }

    const feedbackSection =
      errorFeedback.length > 0
        ? `

## CRITICAL: PREVIOUS ATTEMPT HAD ERRORS - FIX THESE ISSUES:

${errorFeedback.join('\n')}

Please generate metadata again, carefully fixing ALL the issues above.
`
        : '';

    return PROMPT_TEXT + feedbackSection;
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

      // Map and validate category using CategoryService (Story 3.2, AC5)
      const rawCategory = validationResult.data.category;
      const validCategoryId = this.categoryService.toValidCategoryId(rawCategory);
      const categoryName = this.categoryService.getNameById(validCategoryId);

      logger.debug(
        {
          rawCategory,
          validCategoryId,
          categoryName,
        },
        'Category mapped to Adobe Stock taxonomy'
      );

      // Return validated and transformed data with mapped category
      return {
        title: validationResult.data.title,
        keywords: validationResult.data.keywords,
        category: validCategoryId,
      } as RawAIMetadata;
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

  /**
   * Extracts file ID from image URL for fallback metadata generation
   *
   * @param imageUrl - Image URL containing UUID-based filename
   * @returns Extracted UUID or 'unknown' if extraction fails
   */
  private extractFileIdFromUrl(imageUrl: string): string {
    try {
      // URL format: .../temp/{uuid}.jpg or .../temp/{uuid}-{original}.jpg
      const urlParts = imageUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      // Extract UUID from filename (removes extension and any suffix after dash)
      const uuidPart = filename.split('.')[0].split('-')[0];
      return uuidPart || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
