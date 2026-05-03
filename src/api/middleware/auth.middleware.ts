/**
 * Auth Middleware
 * Story 6.8: Optional JWT extraction for authenticated batch processing
 *
 * Extracts and verifies Supabase JWT from Authorization header.
 * Non-throwing — returns null for anonymous users or invalid tokens.
 */

import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { AuthenticationError } from '../../models/errors';
import type { SessionRequest } from './session.middleware';

export interface AuthAwareRequest extends SessionRequest {
  userId?: string | null;
}

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

/**
 * Populates req.userId by calling extractUserId. Non-throwing; anonymous
 * requests get userId = null. Runs before multer so auth state is known
 * before any file bytes are written to disk.
 */
export async function attachUserIdMiddleware(
  req: AuthAwareRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    req.userId = await extractUserId(req);
  } catch {
    req.userId = null;
  }
  next();
}

/**
 * Strict auth gate. Forwards AuthenticationError to the error handler when
 * the request lacks a valid Supabase JWT, otherwise sets req.userId and
 * passes to the next handler. Use on endpoints that must not run for
 * anonymous callers (metadata generation, history, usage, CSV download).
 */
export async function requireAuth(
  req: AuthAwareRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      next(new AuthenticationError('Sign up or log in to continue'));
      return;
    }
    req.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
}
