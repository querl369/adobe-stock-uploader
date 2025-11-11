# Utils

## Purpose

This directory contains pure utility functions that are reusable across the application. Utilities should be stateless, focused helper functions with no side effects.

## Patterns & Best Practices

### What Belongs Here

- **Pure functions**: No side effects, same input always produces same output
- **Helper utilities**: String manipulation, date formatting, validation
- **Constants**: Shared constant values
- **Common operations**: Retry logic, sleep, UUID generation
- **Type guards**: TypeScript type checking functions
- **Converters**: Data transformation utilities

### Example Structure

```typescript
// retry.ts - Exponential backoff retry logic
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

```typescript
// logger.ts - Structured logging setup
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
});
```

```typescript
// validators.ts - Common validation functions
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
```

### Guidelines

- **Pure functions**: No side effects, testable in isolation
- **Single responsibility**: Each function does one thing well
- **Reusability**: Generic enough to use across the codebase
- **No dependencies on other layers**: Utils don't import from services/models (except types)
- **Well-documented**: Add JSDoc comments with examples
- **Type safe**: Properly typed parameters and return values
- **No business logic**: Business logic belongs in services
- **No state**: Utilities should be stateless

### What DOESN'T Belong Here

- Business logic (belongs in services)
- HTTP concerns (belongs in routes/middleware)
- Database operations (belongs in repositories)
- External API calls (belongs in services)
- Stateful classes (belongs in services)

### File Organization

```
utils/
├── retry.ts              # Retry logic with exponential backoff
├── logger.ts             # Pino logger configuration
├── validators.ts         # Validation helper functions
├── constants.ts          # Application-wide constants
├── date-helpers.ts       # Date manipulation utilities
├── string-helpers.ts     # String utilities
└── type-guards.ts        # TypeScript type guards
```

### Common Utilities

- **retry.ts**: Exponential backoff retry logic
- **logger.ts**: Structured logging with Pino
- **metrics.ts**: Prometheus metrics setup
- **validators.ts**: Input validation helpers
- **adobe-stock-categories.ts**: Adobe Stock category mapping
- **file-helpers.ts**: File operation utilities

### Importing

```typescript
import { withRetry } from '@utils/retry';
import { logger } from '@utils/logger';
import { isValidEmail } from '@utils/validators';
```

### Testing

- Utilities should be heavily unit tested
- Test pure functions with various inputs
- Test edge cases and error conditions
- 100% code coverage goal for utilities
- No mocking needed (pure functions)

### Example: Retry Utility

```typescript
// Usage
const metadata = await withRetry(
  () =>
    openai.chat.completions.create({
      /* ... */
    }),
  {
    maxAttempts: 3,
    initialDelayMs: 1000,
    retryableErrors: error => error.status === 429,
  }
);
```

### Example: Logger

```typescript
// Usage
logger.info({ filename: 'image.jpg', duration: 1234 }, 'Processing completed');
logger.error({ error: err }, 'Processing failed');
```

### Constants

```typescript
// constants.ts
export const ADOBE_CATEGORIES = {
  Animals: 1,
  'Buildings and Architecture': 2,
  Business: 3,
  // ...
} as const;

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const SUPPORTED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'] as const;
```
