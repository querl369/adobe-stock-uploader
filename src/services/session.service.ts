/**
 * Session Service
 * Story 2.2: Cookie-Based Anonymous Session Tracking
 *
 * Manages anonymous user sessions with cookie-based tracking
 * Enforces image upload limits per session
 */

import { randomUUID } from 'crypto';
import { logger } from '@utils/logger';
import { config } from '../config/app.config';

interface SessionData {
  sessionId: string;
  imagesProcessed: number;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * In-memory session store (MVP)
 * Future: Replace with Redis for production scalability
 */
class SessionService {
  private sessions: Map<string, SessionData> = new Map();
  private readonly SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
  private readonly MAX_ANONYMOUS_IMAGES = config.rateLimits.anonymous;
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // Start cleanup job (runs every 10 minutes)
    this.startCleanupJob();
    logger.info('SessionService initialized');
  }

  /**
   * Create a new anonymous session
   * Returns session ID (UUID)
   */
  createSession(): string {
    const sessionId = randomUUID();
    const now = new Date();

    this.sessions.set(sessionId, {
      sessionId,
      imagesProcessed: 0,
      createdAt: now,
      lastActivityAt: now,
    });

    logger.debug({ sessionId }, 'New session created');
    return sessionId;
  }

  /**
   * Get session data by ID
   * Returns null if session not found or expired
   */
  getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if expired
    if (this.isSessionExpired(sessionId)) {
      this.sessions.delete(sessionId);
      logger.debug({ sessionId }, 'Session expired and removed');
      return null;
    }

    return session;
  }

  /**
   * Get session usage (number of images processed)
   */
  getSessionUsage(sessionId: string): number {
    const session = this.getSession(sessionId);
    return session ? session.imagesProcessed : 0;
  }

  /**
   * Get remaining images for session
   */
  getRemainingImages(sessionId: string): number {
    const used = this.getSessionUsage(sessionId);
    return Math.max(0, this.MAX_ANONYMOUS_IMAGES - used);
  }

  /**
   * Increment session usage by N images
   * Updates last activity timestamp
   */
  incrementUsage(sessionId: string, count: number = 1): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      logger.warn({ sessionId }, 'Attempted to increment non-existent session');
      return;
    }

    session.imagesProcessed += count;
    session.lastActivityAt = new Date();

    logger.debug(
      { sessionId, imagesProcessed: session.imagesProcessed, count },
      'Session usage incremented'
    );
  }

  /**
   * Check if session has reached upload limit
   */
  hasReachedLimit(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    return session.imagesProcessed >= this.MAX_ANONYMOUS_IMAGES;
  }

  /**
   * Check if session is expired (inactive for 1 hour)
   */
  isSessionExpired(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return true;

    const now = Date.now();
    const lastActivity = session.lastActivityAt.getTime();
    return now - lastActivity > this.SESSION_EXPIRY_MS;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    logger.debug({ sessionId }, 'Session deleted');
  }

  /**
   * Get total active sessions count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Start background cleanup job
   * Runs every 10 minutes to remove expired sessions
   */
  private startCleanupJob(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      10 * 60 * 1000
    ); // 10 minutes

    logger.info('Session cleanup job started (interval: 10 minutes)');
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const beforeCount = this.sessions.size;
    let removedCount = 0;

    for (const [sessionId] of this.sessions) {
      if (this.isSessionExpired(sessionId)) {
        this.sessions.delete(sessionId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info(
        { beforeCount, afterCount: this.sessions.size, removedCount },
        'Expired sessions cleaned up'
      );
    }
  }

  /**
   * Stop cleanup job (for graceful shutdown)
   */
  stopCleanupJob(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      logger.info('Session cleanup job stopped');
    }
  }

  /**
   * Clear all sessions (for testing)
   */
  clearAll(): void {
    this.sessions.clear();
    logger.debug('All sessions cleared');
  }
}

// Singleton instance
export const sessionService = new SessionService();
