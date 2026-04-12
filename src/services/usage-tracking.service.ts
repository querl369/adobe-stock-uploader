/**
 * Usage Tracking Service
 * Story 6.9: Monthly Usage Tracking & Quota Enforcement
 *
 * Tracks monthly image processing usage per user.
 * Provides quota checking and usage increment for free-tier enforcement.
 * Uses Supabase `usage_tracking` table with (user_id, month_year) unique key.
 */

import { supabaseAdmin } from '../lib/supabase';
import { config } from '../config/app.config';
import { logger } from '../utils/logger';

export class UsageTrackingService {
  /**
   * Get current month in YYYY-MM format.
   */
  getCurrentMonthYear(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get the first day of next month as ISO string (quota reset date).
   */
  getResetDate(): string {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toISOString();
  }

  /**
   * Get usage data for a user in the current month.
   * Returns defaults (0 used) when no row exists or Supabase unavailable.
   */
  async getUsage(
    userId: string
  ): Promise<{ used: number; limit: number; remaining: number; resetsAt: string }> {
    const limit = config.rateLimits.freeTier;
    const resetsAt = this.getResetDate();

    if (!supabaseAdmin) {
      return { used: 0, limit, remaining: limit, resetsAt };
    }

    try {
      const monthYear = this.getCurrentMonthYear();
      const { data, error } = await Promise.resolve(
        supabaseAdmin
          .from('usage_tracking')
          .select('images_used')
          .eq('user_id', userId)
          .eq('month_year', monthYear)
          .single()
      );

      if (error || !data) {
        // PGRST116 = "JSON object requested, return is 0 rows" — expected for new users
        if (error && error.code !== 'PGRST116') {
          logger.warn(
            { error: error.message, userId },
            'Usage tracking query failed — returning defaults'
          );
        }
        return { used: 0, limit, remaining: limit, resetsAt };
      }

      const used = data.images_used;
      return { used, limit, remaining: Math.max(0, limit - used), resetsAt };
    } catch (err) {
      logger.warn(
        { error: err instanceof Error ? err.message : 'Unknown', userId },
        'Unexpected error in getUsage — returning defaults'
      );
      return { used: 0, limit, remaining: limit, resetsAt };
    }
  }

  /**
   * Check if a user has quota available for the requested image count.
   */
  async checkQuota(
    userId: string,
    requestedCount: number
  ): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
    const { used, limit, remaining } = await this.getUsage(userId);
    const allowed = used + requestedCount <= limit;
    return { allowed, used, limit, remaining };
  }

  /**
   * Increment usage after successful batch completion.
   * Non-fatal: logs warning on failure, never throws.
   */
  async incrementUsage(userId: string, imageCount: number): Promise<void> {
    if (!supabaseAdmin) {
      logger.warn('Usage tracking skipped — Supabase not configured');
      return;
    }

    try {
      const monthYear = this.getCurrentMonthYear();

      // Fetch current usage first (Supabase upsert doesn't support atomic increment).
      // Known limitation: concurrent batch completions for the same user could lose
      // count increments (read-then-write race). Acceptable for free tier; consider
      // Supabase RPC with atomic SQL increment if accuracy becomes critical.
      const { data } = await Promise.resolve(
        supabaseAdmin
          .from('usage_tracking')
          .select('images_used')
          .eq('user_id', userId)
          .eq('month_year', monthYear)
          .single()
      );

      const currentUsed = data?.images_used ?? 0;
      const newCount = currentUsed + imageCount;

      const { error } = await Promise.resolve(
        supabaseAdmin.from('usage_tracking').upsert(
          {
            user_id: userId,
            month_year: monthYear,
            images_used: newCount,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,month_year' }
        )
      );

      if (error) {
        logger.warn({ error: error.message }, 'Usage tracking upsert failed');
      }
    } catch (err) {
      logger.warn(
        { error: err instanceof Error ? err.message : 'Unknown' },
        'Usage tracking increment failed'
      );
    }
  }
}
