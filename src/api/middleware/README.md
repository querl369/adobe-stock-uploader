# API Middleware

## Purpose

This directory contains Express middleware functions for cross-cutting concerns that run before route handlers, including authentication, validation, error handling, and request processing.

## Patterns & Best Practices

### Middleware Types

1. **Authentication/Authorization**: Verify user identity and permissions
2. **Validation**: Check request format and data integrity
3. **Error Handling**: Catch and format errors consistently
4. **Logging**: Track requests and responses
5. **Rate Limiting**: Prevent abuse
6. **Request Processing**: Parse, transform, or enrich requests

### Example Structure

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@models/errors';

export function exampleMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Perform middleware logic
    // Modify req, res as needed

    // Pass control to next middleware/handler
    next();
  } catch (error) {
    // Pass errors to error handler
    next(error);
  }
}
```

### Async Handler Pattern

```typescript
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

### Error Handler Pattern

```typescript
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Log error
  // Format response
  // Send appropriate status code
}
```

### Guidelines

- **Single responsibility**: Each middleware does one thing well
- **Call next()**: Always call next() to continue the chain
- **Error handling**: Use next(error) to pass errors
- **Type safety**: Use proper Express types
- **Reusability**: Make middleware composable and reusable
- **Order matters**: Register middleware in correct order in server.ts

### Common Middleware

- `auth.middleware.ts` - JWT authentication
- `validation.middleware.ts` - Request validation with Zod
- `error-handler.ts` - Centralized error handling
- `rate-limit.middleware.ts` - Rate limiting logic
- `async-handler.ts` - Async error wrapper
- `logger.middleware.ts` - Request/response logging

### Importing

```typescript
import { authMiddleware } from '@api/middleware/auth.middleware';
import { validateRequest } from '@api/middleware/validation.middleware';
```

### Testing

- Test middleware in isolation
- Mock req, res, next objects
- Verify next() is called appropriately
- Test error scenarios
