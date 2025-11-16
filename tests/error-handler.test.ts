/**
 * Tests for error handler middleware
 *
 * Coverage:
 * - Error handler middleware (errorHandler)
 * - Async handler wrapper (asyncHandler)
 * - Not found handler (notFoundHandler)
 * - Different error types
 * - Response formats
 * - Security (no sensitive info in production)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, asyncHandler, notFoundHandler } from '../src/api/middleware/error-handler';
import * as loggerModule from '../src/utils/logger';
import {
  ValidationError,
  ProcessingError,
  ExternalServiceError,
  RateLimitError,
  NotFoundError,
  AuthenticationError,
} from '../src/models/errors';

// Mock console.error to avoid cluttering test output
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Helper to create mock Express request/response/next
function createMocks(path = '/api/test', method = 'POST') {
  const req = {
    path,
    method,
  } as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe('errorHandler', () => {
  describe('AppError handling', () => {
    it('should handle ValidationError with 400 status', () => {
      const { req, res, next } = createMocks();
      const error = new ValidationError('Invalid input', {
        field: 'email',
      });

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          context: { field: 'email' },
        },
      });
    });

    it('should handle ProcessingError with 500 status', () => {
      const { req, res, next } = createMocks();
      const error = new ProcessingError('PROCESSING_ERROR', 'Compression failed', 500, {
        filename: 'image.jpg',
        stage: 'compress',
      });

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Compression failed',
          context: {
            filename: 'image.jpg',
            stage: 'compress',
          },
        },
      });
    });

    it('should handle ExternalServiceError with 502 status', () => {
      const { req, res, next } = createMocks();
      const error = new ExternalServiceError('OpenAI timeout', {
        service: 'openai',
        statusCode: 504,
      });

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: 'OpenAI timeout',
          context: {
            service: 'openai',
            statusCode: 504,
          },
        },
      });
    });

    it('should handle NotFoundError with 404 status', () => {
      const { req, res, next } = createMocks();
      const error = new NotFoundError('File not found', {
        fileId: 'abc123',
      });

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'File not found',
          context: { fileId: 'abc123' },
        },
      });
    });

    it('should handle AuthenticationError with 401 status', () => {
      const { req, res, next } = createMocks();
      const error = new AuthenticationError('Invalid token');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid token',
        },
      });
    });
  });

  describe('RateLimitError handling', () => {
    it('should handle RateLimitError with 429 status', () => {
      const { req, res, next } = createMocks();
      const error = new RateLimitError('Rate limit exceeded', 3600);

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_ERROR',
          message: 'Rate limit exceeded',
          context: { retryAfter: 3600 },
        },
      });
    });

    it('should set rate limit headers', () => {
      const { req, res, next } = createMocks();
      const error = new RateLimitError('Too many requests', 1800);

      errorHandler(error, req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 1800);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should not set headers if no retryAfter', () => {
      const { req, res, next } = createMocks();
      const error = new RateLimitError('Quota exceeded');

      errorHandler(error, req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('Standard error handling', () => {
    it('should handle standard ValidationError by name', () => {
      const { req, res, next } = createMocks();
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
        },
      });
    });

    it('should handle JWT errors as authentication errors', () => {
      const { req, res, next } = createMocks();
      const error = new Error('jwt malformed');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid or expired authentication token',
        },
      });
    });

    it('should handle UnauthorizedError', () => {
      const { req, res, next } = createMocks();
      const error = new Error('Unauthorized');
      error.name = 'UnauthorizedError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid or expired authentication token',
        },
      });
    });
  });

  describe('Unexpected error handling', () => {
    it('should handle unknown errors with 500 status in development', () => {
      const { req, res, next } = createMocks();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Unexpected error');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            message: 'Unexpected error',
            stack: expect.any(String),
          }),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide error details in production', () => {
      const { req, res, next } = createMocks();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Database connection failed');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
        },
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error logging', () => {
    it('should log error details', () => {
      const { req, res, next } = createMocks();
      const error = new ValidationError('Test error');
      const loggerSpy = vi.spyOn(loggerModule.logger, 'error');

      errorHandler(error, req, res, next);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError',
          message: 'Test error',
          code: 'VALIDATION_ERROR',
          path: '/api/test',
          method: 'POST',
        }),
        expect.stringContaining('Error caught by error handler')
      );
    });

    it('should include stack trace in development', () => {
      const { req, res, next } = createMocks();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      const loggerSpy = vi.spyOn(loggerModule.logger, 'error');

      errorHandler(error, req, res, next);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        }),
        expect.anything()
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production logs', () => {
      const { req, res, next } = createMocks();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      const loggerSpy = vi.spyOn(loggerModule.logger, 'error');

      errorHandler(error, req, res, next);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: undefined,
        }),
        expect.anything()
      );

      process.env.NODE_ENV = originalEnv;
    });
  });
});

describe('asyncHandler', () => {
  it('should wrap async function and catch errors', async () => {
    const { req, res, next } = createMocks();
    const error = new ValidationError('Async error');

    const asyncFn = async () => {
      throw error;
    };

    const wrappedFn = asyncHandler(asyncFn);
    await wrappedFn(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('should pass through successful async functions', async () => {
    const { req, res, next } = createMocks();

    const asyncFn = async () => {
      res.json({ success: true });
    };

    const wrappedFn = asyncHandler(asyncFn);
    await wrappedFn(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('should preserve request, response, and next context', async () => {
    const { req, res, next } = createMocks();

    const asyncFn = async (r: Request, rs: Response, n: NextFunction) => {
      expect(r).toBe(req);
      expect(rs).toBe(res);
      expect(n).toBe(next);
      rs.json({ received: true });
    };

    const wrappedFn = asyncHandler(asyncFn);
    await wrappedFn(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});

describe('notFoundHandler', () => {
  it('should return 404 with proper error format', () => {
    const { req, res, next } = createMocks('/api/nonexistent', 'GET');

    notFoundHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/nonexistent not found',
      },
    });
  });

  it('should handle different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    methods.forEach(method => {
      const { req, res, next } = createMocks('/api/test', method);

      notFoundHandler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${method} /api/test not found`,
        },
      });
    });
  });

  it('should handle different paths', () => {
    const paths = ['/api/users', '/api/images/123', '/'];

    paths.forEach(path => {
      const { req, res, next } = createMocks(path);

      notFoundHandler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining(path),
        },
      });
    });
  });
});

describe('Integration scenarios', () => {
  it('should handle error thrown in asyncHandler and processed by errorHandler', async () => {
    const { req, res, next } = createMocks();
    const error = new ProcessingError('PROCESSING_ERROR', 'Integration test error', 500, {
      filename: 'test.jpg',
      stage: 'compress',
    });

    // Simulate route handler
    const routeHandler = asyncHandler(async () => {
      throw error;
    });

    // Execute handler
    await routeHandler(req, res, next);

    // Verify error was passed to next
    expect(next).toHaveBeenCalledWith(error);

    // Simulate error handler receiving the error
    errorHandler(error, req, res, next);

    // Verify proper error response
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: 'Integration test error',
        context: {
          filename: 'test.jpg',
          stage: 'compress',
        },
      },
    });
  });
});
