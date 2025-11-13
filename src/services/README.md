# Services Layer

This directory contains business logic services following the **Dependency Injection (DI)** pattern for testability and maintainability.

## Architecture

Services implement the application's core business logic and coordinate between different layers:

```
┌─────────────────────────────────────────────┐
│            API Routes Layer                 │
│  (Thin handlers, delegate to services)      │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│          Service Layer (YOU ARE HERE)       │
│  • TempUrlService                           │
│  • MetadataService                          │
│  • ImageProcessingService                   │
│  • CsvExportService                         │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         External Dependencies               │
│  • OpenAI API                               │
│  • Filesystem                               │
│  • Sharp (image processing)                 │
└─────────────────────────────────────────────┘
```

## Available Services

### TempUrlService

**Location:** `temp-url.service.ts`

Creates temporary, self-hosted URLs for images. Replaces Cloudinary (eliminates $0.01-0.02 per image cost).

**Key Features:**

- Compresses images with Sharp (1024px max, 85% quality)
- Generates secure UUID-based URLs
- Automatic cleanup after configured lifetime
- Background cleanup job for old files

**Usage:**

```typescript
const url = await services.tempUrl.createTempUrl(multerFile);
// Returns: https://yourapp.com/temp/uuid-123.jpg
```

### MetadataService

**Location:** `metadata.service.ts`

Generates image metadata using OpenAI Vision API. Wraps API calls with error handling and retry logic.

**Key Features:**

- OpenAI Vision API integration
- Retry logic for resilience (handles 429, 5xx errors)
- JSON response parsing (handles markdown code blocks)
- ExternalServiceError wrapping for consistent error handling

**Usage:**

```typescript
const rawMetadata = await services.metadata.generateMetadata(imageUrl);
console.log(rawMetadata.title, rawMetadata.keywords, rawMetadata.category);
```

### ImageProcessingService

**Location:** `image-processing.service.ts`

Orchestrates the complete image processing workflow from upload to metadata generation.

**Key Features:**

- Complete processing pipeline (temp URL → AI → cleanup)
- Batch processing with concurrency control
- Graceful error handling (failed images don't block successful ones)
- Timeout protection (30s default per image)
- ProcessingResult objects for consistent response format

**Dependencies:** `TempUrlService`, `MetadataService`

**Usage:**

```typescript
// Single image
const result = await services.imageProcessing.processImage(multerFile);
if (result.success) {
  console.log('Metadata:', result.metadata);
}

// Batch processing
const results = await services.imageProcessing.processBatch(multerFiles, {
  concurrency: 5,
  continueOnError: true,
  timeoutMs: 30000,
});
```

### CsvExportService

**Location:** `csv-export.service.ts`

Generates Adobe Stock-compliant CSV files from metadata objects.

**Key Features:**

- RFC 4180 CSV format compliance
- UTF-8 encoding
- Metadata validation (title length, required fields)
- Batch validation for entire metadata lists

**Usage:**

```typescript
await services.csvExport.generateCSV(metadataList, outputPath);

// Validate before export
const validation = services.csvExport.validateMetadataList(metadataList);
if (!validation.valid) {
  console.error('Invalid items:', validation.invalidItems);
}
```

## Dependency Injection Container

All services are registered in the **DI Container** for centralized management:

**Location:** `src/config/container.ts`

```typescript
import { services } from '@/config/container';

// Access any service
await services.imageProcessing.processImage(file);
await services.csvExport.generateCSV(metadata, path);
```

**Benefits:**

- ✅ Single source of truth for service instances
- ✅ Proper dependency ordering (services initialize correctly)
- ✅ Easy mocking for tests
- ✅ Lazy initialization (services created on first use)

## Service Design Principles

### 1. Dependency Injection via Constructor

Services receive dependencies through constructor parameters:

```typescript
export class ImageProcessingService {
  constructor(
    private tempUrlService: TempUrlService,
    private metadataService: MetadataService
  ) {}
}
```

**Benefits:**

- Clear dependencies
- Easy testing (inject mocks)
- Loose coupling

### 2. Single Responsibility

Each service has ONE clear purpose:

- `TempUrlService` → Host images temporarily
- `MetadataService` → Generate metadata
- `ImageProcessingService` → Orchestrate workflow
- `CsvExportService` → Export to CSV

### 3. Error Handling

Services throw typed errors from `src/models/errors.ts`:

```typescript
throw new ExternalServiceError('Failed to generate metadata', 'OpenAI API timeout', { imageUrl });
```

### 4. Retry Logic

Use `withRetry` wrapper for external API calls:

```typescript
import { withRetry } from '@/utils/retry';

const result = await withRetry(
  () => this.openai.chat.completions.create(...),
  { maxAttempts: 3, retryableErrors: err => err.status === 429 }
);
```

## Testing Services

Services are designed for testability. Mock dependencies in tests:

```typescript
// Example test setup
const mockTempUrl = {
  createTempUrl: jest.fn().mockResolvedValue('https://test.com/image.jpg'),
};

const mockMetadata = {
  generateMetadata: jest.fn().mockResolvedValue({
    title: 'Test Title',
    keywords: ['test', 'image'],
    category: 1,
  }),
};

const service = new ImageProcessingService(mockTempUrl, mockMetadata);

// Test service behavior with mocked dependencies
const result = await service.processImage(mockFile);
expect(result.success).toBe(true);
```

## Adding New Services

To add a new service:

1. **Create service file:** `src/services/my-service.ts`
2. **Implement service class:**

   ```typescript
   export class MyService {
     constructor(private dependency: OtherService) {}

     async myMethod(): Promise<Result> {
       // Business logic here
     }
   }
   ```

3. **Register in container:** `src/config/container.ts`

   ```typescript
   const myService = new MyService(otherService);

   return {
     // ... other services
     myService,
   };
   ```

4. **Create tests:** `tests/my-service.test.ts`

## Migration from Legacy Code

**Story 1.8** migrated the following utilities to services:

- `src/openai.ts` → `MetadataService`
- `src/csv-writer.ts` → `CsvExportService`
- Scattered logic → `ImageProcessingService`

**Remaining legacy code** (will be refactored in future stories):

- `src/files-manipulation.ts` (image utilities)

## Best Practices

✅ **DO:**

- Use constructor injection for dependencies
- Return typed results (interfaces from `models/`)
- Throw typed errors (`ProcessingError`, `ExternalServiceError`)
- Log important operations with context
- Use `withRetry` for external API calls

❌ **DON'T:**

- Instantiate services directly (use container)
- Mix business logic with HTTP concerns
- Catch errors without re-throwing or wrapping
- Use hardcoded configuration (use `config` service)
- Make services dependent on Express types (pass plain objects)

## Performance Considerations

- **Concurrency:** `ImageProcessingService` supports configurable parallelism
- **Timeouts:** All processing operations have 30s default timeout
- **Cleanup:** TempUrlService automatically removes old files
- **Retry:** Failed operations retry with exponential backoff

## Configuration

Services read configuration from `src/config/app.config.ts`:

```typescript
config.processing.concurrencyLimit; // Default: 5
config.processing.maxFileSizeMB; // Default: 50
config.processing.tempFileLifetime; // Default: 10 seconds
config.openai.model; // Default: gpt-5-mini
```

## Future Enhancements

Planned improvements for future stories:

- [ ] Add `p-limit` for true concurrent batch processing
- [ ] Implement service-level metrics collection
- [ ] Add batch status tracking service
- [ ] Implement queue-based processing for large batches
- [ ] Add comprehensive service-level logging
- [ ] Implement caching layer for repeated requests

---

**Last Updated:** Story 1.8 - Service Layer & Dependency Injection  
**Author:** Amelia (Dev Agent)
