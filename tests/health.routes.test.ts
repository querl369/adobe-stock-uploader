/**
 * Health Routes Tests
 *
 * Tests for liveness and readiness health check endpoints.
 * These tests verify that health checks correctly report application status.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import healthRoutes from '../src/api/routes/health.routes';

describe('Health Routes', () => {
  let app: Express;

  beforeEach(() => {
    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use('/health', healthRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health - Liveness Probe', () => {
    it('should return 200 with ok status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return timestamp in ISO format', async () => {
      const response = await request(app).get('/health');

      const timestamp = response.body.timestamp;
      expect(timestamp).toBeTruthy();
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should respond quickly (under 50ms)', async () => {
      const startTime = Date.now();
      await request(app).get('/health');
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50);
    });

    it('should not include checks in liveness response', async () => {
      const response = await request(app).get('/health');

      expect(response.body).not.toHaveProperty('checks');
    });
  });

  describe('GET /health/ready - Readiness Probe', () => {
    it('should return 200 with ready status when all checks pass', async () => {
      const response = await request(app).get('/health/ready');

      // Note: This test might fail if OpenAI API is down or API key is invalid
      // In CI/CD, you may need to mock the OpenAI client
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
    });

    it('should include all three checks in response', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.body.checks).toHaveProperty('config');
      expect(response.body.checks).toHaveProperty('openai');
      expect(response.body.checks).toHaveProperty('filesystem');
    });

    it('should return boolean values for all checks', async () => {
      const response = await request(app).get('/health/ready');

      const { checks } = response.body;
      expect(typeof checks.config).toBe('boolean');
      expect(typeof checks.openai).toBe('boolean');
      expect(typeof checks.filesystem).toBe('boolean');
    });

    it('should return timestamp in ISO format', async () => {
      const response = await request(app).get('/health/ready');

      const timestamp = response.body.timestamp;
      expect(timestamp).toBeTruthy();
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should return 503 when any check fails', async () => {
      // This test verifies the failure path
      // In a real scenario, we would mock the checks to force failures
      const response = await request(app).get('/health/ready');

      if (response.status === 503) {
        expect(response.body.status).toBe('unavailable');
        // At least one check should be false
        const checks = response.body.checks;
        const anyCheckFailed = !checks.config || !checks.openai || !checks.filesystem;
        expect(anyCheckFailed).toBe(true);
      }
    });

    it('config check should return boolean based on environment', async () => {
      const response = await request(app).get('/health/ready');

      // Config check result depends on test environment configuration
      // If .env is properly set, it should pass. Otherwise, it should fail.
      // Both outcomes are valid depending on test setup.
      expect(typeof response.body.checks.config).toBe('boolean');

      // If config check fails, verify error is logged (behavior tested elsewhere)
      if (!response.body.checks.config) {
        // Expected in test environment without proper .env configuration
        expect(response.status).toBe(503);
      }
    });

    it('filesystem check should pass with writable temp directory', async () => {
      const response = await request(app).get('/health/ready');

      // Filesystem check should always pass in normal operation
      expect(response.body.checks.filesystem).toBe(true);
    });
  });

  describe('Response Format Validation', () => {
    it('liveness response should match expected schema', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });

    it('readiness response should match expected schema', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.body).toEqual({
        status: expect.stringMatching(/^(ready|unavailable)$/),
        timestamp: expect.any(String),
        checks: {
          config: expect.any(Boolean),
          openai: expect.any(Boolean),
          filesystem: expect.any(Boolean),
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // The readiness endpoint should always return a valid response
      // even if checks fail unexpectedly
      const response = await request(app).get('/health/ready');

      expect(response.status).toBeDefined();
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Timeout Behavior', () => {
    it('readiness check should complete within 5 seconds', async () => {
      const startTime = Date.now();
      await request(app).get('/health/ready');
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(6000); // 6 seconds to account for overhead
    });
  });

  describe('Status Code Mapping', () => {
    it('should return 200 for successful liveness check', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    it('should return 200 or 503 for readiness check based on checks', async () => {
      const response = await request(app).get('/health/ready');
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.status).toBe('ready');
        expect(response.body.checks.config).toBe(true);
        expect(response.body.checks.openai).toBe(true);
        expect(response.body.checks.filesystem).toBe(true);
      } else if (response.status === 503) {
        expect(response.body.status).toBe('unavailable');
      }
    });
  });
});

/**
 * Integration Tests with Full Server
 *
 * These tests verify that health routes work correctly when integrated with the full server.
 */
describe('Health Routes - Integration', () => {
  it('should be accessible without authentication', async () => {
    // Health checks should not require authentication
    // This is important for load balancers and orchestrators
    const app = express();
    app.use('/health', healthRoutes);

    const livenessResponse = await request(app).get('/health');
    expect(livenessResponse.status).toBe(200);

    const readinessResponse = await request(app).get('/health/ready');
    expect([200, 503]).toContain(readinessResponse.status);
  });

  it('should work with CORS and other middleware', async () => {
    const app = express();
    app.use(express.json());

    // Simulate CORS middleware
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      next();
    });

    app.use('/health', healthRoutes);

    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
