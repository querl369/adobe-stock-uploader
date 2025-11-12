/**
 * Retry Logic & Resilience Utility
 *
 * Provides intelligent retry logic with exponential backoff for handling transient failures.
 * Commonly used for external API calls (OpenAI, network requests) that may fail temporarily.
 *
 * Features:
 * - Exponential backoff with configurable delays
 * - Selective retry based on error types
 * - Comprehensive logging for monitoring
 * - Type-safe generic implementation
 *
 * Usage:
 *   const result = await withRetry(
 *     () => openai.chat.completions.create(...),
 *     { maxAttempts: 3, retryableErrors: (err) => err.status === 429 }
 *   );
 */

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /**
   * Maximum number of attempts (including initial attempt)
   * @default 3
   */
  maxAttempts: number;

  /**
   * Initial delay in milliseconds before first retry
   * @default 1000 (1 second)
   */
  initialDelayMs: number;

  /**
   * Maximum delay in milliseconds between retries
   * Prevents exponential backoff from growing too large
   * @default 8000 (8 seconds)
   */
  maxDelayMs: number;

  /**
   * Multiplier for exponential backoff
   * Each retry delay = previous delay * backoffMultiplier
   * @default 2
   */
  backoffMultiplier: number;

  /**
   * Custom function to determine if an error should be retried
   * If not provided, uses default retry logic (5xx, 429, network errors)
   *
   * @param error - The error that occurred
   * @returns true if the operation should be retried, false otherwise
   */
  retryableErrors?: (error: any) => boolean;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
};

/**
 * Default retry logic: determines if an error is retryable
 *
 * Retries on:
 * - Network timeouts (ECONNRESET, ETIMEDOUT, ENOTFOUND)
 * - Server errors (5xx status codes)
 * - Rate limits (429 status code)
 *
 * Does NOT retry on:
 * - Authentication errors (401 status code)
 * - Validation errors (400 status code)
 * - Client errors (4xx except 429)
 */
function isRetryableError(error: any): boolean {
  // Network errors (Node.js error codes)
  if (error.code) {
    const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
    if (networkErrors.includes(error.code)) {
      return true;
    }
  }

  // HTTP status code errors
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;

    // Retry on rate limits (429)
    if (status === 429) {
      return true;
    }

    // Retry on server errors (5xx)
    if (status >= 500 && status < 600) {
      return true;
    }

    // Do NOT retry on client errors (4xx) except 429
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // OpenAI specific errors
  if (error.response?.status) {
    const status = error.response.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  // Default: retry on unknown errors (could be network issues)
  return true;
}

/**
 * Delays execution for a specified number of milliseconds
 * Used for implementing retry backoff delays
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculates the delay for the next retry attempt using exponential backoff
 *
 * Formula: delay = min(initialDelay * (multiplier ^ attemptNumber), maxDelay)
 *
 * @param attempt - Current attempt number (0-based)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number, options: RetryOptions): number {
  const { initialDelayMs, backoffMultiplier, maxDelayMs } = options;
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
  return Math.min(exponentialDelay, maxDelayMs);
}

/**
 * Executes a function with automatic retry logic and exponential backoff
 *
 * This wrapper function handles transient failures by retrying the operation
 * with increasing delays between attempts. It's designed for external API calls
 * and network operations that may fail temporarily.
 *
 * @template T - The return type of the function being retried
 * @param fn - Async function to execute with retry logic
 * @param options - Partial retry options (merged with defaults)
 * @returns Promise resolving to the function's return value
 * @throws The last error encountered after all retries are exhausted
 *
 * @example
 * // Basic usage with defaults (3 attempts, 1s, 2s, 4s delays)
 * const data = await withRetry(() => fetchFromAPI());
 *
 * @example
 * // Custom retry logic for specific error codes
 * const metadata = await withRetry(
 *   () => metadataService.generateMetadata(imageUrl),
 *   {
 *     maxAttempts: 5,
 *     retryableErrors: (err) => err.status === 429 || err.code === 'ETIMEDOUT'
 *   }
 * );
 *
 * @example
 * // Aggressive retry with longer delays
 * const result = await withRetry(
 *   () => processLargeFile(),
 *   {
 *     maxAttempts: 5,
 *     initialDelayMs: 2000,
 *     maxDelayMs: 16000,
 *     backoffMultiplier: 2
 *   }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  partialOptions?: Partial<RetryOptions>
): Promise<T> {
  // Merge provided options with defaults
  const options: RetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...partialOptions,
  };

  const { maxAttempts, retryableErrors } = options;
  const shouldRetry = retryableErrors || isRetryableError;

  let lastError: any;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      // Attempt to execute the function
      const result = await fn();

      // If successful on a retry (not first attempt), log it for monitoring
      if (attempt > 0) {
        console.log(`[Retry Success] Operation succeeded on attempt ${attempt + 1}/${maxAttempts}`);
      }

      return result;
    } catch (error) {
      lastError = error;
      attempt++;

      // Check if we should retry this error
      const isRetryable = shouldRetry(error);

      // If this was the last attempt or error is not retryable, throw
      if (attempt >= maxAttempts || !isRetryable) {
        if (attempt >= maxAttempts) {
          console.error(
            `[Retry Failed] All ${maxAttempts} attempts exhausted. Last error:`,
            getErrorMessage(error)
          );
        } else {
          console.error(
            `[Retry Failed] Non-retryable error encountered on attempt ${attempt}:`,
            getErrorMessage(error)
          );
        }
        throw error;
      }

      // Calculate backoff delay for next attempt
      const backoffDelay = calculateBackoffDelay(attempt - 1, options);

      // Log retry attempt with context
      console.warn(
        `[Retry Attempt ${attempt}/${maxAttempts}] Operation failed: ${getErrorMessage(error)}. ` +
          `Retrying in ${backoffDelay}ms...`
      );

      // Wait before next attempt
      await delay(backoffDelay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Extracts a readable error message from various error types
 * Handles Error objects, strings, and objects with message properties
 *
 * @param error - The error to extract a message from
 * @returns Human-readable error message
 */
function getErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error?.message) {
    return error.message;
  }
  if (error?.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  return 'Unknown error';
}

/**
 * Type guard to check if an error has a status code
 * Useful for filtering errors in retry logic
 *
 * @param error - The error to check
 * @returns true if error has a status or statusCode property
 */
export function hasStatusCode(error: any): error is { status: number } | { statusCode: number } {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (
    'status' in error ||
    'statusCode' in error ||
    ('response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'status' in error.response)
  );
}

/**
 * Extracts the status code from an error if it exists
 *
 * @param error - The error to extract status from
 * @returns Status code or undefined if not present
 */
export function getStatusCode(error: any): number | undefined {
  if (error?.status) return error.status;
  if (error?.statusCode) return error.statusCode;
  if (error?.response?.status) return error.response.status;
  return undefined;
}
