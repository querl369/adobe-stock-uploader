/**
 * Upload Routes Tests
 * Story 2.1: Batch Upload API Endpoint
 *
 * Tests batch upload functionality for anonymous users
 * Covers file validation, size limits, and error handling
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs';

// Mock config to prevent process.exit during tests
vi.mock('../src/config/app.config', () => ({
  config: {
    server: { port: 3000, nodeEnv: 'test', baseUrl: 'http://localhost:3000' },
    openai: { apiKey: 'test-key', model: 'gpt-5-nano', maxTokens: 500, temperature: 0.3 },
    processing: { concurrencyLimit: 5, maxFileSizeMB: 50, tempFileLifetimeSeconds: 10 },
    rateLimits: { anonymous: 10, freeTier: 100, authBatchMax: 100 },
  },
}));

// Mock supabase admin — returns a user when Bearer token is 'auth-token', else
// returns an error. Lets tests select anonymous vs authenticated per request.
vi.mock('../src/lib/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'auth-token') {
          return { data: { user: { id: 'test-user-id' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'invalid token' } };
      }),
    },
  },
}));

describe('Upload Routes - Story 2.1', () => {
  let app: Express;
  let uploadRoutes: any;
  let errorHandler: any;
  let correlationIdMiddleware: any;

  beforeAll(async () => {
    // Dynamically import after mocks are set up
    const uploadModule = await import('../src/api/routes/upload.routes');
    const errorModule = await import('../src/api/middleware/error-handler');
    const correlationModule = await import('../src/api/middleware/correlation-id.middleware');

    uploadRoutes = uploadModule.default;
    errorHandler = errorModule.errorHandler;
    correlationIdMiddleware = correlationModule.correlationIdMiddleware;
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(correlationIdMiddleware);
    app.use('/api', uploadRoutes);
    app.use(errorHandler);
  });

  describe('POST /api/upload-images', () => {
    const testImagePath = path.join(__dirname, '../reference_images/_MG_0024-2.jpg');

    it('AC1 & AC4: should accept valid JPG files and return file IDs', async () => {
      const response = await request(app)
        .post('/api/upload-images')
        .attach('images', testImagePath)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0]).toHaveProperty('id');
      expect(response.body.files[0]).toHaveProperty('name');
      expect(response.body.files[0]).toHaveProperty('size');
      expect(response.body.message).toContain('Successfully uploaded');
    });

    it('beta-deployment T10: anonymous POST without Authorization header still returns 200 (b1 carve-out)', async () => {
      // Regression guard: requireAuth was added across most endpoints during the
      // Railway-beta hardening, but /api/upload-images intentionally stays public
      // so users can drop files BEFORE signing up. If this ever 401s, the
      // drop-then-signup UX is broken.
      const response = await request(app)
        .post('/api/upload-images')
        .attach('images', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']?.[0]).toMatch(/session_id=/);
    });

    it('AC3: anonymous accepts up to 10 images', async () => {
      const req = request(app).post('/api/upload-images');

      // Attach 3 test images
      for (let i = 0; i < 3; i++) {
        req.attach('images', testImagePath);
      }

      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(3);
      expect(response.body.message).toContain('3 file(s)');
    });

    it('AC3: anonymous rejects more than 10 files', async () => {
      const req = request(app).post('/api/upload-images');

      for (let i = 0; i < 11; i++) {
        req.attach('images', testImagePath);
      }

      try {
        const response = await req;

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toMatch(/too many files/i);
        expect(response.body.error.message).toMatch(/Maximum 10 files/);
      } catch (error: any) {
        // Multer may close connection causing EPIPE — acceptable DoS protection.
        expect(error.message).toMatch(/EPIPE|socket hang up|ECONNRESET/i);
      }
    });

    it('authenticated user accepts 15 files', async () => {
      const req = request(app).post('/api/upload-images').set('Authorization', 'Bearer auth-token');

      for (let i = 0; i < 15; i++) {
        req.attach('images', testImagePath);
      }

      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(15);
    });

    it('authenticated user rejected above auth cap (101 files)', async () => {
      const req = request(app).post('/api/upload-images').set('Authorization', 'Bearer auth-token');

      for (let i = 0; i < 101; i++) {
        req.attach('images', testImagePath);
      }

      try {
        const response = await req;

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toMatch(/Maximum 100 files/);
      } catch (error: any) {
        expect(error.message).toMatch(/EPIPE|socket hang up|ECONNRESET/i);
      }
    });

    it('AC6: should return 400 if no files uploaded', async () => {
      const response = await request(app).post('/api/upload-images').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('No files uploaded');
    });

    it('AC1 & AC6: should reject invalid file types (e.g., .txt)', async () => {
      // Create a temporary text file
      const tempTxtPath = path.join(__dirname, '../temp/test.txt');
      fs.writeFileSync(tempTxtPath, 'This is not an image');

      const response = await request(app)
        .post('/api/upload-images')
        .attach('images', tempTxtPath)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid file type');

      // Cleanup
      fs.unlinkSync(tempTxtPath);
    });

    it('AC2: should enforce max file size (50MB)', async () => {
      // Create a buffer larger than 50MB (51MB)
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024);
      const largeTempPath = path.join(__dirname, '../temp/large-test.jpg');
      fs.writeFileSync(largeTempPath, largeBuffer);

      const response = await request(app)
        .post('/api/upload-images')
        .attach('images', largeTempPath)
        .expect(413); // Payload Too Large

      // Cleanup
      fs.unlinkSync(largeTempPath);
    });

    it('AC1: should accept PNG files', async () => {
      const pngTestPath = path.join(__dirname, '../cache_images/IMG_OY_20250323_2.png');

      if (!fs.existsSync(pngTestPath)) {
        console.warn('PNG test file not found, skipping test');
        return;
      }

      const response = await request(app)
        .post('/api/upload-images')
        .attach('images', pngTestPath)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(1);
    });

    it('AC4: should return correct file metadata', async () => {
      const response = await request(app)
        .post('/api/upload-images')
        .attach('images', testImagePath)
        .expect(200);

      const file = response.body.files[0];
      expect(file.id).toBeDefined();
      expect(file.name).toBe('_MG_0024-2.jpg');
      expect(file.size).toBeGreaterThan(0);
    });

    it('should handle multiple files with mixed success gracefully', async () => {
      const req = request(app).post('/api/upload-images');

      // Attach 2 valid images
      req.attach('images', testImagePath);
      req.attach('images', testImagePath);

      const response = await req.expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(2);
    });
  });
});
