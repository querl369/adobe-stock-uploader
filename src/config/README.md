# Configuration

## Purpose

This directory contains application configuration, environment validation, and dependency injection container. All configuration should be loaded and validated once at startup.

## Patterns & Best Practices

### Configuration Files

- `app.config.ts` - Main configuration with Zod validation
- `container.ts` - Dependency injection container for services

### Configuration Structure

```typescript
import { z } from 'zod';

// Define schema with validation
const configSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    nodeEnv: z.enum(['development', 'production', 'test']),
    baseUrl: z.string().url(),
  }),
  openai: z.object({
    apiKey: z.string().min(1),
    model: z.string().default('gpt-4o-mini'),
    maxTokens: z.number().default(500),
    temperature: z.number().min(0).max(2).default(0.3),
  }),
  processing: z.object({
    concurrencyLimit: z.number().default(5),
    maxFileSizeMb: z.number().default(50),
    tempFileLifetimeSeconds: z.number().default(10),
  }),
  rateLimits: z.object({
    anonymous: z.number().default(10),
    freeTier: z.number().default(100),
  }),
});

// Parse and validate environment
const rawConfig = {
  server: {
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  },
  // ... more config
};

// Export validated config
export const config = configSchema.parse(rawConfig);
export type AppConfig = z.infer<typeof configSchema>;
```

### Dependency Injection Container

```typescript
import { TempUrlService } from '@services/temp-url.service';
import { MetadataService } from '@services/metadata.service';
import { ImageProcessingService } from '@services/image-processing.service';
import { config } from './app.config';

// Initialize services with dependencies
const tempUrlService = new TempUrlService(config);
const metadataService = new MetadataService(config);
const imageProcessingService = new ImageProcessingService(tempUrlService, metadataService);

// Export container
export const services = {
  tempUrl: tempUrlService,
  metadata: metadataService,
  imageProcessing: imageProcessingService,
};

export type ServiceContainer = typeof services;
```

### Guidelines

- **Validate early**: Use Zod to validate config at startup - fail fast on invalid config
- **Type safety**: Infer types from Zod schemas
- **Environment variables**: Only access `process.env` in config files
- **Defaults**: Provide sensible defaults for optional config
- **No secrets in code**: All sensitive values from environment variables
- **Single source of truth**: All config through config service
- **Dependency injection**: Use container pattern for service instantiation
- **Immutable**: Configuration should be read-only after validation
- **Documentation**: Document all config options

### Configuration Sections

- **Server**: Port, environment, base URL
- **OpenAI**: API key, model, parameters
- **Processing**: Concurrency, file limits, timeouts
- **Rate Limits**: Anonymous and user quotas
- **Storage**: File paths, temp directory settings
- **Database**: Connection strings (future)

### Environment Variables

Create `.env.example` to document all required variables:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.3

# Processing Configuration
CONCURRENCY_LIMIT=5
MAX_FILE_SIZE_MB=50
TEMP_FILE_LIFETIME_SECONDS=10

# Rate Limits
ANONYMOUS_LIMIT=10
FREE_TIER_LIMIT=100
```

### Importing

```typescript
import { config } from '@config/app.config';
import { services } from '@config/container';

// Use config
const apiKey = config.openai.apiKey;

// Use services
const result = await services.imageProcessing.processImage(file);
```

### Testing

- Mock config for testing: provide test configuration objects
- Validate that invalid config throws errors
- Test that defaults are applied correctly
- Test service container initialization

### Startup Flow

1. Load environment variables (dotenv)
2. Validate configuration with Zod
3. Initialize services with validated config
4. Export container for use throughout app
5. Server starts only if config is valid

This ensures errors are caught at startup, not during runtime.
