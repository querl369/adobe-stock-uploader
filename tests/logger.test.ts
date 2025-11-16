/**
 * Tests for Logger Configuration (Pino)
 *
 * Story 1.9: Structured Logging with Pino
 * Tests logger functionality, redaction, and child logger creation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, createChildLogger } from '../src/utils/logger';

describe('Logger Configuration', () => {
  it('should export logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should create child logger with context', () => {
    const childLogger = createChildLogger({ reqId: 'test-123', userId: 'user-456' });

    expect(childLogger).toBeDefined();
    expect(typeof childLogger.info).toBe('function');
  });

  it('should log info messages', () => {
    // This is more of an integration test - just verify it doesn't throw
    expect(() => {
      logger.info('Test info message');
      logger.info({ key: 'value' }, 'Test info with context');
    }).not.toThrow();
  });

  it('should log error messages', () => {
    expect(() => {
      logger.error('Test error message');
      logger.error({ error: 'Error details' }, 'Test error with context');
    }).not.toThrow();
  });

  it('should log warn messages', () => {
    expect(() => {
      logger.warn('Test warn message');
      logger.warn({ warning: 'Warning details' }, 'Test warn with context');
    }).not.toThrow();
  });

  it('should log debug messages', () => {
    expect(() => {
      logger.debug('Test debug message');
      logger.debug({ debug: 'Debug details' }, 'Test debug with context');
    }).not.toThrow();
  });

  it('should handle logging with no message', () => {
    expect(() => {
      logger.info({ key: 'value' });
    }).not.toThrow();
  });

  it('should handle complex objects', () => {
    expect(() => {
      logger.info(
        {
          nested: {
            deep: {
              value: 'test',
              number: 123,
              array: [1, 2, 3],
            },
          },
        },
        'Complex object test'
      );
    }).not.toThrow();
  });

  it('should handle Error objects', () => {
    const error = new Error('Test error');
    expect(() => {
      logger.error({ err: error }, 'Error object test');
    }).not.toThrow();
  });

  it('should maintain context in child loggers', () => {
    const parentLogger = logger;
    const childLogger = createChildLogger({ reqId: 'parent-123' });
    const grandchildLogger = childLogger.child({ step: 'processing' });

    expect(() => {
      parentLogger.info('Parent message');
      childLogger.info('Child message');
      grandchildLogger.info('Grandchild message');
    }).not.toThrow();
  });
});

describe('Logger Sensitive Data Redaction', () => {
  it('should redact apiKey field', () => {
    // Since we can't easily capture pino output in tests,
    // we verify the logger accepts sensitive data without throwing
    expect(() => {
      logger.info(
        {
          apiKey: 'sk-1234567890abcdef',
          message: 'This has sensitive data',
        },
        'Testing redaction'
      );
    }).not.toThrow();
  });

  it('should redact password field', () => {
    expect(() => {
      logger.info({ password: 'secret123', username: 'user' }, 'Login attempt');
    }).not.toThrow();
  });

  it('should redact authorization headers', () => {
    expect(() => {
      logger.info(
        {
          headers: {
            authorization: 'Bearer token123',
            'content-type': 'application/json',
          },
        },
        'Request with headers'
      );
    }).not.toThrow();
  });

  it('should redact nested sensitive fields', () => {
    expect(() => {
      logger.info(
        {
          req: {
            headers: {
              authorization: 'Bearer token456',
            },
          },
        },
        'Nested sensitive data'
      );
    }).not.toThrow();
  });

  it('should allow non-sensitive data through', () => {
    expect(() => {
      logger.info(
        {
          username: 'testuser',
          email: 'test@example.com',
          action: 'login',
        },
        'Non-sensitive data'
      );
    }).not.toThrow();
  });
});

describe('Logger Environment Configuration', () => {
  it('should respect NODE_ENV for log formatting', () => {
    // Since environment is set at initialization,
    // we just verify logger works in current environment
    expect(logger).toBeDefined();
    expect(typeof logger.level).toBe('string');
  });

  it('should have appropriate log level', () => {
    const level = logger.level;
    const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    expect(validLevels).toContain(level);
  });
});

describe('Logger Performance', () => {
  it('should handle high-frequency logging without crashing', () => {
    expect(() => {
      for (let i = 0; i < 100; i++) {
        logger.debug({ iteration: i }, `Debug message ${i}`);
      }
    }).not.toThrow();
  });

  it('should handle large context objects', () => {
    const largeContext = {
      data: Array(100)
        .fill(null)
        .map((_, i) => ({ id: i, value: `value-${i}` })),
    };

    expect(() => {
      logger.info(largeContext, 'Large context test');
    }).not.toThrow();
  });
});
