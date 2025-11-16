import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { createChildLogger, logger } from '@utils/logger';
import type { Logger } from 'pino';

/**
 * Extend Express Request type to include correlation ID and child logger
 */
declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
    }
  }
}

/**
 * Correlation ID Middleware
 *
 * Generates a unique UUID for each request and attaches:
 * - req.id: Correlation ID
 * - req.log: Child logger with correlation ID in context
 *
 * All logs within the request lifecycle will include the correlation ID,
 * making it easy to trace a single request through all logs.
 *
 * Usage:
 *   app.use(correlationIdMiddleware);
 *   // In route handlers:
 *   req.log.info('Processing request'); // Logs include reqId
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate unique correlation ID for this request
  const correlationId = randomUUID();

  // Attach correlation ID to request
  req.id = correlationId;

  // Create child logger with correlation ID context
  req.log = createChildLogger({
    reqId: correlationId,
    method: req.method,
    path: req.path,
  });

  // Log incoming request
  req.log.info(
    {
      method: req.method,
      url: req.url,
      userAgent: req.get('user-agent'),
    },
    'Incoming request'
  );

  // Capture response time
  const startTime = Date.now();

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    req.log.info(
      {
        statusCode: res.statusCode,
        duration,
      },
      'Request completed'
    );
  });

  next();
}

/**
 * Example usage in routes:
 *
 * app.post('/api/process-image', async (req: Request, res: Response) => {
 *   req.log.info({ filename: 'image.jpg' }, 'Starting image processing');
 *   // All logs will include reqId automatically
 * });
 */
