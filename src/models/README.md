# Models

## Purpose

This directory contains TypeScript interfaces, types, and data models that represent the core domain entities and business objects of the application.

## Patterns & Best Practices

### Model Types

1. **Domain Models**: Core business entities (Image, Metadata, Batch)
2. **Value Objects**: Immutable data structures (Result, Status)
3. **Error Models**: Typed error classes
4. **Enums**: Constant sets of values

### Example Structure

```typescript
// Domain model
export interface ImageMetadata {
  filename: string;
  title: string;
  keywords: string[];
  category: number;
  generatedAt: Date;
}

// Result type
export interface ProcessingResult {
  success: boolean;
  filename: string;
  metadata?: ImageMetadata;
  error?: string;
}

// Status enum
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Batch model
export interface ProcessingBatch {
  id: string;
  userId?: string;
  sessionId?: string;
  images: ProcessingResult[];
  status: ProcessingStatus;
  createdAt: Date;
  completedAt?: Date;
}
```

### Error Models

```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super('VALIDATION_ERROR', message, 400, context);
  }
}

export class ProcessingError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super('PROCESSING_ERROR', message, 500, context);
  }
}
```

### Guidelines

- **Interfaces over classes**: Use interfaces for data structures (unless behavior is needed)
- **Immutability**: Prefer readonly properties where applicable
- **Type safety**: Avoid `any`, use specific types
- **Documentation**: Add JSDoc comments for complex models
- **Validation**: Models define structure, validation happens in services/middleware
- **Domain-driven**: Models should reflect business concepts
- **Reusability**: Create composable, reusable types
- **Separate concerns**: Domain models vs API types vs database schemas

### Naming Conventions

- **Interfaces**: PascalCase (e.g., `ImageMetadata`)
- **Enums**: PascalCase (e.g., `ProcessingStatus`)
- **Types**: PascalCase (e.g., `ProcessingResult`)
- **Files**: kebab-case (e.g., `image-metadata.model.ts`)

### File Organization

```
models/
├── errors.ts                 # Error class hierarchy
├── metadata.model.ts         # Metadata domain models
├── processing.model.ts       # Processing-related models
├── batch.model.ts           # Batch processing models
├── user.model.ts            # User models (future)
└── common.model.ts          # Shared types and utilities
```

### Importing

```typescript
import { ImageMetadata, ProcessingResult } from '@models/metadata.model';
import { AppError, ValidationError } from '@models/errors';
import { ProcessingStatus } from '@models/processing.model';
```

### Relationship to Other Layers

- **Services**: Use models for business logic
- **API Types**: API DTOs may differ from domain models (transformation in routes/services)
- **Database**: ORM models may differ from domain models (transformation in repositories)

### Testing

- Models typically don't need unit tests (they're just types)
- Error classes can be tested for proper inheritance and behavior
- Validate that enums have expected values
