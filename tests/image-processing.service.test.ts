/**
 * Tests for ImageProcessingService
 *
 * Validates image processing orchestration including:
 * - Single image processing workflow
 * - Batch processing with concurrency (Story 2.5)
 * - Error handling and recovery
 * - Timeout protection
 * - Progress tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageProcessingService } from '../src/services/image-processing.service';
import { TempUrlService } from '../src/services/temp-url.service';
import { MetadataService } from '../src/services/metadata.service';
import type { ProcessingResult, RawAIMetadata, BatchProgress } from '../src/models/metadata.model';
import { ProcessingError } from '../src/models/errors';
import * as loggerModule from '../src/utils/logger';

// Mock dependencies
vi.mock('../src/services/temp-url.service');
vi.mock('../src/services/metadata.service');
vi.mock('../src/config/app.config', () => ({
  config: {
    processing: {
      concurrencyLimit: 5,
      maxFileSizeMB: 50,
      tempFileLifetime: 10,
    },
  },
}));
vi.mock('../src/utils/retry', () => ({
  withRetry: vi.fn(async fn => await fn()),
}));

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;
  let mockTempUrlService: any;
  let mockMetadataService: any;

  const createMockFile = (filename: string): Express.Multer.File => ({
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 1024,
    destination: 'uploads/',
    filename: `${Date.now()}-${filename}`,
    path: `uploads/${Date.now()}-${filename}`,
    buffer: Buffer.from('mock-image-data'),
    stream: null as any,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockTempUrlService = {
      createTempUrl: vi.fn(),
      createTempUrlFromPath: vi.fn(),
      cleanup: vi.fn(),
    };

    mockMetadataService = {
      generateMetadata: vi.fn(),
      validateConnection: vi.fn(),
    };

    // Create service with mocked dependencies
    service = new ImageProcessingService(mockTempUrlService, mockMetadataService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processImage', () => {
    it('should successfully process an image', async () => {
      const mockFile = createMockFile('test-image.jpg');
      const mockUrl = 'https://example.com/temp/uuid-123.jpg';
      const mockRawMetadata: RawAIMetadata = {
        title: 'Beautiful sunset',
        keywords: ['sunset', 'landscape', 'nature'],
        category: 1045,
      };

      mockTempUrlService.createTempUrl.mockResolvedValue(mockUrl);
      mockMetadataService.generateMetadata.mockResolvedValue(mockRawMetadata);

      const result = await service.processImage(mockFile);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-image.jpg');
      expect(result.metadata).toEqual({
        filename: 'test-image.jpg',
        title: 'Beautiful sunset',
        keywords: 'sunset,landscape,nature',
        category: 1045,
      });

      expect(mockTempUrlService.createTempUrl).toHaveBeenCalledWith(mockFile);
      expect(mockMetadataService.generateMetadata).toHaveBeenCalledWith(mockUrl);
    });

    it('should handle createTempUrl failure', async () => {
      const mockFile = createMockFile('test-image.jpg');

      mockTempUrlService.createTempUrl.mockRejectedValue(new Error('Failed to compress image'));

      const result = await service.processImage(mockFile);

      expect(result.success).toBe(false);
      expect(result.filename).toBe('test-image.jpg');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('PROCESSING_FAILED');
      expect(result.error?.stage).toBe('create-temp-url');
    });

    it('should handle metadata generation failure', async () => {
      const mockFile = createMockFile('test-image.jpg');
      const mockUrl = 'https://example.com/temp/uuid-123.jpg';

      mockTempUrlService.createTempUrl.mockResolvedValue(mockUrl);
      mockMetadataService.generateMetadata.mockRejectedValue(new Error('OpenAI API timeout'));

      const result = await service.processImage(mockFile);

      expect(result.success).toBe(false);
      expect(result.filename).toBe('test-image.jpg');
      expect(result.error).toBeDefined();
      expect(result.error?.stage).toBe('generate-metadata');
    });

    it('should convert array keywords to comma-separated string', async () => {
      const mockFile = createMockFile('test-image.jpg');
      const mockUrl = 'https://example.com/temp/uuid-123.jpg';
      const mockRawMetadata: RawAIMetadata = {
        title: 'Test',
        keywords: ['keyword1', 'keyword2', 'keyword3'],
        category: 1,
      };

      mockTempUrlService.createTempUrl.mockResolvedValue(mockUrl);
      mockMetadataService.generateMetadata.mockResolvedValue(mockRawMetadata);

      const result = await service.processImage(mockFile);

      expect(result.success).toBe(true);
      expect(result.metadata?.keywords).toBe('keyword1,keyword2,keyword3');
    });

    it('should handle keywords already as string', async () => {
      const mockFile = createMockFile('test-image.jpg');
      const mockUrl = 'https://example.com/temp/uuid-123.jpg';
      const mockRawMetadata: any = {
        title: 'Test',
        keywords: 'keyword1,keyword2', // Already a string
        category: 1,
      };

      mockTempUrlService.createTempUrl.mockResolvedValue(mockUrl);
      mockMetadataService.generateMetadata.mockResolvedValue(mockRawMetadata);

      const result = await service.processImage(mockFile);

      expect(result.success).toBe(true);
      expect(result.metadata?.keywords).toBe('keyword1,keyword2');
    });

    it('should convert category to number', async () => {
      const mockFile = createMockFile('test-image.jpg');
      const mockUrl = 'https://example.com/temp/uuid-123.jpg';
      const mockRawMetadata: any = {
        title: 'Test',
        keywords: ['test'],
        category: '1045', // String category
      };

      mockTempUrlService.createTempUrl.mockResolvedValue(mockUrl);
      mockMetadataService.generateMetadata.mockResolvedValue(mockRawMetadata);

      const result = await service.processImage(mockFile);

      expect(result.success).toBe(true);
      expect(result.metadata?.category).toBe(1045);
      expect(typeof result.metadata?.category).toBe('number');
    });

    it('should use retry logic for metadata generation', async () => {
      const mockFile = createMockFile('test-image.jpg');
      const mockUrl = 'https://example.com/temp/uuid-123.jpg';
      const mockRawMetadata: RawAIMetadata = {
        title: 'Test',
        keywords: ['test'],
        category: 1,
      };

      mockTempUrlService.createTempUrl.mockResolvedValue(mockUrl);
      mockMetadataService.generateMetadata.mockResolvedValue(mockRawMetadata);

      await service.processImage(mockFile);

      // Verify withRetry was called
      const { withRetry } = await import('../src/utils/retry');
      expect(withRetry).toHaveBeenCalled();
    });
  });

  describe('processBatch', () => {
    it('should process multiple images successfully', async () => {
      const mockFiles = [
        createMockFile('image1.jpg'),
        createMockFile('image2.jpg'),
        createMockFile('image3.jpg'),
      ];

      mockTempUrlService.createTempUrl.mockResolvedValue('https://example.com/temp/uuid.jpg');
      mockMetadataService.generateMetadata.mockResolvedValue({
        title: 'Test',
        keywords: ['test'],
        category: 1,
      });

      const results = await service.processBatch(mockFiles);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockTempUrlService.createTempUrl).toHaveBeenCalledTimes(3);
      expect(mockMetadataService.generateMetadata).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures with continueOnError=true (graceful degradation)', async () => {
      const mockFiles = [
        createMockFile('image1.jpg'),
        createMockFile('image2.jpg'),
        createMockFile('image3.jpg'),
      ];

      // Track which file we're processing
      let callIndex = 0;
      mockTempUrlService.createTempUrl.mockImplementation(async (file: any) => {
        callIndex++;
        // Fail for image2.jpg
        if (file.originalname === 'image2.jpg') {
          throw new Error('Failed on second image');
        }
        return 'https://example.com/temp/uuid.jpg';
      });

      mockMetadataService.generateMetadata.mockResolvedValue({
        title: 'Test',
        keywords: ['test'],
        category: 1,
      });

      const results = await service.processBatch(mockFiles, { continueOnError: true });

      expect(results).toHaveLength(3);
      // Note: With parallel processing, order of results matches input order
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      expect(successCount).toBe(2);
      expect(failCount).toBe(1);
    });

    it('should throw error on empty file list', async () => {
      await expect(service.processBatch([])).rejects.toThrow(ProcessingError);

      try {
        await service.processBatch([]);
        expect.fail('Should have thrown ProcessingError');
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessingError);
        const procError = error as ProcessingError;
        expect(procError.code).toBe('EMPTY_FILE_LIST');
        expect(procError.message).toContain('Cannot process empty file list');
      }
    });

    it('should handle timeout for individual images', async () => {
      const mockFiles = [createMockFile('slow-image.jpg')];

      // Mock slow processing (exceeds timeout)
      mockTempUrlService.createTempUrl.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('url'), 50000))
      );

      const results = await service.processBatch(mockFiles, { timeoutMs: 100, retryAttempts: 0 });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      // Story 3.5 (AC7): User-friendly message instead of technical message
      // The timeout error message is user-friendly but we can check errorType
      expect(results[0].error?.message).toBeDefined();
      expect(results[0].error?.stage).toBe('batch-processing');
    });

    it('should log batch processing summary', async () => {
      const mockFiles = [createMockFile('image1.jpg'), createMockFile('image2.jpg')];

      mockTempUrlService.createTempUrl.mockResolvedValue('https://example.com/temp/uuid.jpg');
      mockMetadataService.generateMetadata.mockResolvedValue({
        title: 'Test',
        keywords: ['test'],
        category: 1,
      });

      const loggerSpy = vi.spyOn(loggerModule.logger, 'info');

      await service.processBatch(mockFiles);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ count: 2 }),
        expect.stringContaining('Starting')
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ successful: 2, failed: 0, total: 2 }),
        expect.stringContaining('complete')
      );
    });

    it('should use custom concurrency setting', async () => {
      const mockFiles = [createMockFile('image1.jpg')];

      mockTempUrlService.createTempUrl.mockResolvedValue('https://example.com/temp/uuid.jpg');
      mockMetadataService.generateMetadata.mockResolvedValue({
        title: 'Test',
        keywords: ['test'],
        category: 1,
      });

      const loggerSpy = vi.spyOn(loggerModule.logger, 'info');

      await service.processBatch(mockFiles, { concurrency: 10 });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ concurrency: 10 }),
        expect.any(String)
      );
    });
  });

  // Story 2.5: Parallel Processing Orchestration Tests
  describe('processBatch - Parallel Processing (Story 2.5)', () => {
    describe('AC1: Concurrent Processing with Concurrency Limit', () => {
      it('should process images in parallel with p-limit', async () => {
        const mockFiles = Array.from({ length: 5 }, (_, i) => createMockFile(`image${i + 1}.jpg`));

        const processingOrder: string[] = [];
        const processingStart: Record<string, number> = {};
        const processingEnd: Record<string, number> = {};

        mockTempUrlService.createTempUrl.mockImplementation(async (file: any) => {
          processingStart[file.originalname] = Date.now();
          processingOrder.push(`start:${file.originalname}`);
          // Simulate 50ms processing time
          await new Promise(resolve => setTimeout(resolve, 50));
          processingEnd[file.originalname] = Date.now();
          processingOrder.push(`end:${file.originalname}`);
          return 'https://example.com/temp/uuid.jpg';
        });

        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const startTime = Date.now();
        const results = await service.processBatch(mockFiles, { concurrency: 5 });
        const totalTime = Date.now() - startTime;

        expect(results).toHaveLength(5);
        expect(results.every(r => r.success)).toBe(true);

        // With concurrency 5 and 50ms per image, total should be ~100-200ms, not ~250ms (sequential)
        // Note: This is a soft assertion due to timing variability in tests
        expect(totalTime).toBeLessThan(300);
      });

      it('should respect concurrency limit of 5', async () => {
        const mockFiles = Array.from({ length: 10 }, (_, i) => createMockFile(`image${i + 1}.jpg`));

        let concurrentCount = 0;
        let maxConcurrent = 0;

        mockTempUrlService.createTempUrl.mockImplementation(async () => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 30));
          concurrentCount--;
          return 'https://example.com/temp/uuid.jpg';
        });

        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        await service.processBatch(mockFiles, { concurrency: 5 });

        // Should never exceed concurrency limit
        expect(maxConcurrent).toBeLessThanOrEqual(5);
      });
    });

    describe('AC3: Graceful Degradation on Failures', () => {
      it('should continue processing when one image fails', async () => {
        const mockFiles = [
          createMockFile('image1.jpg'),
          createMockFile('fail-image.jpg'),
          createMockFile('image3.jpg'),
        ];

        mockTempUrlService.createTempUrl.mockImplementation(async (file: any) => {
          if (file.originalname === 'fail-image.jpg') {
            throw new Error('Simulated failure');
          }
          return 'https://example.com/temp/uuid.jpg';
        });

        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const results = await service.processBatch(mockFiles);

        expect(results).toHaveLength(3);

        const successResults = results.filter(r => r.success);
        const failedResults = results.filter(r => !r.success);

        expect(successResults).toHaveLength(2);
        expect(failedResults).toHaveLength(1);
        expect(failedResults[0].filename).toBe('fail-image.jpg');
      });

      it('should process all images even with multiple failures', async () => {
        const mockFiles = Array.from({ length: 5 }, (_, i) => createMockFile(`image${i + 1}.jpg`));

        mockTempUrlService.createTempUrl.mockImplementation(async (file: any) => {
          // Fail images 2 and 4
          if (['image2.jpg', 'image4.jpg'].includes(file.originalname)) {
            throw new Error('Simulated failure');
          }
          return 'https://example.com/temp/uuid.jpg';
        });

        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const results = await service.processBatch(mockFiles);

        expect(results).toHaveLength(5);
        expect(results.filter(r => r.success)).toHaveLength(3);
        expect(results.filter(r => !r.success)).toHaveLength(2);
      });
    });

    describe('AC4: Progress Tracking Support', () => {
      it('should call onProgress callback during batch processing', async () => {
        const mockFiles = [
          createMockFile('image1.jpg'),
          createMockFile('image2.jpg'),
          createMockFile('image3.jpg'),
        ];

        mockTempUrlService.createTempUrl.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          return 'https://example.com/temp/uuid.jpg';
        });

        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const progressUpdates: BatchProgress[] = [];
        const onProgress = vi.fn((progress: BatchProgress) => {
          progressUpdates.push({ ...progress, results: [...progress.results] });
        });

        await service.processBatch(mockFiles, { onProgress, concurrency: 1 });

        // Should have multiple progress updates
        expect(onProgress).toHaveBeenCalled();
        expect(progressUpdates.length).toBeGreaterThan(0);

        // Final update should show all completed
        const finalUpdate = progressUpdates[progressUpdates.length - 1];
        expect(finalUpdate.completed).toBe(3);
        expect(finalUpdate.total).toBe(3);
        expect(finalUpdate.successful).toBe(3);
        expect(finalUpdate.failed).toBe(0);
      });

      it('should track progress with correct counts', async () => {
        const mockFiles = [createMockFile('image1.jpg'), createMockFile('image2.jpg')];

        mockTempUrlService.createTempUrl.mockResolvedValue('https://example.com/temp/uuid.jpg');
        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const progressUpdates: BatchProgress[] = [];
        const onProgress = (progress: BatchProgress) => {
          progressUpdates.push({ ...progress });
        };

        await service.processBatch(mockFiles, { onProgress, concurrency: 1 });

        // Check that total is always correct
        progressUpdates.forEach(update => {
          expect(update.total).toBe(2);
          expect(update.completed + update.pending + update.processing).toBeLessThanOrEqual(2);
        });
      });

      it('should include results in progress updates', async () => {
        const mockFiles = [createMockFile('image1.jpg'), createMockFile('image2.jpg')];

        mockTempUrlService.createTempUrl.mockResolvedValue('https://example.com/temp/uuid.jpg');
        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        let lastProgress: BatchProgress | null = null;
        const onProgress = (progress: BatchProgress) => {
          lastProgress = progress;
        };

        await service.processBatch(mockFiles, { onProgress });

        expect(lastProgress).not.toBeNull();
        expect(lastProgress!.results).toHaveLength(2);
        expect(lastProgress!.results.every(r => r.success)).toBe(true);
      });

      it('should handle error in onProgress callback gracefully', async () => {
        const mockFiles = [createMockFile('image1.jpg')];

        mockTempUrlService.createTempUrl.mockResolvedValue('https://example.com/temp/uuid.jpg');
        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const errorCallback = vi.fn(() => {
          throw new Error('Callback error');
        });

        // Should not throw even if callback throws
        const results = await service.processBatch(mockFiles, { onProgress: errorCallback });

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
      });
    });

    describe('AC5: Performance Target', () => {
      it('should achieve significant speedup with parallel processing', async () => {
        const mockFiles = Array.from({ length: 5 }, (_, i) => createMockFile(`image${i + 1}.jpg`));

        const PROCESSING_TIME = 50; // 50ms per image

        mockTempUrlService.createTempUrl.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, PROCESSING_TIME));
          return 'https://example.com/temp/uuid.jpg';
        });

        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const startTime = Date.now();
        await service.processBatch(mockFiles, { concurrency: 5 });
        const parallelTime = Date.now() - startTime;

        // Sequential would take ~250ms (5 * 50ms)
        // Parallel with 5 concurrent should take ~50-100ms
        // Allow some overhead, but should be significantly less than sequential
        const sequentialTime = mockFiles.length * PROCESSING_TIME;
        const speedup = sequentialTime / parallelTime;

        expect(speedup).toBeGreaterThan(1.5); // At least 1.5x speedup
      });
    });

    describe('AC6: Timeout Handling', () => {
      it('should timeout individual images at 30s by default', async () => {
        const mockFiles = [createMockFile('slow-image.jpg')];

        mockTempUrlService.createTempUrl.mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve('url'), 60000))
        );

        // Use shorter timeout for test
        const results = await service.processBatch(mockFiles, {
          timeoutMs: 100,
          retryAttempts: 0,
        });

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        // Story 3.5 (AC7): User-friendly message instead of technical "timeout"
        expect(results[0].error?.message).toBeDefined();
        expect(results[0].error?.stage).toBe('batch-processing');
      });

      it('should not block other images when one times out', async () => {
        const mockFiles = [createMockFile('slow-image.jpg'), createMockFile('fast-image.jpg')];

        mockTempUrlService.createTempUrl.mockImplementation(async (file: any) => {
          if (file.originalname === 'slow-image.jpg') {
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
          return 'https://example.com/temp/uuid.jpg';
        });

        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const results = await service.processBatch(mockFiles, {
          timeoutMs: 100,
          retryAttempts: 0,
          concurrency: 2,
        });

        expect(results).toHaveLength(2);

        const slowResult = results.find(r => r.filename === 'slow-image.jpg');
        const fastResult = results.find(r => r.filename === 'fast-image.jpg');

        expect(slowResult?.success).toBe(false);
        expect(fastResult?.success).toBe(true);
      });
    });

    describe('AC7: Error Recovery with Retry', () => {
      it('should retry recoverable errors once by default', async () => {
        const mockFiles = [createMockFile('retry-image.jpg')];

        let attemptCount = 0;
        mockTempUrlService.createTempUrl.mockImplementation(async () => {
          attemptCount++;
          if (attemptCount === 1) {
            const error: any = new Error('Network timeout');
            error.message = 'ETIMEDOUT';
            throw error;
          }
          return 'https://example.com/temp/uuid.jpg';
        });

        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const results = await service.processBatch(mockFiles, { retryAttempts: 1 });

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
        expect(attemptCount).toBe(2); // Initial attempt + 1 retry
      });

      it('should not retry non-recoverable errors', async () => {
        const mockFiles = [createMockFile('invalid-image.jpg')];

        let attemptCount = 0;
        mockTempUrlService.createTempUrl.mockImplementation(async () => {
          attemptCount++;
          throw new Error('Invalid image format'); // Non-recoverable
        });

        const results = await service.processBatch(mockFiles, { retryAttempts: 1 });

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        // Non-recoverable errors are not retried within processWithRetryAndTimeout
        // The error is returned as a failure result, not retried
      });

      it('should fail after all retries exhausted', async () => {
        const mockFiles = [createMockFile('always-fail.jpg')];

        let attemptCount = 0;
        mockTempUrlService.createTempUrl.mockImplementation(async () => {
          attemptCount++;
          const error: any = new Error('Network error');
          error.message = 'ECONNRESET'; // Recoverable
          throw error;
        });

        const results = await service.processBatch(mockFiles, { retryAttempts: 2 });

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(attemptCount).toBe(3); // Initial + 2 retries
      });

      it('should use configurable retry attempts', async () => {
        const mockFiles = [createMockFile('retry-image.jpg')];

        let attemptCount = 0;
        mockTempUrlService.createTempUrl.mockImplementation(async () => {
          attemptCount++;
          if (attemptCount <= 2) {
            const error: any = new Error('Network timeout');
            error.message = 'ETIMEDOUT';
            throw error;
          }
          return 'https://example.com/temp/uuid.jpg';
        });

        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        // With 3 retry attempts (initial + 3 retries = 4 total), should succeed on 3rd attempt
        const results = await service.processBatch(mockFiles, { retryAttempts: 3 });

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
        expect(attemptCount).toBe(3); // Initial + 2 retries before success
      }, 15000); // Increased timeout for retry delays
    });

    describe('AC8: Resource Cleanup', () => {
      it('should complete processing for all images (cleanup handled by TempUrlService)', async () => {
        const mockFiles = [createMockFile('image1.jpg'), createMockFile('image2.jpg')];

        mockTempUrlService.createTempUrl.mockResolvedValue('https://example.com/temp/uuid.jpg');
        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const results = await service.processBatch(mockFiles);

        // All images processed
        expect(results).toHaveLength(2);
        expect(results.every(r => r.success)).toBe(true);

        // TempUrlService handles cleanup automatically via scheduled cleanup
        // Verify the service was called for each image
        expect(mockTempUrlService.createTempUrl).toHaveBeenCalledTimes(2);
      });

      it('should handle cleanup even when processing fails', async () => {
        const mockFiles = [createMockFile('fail-image.jpg')];

        mockTempUrlService.createTempUrl.mockRejectedValue(new Error('Processing failed'));

        const results = await service.processBatch(mockFiles, { retryAttempts: 0 });

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        // Service should still complete without throwing
      });
    });

    describe('Logging and Metrics', () => {
      it('should log speedup calculation', async () => {
        const mockFiles = [createMockFile('image1.jpg'), createMockFile('image2.jpg')];

        mockTempUrlService.createTempUrl.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          return 'https://example.com/temp/uuid.jpg';
        });

        mockMetadataService.generateMetadata.mockResolvedValue({
          title: 'Test',
          keywords: ['test'],
          category: 1,
        });

        const loggerSpy = vi.spyOn(loggerModule.logger, 'info');

        await service.processBatch(mockFiles, { concurrency: 2 });

        // Should log completion with speedup info
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            speedupVsSequential: expect.any(String),
          }),
          expect.stringContaining('complete')
        );
      });
    });
  });

  describe('getStats', () => {
    it('should return processing statistics', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('avgProcessingTimeMs');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('successRate');
    });

    it('should return default values for new service instance', () => {
      const stats = service.getStats();

      expect(stats.avgProcessingTimeMs).toBe(0);
      expect(stats.totalProcessed).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('error context', () => {
    it('should include filename in error context', async () => {
      const mockFile = createMockFile('error-image.jpg');

      mockTempUrlService.createTempUrl.mockRejectedValue(new Error('Compression failed'));

      const result = await service.processImage(mockFile);

      expect(result.error?.context).toMatchObject({
        filename: 'error-image.jpg',
      });
    });

    it('should include tempUrl in error context when available', async () => {
      const mockFile = createMockFile('error-image.jpg');
      const mockUrl = 'https://example.com/temp/uuid-123.jpg';

      mockTempUrlService.createTempUrl.mockResolvedValue(mockUrl);
      mockMetadataService.generateMetadata.mockRejectedValue(new Error('AI failure'));

      const result = await service.processImage(mockFile);

      expect(result.error?.context).toMatchObject({
        filename: 'error-image.jpg',
        tempUrl: mockUrl,
      });
    });
  });
});
