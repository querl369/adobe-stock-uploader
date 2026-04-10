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
    openai: { apiKey: 'test-key', model: 'gpt-5-nano', maxTokens: 500, temperature: 0.3 },
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

// Story 6.8: Mock supabase admin client
vi.mock('../src/lib/supabase', () => ({
  supabaseAdmin: null,
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

    it('should not double-count when updateImageResult is called multiple times for same image', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
        ],
      });

      const result1 = {
        success: true,
        filename: 'image1.jpg',
        metadata: { filename: 'image1.jpg', title: 'Title 1', keywords: 'k1', category: 1 },
      };
      const result2 = {
        success: true,
        filename: 'image2.jpg',
        metadata: { filename: 'image2.jpg', title: 'Title 2', keywords: 'k2', category: 2 },
      };

      // Simulate accumulated progress callbacks: first call has 1 result, second has both
      batchTrackingService.updateImageResult(batch.batchId, 'image1.jpg', result1);
      batchTrackingService.updateImageResult(batch.batchId, 'image1.jpg', result1); // duplicate
      batchTrackingService.updateImageResult(batch.batchId, 'image2.jpg', result2);
      batchTrackingService.updateImageResult(batch.batchId, 'image1.jpg', result1); // duplicate again

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.progress.completed).toBe(2);
      expect(updated!.progress.pending).toBe(0);
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

  describe('Story 4.3: Persistence Integration', () => {
    it('should call persistBatch on completion when persistence service is set', () => {
      const mockPersistenceService = {
        persistBatch: vi.fn(),
        isAvailable: true,
      };
      batchTrackingService.setPersistenceService(mockPersistenceService);

      const batch = batchTrackingService.createBatch({
        sessionId: 'session-persist',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      // Complete the batch
      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');

      expect(mockPersistenceService.persistBatch).toHaveBeenCalledTimes(1);
      expect(mockPersistenceService.persistBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: batch.batchId,
          status: 'completed',
        })
      );
    });

    it('should not call persistBatch when no persistence service is set', () => {
      // Fresh service has no persistence service — completeBatch should still work
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-no-persist',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      // Should not throw
      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.status).toBe('completed');
    });

    it('should not break batch completion if persistBatch throws', () => {
      const mockPersistenceService = {
        persistBatch: vi.fn().mockImplementation(() => {
          throw new Error('DB write failed');
        }),
        isAvailable: true,
      };
      batchTrackingService.setPersistenceService(mockPersistenceService);

      const batch = batchTrackingService.createBatch({
        sessionId: 'session-fail-persist',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      // Should not throw despite persistence failure
      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'completed');

      const updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.status).toBe('completed');
      expect(mockPersistenceService.persistBatch).toHaveBeenCalledTimes(1);
    });

    it('should call persistBatch for failed batches too', () => {
      const mockPersistenceService = {
        persistBatch: vi.fn(),
        isAvailable: true,
      };
      batchTrackingService.setPersistenceService(mockPersistenceService);

      const batch = batchTrackingService.createBatch({
        sessionId: 'session-fail',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      batchTrackingService.updateImageStatus(batch.batchId, 'file-1', 'failed', 'Error');

      expect(mockPersistenceService.persistBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: batch.batchId,
          status: 'failed',
        })
      );
    });

    it('should call updateCsvInfo on associateCsv when persistence service is set', () => {
      const mockPersistenceService = {
        persistBatch: vi.fn(),
        updateCsvInfo: vi.fn(),
        isAvailable: true,
      };
      batchTrackingService.setPersistenceService(mockPersistenceService);

      const batch = batchTrackingService.createBatch({
        sessionId: 'session-csv',
        files: [{ id: 'file-1', filename: 'image1.jpg' }],
      });

      batchTrackingService.associateCsv(batch.batchId, 'csv_output/test.csv', 'test.csv');

      expect(mockPersistenceService.updateCsvInfo).toHaveBeenCalledWith(
        batch.batchId,
        'csv_output/test.csv',
        'test.csv'
      );
    });
  });

  describe('Story 6.8: Progress Double-Counting Prevention', () => {
    it('should not inflate progress when updateBatchProgress and updateImageResult are both called', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'file-1', filename: 'image1.jpg' },
          { id: 'file-2', filename: 'image2.jpg' },
          { id: 'file-3', filename: 'image3.jpg' },
          { id: 'file-4', filename: 'image4.jpg' },
          { id: 'file-5', filename: 'image5.jpg' },
        ],
      });

      batchTrackingService.startBatch(batch.batchId);

      // Simulate onProgress callback: set absolute counts, then update image results
      // This is exactly what batch.routes.ts does in the onProgress callback

      // After first image succeeds:
      batchTrackingService.updateBatchProgress(batch.batchId, 1, 1, 0, 4);
      batchTrackingService.updateImageResult(batch.batchId, 'image1.jpg', {
        success: true,
        filename: 'image1.jpg',
        metadata: { filename: 'image1.jpg', title: 'T', keywords: 'k', category: 1 },
      });

      let updated = batchTrackingService.getBatch(batch.batchId);
      // Progress should reflect absolute counts from updateBatchProgress, not be inflated
      expect(updated!.progress.completed).toBe(1);
      expect(updated!.progress.failed).toBe(0);

      // After second image fails:
      batchTrackingService.updateBatchProgress(batch.batchId, 2, 1, 1, 3);
      batchTrackingService.updateImageResult(batch.batchId, 'image1.jpg', {
        success: true,
        filename: 'image1.jpg',
        metadata: { filename: 'image1.jpg', title: 'T', keywords: 'k', category: 1 },
      });
      batchTrackingService.updateImageResult(batch.batchId, 'image2.jpg', {
        success: false,
        filename: 'image2.jpg',
        error: { message: 'API timeout', code: 'TIMEOUT' },
      });

      updated = batchTrackingService.getBatch(batch.batchId);
      expect(updated!.progress.completed).toBe(2);
      expect(updated!.progress.failed).toBe(1);
    });

    it('should show correct final counts with 4 failures and 1 success', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'f1', filename: 'img1.jpg' },
          { id: 'f2', filename: 'img2.jpg' },
          { id: 'f3', filename: 'img3.jpg' },
          { id: 'f4', filename: 'img4.jpg' },
          { id: 'f5', filename: 'img5.jpg' },
        ],
      });

      batchTrackingService.startBatch(batch.batchId);

      const successResult = (fn: string) => ({
        success: true,
        filename: fn,
        metadata: { filename: fn, title: 'T', keywords: 'k', category: 1 },
      });
      const failResult = (fn: string) => ({
        success: false,
        filename: fn,
        error: { message: 'Failed', code: 'ERR' },
      });

      // Simulate the full onProgress sequence for 5 images (1 success, 4 failures)
      // Each callback includes ALL accumulated results

      // Callback 1: img2 succeeds
      batchTrackingService.updateBatchProgress(batch.batchId, 1, 1, 0, 4);
      batchTrackingService.updateImageResult(batch.batchId, 'img2.jpg', successResult('img2.jpg'));

      // Callback 2: img1 fails
      batchTrackingService.updateBatchProgress(batch.batchId, 2, 1, 1, 3);
      batchTrackingService.updateImageResult(batch.batchId, 'img2.jpg', successResult('img2.jpg'));
      batchTrackingService.updateImageResult(batch.batchId, 'img1.jpg', failResult('img1.jpg'));

      // Callback 3: img3 fails
      batchTrackingService.updateBatchProgress(batch.batchId, 3, 1, 2, 2);
      batchTrackingService.updateImageResult(batch.batchId, 'img3.jpg', failResult('img3.jpg'));

      // Callback 4: img4 fails
      batchTrackingService.updateBatchProgress(batch.batchId, 4, 1, 3, 1);
      batchTrackingService.updateImageResult(batch.batchId, 'img4.jpg', failResult('img4.jpg'));

      // Callback 5: img5 fails — triggers completeBatch
      batchTrackingService.updateBatchProgress(batch.batchId, 5, 1, 4, 0);
      batchTrackingService.updateImageResult(batch.batchId, 'img5.jpg', failResult('img5.jpg'));

      const final = batchTrackingService.getBatch(batch.batchId);

      // CRITICAL: batch should be 'completed' (not 'failed') because 1 image succeeded
      expect(final!.status).toBe('completed');
      expect(final!.progress.failed).toBe(4);
      expect(final!.progress.completed).toBe(5); // 4 failed + 1 success = 5 done
      expect(final!.progress.total).toBe(5);
    });

    it('should correctly mark batch as failed only when ALL images fail', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'f1', filename: 'img1.jpg' },
          { id: 'f2', filename: 'img2.jpg' },
        ],
      });

      batchTrackingService.startBatch(batch.batchId);

      const failResult = (fn: string) => ({
        success: false,
        filename: fn,
        error: { message: 'Failed', code: 'ERR' },
      });

      batchTrackingService.updateBatchProgress(batch.batchId, 1, 0, 1, 1);
      batchTrackingService.updateImageResult(batch.batchId, 'img1.jpg', failResult('img1.jpg'));

      batchTrackingService.updateBatchProgress(batch.batchId, 2, 0, 2, 0);
      batchTrackingService.updateImageResult(batch.batchId, 'img2.jpg', failResult('img2.jpg'));

      const final = batchTrackingService.getBatch(batch.batchId);
      expect(final!.status).toBe('failed');
      expect(final!.progress.failed).toBe(2);
    });
  });

  describe('Story 6.8: completeBatch Guard', () => {
    it('should not run completeBatch twice', () => {
      const mockPersistenceService = {
        persistBatch: vi.fn(),
        isAvailable: true,
      };
      batchTrackingService.setPersistenceService(mockPersistenceService);

      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'f1', filename: 'img1.jpg' }],
      });

      batchTrackingService.startBatch(batch.batchId);

      // First completion via updateImageResult
      batchTrackingService.updateImageResult(batch.batchId, 'img1.jpg', {
        success: true,
        filename: 'img1.jpg',
        metadata: { filename: 'img1.jpg', title: 'T', keywords: 'k', category: 1 },
      });

      // Second call (simulating final loop calling updateImageResult again)
      batchTrackingService.updateImageResult(batch.batchId, 'img1.jpg', {
        success: true,
        filename: 'img1.jpg',
        metadata: { filename: 'img1.jpg', title: 'T', keywords: 'k', category: 1 },
      });

      // persistBatch should only be called once (guard prevents second completeBatch)
      expect(mockPersistenceService.persistBatch).toHaveBeenCalledTimes(1);
    });

    it('should preserve correct status after guard prevents re-completion', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [
          { id: 'f1', filename: 'img1.jpg' },
          { id: 'f2', filename: 'img2.jpg' },
        ],
      });

      batchTrackingService.startBatch(batch.batchId);

      // Complete both images
      batchTrackingService.updateImageResult(batch.batchId, 'img1.jpg', {
        success: true,
        filename: 'img1.jpg',
        metadata: { filename: 'img1.jpg', title: 'T', keywords: 'k', category: 1 },
      });
      batchTrackingService.updateImageResult(batch.batchId, 'img2.jpg', {
        success: false,
        filename: 'img2.jpg',
        error: { message: 'Failed', code: 'ERR' },
      });

      const first = batchTrackingService.getBatch(batch.batchId);
      expect(first!.status).toBe('completed');
      const firstCompletedAt = first!.completedAt;

      // Re-call updateImageResult (simulates final loop)
      batchTrackingService.updateImageResult(batch.batchId, 'img1.jpg', {
        success: true,
        filename: 'img1.jpg',
        metadata: { filename: 'img1.jpg', title: 'T', keywords: 'k', category: 1 },
      });

      const second = batchTrackingService.getBatch(batch.batchId);
      // Status and completedAt should not change
      expect(second!.status).toBe('completed');
      expect(second!.completedAt).toEqual(firstCompletedAt);
    });
  });

  describe('Story 6.8: userId Tracking', () => {
    it('should store userId when provided to createBatch', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        userId: 'user-abc-456',
        files: [{ id: 'f1', filename: 'img1.jpg' }],
      });

      expect(batch.userId).toBe('user-abc-456');
      const retrieved = batchTrackingService.getBatch(batch.batchId);
      expect(retrieved!.userId).toBe('user-abc-456');
    });

    it('should leave userId undefined for anonymous users', () => {
      const batch = batchTrackingService.createBatch({
        sessionId: 'session-123',
        files: [{ id: 'f1', filename: 'img1.jpg' }],
      });

      expect(batch.userId).toBeUndefined();
    });
  });
});
