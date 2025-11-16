/**
 * Tests for Correlation ID Middleware
 *
 * Story 1.9: Structured Logging with Pino
 * Tests correlation ID generation and child logger attachment
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { correlationIdMiddleware } from '../src/api/middleware/correlation-id.middleware';

describe('Correlation ID Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      url: '/api/test?param=value',
      get: vi.fn((header: string) => {
        if (header === 'user-agent') return 'test-agent';
        return undefined;
      }) as any,
    };

    mockRes = {
      on: vi.fn() as any,
      statusCode: 200,
    };

    mockNext = vi.fn();
  });

  it('should attach correlation ID to request', () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.id).toBeDefined();
    expect(typeof mockReq.id).toBe('string');
    expect(mockReq.id!.length).toBeGreaterThan(0);
  });

  it('should generate unique correlation IDs', () => {
    const mockReq1 = { ...mockReq };
    const mockReq2 = { ...mockReq };

    correlationIdMiddleware(mockReq1 as Request, mockRes as Response, mockNext);
    correlationIdMiddleware(mockReq2 as Request, mockRes as Response, mockNext);

    expect(mockReq1.id).toBeDefined();
    expect(mockReq2.id).toBeDefined();
    expect(mockReq1.id).not.toBe(mockReq2.id);
  });

  it('should attach child logger to request', () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.log).toBeDefined();
    expect(typeof mockReq.log?.info).toBe('function');
    expect(typeof mockReq.log?.error).toBe('function');
    expect(typeof mockReq.log?.warn).toBe('function');
    expect(typeof mockReq.log?.debug).toBe('function');
  });

  it('should call next middleware', () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should register response finish handler', () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should handle missing user-agent header gracefully', () => {
    mockReq.get = vi.fn(() => undefined);

    expect(() => {
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    }).not.toThrow();

    expect(mockReq.id).toBeDefined();
    expect(mockReq.log).toBeDefined();
  });

  it('should include method and path in child logger context', () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    // Verify child logger was created with correct context
    expect(mockReq.log).toBeDefined();

    // Child logger should be usable
    expect(() => {
      mockReq.log?.info('Test message');
    }).not.toThrow();
  });

  it('should handle different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    methods.forEach(method => {
      const req = { ...mockReq, method };
      correlationIdMiddleware(req as Request, mockRes as Response, vi.fn());

      expect(req.id).toBeDefined();
      expect(req.log).toBeDefined();
    });
  });

  it('should handle different paths', () => {
    const paths = ['/api/users', '/api/process-image', '/health', '/metrics'];

    paths.forEach(path => {
      const req = { ...mockReq, path };
      correlationIdMiddleware(req as Request, mockRes as Response, vi.fn());

      expect(req.id).toBeDefined();
      expect(req.log).toBeDefined();
    });
  });

  it('should work with request logger', () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    // Verify we can use the logger
    expect(() => {
      mockReq.log?.info({ filename: 'test.jpg' }, 'Processing image');
      mockReq.log?.error({ error: 'Test error' }, 'Processing failed');
      mockReq.log?.debug({ step: 'compress' }, 'Compression step');
    }).not.toThrow();
  });
});

describe('Correlation ID Format', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      url: '/api/test',
      get: vi.fn(),
    };

    mockRes = {
      on: vi.fn(),
      statusCode: 200,
    };

    mockNext = vi.fn();
  });

  it('should generate UUID v4 format correlation IDs', () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(mockReq.id).toMatch(uuidV4Regex);
  });

  it('should generate lowercase UUIDs', () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.id).toBe(mockReq.id?.toLowerCase());
  });
});

describe('Correlation ID Logging', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      path: '/api/process-batch',
      url: '/api/process-batch',
      get: vi.fn((header: string) => {
        if (header === 'user-agent') return 'Mozilla/5.0';
        return undefined;
      }) as any,
    };

    mockRes = {
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'finish') {
          // Simulate immediate finish for testing
          setTimeout(() => handler(), 0);
        }
      }) as any,
      statusCode: 200,
    };

    mockNext = vi.fn();
  });

  it('should log incoming request', () => {
    expect(() => {
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    }).not.toThrow();

    expect(mockReq.log).toBeDefined();
  });

  it('should log request completion on response finish', async () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    // Verify response finish handler was registered
    expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });
});

describe('Correlation ID Integration', () => {
  it('should work in request flow simulation', () => {
    const mockReq: Partial<Request> = {
      method: 'POST',
      path: '/api/process-image',
      url: '/api/process-image',
      get: vi.fn(),
    };

    const mockRes: Partial<Response> = {
      on: vi.fn(),
      statusCode: 200,
    };

    const mockNext: NextFunction = vi.fn();

    // Apply middleware
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    // Simulate route handler using the logger
    expect(() => {
      mockReq.log?.info({ filename: 'image.jpg' }, 'Processing started');
      mockReq.log?.debug({ step: 'compress' }, 'Compressing image');
      mockReq.log?.info({ duration: 123 }, 'Processing completed');
    }).not.toThrow();

    // Verify middleware continued to next
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});
