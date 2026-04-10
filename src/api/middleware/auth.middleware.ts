/**
 * Auth Middleware
 * Story 6.8: Optional JWT extraction for authenticated batch processing
 *
 * Extracts and verifies Supabase JWT from Authorization header.
 * Non-throwing — returns null for anonymous users or invalid tokens.
 */

import type { Request } from 'express';
import { supabaseAdmin } from '../../lib/supabase';
import { logger } from '../../utils/logger';

/**
 * Extract user ID from Supabase JWT in Authorization header.
 * Returns null if no header, invalid token, or supabaseAdmin unavailable.
 * Never throws — designed for optional auth on existing anonymous endpoints.
 */
export async function extractUserId(req: Request): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.debug({ error: error?.message }, 'JWT verification failed');
      return null;
    }

    return user.id;
  } catch (error) {
    logger.debug(
      { error: error instanceof Error ? error.message : 'Unknown' },
      'JWT extraction error'
    );
    return null;
  }
}
