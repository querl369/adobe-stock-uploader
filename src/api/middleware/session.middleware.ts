/**
 * Session Middleware
 * Story 2.2: Cookie-Based Anonymous Session Tracking
 *
 * Creates and validates session cookies for anonymous users
 * Tracks session usage for rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../../services/session.service';

/**
 * Session cookie configuration
 * Story 2.2 AC: Secure HTTP-only cookie with 1-hour expiry
 */
export const SESSION_COOKIE_NAME = 'session_id';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Session middleware
 * Creates session cookie if not present
 * Validates and refreshes existing sessions
 *
 * Adds req.sessionId for downstream middleware/routes
 */
export interface SessionRequest extends Request {
  sessionId?: string;
}

export const sessionMiddleware = (req: SessionRequest, res: Response, next: NextFunction): void => {
  try {
    // Check if session cookie exists
    let sessionId = req.cookies?.[SESSION_COOKIE_NAME];

    // If no cookie or session expired, create new session
    if (!sessionId || !sessionService.getSession(sessionId)) {
      sessionId = sessionService.createSession();

      // Set secure HTTP-only cookie
      res.cookie(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict',
        maxAge: SESSION_COOKIE_MAX_AGE,
      });

      req.log.info({ sessionId }, 'New session created and cookie set');
    } else {
      req.log.debug({ sessionId }, 'Existing session validated');
    }

    // Attach session ID to request for downstream use
    req.sessionId = sessionId;

    next();
  } catch (error) {
    req.log.error({ error }, 'Session middleware error');
    next(error);
  }
};

/**
 * Get session usage message for user feedback
 * Story 2.2 AC: "X of 10 free images used"
 */
export const getSessionUsageMessage = (sessionId: string): string => {
  const used = sessionService.getSessionUsage(sessionId);
  const limit = 10; // Anonymous limit
  return `${used} of ${limit} free images used`;
};
