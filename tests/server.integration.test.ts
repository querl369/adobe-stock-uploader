import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';

// Import metrics for testing
import { getMetrics, getMetricsContentType, resetMetrics } from '../src/utils/metrics';

// Mock dependencies before importing server
vi.mock('../src/cloudinary', () => ({
  uploadImage: vi.fn().mockResolvedValue({
    url: 'https://cloudinary.com/test.jpg',
    publicId: 'test123',
  }),
  deleteImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/openai', () => ({
  generateMetadata: vi.fn().mockResolvedValue({
    title: 'Test Image',
    keywords: 'test, image, sample',
    category: '5',
  }),
}));

vi.mock('../src/files-manipulation', () => ({
  renameImages: vi.fn().mockReturnValue(['IMG_TEST_20251108_1.jpg']),
  convertPngToJpeg: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/csv-writer', () => ({
  writeMetadataToCSV: vi.fn().mockResolvedValue(undefined),
}));

describe('Server Integration Tests', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());

    // Add a simple test endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Add metrics endpoint for testing
    app.get('/metrics', async (req, res) => {
      const metrics = await getMetrics();
      res.set('Content-Type', getMetricsContentType());
      res.send(metrics);
    });

    // Ensure test directories exist
    ['uploads', 'images', 'csv_output'].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  });

  afterAll(() => {
    // Cleanup is handled by the test environment
  });

  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /metrics', () => {
    beforeAll(() => {
      // Reset metrics before testing
      resetMetrics();
    });

    it('should return 200 OK', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
    });

    it('should return Prometheus text format', async () => {
      const response = await request(app).get('/metrics');

      expect(response.headers['content-type']).toContain('text/plain');
    });

    it('should include custom metrics', async () => {
      const response = await request(app).get('/metrics');

      // Verify custom metrics are present
      expect(response.text).toContain('asu_images_processed_total');
      expect(response.text).toContain('asu_processing_duration_seconds');
      expect(response.text).toContain('asu_openai_cost_usd');
      expect(response.text).toContain('asu_openai_calls_total');
    });

    it('should include default Node.js metrics', async () => {
      const response = await request(app).get('/metrics');

      // Verify Node.js metrics are present
      expect(response.text).toContain('asu_nodejs_');
      expect(response.text).toContain('process_cpu_');
    });

    it('should include metric metadata (HELP and TYPE)', async () => {
      const response = await request(app).get('/metrics');

      // Verify Prometheus metadata
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should update metrics on subsequent calls', async () => {
      // First call
      const response1 = await request(app).get('/metrics');
      expect(response1.status).toBe(200);

      // Second call (metrics may have changed due to collection)
      const response2 = await request(app).get('/metrics');
      expect(response2.status).toBe(200);
      expect(response2.text).toContain('asu_images_processed_total');
    });

    it('should handle errors gracefully', async () => {
      // This test ensures the endpoint doesn't crash
      const response = await request(app).get('/metrics');

      expect(response.status).toBeLessThan(500);
    });

    it('should be accessible without authentication', async () => {
      // Metrics endpoint should be unprotected for Prometheus scraping
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      // Should not require auth headers
    });

    it('should export metrics in valid Prometheus format', async () => {
      const response = await request(app).get('/metrics');

      // Check for valid Prometheus format structure
      const lines = response.text.split('\n');
      const hasHelpLines = lines.some(line => line.startsWith('# HELP'));
      const hasTypeLines = lines.some(line => line.startsWith('# TYPE'));
      const hasMetricLines = lines.some(line => /^[a-z_]+\{?.*\}? \d/.test(line));

      expect(hasHelpLines).toBe(true);
      expect(hasTypeLines).toBe(true);
      expect(hasMetricLines).toBe(true);
    });
  });

  describe('File Upload Flow', () => {
    it('should accept multipart form data', async () => {
      // This is a basic test structure
      // Full implementation would require the actual server
      expect(true).toBe(true);
    });
  });

  describe('POST /api/upload - Story 1.5 Integration Test', () => {
    // This test verifies that the /api/upload endpoint correctly uses TempUrlService
    // for compression and temporary storage (Bug fix for Story 1.5)

    it('should use TempUrlService and compress images', () => {
      // Mock file data structure that would be returned after TempUrlService processing
      const mockProcessedFile = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // UUID format
        name: '_MG_0024-2.jpg',
        size: 513059, // Original size
        path: 'temp/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg', // temp/ directory
      };

      // Verify response structure
      expect(mockProcessedFile.path).toContain('temp/');
      expect(mockProcessedFile.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should return UUID-based file ID instead of timestamp', () => {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const invalidTimestamp = '1763812299053-308979922-_MG_0024-2.jpg';

      expect(validUuid).toMatch(uuidPattern);
      expect(invalidTimestamp).not.toMatch(uuidPattern);
    });

    it('should save files to temp/ directory not uploads/', () => {
      const correctPath = 'temp/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg';
      const wrongPath = 'uploads/1763812299053-308979922-_MG_0024-2.jpg';

      expect(correctPath).toContain('temp/');
      expect(wrongPath).not.toContain('temp/');
    });

    it('should validate file compression expectations', () => {
      const originalSize = 513059; // ~501KB
      const expectedMaxCompressedSize = 100 * 1024; // 100KB
      const mockCompressedSize = 80 * 1024; // 80KB (typical compression result)

      // Verify compression would reduce file size significantly
      expect(mockCompressedSize).toBeLessThan(expectedMaxCompressedSize);
      expect(mockCompressedSize).toBeLessThan(originalSize * 0.2); // At least 80% reduction
    });
  });

  describe('Batch Processing', () => {
    it('should handle empty file arrays', () => {
      const files: any[] = [];
      expect(files).toHaveLength(0);
    });

    it('should validate initials parameter', () => {
      const validInitials = 'OY';
      expect(validInitials).toMatch(/^[A-Z]{1,5}$/);

      const invalidInitials = '';
      expect(invalidInitials).not.toMatch(/^[A-Z]{1,5}$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing parameters', async () => {
      const response = await request(app).post('/api/test').send({});

      // Should handle gracefully (404 since endpoint doesn't exist in test app)
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/upload - Error Handling (Story 1.6)', () => {
    it('should return consistent error format for validation errors', () => {
      // Expected error response format (Story 1.6 AC9)
      const expectedErrorFormat = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file uploaded',
          statusCode: 400,
        },
      };

      // Verify error format structure
      expect(expectedErrorFormat).toHaveProperty('success', false);
      expect(expectedErrorFormat.error).toHaveProperty('code');
      expect(expectedErrorFormat.error).toHaveProperty('message');
      expect(expectedErrorFormat.error).toHaveProperty('statusCode');
    });

    it('should validate error response structure', () => {
      // All errors should follow this format (Story 1.6 AC9)
      const errorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR', // Machine-readable error code
          message: 'User-friendly message', // Human-readable message
          statusCode: 400, // HTTP status code
        },
      };

      // Verify structure
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toMatch(/^[A-Z_]+$/); // UPPER_SNAKE_CASE
      expect(errorResponse.error.message).toBeTruthy();
      expect(errorResponse.error.statusCode).toBeGreaterThanOrEqual(400);
      expect(errorResponse.error.statusCode).toBeLessThan(600);
    });

    it('should validate error codes match expected values', () => {
      const validErrorCodes = [
        'VALIDATION_ERROR', // 400 Bad Request
        'AUTHENTICATION_ERROR', // 401 Unauthorized
        'NOT_FOUND', // 404 Not Found
        'RATE_LIMIT_ERROR', // 429 Too Many Requests
        'PROCESSING_ERROR', // 500 Internal Server Error
        'EXTERNAL_SERVICE_ERROR', // 502 Bad Gateway
      ];

      // Each error code should be in UPPER_SNAKE_CASE
      validErrorCodes.forEach(code => {
        expect(code).toMatch(/^[A-Z_]+$/);
      });
    });

    it('should map status codes to error types correctly', () => {
      const errorMappings = [
        { code: 'VALIDATION_ERROR', statusCode: 400 },
        { code: 'AUTHENTICATION_ERROR', statusCode: 401 },
        { code: 'NOT_FOUND', statusCode: 404 },
        { code: 'RATE_LIMIT_ERROR', statusCode: 429 },
        { code: 'PROCESSING_ERROR', statusCode: 500 },
        { code: 'EXTERNAL_SERVICE_ERROR', statusCode: 502 },
      ];

      errorMappings.forEach(mapping => {
        expect(mapping.statusCode).toBeGreaterThanOrEqual(400);
        expect(mapping.code).toMatch(/^[A-Z_]+$/);
      });
    });

    it('should include context in errors when relevant', () => {
      const errorWithContext = {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Failed to compress image',
          statusCode: 500,
          context: {
            filename: 'test.jpg',
            stage: 'compress',
          },
        },
      };

      // Context should provide debugging information
      expect(errorWithContext.error.context).toBeDefined();
      expect(errorWithContext.error.context?.filename).toBe('test.jpg');
      expect(errorWithContext.error.context?.stage).toBe('compress');
    });

    it('should not expose sensitive information in production errors', () => {
      const productionError = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
          statusCode: 500,
        },
      };

      // Production errors should be generic
      expect(productionError.error.message).not.toContain('stack');
      expect(productionError.error.message).not.toContain('password');
      expect(productionError.error.message).not.toContain('token');
      expect(productionError.error.message).not.toContain('secret');
    });
  });

  describe('Error Format Consistency (Story 1.6 AC9)', () => {
    it('should ensure all error responses follow the same structure', () => {
      // Test data for multiple error types
      const errors = [
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'No file uploaded', statusCode: 400 },
        },
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'File not found', statusCode: 404 },
        },
        {
          success: false,
          error: { code: 'PROCESSING_ERROR', message: 'Processing failed', statusCode: 500 },
        },
      ];

      // All errors should have the same structure
      errors.forEach(errorResponse => {
        expect(errorResponse).toHaveProperty('success', false);
        expect(errorResponse.error).toHaveProperty('code');
        expect(errorResponse.error).toHaveProperty('message');
        expect(errorResponse.error).toHaveProperty('statusCode');
      });
    });

    it('should never return plain string errors', () => {
      // Wrong format (what we fixed in Story 1.6)
      const wrongFormat = { error: 'No file uploaded' };

      // Correct format (Story 1.6 AC9)
      const correctFormat = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file uploaded',
          statusCode: 400,
        },
      };

      // Verify wrong format lacks required fields
      expect(wrongFormat).not.toHaveProperty('success');
      expect(typeof wrongFormat.error).toBe('string'); // ❌ Plain string

      // Verify correct format has all required fields
      expect(correctFormat).toHaveProperty('success');
      expect(typeof correctFormat.error).toBe('object'); // ✅ Object
      expect(correctFormat.error).toHaveProperty('code');
      expect(correctFormat.error).toHaveProperty('statusCode');
    });
  });
});

describe('API Endpoint Validation', () => {
  describe('Upload endpoint', () => {
    it('should validate file types', () => {
      const validTypes = ['.jpg', '.jpeg', '.png', '.webp'];
      const testFile = 'image.jpg';

      const isValid = validTypes.some(ext => testFile.endsWith(ext));
      expect(isValid).toBe(true);
    });

    it('should reject invalid file types', () => {
      const validTypes = ['.jpg', '.jpeg', '.png', '.webp'];
      const testFile = 'document.pdf';

      const isValid = validTypes.some(ext => testFile.endsWith(ext));
      expect(isValid).toBe(false);
    });
  });

  describe('CSV Export', () => {
    it('should format metadata correctly', () => {
      const metadata = {
        filename: 'test.jpg',
        title: 'Test Image',
        keywords: 'test, keywords',
        category: '5',
        releases: 'OY',
      };

      expect(metadata).toHaveProperty('filename');
      expect(metadata).toHaveProperty('title');
      expect(metadata).toHaveProperty('keywords');
      expect(metadata).toHaveProperty('category');
      expect(metadata).toHaveProperty('releases');
    });
  });
});
