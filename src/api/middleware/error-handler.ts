/**
 * Error Handling Middleware for Adobe Stock Uploader
 *
 * Provides centralized error handling with:
 * - Consistent JSON error responses
 * - Security (no sensitive info in production)
 * - Error logging with context
 * - Async handler wrapper to avoid try-catch boilerplate
 *
 * Usage:
 *   // In routes:
 *   app.post('/api/process', asyncHandler(async (req, res) => {
 *     // Errors automatically caught and passed to errorHandler
 *     throw new ValidationError('Invalid input');
 *   }));
 *
 *   // Register middleware last in server.ts:
 *   app.use(errorHandler);
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, isAppError, RateLimitError } from '../../models/errors';
import { logger } from '@utils/logger';

/**
 * Main error handling middleware
 * Converts all errors to consistent JSON responses
 *
 * Must be registered LAST in server.ts (after all routes)
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log error with context for debugging
  logger.error(
    {
      name: err.name,
      message: err.message,
      code: isAppError(err) ? err.code : 'UNKNOWN_ERROR',
      path: req.path,
      method: req.method,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
    'Error caught by error handler'
  );

  // Handle AppError instances (our custom errors)
  if (isAppError(err)) {
    const statusCode = err.statusCode;
    const response = err.toJSON();

    // Add rate limit headers for RateLimitError
    if (err instanceof RateLimitError && err.retryAfter) {
      res.setHeader('Retry-After', err.retryAfter);
      res.setHeader('X-RateLimit-Reset', Date.now() + err.retryAfter * 1000);
    }

    return res.status(statusCode).json(response);
  }

  // Handle standard Node.js errors (operational errors we recognize)
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    });
  }

  if (err.name === 'UnauthorizedError' || err.message.includes('jwt')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid or expired authentication token',
      },
    });
  }

  // Handle unexpected errors (programming errors)
  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDevelopment
        ? err.message
        : 'An unexpected error occurred. Please try again later.',
      ...(isDevelopment && { stack: err.stack }),
    },
  });
}

/**
 * Async handler wrapper
 * Eliminates need for try-catch in route handlers
 *
 * Wraps async route handlers and catches any errors,
 * passing them to the error handler middleware
 *
 * Usage:
 *   app.post('/api/process', asyncHandler(async (req, res) => {
 *     const result = await processImage(req.body);
 *     res.json(result);
 *   }));
 *
 * Without asyncHandler, you'd need:
 *   app.post('/api/process', async (req, res, next) => {
 *     try {
 *       const result = await processImage(req.body);
 *       res.json(result);
 *     } catch (error) {
 *       next(error);
 *     }
 *   });
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not Found handler (404)
 * Should be registered BEFORE errorHandler but AFTER all routes
 *
 * Usage in server.ts:
 *   app.use(notFoundHandler);
 *   app.use(errorHandler);
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

/**
 * Error response format specification
 *
 * All error responses follow this structure:
 *
 * {
 *   "success": false,
 *   "error": {
 *     "code": "ERROR_CODE",           // Machine-readable code
 *     "message": "User-friendly msg",  // Human-readable message
 *     "context": { ... }               // Optional: debugging context
 *   }
 * }
 *
 * HTTP status codes:
 * - 400 Bad Request       - ValidationError
 * - 401 Unauthorized      - AuthenticationError
 * - 404 Not Found         - NotFoundError
 * - 429 Too Many Requests - RateLimitError
 * - 500 Internal Server   - ProcessingError
 * - 502 Bad Gateway       - ExternalServiceError
 */
