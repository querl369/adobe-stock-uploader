/**
 * Rate Limiting Middleware
 * Story 2.3: Rate Limiting Middleware
 *
 * Prevents abuse by enforcing upload limits:
 * - Anonymous users: 10 images per session per hour
 * - Per-IP rate limit: 50 requests per minute
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError, RateLimitError } from '../../models/errors';
import { sessionService } from '../../services/session.service';
import { SessionRequest } from './session.middleware';

/**
 * Rate limit store for IP-based throttling
 * Maps IP address to { count, resetTime }
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const ipRateLimits: Map<string, RateLimitEntry> = new Map();

/**
 * Per-IP rate limit: 50 requests per minute
 */
const IP_RATE_LIMIT = 50;
const IP_RATE_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * IP-based rate limiting middleware
 * Prevents brute force and DoS attacks
 */
export const ipRateLimitMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // Get or create rate limit entry for this IP
    let entry = ipRateLimits.get(clientIp);

    // Reset if window expired
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + IP_RATE_WINDOW_MS,
      };
      ipRateLimits.set(clientIp, entry);
    }

    // Increment request count
    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', IP_RATE_LIMIT.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, IP_RATE_LIMIT - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

    // Check if limit exceeded
    if (entry.count > IP_RATE_LIMIT) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());

      req.log.warn(
        { clientIp, count: entry.count, limit: IP_RATE_LIMIT },
        'IP rate limit exceeded'
      );

      throw new RateLimitError(
        `Rate limit exceeded. Too many requests from this IP. Try again in ${retryAfter} seconds.`,
        retryAfter
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Session-based upload limit middleware
 * Enforces anonymous user limit: 10 images per session
 *
 * Must be used AFTER sessionMiddleware
 */
export const sessionUploadLimitMiddleware = (imageCount: number) => {
  return (req: SessionRequest, res: Response, next: NextFunction): void => {
    try {
      const sessionId = req.sessionId;

      if (!sessionId) {
        req.log.error('Session ID not found - sessionMiddleware not applied?');
        throw new ValidationError('Session not initialized');
      }

      const currentUsage = sessionService.getSessionUsage(sessionId);
      const remaining = sessionService.getRemainingImages(sessionId);

      // Set session usage headers
      res.setHeader('X-Session-Usage', currentUsage.toString());
      res.setHeader('X-Session-Remaining', remaining.toString());
      res.setHeader('X-Session-Limit', '10');

      // Check if adding these images would exceed limit
      if (currentUsage + imageCount > 10) {
        const retryAfter = 3600; // 1 hour (session expiry)
        res.setHeader('Retry-After', retryAfter.toString());

        req.log.warn(
          { sessionId, currentUsage, imageCount, limit: 10 },
          'Session upload limit exceeded'
        );

        throw new RateLimitError(
          `Anonymous upload limit exceeded. You have processed ${currentUsage} of 10 free images. ` +
            `Please wait 1 hour or create an account for higher limits.`,
          retryAfter
        );
      }

      req.log.debug(
        { sessionId, currentUsage, imageCount, remaining: remaining - imageCount },
        'Session upload limit check passed'
      );

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Cleanup expired IP rate limit entries
 * Run periodically to prevent memory leaks
 */
export const cleanupIpRateLimits = (): void => {
  const now = Date.now();
  let removedCount = 0;

  for (const [ip, entry] of ipRateLimits.entries()) {
    if (now > entry.resetTime) {
      ipRateLimits.delete(ip);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`Cleaned up ${removedCount} expired IP rate limit entries`);
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupIpRateLimits, 5 * 60 * 1000);
