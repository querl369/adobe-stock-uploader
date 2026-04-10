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

import { extractUserId } from '../src/api/middleware/auth.middleware';

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
