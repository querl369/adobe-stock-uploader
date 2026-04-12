/**
 * UsageTrackingService Tests
 * Story 6.9: Monthly Usage Tracking & Quota Enforcement
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Mock supabaseAdmin with chainable query builder
const mockSingle = vi.fn();
const mockUpsert = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  get supabaseAdmin() {
    return { from: mockFrom };
  },
}));

vi.mock('../src/config/app.config', () => ({
  config: {
    rateLimits: { freeTier: 500 },
  },
}));

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('../src/utils/logger', () => ({
  logger: mockLogger,
}));

describe('UsageTrackingService', () => {
  let service: any;

  beforeAll(async () => {
    const mod = await import('../src/services/usage-tracking.service');
    service = new mod.UsageTrackingService();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up chainable mock: from().select().eq().eq().single()
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockEq.mockReturnThis();
    // The last .eq() call needs to return { single: mockSingle }
    // Use mockImplementation to return different things based on call order
    mockEq.mockImplementation(() => ({ eq: mockEq, single: mockSingle }));
    mockSelect.mockReturnValue({ eq: mockEq });
    mockUpsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
  });

  describe('getCurrentMonthYear', () => {
    it('returns correct YYYY-MM format', () => {
      const result = service.getCurrentMonthYear();
      expect(result).toMatch(/^\d{4}-\d{2}$/);

      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(result).toBe(expected);
    });
  });

  describe('getResetDate', () => {
    it('returns first day of next month as ISO string', () => {
      const result = service.getResetDate();
      const date = new Date(result);
      expect(date.getDate()).toBe(1);

      const now = new Date();
      if (now.getMonth() === 11) {
        expect(date.getMonth()).toBe(0);
        expect(date.getFullYear()).toBe(now.getFullYear() + 1);
      } else {
        expect(date.getMonth()).toBe(now.getMonth() + 1);
      }
    });
  });

  describe('getUsage', () => {
    it('returns usage data for current month', async () => {
      mockSingle.mockResolvedValue({
        data: { images_used: 37 },
        error: null,
      });

      const result = await service.getUsage('user-123');

      expect(result).toEqual({
        used: 37,
        limit: 500,
        remaining: 463,
        resetsAt: expect.any(String),
      });
      expect(mockFrom).toHaveBeenCalledWith('usage_tracking');
    });

    it('returns 0 used when no row exists (PGRST116)', async () => {
      // Supabase .single() returns PGRST116 error when no rows match
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'JSON object requested, return is 0 rows' },
      });

      const result = await service.getUsage('user-123');

      expect(result).toEqual({
        used: 0,
        limit: 500,
        remaining: 500,
        resetsAt: expect.any(String),
      });
      // PGRST116 is expected for new users — should NOT log a warning
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('returns defaults when supabaseAdmin is null', async () => {
      vi.resetModules();
      vi.doMock('../src/lib/supabase', () => ({ supabaseAdmin: null }));
      vi.doMock('../src/config/app.config', () => ({
        config: { rateLimits: { freeTier: 500 } },
      }));
      vi.doMock('../src/utils/logger', () => ({ logger: mockLogger }));

      const mod = await import('../src/services/usage-tracking.service');
      const svc = new mod.UsageTrackingService();

      const result = await svc.getUsage('user-123');
      expect(result).toEqual({
        used: 0,
        limit: 500,
        remaining: 500,
        resetsAt: expect.any(String),
      });

      // Restore original mocks for subsequent tests
      vi.resetModules();
      vi.doMock('../src/lib/supabase', () => ({
        get supabaseAdmin() {
          return { from: mockFrom };
        },
      }));
    });
  });

  describe('checkQuota', () => {
    it('returns allowed=true when under limit', async () => {
      mockSingle.mockResolvedValue({
        data: { images_used: 100 },
        error: null,
      });

      const result = await service.checkQuota('user-123', 5);

      expect(result).toEqual({
        allowed: true,
        used: 100,
        limit: 500,
        remaining: 400,
      });
    });

    it('returns allowed=false when over limit', async () => {
      mockSingle.mockResolvedValue({
        data: { images_used: 498 },
        error: null,
      });

      const result = await service.checkQuota('user-123', 5);

      expect(result).toEqual({
        allowed: false,
        used: 498,
        limit: 500,
        remaining: 2,
      });
    });

    it('returns allowed=true when exactly at limit', async () => {
      mockSingle.mockResolvedValue({
        data: { images_used: 495 },
        error: null,
      });

      const result = await service.checkQuota('user-123', 5);

      expect(result).toEqual({
        allowed: true,
        used: 495,
        limit: 500,
        remaining: 5,
      });
    });
  });

  describe('incrementUsage', () => {
    it('upserts usage row', async () => {
      mockSingle.mockResolvedValue({
        data: { images_used: 10 },
        error: null,
      });

      await service.incrementUsage('user-123', 3);

      expect(mockFrom).toHaveBeenCalledWith('usage_tracking');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          images_used: 13,
        }),
        { onConflict: 'user_id,month_year' }
      );
    });

    it('creates new row when no existing usage', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      await service.incrementUsage('user-123', 5);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          images_used: 5,
        }),
        { onConflict: 'user_id,month_year' }
      );
    });

    it('logs warning on Supabase failure (non-fatal)', async () => {
      mockSingle.mockResolvedValue({ data: { images_used: 10 }, error: null });
      mockUpsert.mockResolvedValue({ error: { message: 'DB error' } });

      // Should NOT throw
      await service.incrementUsage('user-123', 3);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'DB error' }),
        expect.stringContaining('Usage tracking')
      );
    });
  });
});
