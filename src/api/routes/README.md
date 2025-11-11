# API Routes

## Purpose

This directory contains Express route handlers that define the application's HTTP endpoints. Routes should be thin controllers that delegate business logic to services.

## Patterns & Best Practices

### Route Handler Responsibilities

- Parse and validate incoming requests
- Delegate business logic to services
- Format responses
- Handle HTTP-specific concerns (status codes, headers)
- Use middleware for cross-cutting concerns (auth, validation, error handling)

### Example Structure

```typescript
import { Router } from 'express';
import { imageProcessingService } from '@services/image-processing.service';
import { asyncHandler } from '@api/middleware/async-handler';

const router = Router();

router.post(
  '/process-image',
  asyncHandler(async (req, res) => {
    // Parse request
    const file = req.file;

    // Delegate to service
    const result = await imageProcessingService.processImage(file);

    // Format response
    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
```

### Guidelines

- **Thin controllers**: Keep route handlers simple - delegate to services
- **Use asyncHandler**: Wrap async handlers to automatically catch errors
- **Consistent responses**: Use standard JSON response format
- **Type safety**: Define request/response types in `@api/types`
- **Validation**: Use middleware for input validation
- **Error handling**: Let errors bubble up to error middleware

### Importing

Use TypeScript path aliases for clean imports:

```typescript
import { someService } from '@services/some.service';
import { SomeType } from '@api/types/some.types';
import { authMiddleware } from '@api/middleware/auth.middleware';
```

### Testing

- Test route behavior (status codes, response format)
- Mock service dependencies
- Focus on HTTP concerns, not business logic
- Use supertest for integration testing
