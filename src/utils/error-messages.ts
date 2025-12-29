/**
 * User-Friendly Error Messages
 *
 * Story 3.5: Error Recovery & Retry Logic (AC7)
 *
 * Provides user-friendly error messages for OpenAI API errors:
 * - User-friendly: "Processing failed - please try again"
 * - Not technical: NOT "OpenAI API returned 500"
 * - Actionable: Suggest next steps when possible
 * - Consistent: Same error types produce same messages
 */

import { OpenAIErrorType, classifyOpenAIError } from './openai-error-classifier';

/**
 * User-friendly error messages for each error type
 * AC7: Messages should be user-friendly, not technical, actionable, consistent
 */
export const USER_FRIENDLY_ERRORS: Record<OpenAIErrorType, string> = {
  [OpenAIErrorType.AUTH]: 'Service configuration error - please contact support',
  [OpenAIErrorType.RATE_LIMIT]: 'Service is busy - please try again in a moment',
  [OpenAIErrorType.TIMEOUT]: 'Processing took too long - please try again',
  [OpenAIErrorType.SERVER_ERROR]: 'Processing failed - please try again',
  [OpenAIErrorType.MALFORMED]: 'Processing failed - please try again',
  [OpenAIErrorType.VALIDATION]: 'Image could not be processed - please try a different image',
  [OpenAIErrorType.UNKNOWN]: 'Something went wrong - please try again',
};

/**
 * Technical error descriptions for logging (not shown to users)
 */
export const TECHNICAL_ERROR_DESCRIPTIONS: Record<OpenAIErrorType, string> = {
  [OpenAIErrorType.AUTH]: 'OpenAI authentication failed - invalid API key',
  [OpenAIErrorType.RATE_LIMIT]: 'OpenAI rate limit exceeded (429)',
  [OpenAIErrorType.TIMEOUT]: 'OpenAI request timeout - operation aborted',
  [OpenAIErrorType.SERVER_ERROR]: 'OpenAI server error (5xx)',
  [OpenAIErrorType.MALFORMED]: 'OpenAI returned malformed/invalid JSON',
  [OpenAIErrorType.VALIDATION]: 'OpenAI validation error (400) - bad request',
  [OpenAIErrorType.UNKNOWN]: 'Unknown OpenAI error',
};

/**
 * Gets a user-friendly error message for a given error type
 *
 * AC7: Returns consistent, non-technical messages
 *
 * @param errorType - The classified error type
 * @returns User-friendly error message
 *
 * @example
 * const message = getUserFriendlyErrorMessage(OpenAIErrorType.TIMEOUT);
 * // Returns: "Processing took too long - please try again"
 */
export function getUserFriendlyErrorMessage(errorType: OpenAIErrorType): string {
  return USER_FRIENDLY_ERRORS[errorType] || USER_FRIENDLY_ERRORS[OpenAIErrorType.UNKNOWN];
}

/**
 * Gets a user-friendly error message from any exception
 *
 * This function classifies the error and returns an appropriate user-facing message.
 * AC7: Ensures technical details are never exposed to users.
 *
 * @param error - Any error/exception
 * @returns User-friendly error message
 *
 * @example
 * try {
 *   await openai.chat.completions.create(...);
 * } catch (error) {
 *   const message = getUserFriendlyErrorForException(error);
 *   // Returns appropriate user-friendly message
 * }
 */
export function getUserFriendlyErrorForException(error: any): string {
  const errorType = classifyOpenAIError(error);
  return getUserFriendlyErrorMessage(errorType);
}

/**
 * Gets the technical description for logging purposes
 *
 * @param errorType - The classified error type
 * @returns Technical description for debugging
 */
export function getTechnicalErrorDescription(errorType: OpenAIErrorType): string {
  return (
    TECHNICAL_ERROR_DESCRIPTIONS[errorType] || TECHNICAL_ERROR_DESCRIPTIONS[OpenAIErrorType.UNKNOWN]
  );
}

/**
 * Creates an error context object for structured logging
 *
 * This provides detailed technical information for debugging while
 * keeping user-facing messages clean.
 *
 * @param error - The original error
 * @param additionalContext - Additional context to include
 * @returns Object with both user message and technical details
 */
export function createErrorContext(
  error: any,
  additionalContext?: Record<string, any>
): {
  userMessage: string;
  errorType: OpenAIErrorType;
  technicalDescription: string;
  originalError?: string;
  context?: Record<string, any>;
} {
  const errorType = classifyOpenAIError(error);

  // Extract original error message from various formats
  let originalError: string;
  if (error instanceof Error) {
    originalError = error.message;
  } else if (error && typeof error.message === 'string') {
    originalError = error.message;
  } else if (typeof error === 'string') {
    originalError = error;
  } else {
    originalError = String(error);
  }

  return {
    userMessage: getUserFriendlyErrorMessage(errorType),
    errorType,
    technicalDescription: getTechnicalErrorDescription(errorType),
    originalError,
    context: additionalContext,
  };
}

/**
 * Determines if an error message should be logged at error level vs warn level
 *
 * @param errorType - The classified error type
 * @returns true if should log at error level (critical issues)
 */
export function shouldLogAsError(errorType: OpenAIErrorType): boolean {
  switch (errorType) {
    // Critical errors that indicate configuration issues
    case OpenAIErrorType.AUTH:
      return true;

    // Operational errors that may self-resolve
    case OpenAIErrorType.RATE_LIMIT:
    case OpenAIErrorType.TIMEOUT:
    case OpenAIErrorType.SERVER_ERROR:
    case OpenAIErrorType.MALFORMED:
      return false;

    // Validation errors (user issue, not system issue)
    case OpenAIErrorType.VALIDATION:
      return false;

    // Unknown errors should be logged at error level for investigation
    case OpenAIErrorType.UNKNOWN:
      return true;

    default:
      return true;
  }
}
