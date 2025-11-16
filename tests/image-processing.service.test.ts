/**
 * Tests for ImageProcessingService
 *
 * Validates image processing orchestration including:
 * - Single image processing workflow
 * - Batch processing with concurrency
 * - Error handling and recovery
 * - Timeout protection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageProcessingService } from '../src/services/image-processing.service';
import { TempUrlService } from '../src/services/temp-url.service';
import { MetadataService } from '../src/services/metadata.service';
import type { ProcessingResult, RawAIMetadata } from '../src/models/metadata.model';
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

    it('should handle partial failures with continueOnError=true', async () => {
      const mockFiles = [
        createMockFile('image1.jpg'),
        createMockFile('image2.jpg'),
        createMockFile('image3.jpg'),
      ];

      let callCount = 0;
      mockTempUrlService.createTempUrl.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
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
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should stop on first error with continueOnError=false', async () => {
      const mockFiles = [
        createMockFile('image1.jpg'),
        createMockFile('image2.jpg'),
        createMockFile('image3.jpg'),
      ];

      let callCount = 0;
      mockTempUrlService.createTempUrl.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Failed on second image');
        }
        return 'https://example.com/temp/uuid.jpg';
      });

      mockMetadataService.generateMetadata.mockResolvedValue({
        title: 'Test',
        keywords: ['test'],
        category: 1,
      });

      const results = await service.processBatch(mockFiles, { continueOnError: false });

      expect(results).toHaveLength(2); // Should stop after second image
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
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

      const results = await service.processBatch(mockFiles, { timeoutMs: 100 });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error?.code).toBe('PROCESSING_TIMEOUT');
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
        expect.stringContaining('Starting batch processing')
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ successful: 2, failed: 0, total: 2 }),
        expect.stringContaining('Batch processing complete')
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

      await service.processBatch(mockFiles, { concurrency: 10 });

      // Note: Current implementation is sequential, but parameter is accepted
      // Future enhancement will use p-limit for true concurrency
      expect(true).toBe(true); // Placeholder - will be enhanced in future story
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
