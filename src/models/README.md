# Models Layer

This directory contains **data models**, **interfaces**, and **error classes** that define the application's type system.

## Purpose

Models provide:

- ✅ Type safety across the application
- ✅ Clear contracts between layers
- ✅ Documentation of data structures
- ✅ Consistent error handling

## Architecture

```
┌─────────────────────────────────────────────┐
│              Models Layer                   │
│           (YOU ARE HERE)                    │
│                                             │
│  ┌───────────────────────────────────┐     │
│  │  Interfaces & Types               │     │
│  │  • Metadata                       │     │
│  │  • ProcessingResult               │     │
│  │  • BatchProcessingOptions         │     │
│  │  • RawAIMetadata                  │     │
│  └───────────────────────────────────┘     │
│                                             │
│  ┌───────────────────────────────────┐     │
│  │  Error Classes                    │     │
│  │  • AppError (base)                │     │
│  │  • ValidationError                │     │
│  │  • ProcessingError                │     │
│  │  • ExternalServiceError           │     │
│  │  • RateLimitError                 │     │
│  └───────────────────────────────────┘     │
└─────────────────────────────────────────────┘
              ▲                  ▲
              │                  │
    ┌─────────┴──────┐   ┌──────┴─────────┐
    │  Services      │   │  API Routes    │
    │  Use models    │   │  Use models    │
    └────────────────┘   └────────────────┘
```

## Model Files

### metadata.model.ts

**Purpose:** Defines structures for image metadata and processing results.

#### Core Interfaces

**`Metadata`** - Adobe Stock-compliant metadata structure

```typescript
interface Metadata {
  filename: string; // Original image filename
  title: string; // 50-200 chars, descriptive
  keywords: string; // Comma-separated keywords
  category: number; // Adobe Stock category ID
  releases?: string; // Optional release information
}
```

**`ProcessingResult`** - Result of processing a single image

```typescript
interface ProcessingResult {
  success: boolean; // Whether processing succeeded
  filename: string; // Original filename
  metadata?: Metadata; // Present if success = true
  error?: ProcessingError; // Present if success = false
}
```

**`RawAIMetadata`** - Raw response from AI service (before conversion)

```typescript
interface RawAIMetadata {
  title: string;
  keywords: string[]; // Array format from AI
  category: number | string;
}
```

**`BatchProcessingOptions`** - Configuration for batch operations

```typescript
interface BatchProcessingOptions {
  concurrency?: number; // Max parallel operations (default: 5)
  continueOnError?: boolean; // Continue if one fails (default: true)
  timeoutMs?: number; // Timeout per image (default: 30000)
}
```

**`ProcessingError`** - Detailed error information

```typescript
interface ProcessingError {
  code: string; // Error code for categorization
  message: string; // User-friendly message
  stage?: string; // Where error occurred
  context?: Record<string, any>; // Debug context
}
```

### errors.ts

**Purpose:** Defines custom error classes for consistent error handling across the application.

#### Error Hierarchy

```
Error (native)
  └── AppError (base class for all app errors)
       ├── ValidationError (400 errors)
       ├── ProcessingError (500 errors)
       ├── ExternalServiceError (502 errors)
       └── RateLimitError (429 errors)
```

#### Error Classes

**`AppError`** - Base class for all application errors

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public context?: Record<string, any>,
    public isOperational: boolean = true
  )
}
```

**Properties:**

- `code`: Machine-readable error identifier (e.g., 'VALIDATION_FAILED')
- `message`: Human-readable description
- `statusCode`: HTTP status code (400, 500, etc.)
- `context`: Additional debugging information
- `isOperational`: true = expected error, false = programming error

**`ValidationError`** - For invalid input data (HTTP 400)

```typescript
new ValidationError('Invalid file type', { allowedTypes: ['jpg', 'png'], received: 'gif' });
```

**`ProcessingError`** - For processing failures (HTTP 500)

```typescript
new ProcessingError('IMAGE_PROCESSING_FAILED', 'Failed to compress image', 500, {
  filename: 'image.jpg',
  stage: 'compress',
});
```

**`ExternalServiceError`** - For third-party service failures (HTTP 502)

```typescript
new ExternalServiceError('Failed to generate metadata', 'OpenAI API timeout', {
  service: 'openai',
  imageUrl: 'https://...',
});
```

**`RateLimitError`** - For rate limit violations (HTTP 429)

```typescript
new RateLimitError('You have exceeded the free tier limit', 'anonymous', { used: 10, limit: 10 });
```

## Usage Patterns

### Using Metadata Models

**In Services:**

```typescript
import type { Metadata, ProcessingResult } from '@/models/metadata.model';

export class ImageProcessingService {
  async processImage(file: Express.Multer.File): Promise<ProcessingResult> {
    try {
      // ... processing logic
      return {
        success: true,
        filename: file.originalname,
        metadata: {
          filename: file.originalname,
          title: 'Generated title',
          keywords: 'keyword1,keyword2',
          category: 1045,
        },
      };
    } catch (error) {
      return {
        success: false,
        filename: file.originalname,
        error: {
          code: 'PROCESSING_FAILED',
          message: error.message,
          stage: 'metadata-generation',
        },
      };
    }
  }
}
```

**In API Routes:**

```typescript
import type { ProcessingResult } from '@/models/metadata.model';

app.post('/api/process', async (req, res) => {
  const result: ProcessingResult = await services.imageProcessing.processImage(req.file);

  if (result.success) {
    res.json({ metadata: result.metadata });
  } else {
    res.status(500).json({ error: result.error });
  }
});
```

### Using Error Classes

**Throwing Errors:**

```typescript
// In services
if (!file) {
  throw new ValidationError('File is required', { received: null });
}

if (openaiCallFailed) {
  throw new ExternalServiceError('Metadata generation failed', 'OpenAI API returned 500', {
    imageUrl,
    attemptNumber: 3,
  });
}
```

**Catching Errors:**

```typescript
try {
  await service.processImage(file);
} catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof RateLimitError) {
    return res.status(429).json({
      error: error.message,
      retryAfter: error.context?.retryAfter,
    });
  }

  // Handle other errors
  return res.status(500).json({ error: 'Internal server error' });
}
```

**Using Error Middleware:**

```typescript
// In error-handler.ts middleware
import { AppError } from '@/models/errors';

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(config.server.nodeEnv === 'development' && { context: err.context }),
      },
    });
  }

  // Handle unexpected errors
  res.status(500).json({ error: 'Internal server error' });
}
```

## Type Safety Benefits

### Without Models (Unsafe)

```typescript
// ❌ No type checking
const result = await processImage(file);
console.log(result.titel); // Typo! Runtime error
```

### With Models (Safe)

```typescript
// ✅ TypeScript catches typos at compile time
const result: ProcessingResult = await processImage(file);
console.log(result.title); // Error: Property 'titel' does not exist
```

## Design Principles

### 1. Separation of Concerns

Models are **pure data structures** with no business logic:

- ✅ Interfaces define shapes
- ✅ Types define constraints
- ✅ Error classes provide structure
- ❌ No methods (except on error classes)
- ❌ No dependencies on services

### 2. Immutability

Interfaces encourage immutable data flow:

```typescript
// Good: Create new objects
const updatedMetadata: Metadata = {
  ...originalMetadata,
  title: 'New Title',
};

// Avoid: Mutating existing objects
// originalMetadata.title = 'New Title';
```

### 3. Explicit Over Implicit

Optional fields use `?`, required fields are explicit:

```typescript
interface Metadata {
  filename: string; // Required
  title: string; // Required
  releases?: string; // Optional - explicit with ?
}
```

### 4. Error Context

Errors include context for debugging:

```typescript
throw new ProcessingError('COMPRESSION_FAILED', 'Image compression failed', 500, {
  filename: 'large-image.jpg',
  originalSize: '50MB',
  stage: 'sharp-compression',
  attemptNumber: 2,
});
```

## Testing with Models

Models make testing easier:

```typescript
describe('ImageProcessingService', () => {
  it('should return ProcessingResult on success', async () => {
    const result: ProcessingResult = await service.processImage(mockFile);

    expect(result).toMatchObject<ProcessingResult>({
      success: true,
      filename: expect.any(String),
      metadata: expect.objectContaining({
        title: expect.any(String),
        keywords: expect.any(String),
        category: expect.any(Number),
      }),
    });
  });

  it('should return error result on failure', async () => {
    const result: ProcessingResult = await service.processImage(invalidFile);

    expect(result).toMatchObject<ProcessingResult>({
      success: false,
      filename: expect.any(String),
      error: expect.objectContaining({
        code: expect.any(String),
        message: expect.any(String),
      }),
    });
  });
});
```

## Adobe Stock Compliance

The `Metadata` interface follows Adobe Stock CSV requirements:

| Field    | Requirement                   | Validation                  |
| -------- | ----------------------------- | --------------------------- |
| Filename | Original file, required       | Non-empty string            |
| Title    | 50-200 characters             | Length check in CSV service |
| Keywords | 30-50 relevant terms          | Comma-separated string      |
| Category | Valid Adobe Stock category ID | Number from taxonomy        |
| Releases | Optional release info         | Optional string             |

## Adding New Models

To add a new model:

1. **Create or update model file:** `src/models/my-model.ts`

   ```typescript
   export interface MyModel {
     id: string;
     name: string;
     createdAt: Date;
   }
   ```

2. **Document the model:** Add JSDoc comments

   ```typescript
   /**
    * Represents a user in the system
    */
   export interface User {
     /** Unique user identifier (UUID) */
     id: string;

     /** User's email address */
     email: string;
   }
   ```

3. **Export from models:** Consider creating `index.ts` for easy imports

   ```typescript
   // models/index.ts
   export * from './metadata.model';
   export * from './errors';
   export * from './my-model';
   ```

4. **Use in services and routes:**
   ```typescript
   import { MyModel } from '@/models/my-model';
   ```

## Common Patterns

### Result Pattern (Success/Error)

```typescript
interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}
```

Used in:

- `ProcessingResult` (success/failure with metadata or error)
- Batch operations (array of results)

### Options Pattern

```typescript
interface ServiceOptions {
  timeout?: number;
  retries?: number;
  // ... optional configuration
}
```

Used in:

- `BatchProcessingOptions`
- Future: `MetadataGenerationOptions`, `CsvExportOptions`

## Migration from Legacy Code

**Story 1.8** created the following models:

- **New:** `metadata.model.ts` (structured metadata interfaces)
- **Migrated:** `Metadata` interface from `csv-writer.ts`
- **Enhanced:** `ProcessingResult` for consistent responses

**Existing models** (from previous stories):

- `errors.ts` (Story 1.6)

## Best Practices

✅ **DO:**

- Use interfaces for data shapes
- Use types for unions/intersections
- Include JSDoc comments
- Make required fields explicit
- Use optional `?` for truly optional fields
- Version breaking changes (add new interface if needed)

❌ **DON'T:**

- Add business logic to models
- Use `any` type
- Make everything optional
- Nest too deeply (3 levels max)
- Use classes unless you need methods (errors are exception)

## Future Enhancements

Planned model additions for upcoming stories:

- [ ] `BatchStatus` model (Story 2.6 - Progress tracking)
- [ ] `User` model (Story 6.1 - Authentication)
- [ ] `Session` model (Story 2.2 - Anonymous sessions)
- [ ] `UsageStats` model (Story 6.4 - Quota tracking)
- [ ] `HealthStatus` model (Story 1.11 - Health checks)

---

**Last Updated:** Story 1.8 - Service Layer & Dependency Injection  
**Author:** Amelia (Dev Agent)
