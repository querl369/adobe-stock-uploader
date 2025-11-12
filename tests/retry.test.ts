/**
 * Tests for Retry Logic & Resilience Utility
 *
 * Validates:
 * - Exponential backoff behavior
 * - Retry on appropriate error types
 * - No retry on non-retryable errors
 * - Maximum attempts enforcement
 * - Custom retry logic
 * - Successful retry recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, hasStatusCode, getStatusCode } from '../src/utils/retry';

describe('withRetry', () => {
  beforeEach(() => {
    // Mock console methods to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock timers for faster tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Successful execution', () => {
    it('should return result on first attempt when function succeeds', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const promise = withRetry(mockFn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(console.log).not.toHaveBeenCalled(); // No retry success log
    });

    it('should succeed after retries and log success', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, { maxAttempts: 3 });

      // Fast-forward through all delays
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Retry Success'));
    });

    it('should work with complex return types', async () => {
      const complexResult = {
        data: { id: 123, name: 'test' },
        metadata: { timestamp: Date.now() },
      };
      const mockFn = vi.fn().mockResolvedValue(complexResult);

      const promise = withRetry(mockFn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(complexResult);
    });
  });

  describe('Retry on retryable errors', () => {
    it('should retry on 5xx server errors', async () => {
      const error = { status: 503, message: 'Service Unavailable' };
      const mockFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Retry Attempt 1/3'));
    });

    it('should retry on 429 rate limit errors', async () => {
      const error = { status: 429, message: 'Too Many Requests' };
      const mockFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on network timeout errors', async () => {
      const error = { code: 'ETIMEDOUT', message: 'Timeout' };
      const mockFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ECONNRESET errors', async () => {
      const error = { code: 'ECONNRESET', message: 'Connection reset' };
      const mockFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ENOTFOUND errors', async () => {
      const error = { code: 'ENOTFOUND', message: 'DNS lookup failed' };
      const mockFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on unknown errors by default', async () => {
      const error = new Error('Unknown network error');
      const mockFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('No retry on non-retryable errors', () => {
    it('should NOT retry on 401 authentication errors', async () => {
      const error = { status: 401, message: 'Unauthorized' };
      const mockFn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(mockFn, { maxAttempts: 3 });

      // Immediately catch the rejection to prevent unhandled promise
      const rejection = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const result = await rejection;

      expect(result).toEqual(error);
      expect(mockFn).toHaveBeenCalledTimes(1); // Only called once
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Non-retryable error'),
        expect.any(String)
      );
    });

    it('should NOT retry on 400 validation errors', async () => {
      const error = { status: 400, message: 'Bad Request' };
      const mockFn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      const rejection = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const result = await rejection;

      expect(result).toEqual(error);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 403 forbidden errors', async () => {
      const error = { status: 403, message: 'Forbidden' };
      const mockFn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      const rejection = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const result = await rejection;

      expect(result).toEqual(error);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 404 not found errors', async () => {
      const error = { status: 404, message: 'Not Found' };
      const mockFn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      const rejection = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const result = await rejection;

      expect(result).toEqual(error);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Exponential backoff', () => {
    it('should use default backoff timing (1s, 2s, 4s)', async () => {
      const error = new Error('Network error');
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      const rejection = promise.catch(err => err);

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Wait 1000ms for first retry
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFn).toHaveBeenCalledTimes(2);

      // Wait 2000ms for second retry
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFn).toHaveBeenCalledTimes(3);

      const result = await rejection;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Network error');
    });

    it('should respect custom initial delay', async () => {
      const error = new Error('Network error');
      const mockFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, {
        maxAttempts: 2,
        initialDelayMs: 500,
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Wait 500ms (custom initial delay)
      await vi.advanceTimersByTimeAsync(500);
      expect(mockFn).toHaveBeenCalledTimes(2);

      await expect(promise).resolves.toBe('success');
    });

    it('should respect custom backoff multiplier', async () => {
      const error = new Error('Network error');
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 3, // 3x instead of 2x
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // First retry: 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFn).toHaveBeenCalledTimes(2);

      // Second retry: 3000ms (1000 * 3)
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockFn).toHaveBeenCalledTimes(3);

      await expect(promise).resolves.toBe('success');
    });

    it('should respect maxDelayMs cap', async () => {
      const error = new Error('Network error');
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const promise = withRetry(mockFn, {
        maxAttempts: 4,
        initialDelayMs: 1000,
        backoffMultiplier: 10,
        maxDelayMs: 2000, // Cap at 2 seconds
      });
      const rejection = promise.catch(err => err);

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // First retry: 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFn).toHaveBeenCalledTimes(2);

      // Second retry: 2000ms (capped, would be 10000ms without cap)
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFn).toHaveBeenCalledTimes(3);

      // Third retry: 2000ms (still capped)
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFn).toHaveBeenCalledTimes(4);

      // Verify the final rejection
      const result = await rejection;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Network error');
    });
  });

  describe('Maximum attempts', () => {
    it('should throw after maxAttempts are exhausted', async () => {
      const error = new Error('Persistent failure');
      const mockFn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      const rejection = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const result = await rejection;

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Persistent failure');
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('All 3 attempts exhausted'),
        expect.any(String)
      );
    });

    it('should respect custom maxAttempts', async () => {
      const error = new Error('Failure');
      const mockFn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(mockFn, { maxAttempts: 5 });
      const rejection = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const result = await rejection;

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Failure');
      expect(mockFn).toHaveBeenCalledTimes(5);
    });

    it('should only try once if maxAttempts is 1', async () => {
      const error = new Error('Failure');
      const mockFn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(mockFn, { maxAttempts: 1 });
      const rejection = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const result = await rejection;

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Failure');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom retry logic', () => {
    it('should use custom retryableErrors function', async () => {
      const retryableError = { code: 'CUSTOM_ERROR' };
      const nonRetryableError = { code: 'FATAL_ERROR' };

      const mockFn = vi.fn().mockRejectedValueOnce(retryableError).mockResolvedValueOnce('success');

      const customRetry = (err: any) => err.code === 'CUSTOM_ERROR';

      const promise = withRetry(mockFn, {
        maxAttempts: 3,
        retryableErrors: customRetry,
      });
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry when custom logic returns false', async () => {
      const error = { code: 'FATAL_ERROR' };
      const mockFn = vi.fn().mockRejectedValue(error);

      const customRetry = (err: any) => err.code !== 'FATAL_ERROR';

      const promise = withRetry(mockFn, {
        maxAttempts: 3,
        retryableErrors: customRetry,
      });
      const rejection = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const result = await rejection;

      expect(result).toEqual(error);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should support retrying only on specific status codes', async () => {
      const error429 = { status: 429 };
      const error500 = { status: 500 };
      const mockFn = vi.fn().mockRejectedValueOnce(error429).mockResolvedValueOnce('success');

      // Only retry on 429
      const customRetry = (err: any) => err.status === 429;

      const promise = withRetry(mockFn, {
        maxAttempts: 3,
        retryableErrors: customRetry,
      });
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Logging', () => {
    it('should log each retry attempt with context', async () => {
      const error = new Error('Network failure');
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      await promise;

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Retry Attempt 1/3'));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Retry Attempt 2/3'));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Network failure'));
    });

    it('should log successful retry recovery', async () => {
      const error = new Error('Temporary error');
      const mockFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      await promise;

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Retry Success'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('attempt 2/3'));
    });

    it('should log final failure after all retries', async () => {
      const error = new Error('Persistent error');
      const mockFn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      const rejection = promise.catch(err => err);
      await vi.runAllTimersAsync();
      await rejection;

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('All 3 attempts exhausted'),
        expect.stringContaining('Persistent error')
      );
    });
  });

  describe('OpenAI specific error handling', () => {
    it('should handle OpenAI response errors', async () => {
      const openAIError = {
        response: {
          status: 503,
          data: { error: { message: 'Service temporarily unavailable' } },
        },
      };

      const mockFn = vi.fn().mockRejectedValueOnce(openAIError).mockResolvedValueOnce('success');

      const promise = withRetry(mockFn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should extract OpenAI error messages for logging', async () => {
      const openAIError = {
        response: {
          status: 500,
          data: { error: { message: 'Internal server error' } },
        },
      };

      const mockFn = vi.fn().mockRejectedValue(openAIError);

      const promise = withRetry(mockFn, { maxAttempts: 2 });
      const rejection = promise.catch(err => err);
      await vi.runAllTimersAsync();
      const result = await rejection;

      expect(result).toEqual(openAIError);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Internal server error'));
    });
  });
});

describe('Helper functions', () => {
  describe('hasStatusCode', () => {
    it('should return true for errors with status property', () => {
      expect(hasStatusCode({ status: 500 })).toBe(true);
    });

    it('should return true for errors with statusCode property', () => {
      expect(hasStatusCode({ statusCode: 404 })).toBe(true);
    });

    it('should return true for errors with response.status', () => {
      expect(hasStatusCode({ response: { status: 503 } })).toBe(true);
    });

    it('should return false for errors without status', () => {
      expect(hasStatusCode(new Error('No status'))).toBe(false);
      expect(hasStatusCode({ code: 'ETIMEDOUT' })).toBe(false);
      expect(hasStatusCode(null)).toBe(false);
    });
  });

  describe('getStatusCode', () => {
    it('should extract status from error.status', () => {
      expect(getStatusCode({ status: 500 })).toBe(500);
    });

    it('should extract status from error.statusCode', () => {
      expect(getStatusCode({ statusCode: 404 })).toBe(404);
    });

    it('should extract status from error.response.status', () => {
      expect(getStatusCode({ response: { status: 503 } })).toBe(503);
    });

    it('should return undefined for errors without status', () => {
      expect(getStatusCode(new Error('No status'))).toBeUndefined();
      expect(getStatusCode({ code: 'ETIMEDOUT' })).toBeUndefined();
      expect(getStatusCode(null)).toBeUndefined();
    });

    it('should prioritize error.status over error.statusCode', () => {
      expect(getStatusCode({ status: 500, statusCode: 404 })).toBe(500);
    });
  });
});
