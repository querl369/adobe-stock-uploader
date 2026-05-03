/**
 * Usage Routes Tests
 * Story 6.9: Monthly Usage Tracking & Quota Enforcement
 *
 * Tests GET /api/usage endpoint:
 * - Returns usage data for authenticated users
 * - Returns 401 for unauthenticated users
 * - Returns 0 used when no usage row exists
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

// Mock config
vi.mock('../src/config/app.config', () => ({
  config: {
    server: { port: 3000, nodeEnv: 'test', baseUrl: 'http://localhost:3000' },
    rateLimits: { anonymous: 10, freeTier: 500 },
    supabase: { url: undefined, anonKey: undefined, serviceRoleKey: undefined },
  },
}));

// Mock supabase
vi.mock('../src/lib/supabase', () => ({
  supabaseAdmin: null,
}));

// Mock auth middleware - requireAuth delegates to mockExtractUserId so per-test
// `mockExtractUserId.mockResolvedValueOnce(...)` controls auth state for both
// the inline-extractUserId path AND the new requireAuth middleware path.
const { mockExtractUserId } = vi.hoisted(() => ({
  mockExtractUserId: vi.fn().mockResolvedValue(null),
}));
vi.mock('../src/api/middleware/auth.middleware', () => ({
  extractUserId: mockExtractUserId,
  requireAuth: vi.fn(async (req: any, _res: any, next: any) => {
    try {
      const userId = await mockExtractUserId(req);
      if (!userId) {
        const { AuthenticationError } = await import('../src/models/errors');
        next(new AuthenticationError('Sign up or log in to continue'));
        return;
      }
      req.userId = userId;
      next();
    } catch (e) {
      next(e);
    }
  }),
}));

// Mock services container
const mockGetUsage = vi.fn();
vi.mock('../src/config/container', () => ({
  services: {
    usageTracking: {
      getUsage: mockGetUsage,
    },
  },
}));

// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createChildLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

describe('Usage Routes - Story 6.9', () => {
  let app: Express;
  let usageRoutes: any;
  let errorHandler: any;
  let correlationIdMiddleware: any;

  beforeAll(async () => {
    const usageModule = await import('../src/api/routes/usage.routes');
    const errorModule = await import('../src/api/middleware/error-handler');
    const correlationModule = await import('../src/api/middleware/correlation-id.middleware');

    usageRoutes = usageModule.default;
    errorHandler = errorModule.errorHandler;
    correlationIdMiddleware = correlationModule.correlationIdMiddleware;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use(correlationIdMiddleware);
    app.use('/api', usageRoutes);
    app.use(errorHandler);
  });

  it('returns usage data for authenticated user', async () => {
    mockExtractUserId.mockResolvedValueOnce('user-123');
    mockGetUsage.mockResolvedValueOnce({
      used: 37,
      limit: 500,
      remaining: 463,
      resetsAt: '2026-05-01T00:00:00.000Z',
    });

    const response = await request(app).get('/api/usage').expect(200);

    expect(response.body).toEqual({
      tier: 'free',
      monthlyLimit: 500,
      used: 37,
      remaining: 463,
      resetsAt: '2026-05-01T00:00:00.000Z',
    });
    expect(mockGetUsage).toHaveBeenCalledWith('user-123');
  });

  it('returns 401 when no JWT provided', async () => {
    mockExtractUserId.mockResolvedValueOnce(null);

    const response = await request(app).get('/api/usage').expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    expect(response.body.error.message).toBe('Sign up or log in to continue');
    expect(mockGetUsage).not.toHaveBeenCalled();
  });

  it('returns 0 used when no usage row exists', async () => {
    mockExtractUserId.mockResolvedValueOnce('user-456');
    mockGetUsage.mockResolvedValueOnce({
      used: 0,
      limit: 500,
      remaining: 500,
      resetsAt: '2026-05-01T00:00:00.000Z',
    });

    const response = await request(app).get('/api/usage').expect(200);

    expect(response.body).toEqual({
      tier: 'free',
      monthlyLimit: 500,
      used: 0,
      remaining: 500,
      resetsAt: '2026-05-01T00:00:00.000Z',
    });
  });
});
