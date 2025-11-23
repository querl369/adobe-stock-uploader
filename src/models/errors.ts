/**
 * Custom Error Classes for Adobe Stock Uploader
 *
 * Provides typed error classes with consistent structure for:
 * - Error codes (machine-readable)
 * - HTTP status codes
 * - User-friendly messages
 * - Context information for debugging
 *
 * Usage:
 *   throw new ValidationError('Invalid file type', { filename: 'test.txt', allowedTypes: ['jpg', 'png'] });
 *   throw new ProcessingError('Compression failed', { filename: 'image.jpg', stage: 'compress' });
 */

/**
 * Base application error class
 * All custom errors extend from this class
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);

    // Maintains proper stack trace for where error was thrown (only available on V8)
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
  }

  /**
   * Convert error to JSON format for API responses
   * Excludes stack traces in production for security
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        ...(this.context && { context: this.context }),
      },
    };
  }
}

/**
 * ValidationError (400 Bad Request)
 * Used for: Invalid input, malformed requests, failed validation
 *
 * Examples:
 * - File type not supported
 * - Required field missing
 * - Invalid email format
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
  }
}

/**
 * ProcessingError (500 Internal Server Error)
 * Used for: Image processing failures, file system errors
 *
 * Includes filename and stage tracking for debugging:
 * - filename: Which file failed
 * - stage: compress | temp-url | metadata | csv
 *
 * Examples:
 * - Image compression failed
 * - File manipulation error
 * - Metadata generation failed
 */
export class ProcessingError extends AppError {
  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    context?: {
      filename?: string;
      stage?: 'compress' | 'temp-url' | 'metadata' | 'csv' | 'cleanup';
      originalError?: any;
      [key: string]: any;
    }
  ) {
    super(message, code, statusCode, true, context);
  }
}

/**
 * ExternalServiceError (502 Bad Gateway)
 * Used for: OpenAI API failures, external service timeouts
 *
 * Examples:
 * - OpenAI API timeout
 * - OpenAI rate limit (429)
 * - External API connection failed
 */
export class ExternalServiceError extends AppError {
  constructor(
    message: string,
    context?: {
      service?: 'openai' | 'filesystem' | 'network';
      statusCode?: number;
      originalError?: any;
      [key: string]: any;
    }
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, true, context);
  }
}

/**
 * RateLimitError (429 Too Many Requests)
 * Used for: Rate limiting enforcement, quota exceeded
 *
 * Examples:
 * - Anonymous user exceeded 10 image limit
 * - Too many requests from IP
 * - OpenAI rate limit reached
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number; // Seconds until retry allowed

  constructor(message: string, retryAfter?: number, context?: Record<string, any>) {
    super(message, 'RATE_LIMIT_ERROR', 429, true, {
      ...context,
      retryAfter,
    });
    this.retryAfter = retryAfter;
  }
}

/**
 * NotFoundError (404 Not Found)
 * Used for: Resource not found, missing files
 *
 * Examples:
 * - File not found
 * - Batch not found
 * - CSV file missing
 */
export class NotFoundError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NOT_FOUND', 404, true, context);
  }
}

/**
 * AuthenticationError (401 Unauthorized)
 * Used for: Missing or invalid authentication
 *
 * Examples:
 * - Missing JWT token
 * - Invalid API key
 * - Expired session
 */
export class AuthenticationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 401, true, context);
  }
}

/**
 * Error Code Reference
 *
 * VALIDATION_ERROR       - 400 Bad Request
 * AUTHENTICATION_ERROR   - 401 Unauthorized
 * NOT_FOUND              - 404 Not Found
 * RATE_LIMIT_ERROR       - 429 Too Many Requests
 * PROCESSING_ERROR       - 500 Internal Server Error
 * EXTERNAL_SERVICE_ERROR - 502 Bad Gateway
 */

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: any): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}
