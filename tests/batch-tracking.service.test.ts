/**
 * Batch Tracking Service Tests
 * Story 2.6: Processing Status & Progress Tracking
 *
 * Tests the in-memory batch tracking service for progress monitoring:
 * - Batch creation with UUID
 * - Image status tracking
 * - Progress calculation
 * - Batch completion detection
 * - Cleanup job for old batches
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock config
vi.mock('../src/config/app.config', () => ({
  config: {
    server: { port: 3000, nodeEnv: 'test', baseUrl: 'http://localhost:3000' },
    openai: { apiKey: 'test-key', model: 'gpt-5-mini', maxTokens: 500, temperature: 0.3 },
    processing: { concurrencyLimit: 5, maxFileSizeMB: 50, tempFileLifetimeSeconds: 10 },
    rateLimits: { anonymous: 10, freeTier: 100 },
  },
}));

// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Use fresh import for each test
let batchTrackingService: any;

describe('BatchTrackingService - Story 2.6', () => {
  beforeEach(async () => {
    // Reset modules to get fresh batch store
    vi.resetModules();
    const module = await import('../src/services/batch-tracking.service');
    batchTrackingService = module.batchTrackingService;
    batchTrackingService.clearAll();
  });

  afterEach(() => {
    batchTrackingService.stopCleanupJob();
  });

  describe('Batch Creation (AC6)', () => {
    it('should create a batch with UUID', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      // UUID format validation (v4)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(batch.batchId).toMatch(uuidRegex);
    });

    it('should initialize batch with pending status', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      expect(batch.status).toBe('pending');
    });

    it('should initialize progress counts correctly', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
          { id: 'file-3', filename: 'image3.jpg' },
        ],
      });

      expect(batch.progress).toEqual({
        total: 3,
        completed: 0,
        failed: 0,
        processing: 0,
        pending: 3,
      });
    });

    it('should initialize all images as pending (AC3)', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      expect(batch.images).toHaveLength(2);
      expect(batch.images[0]).toEqual({
        id: 'file-1',
        filename: 'image1.jpg',
        status: 'pending',
      });
      expect(batch.images[1]).toEqual({
        id: 'file-2',
        filename: 'image2.jpg',
        status: 'pending',
      });
    });

    it('should track creation and update timestamps', () => {
      const beforeCreate = new Date();
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });
      const afterCreate = new Date();

      expect(batch.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(batch.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(batch.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    });

    it('should store session ID for ownership tracking', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-abc',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      expect(batch.sessionId).toBe('session-abc');
    });
  });

  describe('Batch Retrieval (AC1)', () => {
    it('should retrieve batch by ID', () => {
      const created = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      const retrieved = batchTrackingService.getBatch(created.batchId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.batchId).toBe(created.batchId);
    });

    it('should return null for non-existent batch', () => {
      const batch = batchTrackingService.getBatch('non-existent-id');
      expect(batch).toBeNull();
    });
  });

  describe('Batch Status Response (AC2)', () => {
    it('should return API response format', () => {
      const created = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      const status = batchTrackingService.getBatchStatus(created.batchId);

      expect(status).not.toBeNull();
      expect(status).toHaveProperty('batchId');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('images');
      expect(status).toHaveProperty('createdAt');
      expect(typeof status!.createdAt).toBe('string'); // ISO string
    });

    it('should return images with simplified format (AC3)', () => {
      const created = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      const status = batchTrackingService.getBatchStatus(created.batchId);

      expect(status!.images[0]).toEqual({
        id: 'file-1',
        filename: 'image1.jpg',
        status: 'pending',
        error: undefined,
      });
    });

    it('should return null for non-existent batch', () => {
      const status = batchTrackingService.getBatchStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('Batch Start', () => {
    it('should update status to processing', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      expect(batch.status).toBe('pending');

      batchTrackingService.startBatch(batch.batchId);

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.status).toBe('processing');
    });

    it('should handle starting non-existent batch gracefully', () => {
      expect(() => {
        batchTrackingService.startBatch('non-existent');
      }).not.toThrow();
    });
  });

  describe('Image Status Updates (AC3)', () => {
    it('should update image status to processing', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'processing');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.images[0].status).toBe('processing');
      expect(updated!.progress.processing).toBe(1);
      expect(updated!.progress.pending).toBe(0);
    });

    it('should update image status to completed', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'processing');
      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.images[0].status).toBe('completed');
      expect(updated!.progress.completed).toBe(1);
      expect(updated!.progress.processing).toBe(0);
    });

    it('should update image status to failed with error message', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      batchTrackingService.updateImageStatus(
        batch.batchId,
        'file-1',
        'failed',
        'Processing timeout'
      );

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.images[0].status).toBe('failed');
      expect(updated!.images[0].error).toBe('Processing timeout');
      expect(updated!.progress.failed).toBe(1);
    });

    it('should handle updating non-existent image gracefully', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      expect(() => {
        batchTrackingService.updateImageStatus(batch.batchId, 'non-existent', 'completed');
      }).not.toThrow();
    });
  });

  describe('Image Result Updates', () => {
    it('should update image result by filename', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      const result = {
        success: true,
        filename: 'image1.jpg',
        metadata: {
          filename: 'image1.jpg',
          title: 'Test Title',
          keywords: 'test,keywords',
          category: 1,
        },
      };

      batchTrackingService.updateImageResult(batch.batchId, 'image1.jpg', result);

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.images[0].status).toBe('completed');
      expect(updated!.images[0].result).toEqual(result);
    });

    it('should set status to failed for unsuccessful result', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      const result = {
        success: false,
        filename: 'image1.jpg',
        error: {
          code: 'PROCESSING_FAILED',
          message: 'Failed to process',
        },
      };

      batchTrackingService.updateImageResult(batch.batchId, 'image1.jpg', result);

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.images[0].status).toBe('failed');
      expect(updated!.images[0].error).toBe('Failed to process');
    });
  });

  describe('Mark Image Processing', () => {
    it('should mark image as processing by filename', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      batchTrackingService.markImageProcessing(batch.batchId, 'image1.jpg');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.images[0].status).toBe('processing');
      expect(updated!.progress.processing).toBe(1);
    });

    it('should not change status if not pending', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      // Complete the image first
      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');

      // Try to mark as processing
      batchTrackingService.markImageProcessing(batch.batchId, 'image1.jpg');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.images[0].status).toBe('completed');
    });
  });

  describe('Progress Updates (AC4)', () => {
    it('should update batch progress counts', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
          { id: 'file-3', filename: 'image3.jpg' },
        ],
      });

      batchTrackingService.updateBatchProgress(
        batch.batchId,
        2, // completed
        1, // successful
        1, // failed
        1, // processing
        5000, // estimatedTimeRemaining ms
        2500 // avgProcessingTimeMs
      );

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.progress.completed).toBe(2); // successful + failed
      expect(updated!.progress.failed).toBe(1);
      expect(updated!.progress.processing).toBe(1);
      expect(updated!.estimatedTimeRemaining).toBe(5); // Converted to seconds
      expect(updated!.avgProcessingTimeMs).toBe(2500);
    });
  });

  describe('Batch Completion Detection (AC5)', () => {
    it('should mark batch as completed when all images done', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');
      batchTrackingService.updateImageStatus(batch.batchId, 'file-2', 'completed');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.status).toBe('completed');
      expect(updated!.completedAt).not.toBeUndefined();
    });

    it('should mark batch as completed even with failures', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');
      batchTrackingService.updateImageStatus(batch.batchId, 'file-2', 'failed', 'Error');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.status).toBe('completed');
    });

    it('should mark batch as failed if all images failed', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'failed', 'Error 1');
      batchTrackingService.updateImageStatus(batch.batchId, 'file-2', 'failed', 'Error 2');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.status).toBe('failed');
    });

    it('should set estimatedTimeRemaining to 0 on completion', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      // Set some ETA before completion
      batchTrackingService.updateBatchProgress(batch.batchId, 0, 0, 0, 1, 5000, 5000);

      // Complete the batch
      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.estimatedTimeRemaining).toBe(0);
    });
  });

  describe('Session Ownership', () => {
    it('should verify batch ownership correctly', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      expect(batchTrackingService.isBatchOwnedBySession(batch.batchId, 'session-123')).toBe(true);
      expect(batchTrackingService.isBatchOwnedBySession(batch.batchId, 'other-session')).toBe(
        false
      );
    });

    it('should return false for non-existent batch', () => {
      expect(batchTrackingService.isBatchOwnedBySession('non-existent', 'session-123')).toBe(false);
    });
  });

  describe('Get Batches by Session', () => {
    it('should return all batches for a session', () => {
      batchTrackingService.createBatch({
        sessionId: 'session-a',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      batchTrackingService.createBatch({
        sessionId: 'session-a',
        files: [{ id: 'file-2', filename: 'image2.jpg' }],
      });

      batchTrackingService.createBatch({
        sessionId: 'session-b',
        files: [{ id: 'file-3', filename: 'image3.jpg' }],
      });

      const batchesA = batchTrackingService.getBatchesBySession('session-a');
      const batchesB = batchTrackingService.getBatchesBySession('session-b');

      expect(batchesA).toHaveLength(2);
      expect(batchesB).toHaveLength(1);
    });

    it('should return empty array for session with no batches', () => {
      const batches = batchTrackingService.getBatchesBySession('no-batches');
      expect(batches).toHaveLength(0);
    });
  });

  describe('Batch Deletion', () => {
    it('should delete batch by ID', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      expect(batchTrackingService.getActiveBatchCount()).toBe(1);

      batchTrackingService.deleteBatch(batch.batchId);

      expect(batchTrackingService.getBatch(batch.batchId)).toBeNull();
      expect(batchTrackingService.getActiveBatchCount()).toBe(0);
    });

    it('should handle deleting non-existent batch gracefully', () => {
      expect(() => {
        batchTrackingService.deleteBatch('non-existent');
      }).not.toThrow();
    });
  });

  describe('Batch Cleanup (AC7)', () => {
    it('should track active batch count', () => {
      expect(batchTrackingService.getActiveBatchCount()).toBe(0);

      const batch1 = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      expect(batchTrackingService.getActiveBatchCount()).toBe(1);

      batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-2', filename: 'image2.jpg' }],
      });

      expect(batchTrackingService.getActiveBatchCount()).toBe(2);

      batchTrackingService.deleteBatch(batch1.batchId);

      expect(batchTrackingService.getActiveBatchCount()).toBe(1);
    });

    it('should clear all batches', () => {
      batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-2', filename: 'image2.jpg' }],
      });

      expect(batchTrackingService.getActiveBatchCount()).toBe(2);

      batchTrackingService.clearAll();

      expect(batchTrackingService.getActiveBatchCount()).toBe(0);
    });

    it('AC7: should cleanup completed batches older than 1 hour', () => {
      vi.useFakeTimers();

      // Create and complete a batch
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');

      expect(batchTrackingService.getActiveBatchCount()).toBe(1);

      // Advance past 1 hour
      vi.advanceTimersByTime(60 * 60 * 1000 + 1000);

      // Trigger cleanup manually (normally runs on interval)
      // Access private method for testing
      (batchTrackingService as any).cleanupOldBatches();

      expect(batchTrackingService.getActiveBatchCount()).toBe(0);

      vi.useRealTimers();
    });

    it('should not cleanup in-progress batches even if old', () => {
      vi.useFakeTimers();

      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      // Start but don't complete
      batchTrackingService.startBatch(batch.batchId);

      // Advance past 1 hour
      vi.advanceTimersByTime(60 * 60 * 1000 + 1000);

      // Trigger cleanup
      (batchTrackingService as any).cleanupOldBatches();

      // Should still exist because it's not completed
      expect(batchTrackingService.getActiveBatchCount()).toBe(1);

      vi.useRealTimers();
    });
  });

  describe('Complex Progress Scenarios', () => {
    it('should handle mixed status updates correctly', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
          { id: 'file-3', filename: 'image3.jpg' },
          { id: 'file-4', filename: 'image4.jpg' },
        ],
      });

      // Simulate processing
      batchTrackingService.startBatch(batch.batchId);

      // File 1: pending -> processing -> completed
      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'processing');
      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');

      // File 2: pending -> processing -> failed
      batchTrackingService.updateImageStatus(batch.batchId, 'file-2', 'processing');
      batchTrackingService.updateImageStatus(batch.batchId, 'file-2', 'failed', 'Network error');

      // File 3: currently processing
      batchTrackingService.updateImageStatus(batch.batchId, 'file-3', 'processing');

      // File 4: still pending

      const updated = batchTrackingService.getBatch(batch.batchId);

      expect(updated!.status).toBe('processing'); // Not complete yet
      expect(updated!.progress).toEqual({
        total: 4,
        completed: 1,
        failed: 1,
        processing: 1,
        pending: 1,
      });

      expect(updated!.images[0].status).toBe('completed');
      expect(updated!.images[1].status).toBe('failed');
      expect(updated!.images[1].error).toBe('Network error');
      expect(updated!.images[2].status).toBe('processing');
      expect(updated!.images[3].status).toBe('pending');
    });
  });

  describe('Edge Cases', () => {
    it('should handle batch with single file', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      expect(batch.progress.total).toBe(1);

      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.status).toBe('completed');
    });

    it('should handle multiple batches concurrently', () => {
      const batch1 = batchTrackingService.createBatch({
        sessionId: 'session-1',
        files: [{ id: 'file-1', filename: 'batch1.jpg' }],
      });

      const batch2 = batchTrackingService.createBatch({
        sessionId: 'session-2',
        files: [{ id: 'file-2', filename: 'batch2.jpg' }],
      });

      // Update different batches
      batchTrackingService.updateImageStatus(batch1.batchId, 'file-1', 'completed');
      batchTrackingService.updateImageStatus(batch2.batchId, 'file-2', 'failed', 'Error');

      const updated1 = batchTrackingService.getBatch(batch1.batchId);
      const updated2 = batchTrackingService.getBatch(batch2.batchId);

      expect(updated1!.status).toBe('completed');
      expect(updated2!.status).toBe('failed');
    });

    it('should handle high volume of batches', () => {
      const batchIds: string[] = [];

      for (let i = 0; i < 100; i++) {
        const batch = batchTrackingService.createBatch({
          sessionId: `session-${i}`,
          files: [{ id: `file-${i}`, filename: `image${i}.jpg` }],
        });
        batchIds.push(batch.batchId);
      }

      expect(batchTrackingService.getActiveBatchCount()).toBe(100);

      // All batches should be accessible
      for (const batchId of batchIds) {
        expect(batchTrackingService.getBatch(batchId)).not.toBeNull();
      }
    });
  });
});
