/**
 * Auth Middleware Tests
 * Story 6.8: extractUserId helper unit tests
 *
 * Tests JWT extraction from Authorization header:
 * - Returns user_id when valid JWT provided
 * - Returns null when no Authorization header
 * - Returns null when supabaseAdmin is null
 * - Returns null when JWT is invalid/expired
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request } from 'express';

// Mock config (needed by supabase.ts)
vi.mock('../src/config/app.config', () => ({
  config: {
    server: { port: 3000, nodeEnv: 'test', baseUrl: 'http://localhost:3000' },
    supabase: { url: '', serviceRoleKey: '' },
  },
}));

// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Hoisted mock for supabaseAdmin
const mockGetUser = vi.fn();
let mockSupabaseAdmin: unknown = {
  auth: { getUser: mockGetUser },
};

vi.mock('../src/lib/supabase', () => ({
  get supabaseAdmin() {
    return mockSupabaseAdmin;
  },
}));

import { extractUserId, requireAuth } from '../src/api/middleware/auth.middleware';
import { AuthenticationError } from '../src/models/errors';
import type { Response, NextFunction } from 'express';

function createMockRequest(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as Request;
}

describe('extractUserId - Story 6.8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseAdmin = {
      auth: { getUser: mockGetUser },
    };
  });

  it('should return user_id when valid JWT provided', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc-123' } },
      error: null,
    });

    const req = createMockRequest('Bearer valid-jwt-token');
    const result = await extractUserId(req);

    expect(result).toBe('user-abc-123');
    expect(mockGetUser).toHaveBeenCalledWith('valid-jwt-token');
  });

  it('should return null when no Authorization header', async () => {
    const req = createMockRequest();
    const result = await extractUserId(req);

    expect(result).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('should return null when supabaseAdmin is null', async () => {
    mockSupabaseAdmin = null;

    const req = createMockRequest('Bearer some-token');
    const result = await extractUserId(req);

    expect(result).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('should return null when JWT is invalid/expired', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    const req = createMockRequest('Bearer expired-token');
    const result = await extractUserId(req);

    expect(result).toBeNull();
  });

  it('should return null when Authorization header is not Bearer format', async () => {
    const req = createMockRequest('Basic abc123');
    const result = await extractUserId(req);

    expect(result).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('should return null when getUser throws', async () => {
    mockGetUser.mockRejectedValue(new Error('network error'));

    const req = createMockRequest('Bearer valid-token');
    const result = await extractUserId(req);

    expect(result).toBeNull();
  });
});

describe('requireAuth - beta deployment hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseAdmin = {
      auth: { getUser: mockGetUser },
    };
  });

  function createCallables() {
    const res = {} as Response;
    const next = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    return { res, next };
  }

  it('calls next() and sets req.userId on a valid Bearer token', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-xyz-789' } },
      error: null,
    });
    const req = createMockRequest('Bearer good-token') as Request & { userId?: string | null };
    const { res, next } = createCallables();

    await requireAuth(req as any, res, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe('user-xyz-789');
  });

  it('forwards AuthenticationError when Authorization header missing', async () => {
    const req = createMockRequest() as Request;
    const { res, next } = createCallables();

    await requireAuth(req as any, res, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.code).toBe('AUTHENTICATION_ERROR');
    expect(err.statusCode).toBe(401);
  });

  it('forwards AuthenticationError when Bearer token is invalid', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });
    const req = createMockRequest('Bearer expired-token') as Request;
    const { res, next } = createCallables();

    await requireAuth(req as any, res, next as NextFunction);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
  });

  it('forwards AuthenticationError when prefix is malformed (Basic instead of Bearer)', async () => {
    const req = createMockRequest('Basic abc123') as Request;
    const { res, next } = createCallables();

    await requireAuth(req as any, res, next as NextFunction);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('forwards AuthenticationError when supabaseAdmin is unavailable', async () => {
    mockSupabaseAdmin = null;
    const req = createMockRequest('Bearer some-token') as Request;
    const { res, next } = createCallables();

    await requireAuth(req as any, res, next as NextFunction);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
  });
});
