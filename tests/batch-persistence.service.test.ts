/**
 * Tests for BatchPersistenceService
 * Story 4.3: Batch History Persistence (AC1, AC5, AC8)
 *
 * Tests database initialization, batch persistence, retrieval,
 * ownership checks, expiry filtering, and cleanup operations.
 * Uses in-memory SQLite (:memory:) for test isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before importing service
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

// Mock metrics
vi.mock('../src/utils/metrics', () => ({
  recordBatchCleanup: vi.fn(),
}));

import { BatchPersistenceService } from '../src/services/batch-persistence.service';
import type { BatchState } from '../src/models/batch.model';

function createTestBatch(overrides: Partial<BatchState> = {}): BatchState {
  const now = new Date();
  return {
    batchId: 'test-batch-' + Math.random().toString(36).slice(2, 10),
    sessionId: 'test-session-1',
    status: 'completed',
    progress: { total: 5, completed: 4, failed: 1, processing: 0, pending: 0 },
    images: [],
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    csvPath: 'csv_output/adobe-stock-metadata-1234.csv',
    csvFileName: 'adobe-stock-metadata-1234.csv',
    ...overrides,
  };
}

describe('BatchPersistenceService', () => {
  let service: BatchPersistenceService;

  beforeEach(() => {
    service = new BatchPersistenceService();
    service.initialize();
  });

  afterEach(() => {
    service.close();
  });

  describe('initialize()', () => {
    it('should create the processing_batches table', () => {
      // If initialize succeeds without throwing, table was created
      const newService = new BatchPersistenceService();
      expect(() => newService.initialize()).not.toThrow();
      newService.close();
    });

    it('should be idempotent — calling initialize twice should not throw', () => {
      const newService = new BatchPersistenceService();
      newService.initialize();
      expect(() => newService.initialize()).not.toThrow();
      newService.close();
    });
  });

  describe('persistBatch()', () => {
    it('should persist a completed batch', () => {
      const batch = createTestBatch({ batchId: 'persist-test-1' });
      service.persistBatch(batch);

      const retrieved = service.getBatchById('persist-test-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.batch_id).toBe('persist-test-1');
      expect(retrieved!.session_id).toBe('test-session-1');
      expect(retrieved!.image_count).toBe(5);
      expect(retrieved!.successful_count).toBe(3); // completed(4) - failed(1) = 3 successful
      expect(retrieved!.failed_count).toBe(1);
      expect(retrieved!.status).toBe('completed');
      expect(retrieved!.csv_filename).toBe('adobe-stock-metadata-1234.csv');
      expect(retrieved!.csv_path).toBe('csv_output/adobe-stock-metadata-1234.csv');
    });

    it('should persist a failed batch', () => {
      const batch = createTestBatch({
        batchId: 'persist-failed-1',
        status: 'failed',
        csvPath: undefined,
        csvFileName: undefined,
      });
      service.persistBatch(batch);

      const retrieved = service.getBatchById('persist-failed-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.status).toBe('failed');
      expect(retrieved!.csv_filename).toBeNull();
    });

    it('should set expires_at to 24 hours after creation', () => {
      const createdAt = new Date('2026-03-08T12:00:00.000Z');
      const batch = createTestBatch({ batchId: 'expiry-test-1', createdAt });
      service.persistBatch(batch);

      const retrieved = service.getBatchById('expiry-test-1', true);
      expect(retrieved).not.toBeNull();
      const expiresAt = new Date(retrieved!.expires_at);
      const expectedExpiry = new Date('2026-03-09T12:00:00.000Z');
      expect(expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });

    it('should handle duplicate batchId by replacing', () => {
      const batch1 = createTestBatch({ batchId: 'dup-test-1', status: 'completed' });
      service.persistBatch(batch1);

      const batch2 = createTestBatch({ batchId: 'dup-test-1', status: 'failed' });
      service.persistBatch(batch2);

      const retrieved = service.getBatchById('dup-test-1');
      expect(retrieved!.status).toBe('failed');
    });
  });

  describe('getBatchesBySession()', () => {
    it('should return batches for a given session ordered by created_at DESC', () => {
      const now = Date.now();
      const batch1 = createTestBatch({
        batchId: 'session-batch-1',
        sessionId: 'session-A',
        createdAt: new Date(now - 2 * 60 * 60 * 1000), // 2 hours ago
      });
      const batch2 = createTestBatch({
        batchId: 'session-batch-2',
        sessionId: 'session-A',
        createdAt: new Date(now), // now
      });
      const batch3 = createTestBatch({
        batchId: 'session-batch-3',
        sessionId: 'session-B',
        createdAt: new Date(now - 1 * 60 * 60 * 1000), // 1 hour ago
      });

      service.persistBatch(batch1);
      service.persistBatch(batch2);
      service.persistBatch(batch3);

      const result = service.getBatchesBySession('session-A');
      expect(result).toHaveLength(2);
      expect(result[0].batch_id).toBe('session-batch-2'); // newer first
      expect(result[1].batch_id).toBe('session-batch-1');
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 15; i++) {
        service.persistBatch(
          createTestBatch({
            batchId: `limit-batch-${i}`,
            sessionId: 'session-limit',
            createdAt: new Date(Date.now() + i * 1000),
          })
        );
      }

      const result = service.getBatchesBySession('session-limit', 10);
      expect(result).toHaveLength(10);
    });

    it('should exclude expired batches', () => {
      const expiredBatch = createTestBatch({
        batchId: 'expired-batch-1',
        sessionId: 'session-expiry',
        createdAt: new Date('2026-03-06T10:00:00.000Z'), // 48+ hours ago
      });
      const validBatch = createTestBatch({
        batchId: 'valid-batch-1',
        sessionId: 'session-expiry',
        createdAt: new Date(), // now
      });

      service.persistBatch(expiredBatch);
      service.persistBatch(validBatch);

      const result = service.getBatchesBySession('session-expiry');
      expect(result).toHaveLength(1);
      expect(result[0].batch_id).toBe('valid-batch-1');
    });

    it('should return empty array for unknown session', () => {
      const result = service.getBatchesBySession('nonexistent-session');
      expect(result).toEqual([]);
    });
  });

  describe('getBatchById()', () => {
    it('should return batch by ID', () => {
      const batch = createTestBatch({ batchId: 'get-by-id-1' });
      service.persistBatch(batch);

      const result = service.getBatchById('get-by-id-1');
      expect(result).not.toBeNull();
      expect(result!.batch_id).toBe('get-by-id-1');
    });

    it('should return null for nonexistent batch', () => {
      const result = service.getBatchById('nonexistent');
      expect(result).toBeNull();
    });

    it('should exclude expired batches by default', () => {
      const expiredBatch = createTestBatch({
        batchId: 'expired-by-id',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      });
      service.persistBatch(expiredBatch);

      expect(service.getBatchById('expired-by-id')).toBeNull();
    });

    it('should return expired batches when includeExpired is true', () => {
      const expiredBatch = createTestBatch({
        batchId: 'expired-incl',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      });
      service.persistBatch(expiredBatch);

      const result = service.getBatchById('expired-incl', true);
      expect(result).not.toBeNull();
      expect(result!.batch_id).toBe('expired-incl');
    });
  });

  describe('isBatchOwnedBySession()', () => {
    it('should return true when batch belongs to session', () => {
      const batch = createTestBatch({ batchId: 'owned-1', sessionId: 'owner-session' });
      service.persistBatch(batch);

      expect(service.isBatchOwnedBySession('owned-1', 'owner-session')).toBe(true);
    });

    it('should return false when batch belongs to different session', () => {
      const batch = createTestBatch({ batchId: 'owned-2', sessionId: 'owner-session' });
      service.persistBatch(batch);

      expect(service.isBatchOwnedBySession('owned-2', 'other-session')).toBe(false);
    });

    it('should return false for nonexistent batch', () => {
      expect(service.isBatchOwnedBySession('nonexistent', 'any-session')).toBe(false);
    });
  });

  describe('getExpiredBatches()', () => {
    it('should return expired batches without deleting them', () => {
      const expiredBatch = createTestBatch({
        batchId: 'cleanup-1',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      });
      service.persistBatch(expiredBatch);

      const validBatch = createTestBatch({
        batchId: 'cleanup-2',
        createdAt: new Date(),
      });
      service.persistBatch(validBatch);

      const expired = service.getExpiredBatches();
      expect(expired).toHaveLength(1);
      expect(expired[0].batch_id).toBe('cleanup-1');

      // Expired batch should still exist (not yet deleted)
      expect(service.getBatchById('cleanup-1', true)).not.toBeNull();
    });

    it('should return empty array when no expired batches', () => {
      const batch = createTestBatch({ batchId: 'no-cleanup-1', createdAt: new Date() });
      service.persistBatch(batch);

      const expired = service.getExpiredBatches();
      expect(expired).toEqual([]);
    });
  });

  describe('deleteExpiredBatches()', () => {
    it('should delete expired records and return count', () => {
      const expiredBatch = createTestBatch({
        batchId: 'cleanup-del-1',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      });
      service.persistBatch(expiredBatch);

      const validBatch = createTestBatch({
        batchId: 'cleanup-del-2',
        createdAt: new Date(),
      });
      service.persistBatch(validBatch);

      const deletedCount = service.deleteExpiredBatches();
      expect(deletedCount).toBe(1);

      // Valid batch should still exist, expired should be gone
      expect(service.getBatchById('cleanup-del-2')).not.toBeNull();
      expect(service.getBatchById('cleanup-del-1')).toBeNull();
    });
  });

  describe('graceful degradation', () => {
    it('should not throw if initialized with invalid path and initialize fails', () => {
      // Create a service with an invalid DB path
      const badService = new BatchPersistenceService('/nonexistent/deep/path/batches.db');
      // initialize should not throw — graceful degradation
      expect(() => badService.initialize()).not.toThrow();
    });
  });

  describe('close()', () => {
    it('should close without error', () => {
      expect(() => service.close()).not.toThrow();
    });

    it('should handle double close gracefully', () => {
      service.close();
      expect(() => service.close()).not.toThrow();
    });
  });

  describe('Story 6.8: updateCsvInfo()', () => {
    it('should update csv_path and csv_filename for existing batch', () => {
      // Persist batch without CSV info (simulates completeBatch before CSV generation)
      const batch = createTestBatch({
        batchId: 'csv-update-1',
        csvPath: undefined,
        csvFileName: undefined,
      });
      service.persistBatch(batch);

      // Verify null initially
      const before = service.getBatchById('csv-update-1');
      expect(before!.csv_path).toBeNull();
      expect(before!.csv_filename).toBeNull();

      // Update CSV info (simulates associateCsv after CSV generation)
      service.updateCsvInfo('csv-update-1', 'csv_output/test-metadata.csv', 'test-metadata.csv');

      // Verify updated
      const after = service.getBatchById('csv-update-1');
      expect(after!.csv_path).toBe('csv_output/test-metadata.csv');
      expect(after!.csv_filename).toBe('test-metadata.csv');
    });

    it('should not throw for nonexistent batch', () => {
      expect(() => {
        service.updateCsvInfo('nonexistent-batch', 'csv_output/x.csv', 'x.csv');
      }).not.toThrow();
    });

    it('should not throw when service is not initialized', () => {
      const uninitService = new BatchPersistenceService();
      // Don't call initialize — db is null
      expect(() => {
        uninitService.updateCsvInfo('any-batch', 'csv_output/x.csv', 'x.csv');
      }).not.toThrow();
    });
  });
});
