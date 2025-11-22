/**
 * Health Check Routes
 *
 * Provides liveness and readiness endpoints for container orchestration.
 * These endpoints are used by platforms like Railway, Render, Kubernetes, etc.
 * to determine if the application is running and ready to serve traffic.
 *
 * Endpoints:
 * - GET /health       - Liveness probe (always returns 200 if server is up)
 * - GET /health/ready - Readiness probe (checks critical dependencies)
 */

import { Router, Request, Response } from 'express';
import { logger } from '@utils/logger';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

/**
 * Health check response format
 */
interface HealthResponse {
  status: 'ok' | 'ready' | 'unavailable';
  timestamp: string;
  checks?: {
    config: boolean;
    openai: boolean;
    filesystem: boolean;
  };
}

/**
 * Liveness Probe: GET /health
 *
 * Simple health check that returns 200 if the server is running.
 * This endpoint should be fast (<50ms) and have no external dependencies.
 *
 * Used by orchestrators to determine if the container should be restarted.
 * If this endpoint fails, the container is considered dead and will be restarted.
 *
 * @returns 200 OK with basic status information
 */
router.get('/', (req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

/**
 * Readiness Probe: GET /health/ready
 *
 * Comprehensive health check that verifies all critical dependencies are available.
 * This endpoint checks:
 * - Configuration is properly loaded
 * - OpenAI API is reachable
 * - Filesystem is writable
 *
 * Used by orchestrators/load balancers to determine if the container should receive traffic.
 * If this endpoint fails (503), traffic will not be routed to this instance.
 *
 * All checks have a 5-second timeout to prevent hanging.
 *
 * @returns 200 OK if all checks pass, 503 Service Unavailable if any check fails
 */
router.get('/ready', async (req: Request, res: Response) => {
  const checks = {
    config: false,
    openai: false,
    filesystem: false,
  };

  try {
    // Check 1: Configuration loaded
    // Verify that required environment variables are present
    checks.config = await checkConfig();

    // Check 2: OpenAI API reachable (with timeout)
    checks.openai = await withTimeout(checkOpenAI(), 5000);

    // Check 3: Filesystem writable (with timeout)
    checks.filesystem = await withTimeout(checkFilesystem(), 5000);

    // Determine overall status
    const allChecksPass = checks.config && checks.openai && checks.filesystem;
    const statusCode = allChecksPass ? 200 : 503;
    const status = allChecksPass ? 'ready' : 'unavailable';

    const response: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };

    // Log failures for monitoring
    if (!allChecksPass) {
      logger.warn({ checks }, 'Readiness check failed');
    }

    res.status(statusCode).json(response);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown', checks },
      'Readiness check error'
    );

    const response: HealthResponse = {
      status: 'unavailable',
      timestamp: new Date().toISOString(),
      checks,
    };

    res.status(503).json(response);
  }
});

/**
 * Check 1: Verify configuration is loaded
 *
 * Ensures that critical configuration values are present.
 * This is a fast check that doesn't require external calls.
 *
 * @returns true if configuration is valid, false otherwise
 */
async function checkConfig(): Promise<boolean> {
  try {
    // Import config dynamically to avoid module-level initialization in tests
    const { config } = await import('@config/app.config');

    // Verify critical config values are present
    const hasApiKey = Boolean(config.openai.apiKey && config.openai.apiKey.length > 0);
    const hasBaseUrl = Boolean(config.server.baseUrl && config.server.baseUrl.length > 0);
    const hasPort = config.server.port > 0;

    return hasApiKey && hasBaseUrl && hasPort;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown' },
      'Config check failed'
    );
    return false;
  }
}

/**
 * Check 2: Verify OpenAI API is reachable
 *
 * Makes a lightweight API call to verify the OpenAI service is available.
 * Uses the models.list() endpoint as it's fast and doesn't consume tokens.
 *
 * @returns true if OpenAI API is reachable, false otherwise
 */
async function checkOpenAI(): Promise<boolean> {
  try {
    // Import config dynamically to avoid module-level initialization in tests
    const { config } = await import('@config/app.config');

    // Create OpenAI client
    const client = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    // Make a lightweight API call to verify connectivity
    // models.list() is fast and doesn't consume tokens
    await client.models.list();

    return true;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown' },
      'OpenAI check failed'
    );
    return false;
  }
}

/**
 * Check 3: Verify filesystem is writable
 *
 * Attempts to write and delete a temporary file to verify filesystem access.
 * This ensures the application can save processed images and CSV files.
 *
 * @returns true if filesystem is writable, false otherwise
 */
async function checkFilesystem(): Promise<boolean> {
  try {
    const tempDir = path.join(process.cwd(), 'temp');
    const testFile = path.join(tempDir, '.health-check');

    // Ensure temp directory exists
    try {
      await fs.access(tempDir);
    } catch {
      await fs.mkdir(tempDir, { recursive: true });
    }

    // Write test file
    await fs.writeFile(testFile, 'health-check', 'utf8');

    // Read test file to verify write succeeded
    const content = await fs.readFile(testFile, 'utf8');

    // Delete test file
    await fs.unlink(testFile);

    return content === 'health-check';
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown' },
      'Filesystem check failed'
    );
    return false;
  }
}

/**
 * Utility function to wrap a promise with a timeout
 *
 * If the promise doesn't resolve within the timeout period,
 * it will reject with a timeout error.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves or times out
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Check timeout')), timeoutMs)),
  ]);
}

export default router;
