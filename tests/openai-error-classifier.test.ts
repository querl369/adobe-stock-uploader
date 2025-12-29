/**
 * Tests for OpenAI Error Classifier
 *
 * Story 3.5: Error Recovery & Retry Logic (AC9)
 *
 * Tests:
 * - Error classification for all error types (AC1, AC2, AC8)
 * - Retry behavior determination
 * - Exponential backoff timing (AC3)
 * - Rate limit retry-after handling
 */

import { describe, it, expect } from 'vitest';
import {
  OpenAIErrorType,
  classifyOpenAIError,
  isRetryableOpenAIError,
  getRetryDelayForError,
  extractRetryAfter,
} from '../src/utils/openai-error-classifier';

describe('OpenAI Error Classifier', () => {
  describe('classifyOpenAIError', () => {
    describe('AUTH errors (401)', () => {
      it('should classify 401 status as AUTH error', () => {
        const error = { status: 401, message: 'Unauthorized' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.AUTH);
      });

      it('should classify 401 statusCode as AUTH error', () => {
        const error = { statusCode: 401, message: 'Invalid API key' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.AUTH);
      });

      it('should classify nested response.status 401 as AUTH error', () => {
        const error = { response: { status: 401 } };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.AUTH);
      });
    });

    describe('RATE_LIMIT errors (429)', () => {
      it('should classify 429 status as RATE_LIMIT error', () => {
        const error = { status: 429, message: 'Too Many Requests' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.RATE_LIMIT);
      });

      it('should classify nested 429 as RATE_LIMIT error', () => {
        const error = { response: { status: 429, headers: { 'retry-after': '30' } } };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.RATE_LIMIT);
      });
    });

    describe('TIMEOUT errors', () => {
      it('should classify AbortError as TIMEOUT', () => {
        const error = { name: 'AbortError', message: 'The operation was aborted' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.TIMEOUT);
      });

      it('should classify error with "aborted" in message as TIMEOUT', () => {
        const error = { message: 'Request was aborted due to timeout' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.TIMEOUT);
      });

      it('should classify ETIMEDOUT code as TIMEOUT', () => {
        const error = { code: 'ETIMEDOUT', message: 'Timeout' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.TIMEOUT);
      });

      it('should classify ECONNRESET code as TIMEOUT', () => {
        const error = { code: 'ECONNRESET', message: 'Connection reset' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.TIMEOUT);
      });

      it('should classify ENOTFOUND code as TIMEOUT', () => {
        const error = { code: 'ENOTFOUND', message: 'DNS lookup failed' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.TIMEOUT);
      });

      it('should classify ECONNREFUSED code as TIMEOUT', () => {
        const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.TIMEOUT);
      });

      it('should classify type=aborted as TIMEOUT', () => {
        const error = { type: 'aborted' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.TIMEOUT);
      });

      it('should classify type=timeout as TIMEOUT', () => {
        const error = { type: 'timeout' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.TIMEOUT);
      });
    });

    describe('SERVER_ERROR (5xx)', () => {
      it('should classify 500 as SERVER_ERROR', () => {
        const error = { status: 500, message: 'Internal Server Error' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.SERVER_ERROR);
      });

      it('should classify 502 as SERVER_ERROR', () => {
        const error = { status: 502, message: 'Bad Gateway' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.SERVER_ERROR);
      });

      it('should classify 503 as SERVER_ERROR', () => {
        const error = { status: 503, message: 'Service Unavailable' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.SERVER_ERROR);
      });

      it('should classify 504 as SERVER_ERROR', () => {
        const error = { status: 504, message: 'Gateway Timeout' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.SERVER_ERROR);
      });

      it('should classify 599 as SERVER_ERROR', () => {
        const error = { status: 599 };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.SERVER_ERROR);
      });
    });

    describe('VALIDATION errors (400)', () => {
      it('should classify 400 as VALIDATION error', () => {
        const error = { status: 400, message: 'Bad Request' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.VALIDATION);
      });

      it('should classify content policy violation (400) as VALIDATION', () => {
        const error = { status: 400, message: 'Content policy violation' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.VALIDATION);
      });

      it('should classify invalid image format (400) as VALIDATION', () => {
        const error = { status: 400, message: 'Invalid image format' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.VALIDATION);
      });

      it('should classify 403 as VALIDATION error', () => {
        const error = { status: 403, message: 'Forbidden' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.VALIDATION);
      });

      it('should classify 404 as VALIDATION error', () => {
        const error = { status: 404, message: 'Not Found' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.VALIDATION);
      });
    });

    describe('MALFORMED errors', () => {
      it('should classify SyntaxError as MALFORMED', () => {
        const error = { name: 'SyntaxError', message: 'Unexpected token' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.MALFORMED);
      });

      it('should classify "unexpected token" in message as MALFORMED', () => {
        const error = { message: 'Unexpected token in JSON at position 0' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.MALFORMED);
      });

      it('should classify JSON parsing error as MALFORMED', () => {
        const error = { message: 'Failed to parse JSON response' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.MALFORMED);
      });

      it('should classify "invalid json" in message as MALFORMED', () => {
        const error = { message: 'Invalid JSON in response body' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.MALFORMED);
      });
    });

    describe('UNKNOWN errors', () => {
      it('should classify null as UNKNOWN', () => {
        expect(classifyOpenAIError(null)).toBe(OpenAIErrorType.UNKNOWN);
      });

      it('should classify undefined as UNKNOWN', () => {
        expect(classifyOpenAIError(undefined)).toBe(OpenAIErrorType.UNKNOWN);
      });

      it('should classify empty object as UNKNOWN', () => {
        expect(classifyOpenAIError({})).toBe(OpenAIErrorType.UNKNOWN);
      });

      it('should classify error without status or recognizable pattern as UNKNOWN', () => {
        const error = { message: 'Some random error' };
        expect(classifyOpenAIError(error)).toBe(OpenAIErrorType.UNKNOWN);
      });
    });
  });

  describe('isRetryableOpenAIError', () => {
    describe('Retryable errors (AC1)', () => {
      it('should return true for TIMEOUT', () => {
        expect(isRetryableOpenAIError(OpenAIErrorType.TIMEOUT)).toBe(true);
      });

      it('should return true for SERVER_ERROR', () => {
        expect(isRetryableOpenAIError(OpenAIErrorType.SERVER_ERROR)).toBe(true);
      });

      it('should return true for MALFORMED', () => {
        expect(isRetryableOpenAIError(OpenAIErrorType.MALFORMED)).toBe(true);
      });

      it('should return true for RATE_LIMIT', () => {
        expect(isRetryableOpenAIError(OpenAIErrorType.RATE_LIMIT)).toBe(true);
      });
    });

    describe('Non-retryable errors (AC2)', () => {
      it('should return false for AUTH', () => {
        expect(isRetryableOpenAIError(OpenAIErrorType.AUTH)).toBe(false);
      });

      it('should return false for VALIDATION', () => {
        expect(isRetryableOpenAIError(OpenAIErrorType.VALIDATION)).toBe(false);
      });

      it('should return false for UNKNOWN', () => {
        expect(isRetryableOpenAIError(OpenAIErrorType.UNKNOWN)).toBe(false);
      });
    });
  });

  describe('getRetryDelayForError (AC3)', () => {
    describe('Default exponential backoff', () => {
      it('should return 2000ms for first retry (attempt 0)', () => {
        expect(getRetryDelayForError(OpenAIErrorType.TIMEOUT, 0)).toBe(2000);
      });

      it('should return 4000ms for second retry (attempt 1)', () => {
        expect(getRetryDelayForError(OpenAIErrorType.TIMEOUT, 1)).toBe(4000);
      });

      it('should cap at 8000ms for third+ retry', () => {
        expect(getRetryDelayForError(OpenAIErrorType.TIMEOUT, 2)).toBe(8000);
        expect(getRetryDelayForError(OpenAIErrorType.TIMEOUT, 3)).toBe(8000);
        expect(getRetryDelayForError(OpenAIErrorType.TIMEOUT, 10)).toBe(8000);
      });
    });

    describe('Rate limit with retry-after header (AC2)', () => {
      it('should use retry-after header when provided as seconds string', () => {
        expect(getRetryDelayForError(OpenAIErrorType.RATE_LIMIT, 0, '30')).toBe(30000);
      });

      it('should use retry-after header when provided as number', () => {
        expect(getRetryDelayForError(OpenAIErrorType.RATE_LIMIT, 0, 45)).toBe(45000);
      });

      it('should cap retry-after at 60 seconds', () => {
        expect(getRetryDelayForError(OpenAIErrorType.RATE_LIMIT, 0, '120')).toBe(60000);
      });

      it('should fall back to exponential backoff when retry-after is 0', () => {
        expect(getRetryDelayForError(OpenAIErrorType.RATE_LIMIT, 0, '0')).toBe(2000);
      });

      it('should fall back to exponential backoff when retry-after is undefined', () => {
        expect(getRetryDelayForError(OpenAIErrorType.RATE_LIMIT, 0, undefined)).toBe(2000);
      });
    });

    describe('Different error types use same backoff', () => {
      it('should use same delay for SERVER_ERROR', () => {
        expect(getRetryDelayForError(OpenAIErrorType.SERVER_ERROR, 0)).toBe(2000);
        expect(getRetryDelayForError(OpenAIErrorType.SERVER_ERROR, 1)).toBe(4000);
      });

      it('should use same delay for MALFORMED', () => {
        expect(getRetryDelayForError(OpenAIErrorType.MALFORMED, 0)).toBe(2000);
        expect(getRetryDelayForError(OpenAIErrorType.MALFORMED, 1)).toBe(4000);
      });
    });
  });

  describe('extractRetryAfter', () => {
    it('should return undefined when error has no headers', () => {
      expect(extractRetryAfter({ status: 429 })).toBeUndefined();
    });

    it('should extract retry-after from headers', () => {
      const error = { headers: { 'retry-after': '30' } };
      expect(extractRetryAfter(error)).toBe(30);
    });

    it('should extract Retry-After (capitalized) from headers', () => {
      const error = { headers: { 'Retry-After': '45' } };
      expect(extractRetryAfter(error)).toBe(45);
    });

    it('should extract retry-after from response.headers', () => {
      const error = { response: { headers: { 'retry-after': '60' } } };
      expect(extractRetryAfter(error)).toBe(60);
    });

    it('should return undefined for null error', () => {
      expect(extractRetryAfter(null)).toBeUndefined();
    });

    it('should return undefined for empty headers', () => {
      expect(extractRetryAfter({ headers: {} })).toBeUndefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete OpenAI 429 error with retry-after', () => {
      const error = {
        status: 429,
        message: 'Rate limit exceeded',
        headers: { 'retry-after': '10' },
      };

      const errorType = classifyOpenAIError(error);
      expect(errorType).toBe(OpenAIErrorType.RATE_LIMIT);
      expect(isRetryableOpenAIError(errorType)).toBe(true);

      const retryAfter = extractRetryAfter(error);
      expect(retryAfter).toBe(10);

      const delay = getRetryDelayForError(
        errorType,
        0,
        retryAfter ? String(retryAfter) : undefined
      );
      expect(delay).toBe(10000);
    });

    it('should handle OpenAI timeout error', () => {
      const error = {
        name: 'AbortError',
        message: 'Request was aborted',
      };

      const errorType = classifyOpenAIError(error);
      expect(errorType).toBe(OpenAIErrorType.TIMEOUT);
      expect(isRetryableOpenAIError(errorType)).toBe(true);
      expect(getRetryDelayForError(errorType, 0)).toBe(2000);
    });

    it('should handle OpenAI 500 server error', () => {
      const error = {
        status: 500,
        message: 'Internal server error',
        response: { status: 500 },
      };

      const errorType = classifyOpenAIError(error);
      expect(errorType).toBe(OpenAIErrorType.SERVER_ERROR);
      expect(isRetryableOpenAIError(errorType)).toBe(true);
    });

    it('should not retry 401 auth error', () => {
      const error = {
        status: 401,
        message: 'Invalid API key',
      };

      const errorType = classifyOpenAIError(error);
      expect(errorType).toBe(OpenAIErrorType.AUTH);
      expect(isRetryableOpenAIError(errorType)).toBe(false);
    });

    it('should not retry 400 validation error', () => {
      const error = {
        status: 400,
        message: 'Invalid image format',
      };

      const errorType = classifyOpenAIError(error);
      expect(errorType).toBe(OpenAIErrorType.VALIDATION);
      expect(isRetryableOpenAIError(errorType)).toBe(false);
    });
  });
});
