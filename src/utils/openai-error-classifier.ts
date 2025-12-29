/**
 * OpenAI Error Classifier
 *
 * Story 3.5: Error Recovery & Retry Logic
 *
 * Provides error classification for OpenAI API errors to enable:
 * - Intelligent retry decisions (AC1, AC2)
 * - Proper exponential backoff delays (AC3)
 * - Error-type specific handling (AC8)
 * - Rate limit retry-after support (AC2)
 *
 * Error Types:
 * - AUTH: Invalid API key (401) - Do NOT retry
 * - RATE_LIMIT: Too many requests (429) - Retry after delay
 * - TIMEOUT: Request timeout/abort - Retry once
 * - SERVER_ERROR: 5xx errors - Retry once
 * - MALFORMED: Invalid JSON response - Retry once
 * - VALIDATION: 400 errors - Do NOT retry
 * - UNKNOWN: Unclassified errors - Do NOT retry
 */

/**
 * OpenAI error type classification
 * Used for retry decisions and metrics recording
 */
export enum OpenAIErrorType {
  /** Authentication error (401) - Invalid API key */
  AUTH = 'auth',
  /** Rate limit exceeded (429) - Too many requests */
  RATE_LIMIT = 'rate_limit',
  /** Request timeout or abort */
  TIMEOUT = 'timeout',
  /** Server error (5xx) */
  SERVER_ERROR = 'server_error',
  /** Malformed/invalid JSON response */
  MALFORMED = 'malformed',
  /** Validation error (400) - Bad request */
  VALIDATION = 'validation',
  /** Unclassified error */
  UNKNOWN = 'unknown',
}

/**
 * Network error codes that indicate timeout-like issues
 */
const TIMEOUT_ERROR_CODES = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNABORTED',
];

/**
 * Default exponential backoff delays for retries (in milliseconds)
 * AC3: First retry: 2s, Second retry: 4s, Max: 8s
 */
const DEFAULT_RETRY_DELAYS = {
  initial: 2000,
  multiplier: 2,
  maxDelay: 8000,
};

/**
 * Classifies an OpenAI API error into a specific error type
 *
 * @param error - The error to classify (can be any error type)
 * @returns The classified error type
 *
 * @example
 * const errorType = classifyOpenAIError(error);
 * if (isRetryableOpenAIError(errorType)) {
 *   // Retry the request
 * }
 */
export function classifyOpenAIError(error: any): OpenAIErrorType {
  if (!error) {
    return OpenAIErrorType.UNKNOWN;
  }

  // Check for abort/timeout errors (AC1)
  if (isAbortError(error)) {
    return OpenAIErrorType.TIMEOUT;
  }

  // Check for network timeout errors by code (AC1)
  if (error.code && TIMEOUT_ERROR_CODES.includes(error.code)) {
    return OpenAIErrorType.TIMEOUT;
  }

  // Also check message for network error patterns (for compatibility)
  if (isNetworkErrorByMessage(error)) {
    return OpenAIErrorType.TIMEOUT;
  }

  // Extract HTTP status code
  const status = extractStatusCode(error);

  if (status !== undefined) {
    // 401 Unauthorized - Auth error (AC2)
    if (status === 401) {
      return OpenAIErrorType.AUTH;
    }

    // 429 Rate Limit (AC2)
    if (status === 429) {
      return OpenAIErrorType.RATE_LIMIT;
    }

    // 400 Bad Request - Validation error (AC2)
    if (status === 400) {
      return OpenAIErrorType.VALIDATION;
    }

    // 5xx Server errors (AC1)
    if (status >= 500 && status < 600) {
      return OpenAIErrorType.SERVER_ERROR;
    }

    // Other 4xx errors
    if (status >= 400 && status < 500) {
      return OpenAIErrorType.VALIDATION;
    }
  }

  // Check for malformed JSON response errors (AC1)
  if (isMalformedJsonError(error)) {
    return OpenAIErrorType.MALFORMED;
  }

  return OpenAIErrorType.UNKNOWN;
}

/**
 * Determines if an error type should be retried
 *
 * AC1: Retry for network timeouts, 5xx server errors, malformed JSON
 * AC2: Retry for rate limits (429), do NOT retry for 401, 400
 *
 * @param errorType - The classified error type
 * @returns true if the error should be retried
 */
export function isRetryableOpenAIError(errorType: OpenAIErrorType): boolean {
  switch (errorType) {
    // Retryable errors (AC1)
    case OpenAIErrorType.TIMEOUT:
    case OpenAIErrorType.SERVER_ERROR:
    case OpenAIErrorType.MALFORMED:
    case OpenAIErrorType.RATE_LIMIT:
      return true;

    // Non-retryable errors (AC2)
    case OpenAIErrorType.AUTH:
    case OpenAIErrorType.VALIDATION:
    case OpenAIErrorType.UNKNOWN:
      return false;

    default:
      return false;
  }
}

/**
 * Gets the retry delay for a specific error type and attempt number
 *
 * AC3: Exponential backoff - 2s, 4s, max 8s
 * AC2: For rate limits, use retry-after header if present
 *
 * @param errorType - The classified error type
 * @param attempt - The current attempt number (0-based)
 * @param retryAfterHeader - Optional retry-after header value from 429 response
 * @returns Delay in milliseconds before next retry
 */
export function getRetryDelayForError(
  errorType: OpenAIErrorType,
  attempt: number,
  retryAfterHeader?: string | number
): number {
  // For rate limits, respect retry-after header if present (AC2)
  if (errorType === OpenAIErrorType.RATE_LIMIT && retryAfterHeader !== undefined) {
    const retryAfterMs = parseRetryAfterHeader(retryAfterHeader);
    if (retryAfterMs > 0) {
      // Cap at reasonable maximum to prevent extremely long waits
      return Math.min(retryAfterMs, 60000); // Max 60 seconds
    }
  }

  // AC3: Exponential backoff - 2s, 4s, max 8s
  const { initial, multiplier, maxDelay } = DEFAULT_RETRY_DELAYS;
  const delay = initial * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Extracts the retry-after value from an error response
 *
 * @param error - The error that may contain retry-after header
 * @returns Retry-after value in seconds, or undefined if not present
 */
export function extractRetryAfter(error: any): number | undefined {
  // OpenAI SDK typically includes headers in error.headers
  const headers = error?.headers || error?.response?.headers;

  if (!headers) {
    return undefined;
  }

  // Try to get retry-after header (case-insensitive)
  const retryAfter = headers['retry-after'] || headers['Retry-After'];

  if (retryAfter === undefined || retryAfter === null) {
    return undefined;
  }

  const parsed = parseRetryAfterHeader(retryAfter);
  return parsed > 0 ? parsed / 1000 : undefined; // Return seconds
}

/**
 * Checks if an error is an abort/timeout error
 */
function isAbortError(error: any): boolean {
  if (!error) return false;

  // Check for AbortError name
  if (error.name === 'AbortError') return true;

  // Check for abort message
  if (typeof error.message === 'string' && error.message.toLowerCase().includes('aborted')) {
    return true;
  }

  // Check for timeout in error type
  if (error.type === 'aborted' || error.type === 'timeout') {
    return true;
  }

  return false;
}

/**
 * Checks if an error message indicates a network error
 * This is a fallback check for when error.code is not set
 */
function isNetworkErrorByMessage(error: any): boolean {
  if (!error) return false;

  const message = error.message || error.toString() || '';

  // Check for network error patterns in the message
  for (const code of TIMEOUT_ERROR_CODES) {
    if (message.includes(code)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if an error indicates a malformed JSON response
 */
function isMalformedJsonError(error: any): boolean {
  if (!error) return false;

  const message = error.message || error.toString() || '';
  const lowerMessage = message.toLowerCase();

  // Check for JSON parsing errors
  if (
    lowerMessage.includes('unexpected token') ||
    lowerMessage.includes('json') ||
    lowerMessage.includes('parsing') ||
    lowerMessage.includes('invalid json')
  ) {
    return true;
  }

  // Check for SyntaxError (JSON.parse errors)
  if (error.name === 'SyntaxError') {
    return true;
  }

  return false;
}

/**
 * Extracts HTTP status code from various error formats
 */
function extractStatusCode(error: any): number | undefined {
  // Direct status property
  if (typeof error.status === 'number') {
    return error.status;
  }

  // statusCode property
  if (typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  // Nested response.status
  if (error.response && typeof error.response.status === 'number') {
    return error.response.status;
  }

  // OpenAI SDK error format
  if (error.error && typeof error.error.status === 'number') {
    return error.error.status;
  }

  return undefined;
}

/**
 * Parses retry-after header value into milliseconds
 *
 * Handles:
 * - Number of seconds (e.g., "120")
 * - HTTP date format (e.g., "Wed, 21 Oct 2025 07:28:00 GMT")
 */
function parseRetryAfterHeader(value: string | number): number {
  if (typeof value === 'number') {
    return value * 1000; // Convert seconds to ms
  }

  // Try parsing as number of seconds
  const seconds = parseInt(value, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  const date = Date.parse(value);
  if (!isNaN(date)) {
    const delay = date - Date.now();
    return delay > 0 ? delay : 0;
  }

  return 0;
}
