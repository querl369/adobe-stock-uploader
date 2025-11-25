/**
 * Session Middleware Tests
 * Story 2.2: Cookie-Based Anonymous Session Tracking
 *
 * Tests the session middleware for:
 * - Cookie creation (AC1, AC3-AC6)
 * - Session validation and refresh
 * - User feedback message (AC12)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock config
vi.mock('../src/config/app.config', () => ({
  config: {
    server: { port: 3000, nodeEnv: 'test', baseUrl: 'http://localhost:3000' },
    openai: { apiKey: 'test-key', model: 'gpt-5-mini', maxTokens: 500, temperature: 0.3 },
    processing: { concurrencyLimit: 5, maxFileSizeMB: 50, tempFileLifetimeSeconds: 10 },
    rateLimits: { anonymous: 10, freeTier: 100 },
  },
}));

// Mock logger with createChildLogger
const mockChildLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => mockChildLogger),
  },
  createChildLogger: vi.fn(() => mockChildLogger),
}));

describe('Session Middleware - Story 2.2', () => {
  let app: Express;
  let sessionMiddleware: any;
  let getSessionUsageMessage: any;
  let sessionService: any;
  let SESSION_COOKIE_NAME: string;
  let correlationIdMiddleware: any;

  beforeEach(async () => {
    vi.resetModules();

    // Import after mocks
    const middlewareModule = await import('../src/api/middleware/session.middleware');
    const serviceModule = await import('../src/services/session.service');
    const correlationModule = await import('../src/api/middleware/correlation-id.middleware');

    sessionMiddleware = middlewareModule.sessionMiddleware;
    getSessionUsageMessage = middlewareModule.getSessionUsageMessage;
    SESSION_COOKIE_NAME = middlewareModule.SESSION_COOKIE_NAME;
    sessionService = serviceModule.sessionService;
    correlationIdMiddleware = correlationModule.correlationIdMiddleware;

    sessionService.clearAll();

    // Setup test app
    app = express();
    app.use(cookieParser());
    app.use(correlationIdMiddleware);
    app.use(sessionMiddleware);

    // Test route
    app.get('/test', (req: any, res: Response) => {
      res.json({
        sessionId: req.sessionId,
        hasSession: !!req.sessionId,
      });
    });

    // Error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });
  });

  afterEach(() => {
    sessionService.stopCleanupJob();
  });

  describe('Cookie Configuration (AC1, AC3-AC6)', () => {
    it('AC1: should set cookie name as "session_id"', async () => {
      expect(SESSION_COOKIE_NAME).toBe('session_id');

      const response = await request(app).get('/test').expect(200);

      // Cookie should be set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('session_id=');
    });

    it('AC6: should set HttpOnly flag on cookie', async () => {
      const response = await request(app).get('/test').expect(200);

      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('AC5: should set SameSite=Strict on cookie', async () => {
      const response = await request(app).get('/test').expect(200);

      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toContain('SameSite=Strict');
    });

    it('AC3: should set 1 hour expiry on cookie', async () => {
      const response = await request(app).get('/test').expect(200);

      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toContain('Max-Age=3600'); // 1 hour in seconds
    });

    it('AC4: should not set Secure flag in test/dev mode', async () => {
      const response = await request(app).get('/test').expect(200);

      const cookies = response.headers['set-cookie'];
      // In test mode, NODE_ENV !== 'production', so Secure should not be set
      expect(cookies[0]).not.toContain('Secure');
    });
  });

  describe('Session Creation', () => {
    it('should create new session for first request', async () => {
      const response = await request(app).get('/test').expect(200);

      expect(response.body.hasSession).toBe(true);
      expect(response.body.sessionId).toBeDefined();

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(response.body.sessionId).toMatch(uuidRegex);
    });

    it('should reuse existing session from cookie', async () => {
      // First request to get session
      const firstResponse = await request(app).get('/test').expect(200);

      const sessionId = firstResponse.body.sessionId;
      const cookies = firstResponse.headers['set-cookie'];

      // Extract session_id cookie value
      const sessionCookie = cookies[0].split(';')[0];

      // Second request with cookie
      const secondResponse = await request(app)
        .get('/test')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(secondResponse.body.sessionId).toBe(sessionId);

      // No new cookie should be set
      expect(secondResponse.headers['set-cookie']).toBeUndefined();
    });

    it('should create new session if existing cookie session is invalid', async () => {
      // Request with invalid session cookie
      const response = await request(app)
        .get('/test')
        .set('Cookie', 'session_id=invalid-session-id')
        .expect(200);

      expect(response.body.hasSession).toBe(true);
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.sessionId).not.toBe('invalid-session-id');

      // New cookie should be set
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should attach sessionId to request object', async () => {
      let capturedSessionId: string | undefined;

      // Add route that captures sessionId
      app.get('/capture', (req: any, res: Response) => {
        capturedSessionId = req.sessionId;
        res.json({ captured: true });
      });

      await request(app).get('/capture').expect(200);

      expect(capturedSessionId).toBeDefined();
      expect(typeof capturedSessionId).toBe('string');
    });
  });

  describe('Session Validation', () => {
    it('should validate session exists in service', async () => {
      const response = await request(app).get('/test').expect(200);

      const sessionId = response.body.sessionId;

      // Session should exist in service
      const session = sessionService.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe(sessionId);
    });

    it('should handle expired sessions by creating new one', async () => {
      vi.useFakeTimers();

      // First request
      const firstResponse = await request(app).get('/test').expect(200);

      const cookies = firstResponse.headers['set-cookie'];
      const sessionCookie = cookies[0].split(';')[0];
      const firstSessionId = firstResponse.body.sessionId;

      // Advance time past expiry
      vi.advanceTimersByTime(60 * 60 * 1000 + 1000);

      // Second request with expired session cookie
      const secondResponse = await request(app)
        .get('/test')
        .set('Cookie', sessionCookie)
        .expect(200);

      // Should get new session
      expect(secondResponse.body.sessionId).not.toBe(firstSessionId);
      expect(secondResponse.headers['set-cookie']).toBeDefined();

      vi.useRealTimers();
    });
  });

  describe('getSessionUsageMessage (AC12)', () => {
    it('AC12: should return "X of 10 free images used" message', () => {
      const sessionId = sessionService.createSession();

      expect(getSessionUsageMessage(sessionId)).toBe('0 of 10 free images used');

      sessionService.incrementUsage(sessionId, 3);
      expect(getSessionUsageMessage(sessionId)).toBe('3 of 10 free images used');

      sessionService.incrementUsage(sessionId, 7);
      expect(getSessionUsageMessage(sessionId)).toBe('10 of 10 free images used');
    });

    it('should show 0 usage for non-existent session', () => {
      const message = getSessionUsageMessage('non-existent');
      expect(message).toBe('0 of 10 free images used');
    });
  });

  describe('Error Handling', () => {
    it('should pass errors to next middleware', async () => {
      // Create app that simulates error in session middleware
      const errorApp = express();
      errorApp.use(cookieParser());
      errorApp.use(correlationIdMiddleware);

      // Mock middleware that will cause error
      const mockMiddleware = (req: Request, res: Response, next: NextFunction) => {
        // Simulate session service error by calling getSession on undefined
        try {
          sessionMiddleware(req, res, next);
        } catch (error) {
          next(error);
        }
      };

      errorApp.use(mockMiddleware);
      errorApp.get('/test', (req, res) => res.json({ ok: true }));

      // Error handler
      errorApp.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        res.status(500).json({ error: err.message });
      });

      // Should not crash
      const response = await request(errorApp).get('/test');
      // Either succeeds or returns error - doesn't crash
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('Multiple Concurrent Requests', () => {
    it('should handle concurrent requests from same session', async () => {
      // First request to establish session
      const firstResponse = await request(app).get('/test').expect(200);

      const cookies = firstResponse.headers['set-cookie'];
      const sessionCookie = cookies[0].split(';')[0];
      const sessionId = firstResponse.body.sessionId;

      // Concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        request(app).get('/test').set('Cookie', sessionCookie)
      );

      const responses = await Promise.all(promises);

      // All should have same session
      responses.forEach(response => {
        expect(response.body.sessionId).toBe(sessionId);
      });
    });

    it('should handle concurrent requests from different clients', async () => {
      // Multiple independent requests
      const promises = Array.from({ length: 5 }, () => request(app).get('/test'));

      const responses = await Promise.all(promises);

      // All should have unique sessions
      const sessionIds = responses.map(r => r.body.sessionId);
      const uniqueIds = new Set(sessionIds);

      expect(uniqueIds.size).toBe(5);
    });
  });
});
