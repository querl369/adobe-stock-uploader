# API Types

## Purpose

This directory contains TypeScript type definitions for API requests and responses, providing type safety for HTTP communication.

## Patterns & Best Practices

### Type Categories

1. **Request Types**: Incoming request bodies, params, query strings
2. **Response Types**: API response structures
3. **DTO Types**: Data Transfer Objects for API contracts
4. **Validation Schemas**: Zod schemas for runtime validation

### Example Structure

```typescript
// Request types
export interface ProcessImageRequest {
  imageUrl: string;
  options?: {
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  };
}

// Response types
export interface ProcessImageResponse {
  success: boolean;
  data?: {
    filename: string;
    metadata: ImageMetadata;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Consistent API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  context?: Record<string, any>;
}
```

### Zod Schemas (Recommended)

```typescript
import { z } from 'zod';

export const ProcessImageSchema = z.object({
  imageUrl: z.string().url(),
  options: z
    .object({
      quality: z.number().min(1).max(100).optional(),
      format: z.enum(['jpeg', 'png', 'webp']).optional(),
    })
    .optional(),
});

export type ProcessImageRequest = z.infer<typeof ProcessImageSchema>;
```

### Guidelines

- **Consistent naming**: Use `Request` and `Response` suffixes
- **Reusable wrappers**: Use standard `ApiResponse<T>` pattern
- **Runtime validation**: Prefer Zod schemas for request validation
- **Type inference**: Use `z.infer<>` to derive types from schemas
- **Documentation**: Add JSDoc comments for complex types
- **Generic responses**: Define reusable response structures
- **Error types**: Standardize error response format

### Standard Response Format

All API responses should follow this structure:

```typescript
{
  "success": true | false,
  "data": { /* response payload */ },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "meta": {
    "timestamp": "2025-11-11T10:00:00Z",
    "requestId": "uuid"
  }
}
```

### Importing

```typescript
import { ProcessImageRequest, ProcessImageResponse } from '@api/types/image.types';
import { ApiResponse } from '@api/types/common.types';
```

### Testing

- Validate schemas with test data
- Test Zod schema parsing and error messages
- Verify type inference works correctly
