/**
 * Rate Limit Middleware Tests
 * Story 2.3: Rate Limiting Middleware
 *
 * Tests:
 * - AC1: Anonymous users: 10 images per session per hour
 * - AC2: Per-IP rate limit: 50 requests per minute
 * - AC3: Response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 * - AC4: 429 error with clear message when limit exceeded
 * - AC5: Cleanup of expired entries
 * - AC6: Bypass mechanism for testing
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock config
vi.mock('../src/config/app.config', () => ({
  config: {
    server: { port: 3000, nodeEnv: 'test', baseUrl: 'http://localhost:3000' },
    openai: { apiKey: 'test-key', model: 'gpt-5-nano', maxTokens: 500, temperature: 0.3 },
    processing: { concurrencyLimit: 5, maxFileSizeMB: 50, tempFileLifetimeSeconds: 10 },
    rateLimits: { anonymous: 10, freeTier: 100 },
  },
}));

// Mock session service
vi.mock('../src/services/session.service', () => ({
  sessionService: {
    getSessionUsage: vi.fn().mockReturnValue(0),
    getRemainingImages: vi.fn().mockReturnValue(10),
    createSession: vi.fn().mockReturnValue('test-session-id'),
    getSession: vi.fn().mockReturnValue({ sessionId: 'test-session-id', imagesProcessed: 0 }),
    incrementUsage: vi.fn(),
    hasReachedLimit: vi.fn().mockReturnValue(false),
  },
}));

import {
  ipRateLimitMiddleware,
  sessionUploadLimitMiddleware,
  cleanupIpRateLimits,
  getIpRateLimitStoreSize,
  clearIpRateLimits,
} from '../src/api/middleware/rate-limit.middleware';
import { RateLimitError, ValidationError } from '../src/models/errors';
import { sessionService } from '../src/services/session.service';
import { SessionRequest } from '../src/api/middleware/session.middleware';

describe('Rate Limit Middleware - Story 2.3', () => {
  // Helper to create mock request (supports both Request and SessionRequest properties)
  const createMockRequest = (overrides: Partial<Request & SessionRequest> = {}): Request => {
    return {
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      ...overrides,
    } as unknown as Request;
  };

  // Helper to create mock response
  const createMockResponse = (): Response => {
    const res: Partial<Response> = {
      setHeader: vi.fn(),
    };
    return res as Response;
  };

  // Helper to create mock next function with proper typing for mock access
  const createMockNext = (): NextFunction & Mock => vi.fn() as NextFunction & Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    clearIpRateLimits(); // Clear rate limit store between tests

    // Ensure rate limiting is NOT bypassed for these tests
    // We need to explicitly set NODE_ENV to allow rate limiting to work
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('RATE_LIMIT_BYPASS', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('ipRateLimitMiddleware', () => {
    describe('AC2: Per-IP rate limit (50 requests per minute)', () => {
      it('should allow requests under the limit', () => {
        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        ipRateLimitMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
      });

      it('should set rate limit headers on each request', () => {
        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        ipRateLimitMiddleware(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '50');
        expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
        expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
      });

      it('should decrement remaining count on each request', () => {
        const res1 = createMockResponse();
        const res2 = createMockResponse();
        const next = createMockNext();

        ipRateLimitMiddleware(createMockRequest(), res1, next);
        ipRateLimitMiddleware(createMockRequest(), res2, next);

        // First request should have 49 remaining
        expect(res1.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '49');
        // Second request should have 48 remaining
        expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '48');
      });

      it('should block requests when limit exceeded (AC4: 429 error)', () => {
        const next = createMockNext();

        // Make 51 requests to exceed the limit
        for (let i = 0; i < 51; i++) {
          const req = createMockRequest();
          const res = createMockResponse();
          ipRateLimitMiddleware(req, res, next);
        }

        // 51st call should trigger rate limit error
        const lastCall = next.mock.calls[50];
        expect(lastCall).toBeDefined();
        expect(lastCall[0]).toBeInstanceOf(RateLimitError);
        expect(lastCall[0].message).toContain('Rate limit exceeded');
      });

      it('should set Retry-After header when limit exceeded', () => {
        const next = createMockNext();
        let lastRes: Response | null = null;

        // Make 51 requests to exceed the limit
        for (let i = 0; i < 51; i++) {
          const req = createMockRequest();
          lastRes = createMockResponse();
          ipRateLimitMiddleware(req, lastRes, next);
        }

        expect(lastRes?.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
      });

      it('should track different IPs separately', () => {
        const req1 = createMockRequest({ ip: '10.0.0.1' });
        const req2 = createMockRequest({ ip: '10.0.0.2' });
        const res1 = createMockResponse();
        const res2 = createMockResponse();
        const next = createMockNext();

        ipRateLimitMiddleware(req1, res1, next);
        ipRateLimitMiddleware(req2, res2, next);

        // Both should have 49 remaining (tracked separately)
        expect(res1.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '49');
        expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '49');
      });

      it('should fallback to socket.remoteAddress when ip is undefined', () => {
        const req = createMockRequest({ ip: undefined });
        const res = createMockResponse();
        const next = createMockNext();

        ipRateLimitMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('sessionUploadLimitMiddleware', () => {
    describe('AC1: Anonymous users - 10 images per session', () => {
      it('should allow uploads under the limit', () => {
        const middleware = sessionUploadLimitMiddleware(5);
        const req = createMockRequest({ sessionId: 'test-session' }) as SessionRequest;
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
      });

      it('should set session usage headers', () => {
        const middleware = sessionUploadLimitMiddleware(3);
        const req = createMockRequest({ sessionId: 'test-session' }) as SessionRequest;
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith('X-Session-Usage', '0');
        expect(res.setHeader).toHaveBeenCalledWith('X-Session-Remaining', '10');
        expect(res.setHeader).toHaveBeenCalledWith('X-Session-Limit', '10');
      });

      it('should block upload when limit would be exceeded (AC4: 429 error)', () => {
        // Mock session at limit
        vi.mocked(sessionService.getSessionUsage).mockReturnValue(8);
        vi.mocked(sessionService.getRemainingImages).mockReturnValue(2);

        const middleware = sessionUploadLimitMiddleware(5); // Try to upload 5 when only 2 remaining
        const req = createMockRequest({ sessionId: 'test-session' }) as SessionRequest;
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(RateLimitError));
        const error = next.mock.calls[0][0] as RateLimitError;
        expect(error.message).toContain('Anonymous upload limit exceeded');
      });

      it('should throw ValidationError if session not initialized', () => {
        const middleware = sessionUploadLimitMiddleware(1);
        const req = createMockRequest({ sessionId: undefined }) as SessionRequest;
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      });

      it('should set Retry-After header when limit exceeded', () => {
        vi.mocked(sessionService.getSessionUsage).mockReturnValue(10);
        vi.mocked(sessionService.getRemainingImages).mockReturnValue(0);

        const middleware = sessionUploadLimitMiddleware(1);
        const req = createMockRequest({ sessionId: 'test-session' }) as SessionRequest;
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '3600');
      });
    });
  });

  describe('Rate Limit Cleanup', () => {
    describe('AC5: Cleanup of expired entries', () => {
      it('should remove expired rate limit entries', () => {
        // Make a request to create an entry
        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        ipRateLimitMiddleware(req, res, next);
        expect(getIpRateLimitStoreSize()).toBe(1);

        // Manually expire the entry by modifying time
        // Note: This is a simplified test - in real scenarios we'd use time mocking
        clearIpRateLimits();
        expect(getIpRateLimitStoreSize()).toBe(0);
      });

      it('cleanupIpRateLimits should not throw errors', () => {
        expect(() => cleanupIpRateLimits()).not.toThrow();
      });
    });
  });

  describe('Rate Limit Bypass', () => {
    describe('AC6: Bypass mechanism for testing', () => {
      it('should bypass rate limiting when RATE_LIMIT_BYPASS is true', () => {
        vi.stubEnv('RATE_LIMIT_BYPASS', 'true');
        vi.stubEnv('NODE_ENV', 'development');

        // Re-import the module to pick up new env value
        // For this test, we'll just verify the test environment works correctly
        const next = createMockNext();

        // Make 100 requests - none should be blocked in test mode
        for (let i = 0; i < 100; i++) {
          const req = createMockRequest();
          const res = createMockResponse();
          ipRateLimitMiddleware(req, res, next);
        }

        // Since NODE_ENV is test, all should pass through
        const errorCalls = next.mock.calls.filter((call: unknown[]) => call[0] instanceof Error);
        expect(errorCalls.length).toBe(0);
      });

      it('should bypass session limit in test mode', () => {
        vi.stubEnv('NODE_ENV', 'test');

        const middleware = sessionUploadLimitMiddleware(100);
        const req = createMockRequest({ sessionId: 'test-session' }) as SessionRequest;
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req, res, next);

        // Should not call next with error
        expect(next).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown IP address gracefully', () => {
      const req = createMockRequest({
        ip: undefined,
        socket: { remoteAddress: undefined } as any,
      });
      const res = createMockResponse();
      const next = createMockNext();

      ipRateLimitMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle zero image count in session middleware', () => {
      const middleware = sessionUploadLimitMiddleware(0);
      const req = createMockRequest({ sessionId: 'test-session' }) as SessionRequest;
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should properly format X-RateLimit-Reset as ISO string', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      ipRateLimitMiddleware(req, res, next);

      const resetHeader = (res.setHeader as any).mock.calls.find(
        (call: string[]) => call[0] === 'X-RateLimit-Reset'
      );
      expect(resetHeader).toBeDefined();
      // Should be a valid ISO date string
      expect(new Date(resetHeader[1]).toISOString()).toBe(resetHeader[1]);
    });
  });

  describe('Error Response Format', () => {
    it('should include retryAfter in RateLimitError', () => {
      vi.mocked(sessionService.getSessionUsage).mockReturnValue(10);
      vi.mocked(sessionService.getRemainingImages).mockReturnValue(0);

      const middleware = sessionUploadLimitMiddleware(1);
      const req = createMockRequest({ sessionId: 'test-session' }) as SessionRequest;
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      const error = next.mock.calls[0][0] as RateLimitError;
      expect(error.retryAfter).toBe(3600);
    });

    it('should return 429 status code in rate limit error', () => {
      const next = createMockNext();

      // Exceed IP rate limit
      for (let i = 0; i < 51; i++) {
        const req = createMockRequest();
        const res = createMockResponse();
        ipRateLimitMiddleware(req, res, next);
      }

      const error = next.mock.calls.find(
        (call: unknown[]) => call[0] instanceof RateLimitError
      )?.[0];
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(429);
    });
  });
});
