/**
 * Batch Routes Tests
 * Story 2.6: Processing Status & Progress Tracking
 *
 * Tests batch status and processing endpoints:
 * - GET /api/batch-status/:batchId - Get batch progress
 * - POST /api/process-batch-v2 - Start batch processing
 */

import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// Mock config - must be before imports
vi.mock('../src/config/app.config', () => ({
  config: {
    server: { port: 3000, nodeEnv: 'test', baseUrl: 'http://localhost:3000' },
    openai: { apiKey: 'test-key', model: 'gpt-5-nano', maxTokens: 500, temperature: 0.3 },
    processing: { concurrencyLimit: 5, maxFileSizeMB: 50, tempFileLifetimeSeconds: 10 },
    rateLimits: { anonymous: 10, freeTier: 500, authBatchMax: 100 },
  },
}));

// Mock services container (for async processing)
vi.mock('../src/config/container', () => ({
  services: {
    imageProcessing: {
      processBatch: vi.fn().mockResolvedValue([
        {
          success: true,
          filename: 'test.jpg',
          metadata: { title: 'Test', keywords: 'test', category: 1 },
        },
      ]),
    },
    usageTracking: {
      checkQuota: vi.fn().mockResolvedValue({ allowed: true, used: 0, limit: 500, remaining: 500 }),
      incrementUsage: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

// Create mock child logger
const mockChildLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

// Create mock logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnValue(mockChildLogger),
};

// Mock logger - must include createChildLogger
vi.mock('../src/utils/logger', () => ({
  logger: mockLogger,
  createChildLogger: vi.fn().mockReturnValue(mockChildLogger),
}));

// Story 6.8: Mock supabase admin client (auth.middleware.ts dependency)
vi.mock('../src/lib/supabase', () => ({
  supabaseAdmin: null,
}));

// Story 6.8 + beta-deployment: Mock auth middleware. requireAuth delegates to
// the mocked extractUserId so existing tests that drive auth state via
// `vi.mocked(extractUserId).mockResolvedValueOnce(...)` continue to work.
vi.mock('../src/api/middleware/auth.middleware', () => {
  // Default = authenticated. Existing tests that don't care about auth (e.g. session
  // ownership, validation) just work; tests that need 401 use mockResolvedValueOnce(null).
  const mockExtractUserId = vi.fn().mockResolvedValue('mock-user-id');
  return {
    extractUserId: mockExtractUserId,
    requireAuth: vi.fn(async (req: any, _res: any, next: any) => {
      try {
        const userId = await mockExtractUserId(req);
        if (!userId) {
          const { AuthenticationError } = await import('../src/models/errors');
          next(new AuthenticationError('Sign up or log in to continue'));
          return;
        }
        req.userId = userId;
        next();
      } catch (e) {
        next(e);
      }
    }),
  };
});

describe('Batch Routes - Story 2.6', () => {
  let app: Express;
  let batchRoutes: any;
  let errorHandler: any;
  let correlationIdMiddleware: any;
  let batchTrackingService: any;
  let sessionService: any;
  let extractUserId: any;
  let mockUsageTracking: any;

  beforeAll(async () => {
    // Dynamically import after mocks are set up
    const batchModule = await import('../src/api/routes/batch.routes');
    const errorModule = await import('../src/api/middleware/error-handler');
    const correlationModule = await import('../src/api/middleware/correlation-id.middleware');
    const batchServiceModule = await import('../src/services/batch-tracking.service');
    const sessionModule = await import('../src/services/session.service');
    const authModule = await import('../src/api/middleware/auth.middleware');
    const containerModule = await import('../src/config/container');

    batchRoutes = batchModule.default;
    errorHandler = errorModule.errorHandler;
    correlationIdMiddleware = correlationModule.correlationIdMiddleware;
    batchTrackingService = batchServiceModule.batchTrackingService;
    sessionService = sessionModule.sessionService;
    extractUserId = authModule.extractUserId;
    mockUsageTracking = (containerModule.services as any).usageTracking;
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(correlationIdMiddleware);
    app.use('/api', batchRoutes);
    app.use(errorHandler);

    // Clear services
    batchTrackingService.clearAll();
    sessionService.clearAll();
  });

  afterEach(() => {
    batchTrackingService.stopCleanupJob();
    sessionService.stopCleanupJob();
  });

  describe('GET /api/batch-status/:batchId (AC1, AC2, AC3, AC4)', () => {
    it('AC1: should return batch status for valid batchId', async () => {
      // Create a session and batch
      const sessionId = sessionService.createSession();
      const batch = batchTrackingService.createBatch({
        sessionId,
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      const response = await request(app)
        .get(`/api/batch-status/${batch.batchId}`)
        .set('Cookie', `session_id=${sessionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('batchId', batch.batchId);
      expect(response.body).toHaveProperty('status', 'pending');
      expect(response.body).toHaveProperty('progress');
      expect(response.body).toHaveProperty('images');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('AC2: should return correct progress counts', async () => {
      const sessionId = sessionService.createSession();
      const batch = batchTrackingService.createBatch({
        sessionId,
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
          { id: 'file-3', filename: 'image3.jpg' },
        ],
      });

      // Simulate some progress
      batchTrackingService.startBatch(batch.batchId);
      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');
      batchTrackingService.updateImageStatus(batch.batchId, 'file-2', 'processing');

      const response = await request(app)
        .get(`/api/batch-status/${batch.batchId}`)
        .set('Cookie', `session_id=${sessionId}`)
        .expect(200);

      expect(response.body.progress).toEqual({
        total: 3,
        completed: 1,
        failed: 0,
        processing: 1,
        pending: 1,
      });
    });

    it('AC3: should return per-image status', async () => {
      const sessionId = sessionService.createSession();
      const batch = batchTrackingService.createBatch({
        sessionId,
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');
      batchTrackingService.updateImageStatus(batch.batchId, 'file-2', 'failed', 'Processing error');

      const response = await request(app)
        .get(`/api/batch-status/${batch.batchId}`)
        .set('Cookie', `session_id=${sessionId}`)
        .expect(200);

      expect(response.body.images).toHaveLength(2);
      expect(response.body.images[0]).toEqual({
        id: 'file-1',
        filename: 'image1.jpg',
        status: 'completed',
        error: undefined,
      });
      expect(response.body.images[1]).toEqual({
        id: 'file-2',
        filename: 'image2.jpg',
        status: 'failed',
        error: 'Processing error',
      });
    });

    it('should return 404 for non-existent batchId', async () => {
      const sessionId = sessionService.createSession();

      const response = await request(app)
        .get('/api/batch-status/00000000-0000-4000-8000-000000000000')
        .set('Cookie', `session_id=${sessionId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid batchId format', async () => {
      const sessionId = sessionService.createSession();

      const response = await request(app)
        .get('/api/batch-status/invalid-id')
        .set('Cookie', `session_id=${sessionId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 if batch belongs to different session', async () => {
      // Create batch with one session
      const sessionId1 = sessionService.createSession();
      const batch = batchTrackingService.createBatch({
        sessionId: sessionId1,
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      // Try to access with different session
      const sessionId2 = sessionService.createSession();

      const response = await request(app)
        .get(`/api/batch-status/${batch.batchId}`)
        .set('Cookie', `session_id=${sessionId2}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('AC5: should show completed status when all images done', async () => {
      const sessionId = sessionService.createSession();
      const batch = batchTrackingService.createBatch({
        sessionId,
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');
      batchTrackingService.updateImageStatus(batch.batchId, 'file-2', 'completed');

      const response = await request(app)
        .get(`/api/batch-status/${batch.batchId}`)
        .set('Cookie', `session_id=${sessionId}`)
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should include estimatedTimeRemaining when available', async () => {
      const sessionId = sessionService.createSession();
      const batch = batchTrackingService.createBatch({
        sessionId,
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      // Set ETA
      batchTrackingService.updateBatchProgress(
        batch.batchId,
        1, // completed
        1, // successful
        0, // failed
        1, // processing
        10000, // 10 seconds
        5000 // avgProcessingTimeMs
      );

      const response = await request(app)
        .get(`/api/batch-status/${batch.batchId}`)
        .set('Cookie', `session_id=${sessionId}`)
        .expect(200);

      expect(response.body.estimatedTimeRemaining).toBe(10); // In seconds
    });

    it('should create session cookie if not present', async () => {
      // Make request without session cookie
      const response = await request(app)
        .get('/api/batch-status/00000000-0000-4000-8000-000000000000')
        .expect(404);

      // Should have set-cookie header with session_id
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toMatch(/session_id=/);
    });
  });

  describe('POST /api/process-batch-v2 (AC8)', () => {
    it('should return 400 if fileIds not provided', async () => {
      const sessionId = sessionService.createSession();

      const response = await request(app)
        .post('/api/process-batch-v2')
        .set('Cookie', `session_id=${sessionId}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('fileIds');
    });

    it('should return 400 if fileIds is empty array', async () => {
      const sessionId = sessionService.createSession();

      const response = await request(app)
        .post('/api/process-batch-v2')
        .set('Cookie', `session_id=${sessionId}`)
        .send({ fileIds: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('fileIds');
    });

    it('authenticated user rejected above authBatchMax (101 fileIds)', async () => {
      const sessionId = sessionService.createSession();
      vi.mocked(extractUserId).mockResolvedValueOnce('user-123');
      const fileIds = Array.from({ length: 101 }, (_, i) => `file-${i}`);

      const response = await request(app)
        .post('/api/process-batch-v2')
        .set('Cookie', `session_id=${sessionId}`)
        .send({ fileIds })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Maximum 100 files');
    });

    it('authenticated user passes 15 fileIds through count check', async () => {
      // Regression: old cap of 10 would reject 15 here with 400 "Maximum 10".
      // Now 15 is under authBatchMax (100), so request proceeds past the
      // count check and fails later on "Files not found" instead.
      const sessionId = sessionService.createSession();
      vi.mocked(extractUserId).mockResolvedValueOnce('user-123');
      const fileIds = Array.from({ length: 15 }, (_, i) => `file-${i}`);

      const response = await request(app)
        .post('/api/process-batch-v2')
        .set('Cookie', `session_id=${sessionId}`)
        .send({ fileIds })
        .expect(400);

      expect(response.body.error.message).toContain('Files not found');
      expect(response.body.error.message).not.toContain('Maximum');
    });

    it('anonymous user gets 401 before file count check', async () => {
      // Regression guard for the auth-first ordering. Sending 101 fileIds with
      // no auth should surface the auth error, not "Maximum 100 files".
      vi.mocked(extractUserId).mockResolvedValueOnce(null);
      const sessionId = sessionService.createSession();
      const fileIds = Array.from({ length: 101 }, (_, i) => `file-${i}`);

      const response = await request(app)
        .post('/api/process-batch-v2')
        .set('Cookie', `session_id=${sessionId}`)
        .send({ fileIds })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should return 400 if files not found', async () => {
      const sessionId = sessionService.createSession();
      vi.mocked(extractUserId).mockResolvedValueOnce('user-123');

      const response = await request(app)
        .post('/api/process-batch-v2')
        .set('Cookie', `session_id=${sessionId}`)
        .send({ fileIds: ['non-existent-file-id'] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Files not found');
    });
  });

  describe('Story 6.9: Auth & Quota Enforcement', () => {
    it('should return 401 when no JWT provided (anonymous blocked)', async () => {
      vi.mocked(extractUserId).mockResolvedValueOnce(null);
      const sessionId = sessionService.createSession();

      const response = await request(app)
        .post('/api/process-batch-v2')
        .set('Cookie', `session_id=${sessionId}`)
        .send({ fileIds: ['file-1'] })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(response.body.error.message).toBe('Sign up or log in to continue');
    });

    it('should return 429 when quota exceeded', async () => {
      const sessionId = sessionService.createSession();
      vi.mocked(extractUserId).mockResolvedValueOnce('user-123');
      vi.mocked(mockUsageTracking.checkQuota).mockResolvedValueOnce({
        allowed: false,
        used: 498,
        limit: 500,
        remaining: 2,
      });

      const response = await request(app)
        .post('/api/process-batch-v2')
        .set('Cookie', `session_id=${sessionId}`)
        .send({ fileIds: ['file-1'] })
        .expect(429);

      expect(response.body.error.message).toContain('free images this month');
    });
  });

  describe('Session Integration', () => {
    it('should use existing session from cookie', async () => {
      const sessionId = sessionService.createSession();
      const batch = batchTrackingService.createBatch({
        sessionId,
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      // First request should work
      const response1 = await request(app)
        .get(`/api/batch-status/${batch.batchId}`)
        .set('Cookie', `session_id=${sessionId}`)
        .expect(200);

      expect(response1.body.batchId).toBe(batch.batchId);

      // Second request with same session should also work
      const response2 = await request(app)
        .get(`/api/batch-status/${batch.batchId}`)
        .set('Cookie', `session_id=${sessionId}`)
        .expect(200);

      expect(response2.body.batchId).toBe(batch.batchId);
    });
  });

  describe('beta-deployment T9: requireAuth gates protected routes', () => {
    it('GET /api/batch-status/:id returns 401 when unauthenticated', async () => {
      vi.mocked(extractUserId).mockResolvedValueOnce(null);
      const sessionId = sessionService.createSession();

      const response = await request(app)
        .get('/api/batch-status/00000000-0000-4000-8000-000000000000')
        .set('Cookie', `session_id=${sessionId}`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('GET /api/batches returns 401 when unauthenticated', async () => {
      vi.mocked(extractUserId).mockResolvedValueOnce(null);
      const sessionId = sessionService.createSession();

      const response = await request(app)
        .get('/api/batches')
        .set('Cookie', `session_id=${sessionId}`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('GET /api/batches/:id returns 401 when unauthenticated', async () => {
      vi.mocked(extractUserId).mockResolvedValueOnce(null);
      const sessionId = sessionService.createSession();

      const response = await request(app)
        .get('/api/batches/00000000-0000-4000-8000-000000000000')
        .set('Cookie', `session_id=${sessionId}`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('Error Handling', () => {
    it('should return structured error response', async () => {
      const sessionId = sessionService.createSession();

      const response = await request(app)
        .get('/api/batch-status/invalid')
        .set('Cookie', `session_id=${sessionId}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });
});
