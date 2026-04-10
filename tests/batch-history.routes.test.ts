/**
 * Tests for Batch History Routes
 * Story 4.3: Batch History Persistence (AC2, AC3, AC6, AC8)
 *
 * Tests GET /api/batches and GET /api/batches/:batchId endpoints.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import type { BatchRow } from '../src/services/batch-persistence.service';

// Mock config
vi.mock('../src/config/app.config', () => ({
  config: {
    server: { port: 3000, nodeEnv: 'test', baseUrl: 'http://localhost:3000' },
    openai: { apiKey: 'test-key', model: 'gpt-5-nano', maxTokens: 500, temperature: 0.3 },
    processing: { concurrencyLimit: 5, maxFileSizeMB: 50, tempFileLifetimeSeconds: 10 },
    rateLimits: { anonymous: 10, freeTier: 100 },
    database: { path: ':memory:' },
  },
}));

// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock batch tracking service
vi.mock('../src/services/batch-tracking.service', () => ({
  batchTrackingService: {
    getBatch: vi.fn(),
    getBatchesBySession: vi.fn(),
    isBatchOwnedBySession: vi.fn(),
    getBatchStatus: vi.fn(),
    createBatch: vi.fn(),
    startBatch: vi.fn(),
    updateImageStatus: vi.fn(),
    updateBatchProgress: vi.fn(),
    updateImageResult: vi.fn(),
    markImageProcessing: vi.fn(),
    associateCsv: vi.fn(),
  },
}));

// Mock session service
vi.mock('../src/services/session.service', () => ({
  sessionService: {
    createSession: vi.fn().mockReturnValue('test-session'),
    getSession: vi.fn().mockReturnValue({ id: 'test-session', usage: 0 }),
    getSessionUsage: vi.fn().mockReturnValue(0),
  },
}));

// Mock better-sqlite3 to prevent actual DB creation
vi.mock('better-sqlite3', () => ({
  default: vi.fn(),
}));

// Story 6.8: Mock supabase admin client (auth.middleware.ts dependency)
vi.mock('../src/lib/supabase', () => ({
  supabaseAdmin: null,
}));

// Create mock persistence service (hoisted so vi.mock factory can reference them)
const {
  mockGetBatchesBySessionDb,
  mockGetBatchByIdDb,
  mockIsBatchOwnedBySessionDb,
  mockPersistenceService,
} = vi.hoisted(() => {
  const mockGetBatchesBySessionDb = vi.fn();
  const mockGetBatchByIdDb = vi.fn();
  const mockIsBatchOwnedBySessionDb = vi.fn();
  const mockPersistenceService = {
    getBatchesBySession: mockGetBatchesBySessionDb,
    getBatchById: mockGetBatchByIdDb,
    isBatchOwnedBySession: mockIsBatchOwnedBySessionDb,
    isAvailable: true,
    initialize: vi.fn(),
    persistBatch: vi.fn(),
    getExpiredBatches: vi.fn().mockReturnValue([]),
    deleteExpiredBatches: vi.fn().mockReturnValue(0),
    close: vi.fn(),
  };
  return {
    mockGetBatchesBySessionDb,
    mockGetBatchByIdDb,
    mockIsBatchOwnedBySessionDb,
    mockPersistenceService,
  };
});

// Mock services container to use our mock persistence service
vi.mock('../src/config/container', () => ({
  services: {
    csvExport: {
      generateCSV: vi.fn().mockResolvedValue(undefined),
      validateMetadataList: vi.fn().mockReturnValue({ valid: true, invalidItems: [] }),
    },
    batchPersistence: mockPersistenceService,
  },
}));

// Import routes after mocks
import batchRoutes from '../src/api/routes/batch.routes';
import { errorHandler } from '../src/api/middleware/error-handler';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  // Add req.log stub (normally provided by correlation ID middleware)
  app.use((req, _res, next) => {
    (req as any).log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    next();
  });
  app.use('/api', batchRoutes);
  app.use(errorHandler);
  return app;
}

function createBatchRow(overrides: Partial<BatchRow> = {}): BatchRow {
  return {
    batch_id: 'test-batch-1',
    session_id: 'test-session',
    user_id: null,
    image_count: 5,
    successful_count: 4,
    failed_count: 1,
    status: 'completed',
    csv_filename: 'adobe-stock-metadata-1234.csv',
    csv_path: 'csv_output/adobe-stock-metadata-1234.csv',
    created_at: '2026-03-08T12:00:00.000Z',
    completed_at: '2026-03-08T12:01:30.000Z',
    expires_at: '2026-03-09T12:00:00.000Z',
    ...overrides,
  };
}

describe('GET /api/batches', () => {
  let app: express.Application;
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncSpy = vi.spyOn(fs, 'existsSync');
  });

  it('should return batch history for the session', async () => {
    const batches = [createBatchRow(), createBatchRow({ batch_id: 'test-batch-2' })];
    mockGetBatchesBySessionDb.mockReturnValue(batches);
    existsSyncSpy.mockReturnValue(true);

    const res = await request(app).get('/api/batches').set('Cookie', 'session_id=test-session');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.batches).toHaveLength(2);
    expect(res.body.batches[0].batchId).toBe('test-batch-1');
    expect(res.body.batches[0].csvAvailable).toBe(true);
  });

  it('should return empty array when no batches exist', async () => {
    mockGetBatchesBySessionDb.mockReturnValue([]);

    const res = await request(app).get('/api/batches').set('Cookie', 'session_id=test-session');

    expect(res.status).toBe(200);
    expect(res.body.batches).toEqual([]);
  });

  it('should set csvAvailable to false when file does not exist', async () => {
    const batches = [createBatchRow()];
    mockGetBatchesBySessionDb.mockReturnValue(batches);
    existsSyncSpy.mockReturnValue(false);

    const res = await request(app).get('/api/batches').set('Cookie', 'session_id=test-session');

    expect(res.status).toBe(200);
    expect(res.body.batches[0].csvAvailable).toBe(false);
  });

  it('should set csvAvailable to false when csv_path is null', async () => {
    const batches = [createBatchRow({ csv_path: null, csv_filename: null })];
    mockGetBatchesBySessionDb.mockReturnValue(batches);

    const res = await request(app).get('/api/batches').set('Cookie', 'session_id=test-session');

    expect(res.status).toBe(200);
    expect(res.body.batches[0].csvAvailable).toBe(false);
  });
});

describe('GET /api/batches/:batchId', () => {
  let app: express.Application;
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncSpy = vi.spyOn(fs, 'existsSync');
  });

  const validBatchId = '12345678-1234-1234-1234-123456789abc';

  it('should return batch detail for valid owned batch', async () => {
    const batch = createBatchRow({ batch_id: validBatchId });
    mockGetBatchByIdDb.mockReturnValue(batch);
    mockIsBatchOwnedBySessionDb.mockReturnValue(true);
    existsSyncSpy.mockReturnValue(true);

    const res = await request(app)
      .get(`/api/batches/${validBatchId}`)
      .set('Cookie', 'session_id=test-session');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.batch.batchId).toBe(validBatchId);
    expect(res.body.batch.csvAvailable).toBe(true);
  });

  it('should return 404 for nonexistent batch', async () => {
    mockGetBatchByIdDb.mockReturnValue(null);

    const res = await request(app)
      .get(`/api/batches/${validBatchId}`)
      .set('Cookie', 'session_id=test-session');

    expect(res.status).toBe(404);
  });

  it('should return 404 for batch not owned by session', async () => {
    const batch = createBatchRow({ batch_id: validBatchId, session_id: 'other-session' });
    mockGetBatchByIdDb.mockReturnValue(batch);
    mockIsBatchOwnedBySessionDb.mockReturnValue(false);

    const res = await request(app)
      .get(`/api/batches/${validBatchId}`)
      .set('Cookie', 'session_id=test-session');

    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid batchId format', async () => {
    const res = await request(app)
      .get('/api/batches/not-a-uuid')
      .set('Cookie', 'session_id=test-session');

    expect(res.status).toBe(400);
  });

  it('should return 404 for expired batch', async () => {
    // getBatchById now filters expired batches by default, returning null
    mockGetBatchByIdDb.mockReturnValue(null);

    const res = await request(app)
      .get(`/api/batches/${validBatchId}`)
      .set('Cookie', 'session_id=test-session');

    expect(res.status).toBe(404);
  });
});
