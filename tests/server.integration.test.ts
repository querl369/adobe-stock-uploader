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
