# Data Models

This directory contains data models, interfaces, and custom error classes used throughout the application.

## Files

### `errors.ts`

Custom error classes that extend the base `Error` class with additional context and structure.

#### Error Classes

##### `AppError` (Base Class)

Abstract base class for all application errors. Provides:

- `code` - Machine-readable error code
- `statusCode` - HTTP status code for API responses
- `isOperational` - Flag to distinguish expected errors from programming errors
- `context` - Additional debugging information
- `toJSON()` - Serializes error for API responses

##### `ValidationError` (400)

Used for input validation failures and malformed requests.

```typescript
import { ValidationError } from '@models/errors';

// Example: Invalid file type
throw new ValidationError('File type not supported', {
  filename: 'test.txt',
  allowedTypes: ['jpg', 'png', 'webp'],
});
```

##### `ProcessingError` (500)

Used for image processing failures and internal operations.

```typescript
import { ProcessingError } from '@models/errors';

// Example: Compression failure
throw new ProcessingError('Image compression failed', {
  filename: 'image.jpg',
  stage: 'compress',
  originalError: err,
});
```

Stages: `compress`, `temp-url`, `metadata`, `csv`, `cleanup`

##### `ExternalServiceError` (502)

Used for external API failures (OpenAI, filesystem, network).

```typescript
import { ExternalServiceError } from '@models/errors';

// Example: OpenAI timeout
throw new ExternalServiceError('OpenAI API request timeout', {
  service: 'openai',
  statusCode: 504,
  originalError: err,
});
```

Services: `openai`, `filesystem`, `network`

##### `RateLimitError` (429)

Used for rate limiting enforcement.

```typescript
import { RateLimitError } from '@models/errors';

// Example: Anonymous limit exceeded
throw new RateLimitError(
  'You have exceeded the free tier limit of 10 images',
  3600, // retryAfter in seconds
  { limit: 10, used: 10 }
);
```

##### `NotFoundError` (404)

Used when a resource cannot be found.

```typescript
import { NotFoundError } from '@models/errors';

// Example: File not found
throw new NotFoundError('File not found', {
  fileId: 'abc123',
  path: 'uploads/missing.jpg',
});
```

##### `AuthenticationError` (401)

Used for authentication and authorization failures.

```typescript
import { AuthenticationError } from '@models/errors';

// Example: Invalid token
throw new AuthenticationError('Invalid or expired authentication token', {
  reason: 'token_expired',
});
```

#### Helper Functions

##### `isAppError(error: any): error is AppError`

Type guard to check if an error is an `AppError` instance.

```typescript
if (isAppError(error)) {
  console.log(error.code, error.statusCode);
}
```

##### `isOperationalError(error: any): boolean`

Check if an error is operational (expected) vs a programming error.

```typescript
if (isOperationalError(error)) {
  // Expected error, handle gracefully
} else {
  // Programming error, log and alert
}
```

## Future Models

As the application grows, this directory will contain:

- **Metadata models** (`metadata.model.ts`) - Image metadata structures
- **User models** (`user.model.ts`) - User account data
- **Batch models** (`batch.model.ts`) - Processing batch data
- **Session models** (`session.model.ts`) - Anonymous session tracking

## Design Principles

- **Typed errors** - Always use specific error classes, not generic `Error`
- **Context-rich** - Include debugging information in `context` field
- **User-friendly** - Error messages should be clear and actionable
- **Secure** - Never expose sensitive information (API keys, passwords)
- **Serializable** - All models should be JSON-serializable
