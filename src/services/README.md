# Services

## Purpose

This directory contains the business logic layer of the application. Services encapsulate domain logic, coordinate operations, and interact with external systems. They are the core of the application architecture.

## Patterns & Best Practices

### Service Responsibilities

- Implement business logic and rules
- Orchestrate operations across multiple components
- Interact with external APIs (OpenAI, file systems, etc.)
- Manage transactions and state
- Enforce domain constraints
- Transform data between layers

### Service Structure

```typescript
import { config } from '@config/app.config';
import { TempUrlService } from '@services/temp-url.service';
import { MetadataService } from '@services/metadata.service';
import { ProcessingError } from '@models/errors';
import { ProcessingResult } from '@models/processing.model';

export class ImageProcessingService {
  constructor(
    private readonly tempUrlService: TempUrlService,
    private readonly metadataService: MetadataService
  ) {}

  async processImage(file: Express.Multer.File): Promise<ProcessingResult> {
    try {
      // Business logic implementation
      const tempUrl = await this.tempUrlService.createTempUrl(file);
      const metadata = await this.metadataService.generateMetadata(tempUrl);

      return {
        success: true,
        filename: file.originalname,
        metadata,
      };
    } catch (error) {
      throw new ProcessingError('Image processing failed', {
        filename: file.originalname,
        error: error.message,
      });
    }
  }
}
```

### Dependency Injection Pattern

Services use constructor injection for dependencies:

```typescript
// In container.ts
export const services = {
  tempUrl: new TempUrlService(config),
  metadata: new MetadataService(config),
  imageProcessing: new ImageProcessingService(services.tempUrl, services.metadata),
};
```

### Guidelines

- **Single responsibility**: Each service has one clear purpose
- **Dependency injection**: Use constructor injection for dependencies
- **No HTTP concerns**: Services don't know about Express/HTTP
- **Type safety**: Use interfaces from `@models`
- **Error handling**: Throw typed errors from `@models/errors`
- **Pure business logic**: No UI or transport layer concerns
- **Testable**: Easy to mock dependencies for unit testing
- **Stateless when possible**: Avoid mutable state in services
- **Configuration**: Use config service, not environment variables directly

### Common Service Types

- **Domain Services**: Core business logic (ImageProcessingService)
- **Infrastructure Services**: External system integration (MetadataService, TempUrlService)
- **Application Services**: Orchestration (BatchProcessingService)
- **Utility Services**: Cross-cutting concerns (CacheService, LoggerService)

### Service Naming

- Use descriptive names ending in `Service`
- Group related services (e.g., `image-processing.service.ts`)
- One class per file
- Export singleton instances from container

### Importing

```typescript
import { ImageProcessingService } from '@services/image-processing.service';
import { services } from '@config/container';

// In routes
const result = await services.imageProcessing.processImage(file);
```

### Testing

- Unit test services in isolation
- Mock dependencies via constructor injection
- Test business logic thoroughly
- Test error scenarios and edge cases
- Use dependency injection for easy mocking
- No need to mock HTTP - services are transport-agnostic

### Example Services

- `metadata.service.ts` - OpenAI API integration
- `image-processing.service.ts` - Image processing orchestration
- `temp-url.service.ts` - Temporary URL management
- `csv-export.service.ts` - CSV file generation
- `batch-processing.service.ts` - Parallel batch processing
- `session.service.ts` - Session management
- `usage-tracking.service.ts` - User quota tracking
