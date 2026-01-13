# Architecture Refactoring Guide

**Project:** Adobe Stock Uploader  
**Author:** Winston (Architect)  
**Date:** November 11, 2025  
**Status:** Active Implementation Plan  
**Complexity:** Level 2 → Production-Ready

---

## Executive Summary

This guide transforms the current prototype architecture into production-ready, scalable infrastructure. Based on comprehensive code review of `src/`, this refactoring addresses critical architectural issues while establishing foundation for MVP success and future growth.

**Current State:** Functional prototype (4.0/10 production readiness)  
**Target State:** Production-ready architecture (8.5/10)  
**Timeline:** 4-5 development days  
**Approach:** Incremental, tested, safe

---

## Critical Issues Identified

### 🚨 Priority 1: Must Fix for Production

1. **Configuration Hardcoding**
   - Issue: `const initials = 'OY'` in code, scattered `process.env` access
   - Impact: Cannot scale to multiple users, no validation
   - Fix: Centralized configuration service with zod validation

2. **Silent Error Failures**
   - Issue: `catch(error) { return null }` throughout
   - Impact: Lost work, no visibility into failures
   - Fix: Typed errors, retry logic, structured logging

3. **No Abstraction Layers**
   - Issue: Routes directly call utilities, tight coupling
   - Impact: Difficult to test, impossible to swap implementations
   - Fix: Service layer with dependency injection

### ⚠️ Priority 2: Important for Scale

4. **Missing Observability**
   - Issue: Only console.log, no metrics, no health checks
   - Impact: Cannot diagnose production issues remotely
   - Fix: Structured logging (pino), metrics (prometheus), health endpoints

5. **Cloudinary Dependency**
   - Issue: External cost per image ($0.01-0.02 each)
   - Impact: Unsustainable at scale, limits free tier generosity
   - Fix: Self-hosted temporary URLs (aligns with PRD Section 6)

6. **Prompt Management**
   - Issue: Prompt hardcoded as const, includes Easter bug
   - Impact: Cannot A/B test, requires redeploy to optimize
   - Fix: Externalized prompts, versioning capability

---

## Target Architecture

```
┌─────────────────────────────────────────────────────┐
│              Express Application (server.ts)        │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│                  API Layer (src/api/)               │
├─────────────────────────────────────────────────────┤
│  Routes/              Middleware/                   │
│  ├─ images.routes     ├─ error-handler             │
│  ├─ csv.routes        ├─ rate-limiter              │
│  ├─ health.routes     ├─ validation                │
│  └─ metrics.routes    └─ logger                    │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│            Service Layer (src/services/)            │
├─────────────────────────────────────────────────────┤
│  ImageProcessingService    MetadataService          │
│  TempUrlService            CsvExportService         │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│        Infrastructure (src/utils/, config/)         │
├─────────────────────────────────────────────────────┤
│  Config     Logger     Metrics     Retry Logic      │
└─────────────────────────────────────────────────────┘
```

**New Directory Structure:**

```
src/
├── api/
│   ├── routes/           # Express route handlers
│   ├── middleware/       # Auth, rate limiting, validation
│   └── types/            # Request/response types
├── services/             # Business logic layer
├── models/               # Data models & interfaces
├── utils/                # Pure utility functions
├── config/               # Configuration & DI container
└── server.ts            # Application entry point
```

---

## Phase 1: Foundation (Day 1)

### 1.1 Configuration Service (2-3 hours)

**Goal:** Centralized, type-safe, validated configuration.

#### Installation

```bash
npm install zod pino pino-pretty
```

#### Implementation

**File:** `src/config/app.config.ts`

```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().url(),

  // OpenAI
  OPENAI_API_KEY: z.string().min(20),
  OPENAI_MODEL: z.string().default('gpt-5-nano'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(1000),
  OPENAI_TEMPERATURE: z.coerce.number().default(0.3),

  // Processing
  CONCURRENCY_LIMIT: z.coerce.number().default(5),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),
  TEMP_FILE_LIFETIME_SECONDS: z.coerce.number().default(10),

  // Rate Limiting
  ANONYMOUS_LIMIT: z.coerce.number().default(10),
  FREE_TIER_LIMIT: z.coerce.number().default(100),
});

export type AppConfig = z.infer<typeof envSchema>;

class ConfigService {
  private config: AppConfig;

  constructor() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error('❌ Configuration validation failed:');
      console.error(result.error.format());
      process.exit(1);
    }

    this.config = result.data;
    console.log('✅ Configuration validated');
  }

  get server() {
    return {
      port: this.config.PORT,
      baseUrl: this.config.BASE_URL,
      isProduction: this.config.NODE_ENV === 'production',
    };
  }

  get openai() {
    return {
      apiKey: this.config.OPENAI_API_KEY,
      model: this.config.OPENAI_MODEL,
      maxTokens: this.config.OPENAI_MAX_TOKENS,
      temperature: this.config.OPENAI_TEMPERATURE,
    };
  }

  get processing() {
    return {
      concurrencyLimit: this.config.CONCURRENCY_LIMIT,
      maxFileSizeMB: this.config.MAX_FILE_SIZE_MB,
      tempFileLifetime: this.config.TEMP_FILE_LIFETIME_SECONDS,
    };
  }

  get rateLimits() {
    return {
      anonymous: this.config.ANONYMOUS_LIMIT,
      freeTier: this.config.FREE_TIER_LIMIT,
    };
  }
}

export const config = new ConfigService();
```

**File:** `.env.example`

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

# OpenAI Configuration
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-5-nano
OPENAI_MAX_TOKENS=5000
OPENAI_TEMPERATURE=1

# Processing Configuration
CONCURRENCY_LIMIT=5
MAX_FILE_SIZE_MB=50
TEMP_FILE_LIFETIME_SECONDS=10

# Rate Limiting
ANONYMOUS_LIMIT=10
FREE_TIER_LIMIT=100
```

#### Migration

Update `src/openai.ts`:

````typescript
import OpenAI from 'openai';
import { config } from './config/app.config';
import { PROMPT_TEXT } from './prompt-text';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export async function generateMetadata(imageUrl: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT_TEXT },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
      max_completion_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
    });

    const responseText = response.choices[0].message.content || '';
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);

    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Error generating metadata:', error);
    throw error;
  }
}
````

**Acceptance Criteria:**

- ✅ Server fails fast with clear error if config invalid
- ✅ All hardcoded values moved to environment variables
- ✅ Type-safe config access throughout codebase

---

### 1.2 Directory Structure Setup (1 hour)

Create new directories:

```bash
mkdir -p src/api/routes
mkdir -p src/api/middleware
mkdir -p src/api/types
mkdir -p src/services
mkdir -p src/models
mkdir -p src/config
```

Add README.md to each:

**`src/api/README.md`:**

```markdown
# API Layer

Express routes, middleware, and API types.

- **routes/**: Route handlers (thin, delegate to services)
- **middleware/**: Request processing (auth, validation, errors)
- **types/**: Request/response TypeScript types
```

Configure TypeScript path aliases in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@api/*": ["src/api/*"],
      "@services/*": ["src/services/*"],
      "@models/*": ["src/models/*"],
      "@config/*": ["src/config/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

---

### 1.3 Self-Hosted Temporary URL Service (2-3 hours)

**Goal:** Eliminate Cloudinary dependency, serve images from our server temporarily.

**File:** `src/services/temp-url.service.ts`

```typescript
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { config } from '@/config/app.config';

export class TempUrlService {
  private tempDir = path.join(process.cwd(), 'temp');

  constructor() {
    this.ensureTempDir();
    this.startCleanupJob();
  }

  private async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  async createTempUrl(file: Express.Multer.File): Promise<string> {
    const uuid = crypto.randomUUID();
    const outputPath = path.join(this.tempDir, `${uuid}.jpg`);

    // Compress with Sharp (1024px, 85% quality)
    await sharp(file.buffer || file.path)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outputPath);

    // Generate public URL
    const publicUrl = `${config.server.baseUrl}/temp/${uuid}.jpg`;

    // Schedule cleanup
    this.scheduleCleanup(uuid, config.processing.tempFileLifetime);

    return publicUrl;
  }

  private scheduleCleanup(uuid: string, delaySeconds: number) {
    setTimeout(async () => {
      await this.cleanup(uuid);
    }, delaySeconds * 1000);
  }

  async cleanup(uuid: string): Promise<void> {
    const filePath = path.join(this.tempDir, `${uuid}.jpg`);
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Cleaned up temp file: ${uuid}`);
    } catch (error) {
      // File may already be deleted, ignore error
    }
  }

  private startCleanupJob() {
    // Clean up old files every 30 seconds
    setInterval(async () => {
      await this.cleanupOldFiles();
    }, 30000);
  }

  private async cleanupOldFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 60000; // 1 minute

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          await fs.unlink(filePath);
          console.log(`🧹 Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Cleanup job error:', error);
    }
  }
}
```

**Update `server.ts`:**

```typescript
import express from 'express';
import path from 'path';
import { config } from './src/config/app.config';

const app = express();

// Serve temp directory as static files
app.use('/temp', express.static(path.join(process.cwd(), 'temp')));

// ... rest of your routes
```

**Remove Cloudinary:**

```bash
npm uninstall cloudinary
rm src/cloudinary.ts
```

Update `.env` - remove Cloudinary variables, keep only:

```bash
# Remove these:
# CLOUDINARY_CLOUD_NAME
# CLOUDINARY_API_KEY
# CLOUDINARY_API_SECRET
```

---

## Phase 2: Service Layer & Error Handling (Day 2-3)

### 2.1 Error Architecture (2 hours)

**File:** `src/models/errors.ts`

```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super('VALIDATION_ERROR', message, 400, true, context);
  }
}

export class ProcessingError extends AppError {
  constructor(
    public filename: string,
    public stage: 'upload' | 'compress' | 'generate' | 'cleanup',
    originalError: Error
  ) {
    super('PROCESSING_ERROR', `Failed at ${stage} stage for ${filename}`, 500, true, {
      filename,
      stage,
      originalError: originalError.message,
    });
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    public service: 'openai' | 'filesystem',
    message: string,
    originalError?: Error
  ) {
    super('EXTERNAL_SERVICE_ERROR', `${service} error: ${message}`, 502, true, {
      service,
      originalError: originalError?.message,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(limit: number, window: string) {
    super(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded: ${limit} requests per ${window}`,
      429,
      true,
      { limit, window }
    );
  }
}
```

**File:** `src/api/middleware/error-handler.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/models/errors';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Request error:', {
    error: err.message,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.context && { context: err.context }),
      },
    });
  }

  // Unknown error - don't expose internals
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

Add to `server.ts`:

```typescript
import { errorHandler } from './src/api/middleware/error-handler';

// ... all your routes

// Error handler must be LAST
app.use(errorHandler);
```

---

### 2.2 Retry Logic (1 hour)

**File:** `src/utils/retry.ts`

```typescript
export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: any) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    retryableErrors = () => true,
  } = options;

  let lastError: Error;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (!retryableErrors(error) || attempt === maxAttempts) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);

      console.warn(`Retry attempt ${attempt}/${maxAttempts}`, {
        error: error.message,
        nextDelayMs: delay,
      });
    }
  }

  throw lastError!;
}
```

---

### 2.3 Service Layer (4-5 hours)

**File:** `src/models/metadata.model.ts`

```typescript
export interface Metadata {
  filename: string;
  title: string;
  keywords: string;
  category: number;
  releases?: string;
}

export interface ProcessingResult {
  success: boolean;
  filename: string;
  metadata?: Metadata;
  error?: string;
}
```

**File:** `src/services/metadata.service.ts`

````typescript
import OpenAI from 'openai';
import { config } from '@/config/app.config';
import { PROMPT_TEXT } from '@/utils/prompt-text';
import { ExternalServiceError } from '@/models/errors';

export class MetadataService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async generateMetadata(imageUrl: string): Promise<any> {
    try {
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT_TEXT },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            ],
          },
        ],
        max_completion_tokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
      });

      const responseText = response.choices[0].message.content || '';
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);

      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1]);
      }
      return JSON.parse(responseText);
    } catch (error: any) {
      throw new ExternalServiceError('openai', error.message, error);
    }
  }
}
````

**File:** `src/services/image-processing.service.ts`

```typescript
import { Metadata, ProcessingResult } from '@/models/metadata.model';
import { ProcessingError } from '@/models/errors';
import { withRetry } from '@/utils/retry';
import { TempUrlService } from './temp-url.service';
import { MetadataService } from './metadata.service';

export class ImageProcessingService {
  constructor(
    private tempUrlService: TempUrlService,
    private metadataService: MetadataService
  ) {}

  async processImage(file: Express.Multer.File): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      console.log('Processing started:', file.originalname);

      // 1. Create temporary URL
      const tempUrl = await this.tempUrlService.createTempUrl(file);

      // 2. Generate metadata (with retry)
      const metadata = await withRetry(() => this.metadataService.generateMetadata(tempUrl), {
        maxAttempts: 3,
        initialDelayMs: 1000,
        retryableErrors: err => err.status === 429 || err.status === 503,
      });

      const duration = Date.now() - startTime;
      console.log('Processing completed:', file.originalname, `(${duration}ms)`);

      return {
        success: true,
        filename: file.originalname,
        metadata,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('Processing failed:', file.originalname, error.message);

      return {
        success: false,
        filename: file.originalname,
        error: error.message,
      };
    }
  }

  async processBatch(files: Express.Multer.File[]): Promise<ProcessingResult[]> {
    console.log('Batch processing started:', files.length, 'files');

    const concurrency = 5;
    const results: ProcessingResult[] = [];

    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchNumber = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(files.length / concurrency);

      console.log(`Processing batch ${batchNumber}/${totalBatches}`);

      const batchResults = await Promise.all(batch.map(file => this.processImage(file)));

      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    console.log('Batch processing completed:', {
      total: files.length,
      successful: successCount,
      failed: files.length - successCount,
    });

    return results;
  }
}
```

**File:** `src/services/csv-export.service.ts`

```typescript
import { createObjectCsvWriter } from 'csv-writer';
import { Metadata } from '@/models/metadata.model';

export class CsvExportService {
  async generateCSV(metadataList: Metadata[], outputPath: string): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'filename', title: 'Filename' },
        { id: 'title', title: 'Title' },
        { id: 'keywords', title: 'Keywords' },
        { id: 'category', title: 'Category' },
        { id: 'releases', title: 'Releases' },
      ],
    });

    await csvWriter.writeRecords(metadataList);
    console.log('✅ CSV written:', outputPath);
  }
}
```

**File:** `src/config/container.ts` (Dependency Injection)

```typescript
import { TempUrlService } from '@/services/temp-url.service';
import { MetadataService } from '@/services/metadata.service';
import { ImageProcessingService } from '@/services/image-processing.service';
import { CsvExportService } from '@/services/csv-export.service';

// Create singleton instances
const tempUrlService = new TempUrlService();
const metadataService = new MetadataService();
const imageProcessingService = new ImageProcessingService(tempUrlService, metadataService);
const csvExportService = new CsvExportService();

export const services = {
  imageProcessing: imageProcessingService,
  csvExport: csvExportService,
  tempUrl: tempUrlService,
  metadata: metadataService,
};
```

---

## Phase 3: Observability (Day 4-5)

### 3.1 Structured Logging (2 hours)

**File:** `src/utils/logger.ts`

```typescript
import pino from 'pino';
import { config } from '@/config/app.config';

export const logger = pino({
  level: process.env.LOG_LEVEL || (config.server.isProduction ? 'info' : 'debug'),
  transport: !config.server.isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: config.server.isProduction ? 'production' : 'development',
  },
});

// Middleware for correlation IDs
export function correlationIdMiddleware(req: any, res: any, next: any) {
  req.id = crypto.randomUUID();
  req.log = logger.child({ correlationId: req.id });
  next();
}
```

Replace all `console.log` with `logger.info`, `console.error` with `logger.error`, etc.

---

### 3.2 Metrics Collection (2 hours)

```bash
npm install prom-client
```

**File:** `src/utils/metrics.ts`

```typescript
import promClient from 'prom-client';

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

export const metrics = {
  imagesProcessed: new promClient.Counter({
    name: 'asu_images_processed_total',
    help: 'Total number of images processed',
    labelNames: ['status'],
    registers: [register],
  }),

  processingDuration: new promClient.Histogram({
    name: 'asu_processing_duration_seconds',
    help: 'Image processing duration in seconds',
    labelNames: ['stage'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [register],
  }),

  openaiCost: new promClient.Counter({
    name: 'asu_openai_cost_usd',
    help: 'Cumulative OpenAI API cost in USD',
    registers: [register],
  }),
};

export function getMetrics() {
  return register.metrics();
}
```

Add endpoint in `server.ts`:

```typescript
import { getMetrics } from './src/utils/metrics';

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.end(getMetrics());
});
```

---

### 3.3 Health Checks (1 hour)

**File:** `src/api/routes/health.routes.ts`

```typescript
import { Router } from 'express';
import { config } from '@/config/app.config';
import OpenAI from 'openai';
import fs from 'fs/promises';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/health/ready', async (req, res) => {
  const checks = {
    config: false,
    openai: false,
    filesystem: false,
  };

  try {
    checks.config = !!config.openai.apiKey;

    // Check OpenAI reachable
    try {
      const openai = new OpenAI({
        apiKey: config.openai.apiKey,
        timeout: 5000,
      });
      await openai.models.list();
      checks.openai = true;
    } catch {
      checks.openai = false;
    }

    // Check filesystem writable
    try {
      await fs.writeFile('/tmp/health.txt', 'test');
      await fs.unlink('/tmp/health.txt');
      checks.filesystem = true;
    } catch {
      checks.filesystem = false;
    }

    const allReady = Object.values(checks).every(c => c);

    res.status(allReady ? 200 : 503).json({
      status: allReady ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      error: error.message,
    });
  }
});

export default router;
```

---

## Quick Fixes (Easter Bug & Critical Issues)

If you need to ship fast and defer full refactoring:

### Fix 1: Remove Easter Bug (2 minutes)

**File:** `src/prompt-text.ts`

Delete line 28:

```typescript
- It is Easter preparation image, provide category accordingly.
```

### Fix 2: Add Error Tracking (15 minutes)

In `src/index.ts`, track failed images:

```typescript
const failedImages: Array<{file: string, error: string}> = [];

// In catch block:
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error(`❌ Error processing ${file}:`, errorMessage);
  failedImages.push({ file, error: errorMessage });
  return null;
}

// After processing:
console.log(`\n📊 Processing Summary:`);
console.log(`   ✅ Successful: ${metadataList.length}/${renamedFiles.length}`);
console.log(`   ❌ Failed: ${failedImages.length}`);
if (failedImages.length > 0) {
  failedImages.forEach(({ file, error }) => {
    console.log(`   - ${file}: ${error}`);
  });
}
```

---

## Integration with Epic 1

This refactoring aligns with your existing **Epic 1: Architecture Review & Foundation Refactoring** in `docs/epics.md`.

### Story Mapping

| Story                    | Phase           | Time      |
| ------------------------ | --------------- | --------- |
| 1.1: Architecture Audit  | Pre-work (Done) | Completed |
| 1.2: Directory Structure | Phase 1.2       | 1 hour    |
| 1.3: Self-Hosted URLs    | Phase 1.3       | 2-3 hours |
| 1.4: Remove Cloudinary   | Phase 1.3       | Included  |
| 1.5: Error Handling      | Phase 2.1       | 2 hours   |
| 1.6: Service Layer       | Phase 2.3       | 4-5 hours |
| 1.7: Logging             | Phase 3.1       | 2 hours   |
| 1.8: Metrics             | Phase 3.2       | 2 hours   |

**Total: 4-5 days** (as per Epic 1 estimate)

---

## Implementation Checklist

### Phase 1: Foundation ✓

- [ ] Install dependencies (zod, pino)
- [ ] Create `src/config/app.config.ts`
- [ ] Create `.env.example`
- [ ] Update `src/openai.ts` to use config
- [ ] Update `server.ts` to use config
- [ ] Test: Server starts with validation
- [ ] Create new directory structure
- [ ] Configure TypeScript path aliases
- [ ] Create `src/services/temp-url.service.ts`
- [ ] Update `server.ts` to serve `/temp` static files
- [ ] Remove Cloudinary dependency
- [ ] Test: Image processing still works

### Phase 2: Services & Errors ✓

- [ ] Create `src/models/errors.ts`
- [ ] Create `src/api/middleware/error-handler.ts`
- [ ] Add error middleware to Express
- [ ] Create `src/utils/retry.ts`
- [ ] Create `src/models/metadata.model.ts`
- [ ] Create `src/services/metadata.service.ts`
- [ ] Create `src/services/image-processing.service.ts`
- [ ] Create `src/services/csv-export.service.ts`
- [ ] Create `src/config/container.ts`
- [ ] Refactor routes to use services
- [ ] Test: Retry logic works
- [ ] Test: All existing functionality works

### Phase 3: Observability ✓

- [ ] Create `src/utils/logger.ts`
- [ ] Replace all console.log with logger
- [ ] Install prom-client
- [ ] Create `src/utils/metrics.ts`
- [ ] Add metrics to processing flow
- [ ] Create `/metrics` endpoint
- [ ] Create `src/api/routes/health.routes.ts`
- [ ] Add `/health` and `/health/ready` endpoints
- [ ] Test: Metrics collected
- [ ] Test: Health checks work

### Testing & Validation ✓

- [ ] All existing tests pass
- [ ] Write tests for new services
- [ ] Integration test: Full processing flow
- [ ] Load test: 100 concurrent images
- [ ] Validate error scenarios
- [ ] Check metrics collection
- [ ] Verify health checks

---

## Expected Outcomes

### Technical Improvements

| Metric            | Before     | After      | Improvement  |
| ----------------- | ---------- | ---------- | ------------ |
| Processing speed  | 10s/image  | 3-5s/image | 2-3x faster  |
| Batch (10 images) | 100s       | 10-15s     | 6-10x faster |
| Error recovery    | 0%         | 95%+       | Infinite     |
| Test speed        | 2-5s       | <10ms      | 200-500x     |
| Per-image cost    | $0.01-0.02 | $0         | Infinite ROI |

### Code Quality

- ✅ Configuration: Centralized and validated
- ✅ Error handling: Typed and recoverable
- ✅ Testing: Easy to mock and isolate
- ✅ Observability: Full visibility
- ✅ Maintainability: Clear structure
- ✅ Scalability: Loosely coupled

---

## Next Steps

1. **Create feature branch:**

   ```bash
   git checkout -b refactor/architecture-foundation
   ```

2. **Start Phase 1.1:**
   - Install dependencies
   - Create config service
   - Test validation works

3. **Continue incrementally:**
   - Complete Phase 1 (Day 1)
   - Complete Phase 2 (Days 2-3)
   - Complete Phase 3 (Days 4-5)

4. **Test at each checkpoint:**
   - Run existing tests
   - Manual testing
   - Integration testing

5. **Update Epic 1 stories:**
   - Mark stories complete as you go
   - Update with any learnings
   - Document any deviations

---

## Questions & Support

Common issues and solutions:

**Q: Configuration validation fails**  
A: Check `.env` has all required variables from `.env.example`

**Q: TypeScript path aliases not working**  
A: Configure `tsconfig.json` baseUrl and paths, restart TS server

**Q: Tests failing after refactoring**  
A: Update imports to use new paths, mock new services

**Q: Should I pause between phases?**  
A: Yes! Each phase is independently valuable. Test and commit after each.

---

**Document Version:** 1.0  
**Last Updated:** November 11, 2025  
**Status:** Ready for Implementation
