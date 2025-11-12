# API Middleware

This directory contains Express middleware functions for request processing, error handling, and cross-cutting concerns.

## Files

### `error-handler.ts`

Centralized error handling middleware that provides:

- **Consistent error responses** - All errors follow the same JSON structure
- **Security** - Sensitive information is never exposed in production
- **Typed errors** - Works with custom AppError classes for different scenarios
- **Async support** - `asyncHandler` wrapper eliminates try-catch boilerplate

#### Usage

```typescript
// In route handlers:
import { asyncHandler } from '@api/middleware/error-handler';
import { ValidationError } from '@models/errors';

app.post(
  '/api/process',
  asyncHandler(async (req, res) => {
    // Errors automatically caught and passed to error handler
    if (!req.body.filename) {
      throw new ValidationError('Filename is required');
    }

    const result = await processImage(req.body);
    res.json(result);
  })
);

// In server.ts (MUST be registered last):
import { errorHandler, notFoundHandler } from '@api/middleware/error-handler';

// ... all routes here ...

app.use(notFoundHandler); // Handle 404s
app.use(errorHandler); // Handle all other errors
```

#### Error Response Format

All errors return this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "context": {
      "additionalInfo": "Optional debugging context"
    }
  }
}
```

#### HTTP Status Codes

- `400` - ValidationError (bad request)
- `401` - AuthenticationError (unauthorized)
- `404` - NotFoundError (not found)
- `429` - RateLimitError (too many requests)
- `500` - ProcessingError (internal server error)
- `502` - ExternalServiceError (bad gateway)

## Future Middleware

As the application grows, this directory will contain:

- **Authentication middleware** (`auth.middleware.ts`) - JWT validation
- **Rate limiting middleware** (`rate-limit.middleware.ts`) - Request throttling
- **Validation middleware** (`validation.middleware.ts`) - Request body validation
- **Logging middleware** (`logging.middleware.ts`) - Request/response logging
- **CORS middleware** (`cors.middleware.ts`) - Cross-origin resource sharing

## Design Patterns

- **Thin middleware** - Single responsibility, composable
- **Fail fast** - Validate early, throw meaningful errors
- **Immutable requests** - Don't modify req/res unless necessary
- **Type safety** - Use TypeScript interfaces for middleware contracts
