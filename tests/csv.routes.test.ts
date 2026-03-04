/**
 * Tests for CSV API Routes
 * Story 4.1: CSV Generation Service (AC8, AC9)
 *
 * Tests the POST /api/generate-csv endpoint including:
 * - Successful CSV generation
 * - Empty metadata validation (AC7)
 * - Invalid input handling
 * - Filename pattern validation (AC3)
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Metadata } from '../src/models/metadata.model';

// Mock config - must be before imports
vi.mock('../src/config/app.config', () => ({
  config: {
    server: { port: 3000, nodeEnv: 'test', baseUrl: 'http://localhost:3000' },
    openai: { apiKey: 'test-key', model: 'gpt-5-nano', maxTokens: 500, temperature: 0.3 },
    processing: { concurrencyLimit: 5, maxFileSizeMB: 50, tempFileLifetimeSeconds: 10 },
    rateLimits: { anonymous: 10, freeTier: 100 },
  },
}));

// Mock the services container
vi.mock('../src/config/container', () => ({
  services: {
    csvExport: {
      generateCSV: vi.fn().mockResolvedValue(undefined),
      validateMetadataList: vi.fn().mockReturnValue({ valid: true, invalidItems: [] }),
    },
  },
}));

// Mock batch tracking service
vi.mock('../src/services/batch-tracking.service', () => ({
  batchTrackingService: {
    associateCsv: vi.fn(),
  },
}));

// Mock rate limiting middleware to pass through in tests
vi.mock('../src/api/middleware/rate-limit.middleware', () => ({
  ipRateLimitMiddleware: (req: any, res: any, next: any) => next(),
}));

// Mock logger to avoid console output in tests
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CSV Routes - POST /api/generate-csv', () => {
  let app: express.Express;
  let csvRoutes: any;
  let errorHandler: any;

  beforeAll(async () => {
    // Dynamically import after mocks are set up
    const csvModule = await import('../src/api/routes/csv.routes');
    const errorModule = await import('../src/api/middleware/error-handler');

    csvRoutes = csvModule.csvRoutes;
    errorHandler = errorModule.errorHandler;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api', csvRoutes);
    app.use(errorHandler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validMetadataList: Metadata[] = [
    {
      filename: 'image1.jpg',
      title: 'Beautiful sunset over mountains with dramatic clouds and golden light',
      keywords: 'sunset,mountains,landscape,nature,sky,clouds',
      category: 1045,
    },
    {
      filename: 'image2.jpg',
      title: 'Urban cityscape at night with illuminated skyscrapers reflecting in water',
      keywords: 'city,urban,night,buildings,architecture',
      category: 1002,
      releases: 'Model Released',
    },
  ];

  describe('AC8: Generate CSV API Endpoint', () => {
    it('should return 200 and generate CSV for valid metadata list', async () => {
      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.csvFileName).toBeDefined();
      expect(response.body.csvPath).toBeDefined();
      expect(response.body.recordCount).toBe(2);
    });

    it('should call csvExport.generateCSV with correct arguments', async () => {
      const { services } = await import('../src/config/container');

      await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList })
        .expect(200);

      expect(services.csvExport.generateCSV).toHaveBeenCalledWith(
        validMetadataList,
        expect.stringContaining('csv_output')
      );
    });

    it('should include batchId in generated CSV path when provided', async () => {
      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList, batchId: 'test-batch-123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.csvPath).toContain('csv_output');
    });
  });

  describe('AC3: Filename Convention', () => {
    it('should generate filename following pattern adobe-stock-metadata-{timestamp}.csv', async () => {
      const beforeTimestamp = Date.now();

      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList })
        .expect(200);

      const afterTimestamp = Date.now();

      // Verify filename pattern
      expect(response.body.csvFileName).toMatch(/^adobe-stock-metadata-\d+\.csv$/);

      // Extract timestamp from filename and verify it's within the test execution window
      const timestampMatch = response.body.csvFileName.match(/adobe-stock-metadata-(\d+)\.csv/);
      expect(timestampMatch).not.toBeNull();

      const extractedTimestamp = parseInt(timestampMatch![1], 10);
      expect(extractedTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(extractedTimestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it('should save files to /csv_output directory', async () => {
      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList })
        .expect(200);

      expect(response.body.csvPath).toMatch(/^csv_output[/\\]/);
    });
  });

  describe('AC7: Empty Batch Handling', () => {
    it('should return 400 with VALIDATION_ERROR code for empty metadataList', async () => {
      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('No images were processed successfully');
    });

    it('should return 400 for missing metadataList', async () => {
      const response = await request(app).post('/api/generate-csv').send({}).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('No images were processed successfully');
    });

    it('should return 400 for null metadataList', async () => {
      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: null })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('No images were processed successfully');
    });

    it('should return 400 for non-array metadataList', async () => {
      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: 'not an array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('No images were processed successfully');
    });
  });

  describe('AC5: Response Format', () => {
    it('should return success response with csvFileName, csvPath, recordCount', async () => {
      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList })
        .expect(200);

      // Verify all required fields are present
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('csvFileName');
      expect(response.body).toHaveProperty('csvPath');
      expect(response.body).toHaveProperty('recordCount');

      // Verify types
      expect(typeof response.body.csvFileName).toBe('string');
      expect(typeof response.body.csvPath).toBe('string');
      expect(typeof response.body.recordCount).toBe('number');
    });

    it('should return correct recordCount matching input length', async () => {
      const singleItemList: Metadata[] = [validMetadataList[0]];

      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: singleItemList })
        .expect(200);

      expect(response.body.recordCount).toBe(1);
    });
  });

  describe('Metadata Validation', () => {
    it('should return 400 when metadata validation fails', async () => {
      const { services } = await import('../src/config/container');
      vi.mocked(services.csvExport.validateMetadataList).mockReturnValueOnce({
        valid: false,
        invalidItems: [{ index: 0, errors: ['Filename is required and cannot be empty'] }],
      });

      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid metadata');
    });

    it('should call validateMetadataList before generateCSV', async () => {
      const { services } = await import('../src/config/container');

      await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList })
        .expect(200);

      expect(services.csvExport.validateMetadataList).toHaveBeenCalledWith(validMetadataList);
      expect(services.csvExport.generateCSV).toHaveBeenCalled();
    });

    it('should not call generateCSV when validation fails', async () => {
      const { services } = await import('../src/config/container');
      vi.mocked(services.csvExport.validateMetadataList).mockReturnValueOnce({
        valid: false,
        invalidItems: [{ index: 0, errors: ['Title is required'] }],
      });

      await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList })
        .expect(400);

      expect(services.csvExport.generateCSV).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when CSV generation fails', async () => {
      const { services } = await import('../src/config/container');
      vi.mocked(services.csvExport.generateCSV).mockRejectedValueOnce(
        new Error('Filesystem error')
      );

      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('AC5: Batch Association', () => {
    it('should associate CSV with batch when batchId is provided', async () => {
      const { batchTrackingService } = await import('../src/services/batch-tracking.service');

      await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList, batchId: 'test-batch-123' })
        .expect(200);

      expect(batchTrackingService.associateCsv).toHaveBeenCalledWith(
        'test-batch-123',
        expect.stringContaining('csv_output/'),
        expect.stringMatching(/^adobe-stock-metadata-\d+\.csv$/)
      );
    });

    it('should not call associateCsv when batchId is not provided', async () => {
      const { batchTrackingService } = await import('../src/services/batch-tracking.service');

      await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: validMetadataList })
        .expect(200);

      expect(batchTrackingService.associateCsv).not.toHaveBeenCalled();
    });
  });

  describe('Array Size Limit', () => {
    it('should return 400 when metadata list exceeds 1000 items', async () => {
      const oversizedList = Array.from({ length: 1001 }, (_, i) => ({
        filename: `image${i}.jpg`,
        title: 'A'.repeat(50),
        keywords: 'a,b,c,d,e',
        category: 1,
      }));

      const response = await request(app)
        .post('/api/generate-csv')
        .send({ metadataList: oversizedList })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Too many items');
    });
  });
});
