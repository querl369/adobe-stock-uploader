import pino from 'pino';

/**
 * Structured Logger Configuration with Pino
 *
 * Features:
 * - Development: Pretty-printed with colors (pino-pretty)
 * - Production: JSON format for log aggregation
 * - Auto-detection based on NODE_ENV
 * - Redaction for sensitive fields (apiKey, password, etc.)
 * - Child logger support for request correlation
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

// Configure Pino options
const pinoOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Redact sensitive fields from logs
  redact: {
    paths: [
      'apiKey',
      'password',
      'token',
      'authorization',
      'OPENAI_API_KEY',
      'headers.authorization',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },

  // Serialize standard objects
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
};

// Configure transport for development (pretty-print)
const transport = isDevelopment
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    }
  : undefined;

// Create logger instance
export const logger = pino({
  ...pinoOptions,
  ...(transport && { transport }),
});

/**
 * Create a child logger with additional context
 * Useful for request-specific logging with correlation IDs
 */
export function createChildLogger(context: Record<string, any>): pino.Logger {
  return logger.child(context);
}

/**
 * Log examples:
 *
 * logger.info('Server started');
 * logger.info({ port: 3000, env: 'dev' }, 'Server started');
 * logger.error({ err: error }, 'Processing failed');
 * logger.warn({ filename: 'image.jpg' }, 'File size exceeds recommended limit');
 *
 * const reqLogger = createChildLogger({ reqId: uuid() });
 * reqLogger.info('Processing request');
 */
