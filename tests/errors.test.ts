/**
 * Tests for custom error classes
 *
 * Coverage:
 * - Error class instantiation and properties
 * - Error serialization (toJSON)
 * - Type guards (isAppError, isOperationalError)
 * - Inheritance and stack traces
 * - Context information
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  ProcessingError,
  ExternalServiceError,
  RateLimitError,
  NotFoundError,
  AuthenticationError,
  isAppError,
  isOperationalError,
} from '../src/models/errors';

describe('AppError', () => {
  it('should create error with required properties', () => {
    const error = new AppError('Test error message', 'TEST_ERROR', 500, true, { key: 'value' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error.context).toEqual({ key: 'value' });
    expect(error.name).toBe('AppError');
  });

  it('should have proper stack trace', () => {
    const error = new AppError('Test', 'TEST', 500);
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });

  it('should serialize to JSON correctly', () => {
    const error = new AppError('Test error', 'TEST_ERROR', 500, true, { filename: 'test.jpg' });

    const json = error.toJSON();
    expect(json).toEqual({
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: 'Test error',
        context: { filename: 'test.jpg' },
      },
    });
  });

  it('should serialize to JSON without context if not provided', () => {
    const error = new AppError('Test error', 'TEST_ERROR', 500);

    const json = error.toJSON();
    expect(json).toEqual({
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: 'Test error',
      },
    });
  });

  it('should default isOperational to true', () => {
    const error = new AppError('Test', 'TEST', 500);
    expect(error.isOperational).toBe(true);
  });
});

describe('ValidationError', () => {
  it('should create ValidationError with 400 status', () => {
    const error = new ValidationError('Invalid input');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
  });

  it('should include context information', () => {
    const error = new ValidationError('File type not supported', {
      filename: 'test.txt',
      allowedTypes: ['jpg', 'png'],
    });

    expect(error.context).toEqual({
      filename: 'test.txt',
      allowedTypes: ['jpg', 'png'],
    });

    const json = error.toJSON();
    expect(json.error.context).toEqual({
      filename: 'test.txt',
      allowedTypes: ['jpg', 'png'],
    });
  });

  it('should work without context', () => {
    const error = new ValidationError('Missing required field');
    expect(error.context).toBeUndefined();
  });
});

describe('ProcessingError', () => {
  it('should create ProcessingError with 500 status', () => {
    const error = new ProcessingError('Compression failed');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ProcessingError);
    expect(error.message).toBe('Compression failed');
    expect(error.code).toBe('PROCESSING_ERROR');
    expect(error.statusCode).toBe(500);
  });

  it('should include filename and stage context', () => {
    const error = new ProcessingError('Metadata generation failed', {
      filename: 'image.jpg',
      stage: 'metadata',
    });

    expect(error.context).toEqual({
      filename: 'image.jpg',
      stage: 'metadata',
    });
  });

  it('should include original error in context', () => {
    const originalError = new Error('Original error message');
    const error = new ProcessingError('Processing failed', {
      filename: 'test.jpg',
      stage: 'compress',
      originalError,
    });

    expect(error.context?.originalError).toBe(originalError);
    expect(error.context?.filename).toBe('test.jpg');
    expect(error.context?.stage).toBe('compress');
  });

  it('should support all processing stages', () => {
    const stages: Array<'compress' | 'temp-url' | 'metadata' | 'csv' | 'cleanup'> = [
      'compress',
      'temp-url',
      'metadata',
      'csv',
      'cleanup',
    ];

    stages.forEach(stage => {
      const error = new ProcessingError('Failed', {
        filename: 'test.jpg',
        stage,
      });
      expect(error.context?.stage).toBe(stage);
    });
  });
});

describe('ExternalServiceError', () => {
  it('should create ExternalServiceError with 502 status', () => {
    const error = new ExternalServiceError('OpenAI API timeout');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect(error.message).toBe('OpenAI API timeout');
    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(error.statusCode).toBe(502);
  });

  it('should include service and statusCode context', () => {
    const error = new ExternalServiceError('API error', {
      service: 'openai',
      statusCode: 429,
    });

    expect(error.context).toEqual({
      service: 'openai',
      statusCode: 429,
    });
  });

  it('should support all service types', () => {
    const services: Array<'openai' | 'filesystem' | 'network'> = [
      'openai',
      'filesystem',
      'network',
    ];

    services.forEach(service => {
      const error = new ExternalServiceError('Service error', { service });
      expect(error.context?.service).toBe(service);
    });
  });
});

describe('RateLimitError', () => {
  it('should create RateLimitError with 429 status', () => {
    const error = new RateLimitError('Rate limit exceeded');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.statusCode).toBe(429);
  });

  it('should include retryAfter property and context', () => {
    const error = new RateLimitError('Too many requests', 3600);

    expect(error.retryAfter).toBe(3600);
    expect(error.context?.retryAfter).toBe(3600);
  });

  it('should include additional context with retryAfter', () => {
    const error = new RateLimitError('Limit exceeded', 3600, {
      limit: 10,
      used: 10,
    });

    expect(error.retryAfter).toBe(3600);
    expect(error.context).toEqual({
      limit: 10,
      used: 10,
      retryAfter: 3600,
    });
  });

  it('should work without retryAfter', () => {
    const error = new RateLimitError('Quota exceeded');
    expect(error.retryAfter).toBeUndefined();
  });
});

describe('NotFoundError', () => {
  it('should create NotFoundError with 404 status', () => {
    const error = new NotFoundError('File not found');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('File not found');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
  });

  it('should include resource context', () => {
    const error = new NotFoundError('Batch not found', {
      batchId: 'abc123',
    });

    expect(error.context).toEqual({ batchId: 'abc123' });
  });
});

describe('AuthenticationError', () => {
  it('should create AuthenticationError with 401 status', () => {
    const error = new AuthenticationError('Invalid token');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Invalid token');
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.statusCode).toBe(401);
  });

  it('should include auth context', () => {
    const error = new AuthenticationError('Token expired', {
      reason: 'token_expired',
    });

    expect(error.context).toEqual({ reason: 'token_expired' });
  });
});

describe('Type Guards', () => {
  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError('Test', 'TEST', 500);
      expect(isAppError(error)).toBe(true);
    });

    it('should return true for AppError subclasses', () => {
      expect(isAppError(new ValidationError('Test'))).toBe(true);
      expect(isAppError(new ProcessingError('Test'))).toBe(true);
      expect(isAppError(new ExternalServiceError('Test'))).toBe(true);
      expect(isAppError(new RateLimitError('Test'))).toBe(true);
      expect(isAppError(new NotFoundError('Test'))).toBe(true);
      expect(isAppError(new AuthenticationError('Test'))).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Regular error');
      expect(isAppError(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(isAppError({})).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(123)).toBe(false);
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational AppErrors', () => {
      const error = new AppError('Test', 'TEST', 500, true);
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for non-operational AppErrors', () => {
      const error = new AppError('Test', 'TEST', 500, false);
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return true for all built-in error types (all are operational)', () => {
      expect(isOperationalError(new ValidationError('Test'))).toBe(true);
      expect(isOperationalError(new ProcessingError('Test'))).toBe(true);
      expect(isOperationalError(new ExternalServiceError('Test'))).toBe(true);
      expect(isOperationalError(new RateLimitError('Test'))).toBe(true);
      expect(isOperationalError(new NotFoundError('Test'))).toBe(true);
      expect(isOperationalError(new AuthenticationError('Test'))).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = new Error('Regular error');
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(isOperationalError({})).toBe(false);
      expect(isOperationalError(null)).toBe(false);
      expect(isOperationalError(undefined)).toBe(false);
    });
  });
});

describe('Error Inheritance', () => {
  it('should maintain proper prototype chain', () => {
    const validation = new ValidationError('Test');
    expect(validation instanceof Error).toBe(true);
    expect(validation instanceof AppError).toBe(true);
    expect(validation instanceof ValidationError).toBe(true);
  });

  it('should have correct constructor names', () => {
    expect(new AppError('', '', 500).constructor.name).toBe('AppError');
    expect(new ValidationError('').constructor.name).toBe('ValidationError');
    expect(new ProcessingError('').constructor.name).toBe('ProcessingError');
    expect(new ExternalServiceError('').constructor.name).toBe('ExternalServiceError');
    expect(new RateLimitError('').constructor.name).toBe('RateLimitError');
    expect(new NotFoundError('').constructor.name).toBe('NotFoundError');
    expect(new AuthenticationError('').constructor.name).toBe('AuthenticationError');
  });
});
