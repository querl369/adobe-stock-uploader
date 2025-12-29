/**
 * Tests for User-Friendly Error Messages
 *
 * Story 3.5: Error Recovery & Retry Logic (AC7, AC9)
 *
 * Tests:
 * - User-friendly message mapping for all error types
 * - Message consistency and non-technical nature
 * - Error context creation for logging
 * - Log level determination
 */

import { describe, it, expect } from 'vitest';
import {
  USER_FRIENDLY_ERRORS,
  TECHNICAL_ERROR_DESCRIPTIONS,
  getUserFriendlyErrorMessage,
  getUserFriendlyErrorForException,
  getTechnicalErrorDescription,
  createErrorContext,
  shouldLogAsError,
} from '../src/utils/error-messages';
import { OpenAIErrorType } from '../src/utils/openai-error-classifier';

describe('User-Friendly Error Messages', () => {
  describe('getUserFriendlyErrorMessage (AC7)', () => {
    describe('Returns user-friendly messages for all error types', () => {
      it('should return configuration error message for AUTH', () => {
        const message = getUserFriendlyErrorMessage(OpenAIErrorType.AUTH);
        expect(message).toBe('Service configuration error - please contact support');
      });

      it('should return busy message for RATE_LIMIT', () => {
        const message = getUserFriendlyErrorMessage(OpenAIErrorType.RATE_LIMIT);
        expect(message).toBe('Service is busy - please try again in a moment');
      });

      it('should return timeout message for TIMEOUT', () => {
        const message = getUserFriendlyErrorMessage(OpenAIErrorType.TIMEOUT);
        expect(message).toBe('Processing took too long - please try again');
      });

      it('should return processing failed message for SERVER_ERROR', () => {
        const message = getUserFriendlyErrorMessage(OpenAIErrorType.SERVER_ERROR);
        expect(message).toBe('Processing failed - please try again');
      });

      it('should return processing failed message for MALFORMED', () => {
        const message = getUserFriendlyErrorMessage(OpenAIErrorType.MALFORMED);
        expect(message).toBe('Processing failed - please try again');
      });

      it('should return try different image message for VALIDATION', () => {
        const message = getUserFriendlyErrorMessage(OpenAIErrorType.VALIDATION);
        expect(message).toBe('Image could not be processed - please try a different image');
      });

      it('should return generic message for UNKNOWN', () => {
        const message = getUserFriendlyErrorMessage(OpenAIErrorType.UNKNOWN);
        expect(message).toBe('Something went wrong - please try again');
      });
    });

    describe('Messages are user-friendly (AC7)', () => {
      const allErrorTypes = Object.values(OpenAIErrorType);

      allErrorTypes.forEach(errorType => {
        it(`should NOT contain "OpenAI" in ${errorType} message`, () => {
          const message = getUserFriendlyErrorMessage(errorType);
          expect(message.toLowerCase()).not.toContain('openai');
        });

        it(`should NOT contain "API" in ${errorType} message`, () => {
          const message = getUserFriendlyErrorMessage(errorType);
          expect(message.toLowerCase()).not.toContain(' api ');
        });

        it(`should NOT contain status codes in ${errorType} message`, () => {
          const message = getUserFriendlyErrorMessage(errorType);
          expect(message).not.toMatch(/\b(400|401|429|500|502|503|504)\b/);
        });

        it(`should NOT contain technical error codes in ${errorType} message`, () => {
          const message = getUserFriendlyErrorMessage(errorType);
          expect(message).not.toMatch(/ETIMEDOUT|ECONNRESET|ENOTFOUND/);
        });

        it(`should be actionable (contain action word) for ${errorType}`, () => {
          const message = getUserFriendlyErrorMessage(errorType);
          const hasActionWord =
            message.includes('please') || message.includes('try') || message.includes('contact');
          expect(hasActionWord).toBe(true);
        });
      });
    });

    describe('Fallback handling', () => {
      it('should return UNKNOWN message for invalid error type', () => {
        // @ts-ignore - Testing invalid input
        const message = getUserFriendlyErrorMessage('invalid_type');
        expect(message).toBe(USER_FRIENDLY_ERRORS[OpenAIErrorType.UNKNOWN]);
      });
    });
  });

  describe('getUserFriendlyErrorForException', () => {
    it('should classify and return message for 401 error', () => {
      const error = { status: 401, message: 'Unauthorized' };
      const message = getUserFriendlyErrorForException(error);
      expect(message).toBe('Service configuration error - please contact support');
    });

    it('should classify and return message for 429 error', () => {
      const error = { status: 429, message: 'Rate limit' };
      const message = getUserFriendlyErrorForException(error);
      expect(message).toBe('Service is busy - please try again in a moment');
    });

    it('should classify and return message for AbortError', () => {
      const error = { name: 'AbortError', message: 'Aborted' };
      const message = getUserFriendlyErrorForException(error);
      expect(message).toBe('Processing took too long - please try again');
    });

    it('should classify and return message for 500 error', () => {
      const error = { status: 500, message: 'Internal error' };
      const message = getUserFriendlyErrorForException(error);
      expect(message).toBe('Processing failed - please try again');
    });

    it('should classify and return message for JSON parse error', () => {
      const error = { name: 'SyntaxError', message: 'Unexpected token' };
      const message = getUserFriendlyErrorForException(error);
      expect(message).toBe('Processing failed - please try again');
    });

    it('should return generic message for unknown error', () => {
      const error = { message: 'Random error' };
      const message = getUserFriendlyErrorForException(error);
      expect(message).toBe('Something went wrong - please try again');
    });

    it('should handle null error', () => {
      const message = getUserFriendlyErrorForException(null);
      expect(message).toBe('Something went wrong - please try again');
    });

    it('should handle Error instance', () => {
      const error = new Error('Network failure');
      const message = getUserFriendlyErrorForException(error);
      expect(message).toBe('Something went wrong - please try again');
    });
  });

  describe('getTechnicalErrorDescription', () => {
    it('should return technical description for AUTH', () => {
      const desc = getTechnicalErrorDescription(OpenAIErrorType.AUTH);
      expect(desc).toContain('authentication');
    });

    it('should return technical description for RATE_LIMIT', () => {
      const desc = getTechnicalErrorDescription(OpenAIErrorType.RATE_LIMIT);
      expect(desc).toContain('429');
    });

    it('should return technical description for TIMEOUT', () => {
      const desc = getTechnicalErrorDescription(OpenAIErrorType.TIMEOUT);
      expect(desc).toContain('timeout');
    });

    it('should return technical description for SERVER_ERROR', () => {
      const desc = getTechnicalErrorDescription(OpenAIErrorType.SERVER_ERROR);
      expect(desc).toContain('5xx');
    });

    it('should return fallback for unknown type', () => {
      // @ts-ignore - Testing invalid input
      const desc = getTechnicalErrorDescription('invalid');
      expect(desc).toBe(TECHNICAL_ERROR_DESCRIPTIONS[OpenAIErrorType.UNKNOWN]);
    });
  });

  describe('createErrorContext', () => {
    it('should create context with user message and technical details', () => {
      const error = { status: 500, message: 'Internal Server Error' };
      const context = createErrorContext(error, { imageUrl: 'test.jpg' });

      expect(context.userMessage).toBe('Processing failed - please try again');
      expect(context.errorType).toBe(OpenAIErrorType.SERVER_ERROR);
      expect(context.technicalDescription).toContain('5xx');
      expect(context.originalError).toBe('Internal Server Error');
      expect(context.context).toEqual({ imageUrl: 'test.jpg' });
    });

    it('should handle Error instance', () => {
      const error = new Error('Test error');
      const context = createErrorContext(error);

      expect(context.originalError).toBe('Test error');
      expect(context.context).toBeUndefined();
    });

    it('should handle non-Error values', () => {
      const context = createErrorContext('string error');

      expect(context.originalError).toBe('string error');
    });

    it('should classify error correctly', () => {
      const error = { status: 429, message: 'Rate limited' };
      const context = createErrorContext(error);

      expect(context.errorType).toBe(OpenAIErrorType.RATE_LIMIT);
      expect(context.userMessage).toBe('Service is busy - please try again in a moment');
    });
  });

  describe('shouldLogAsError', () => {
    describe('Critical errors (log at error level)', () => {
      it('should return true for AUTH', () => {
        expect(shouldLogAsError(OpenAIErrorType.AUTH)).toBe(true);
      });

      it('should return true for UNKNOWN', () => {
        expect(shouldLogAsError(OpenAIErrorType.UNKNOWN)).toBe(true);
      });
    });

    describe('Operational errors (log at warn level)', () => {
      it('should return false for RATE_LIMIT', () => {
        expect(shouldLogAsError(OpenAIErrorType.RATE_LIMIT)).toBe(false);
      });

      it('should return false for TIMEOUT', () => {
        expect(shouldLogAsError(OpenAIErrorType.TIMEOUT)).toBe(false);
      });

      it('should return false for SERVER_ERROR', () => {
        expect(shouldLogAsError(OpenAIErrorType.SERVER_ERROR)).toBe(false);
      });

      it('should return false for MALFORMED', () => {
        expect(shouldLogAsError(OpenAIErrorType.MALFORMED)).toBe(false);
      });

      it('should return false for VALIDATION', () => {
        expect(shouldLogAsError(OpenAIErrorType.VALIDATION)).toBe(false);
      });
    });
  });

  describe('Message consistency (AC7)', () => {
    it('should return same message for same error type', () => {
      const message1 = getUserFriendlyErrorMessage(OpenAIErrorType.TIMEOUT);
      const message2 = getUserFriendlyErrorMessage(OpenAIErrorType.TIMEOUT);
      expect(message1).toBe(message2);
    });

    it('should return same message from direct function and from exception', () => {
      const error = { status: 429, message: 'Rate limit' };
      const messageFromType = getUserFriendlyErrorMessage(OpenAIErrorType.RATE_LIMIT);
      const messageFromException = getUserFriendlyErrorForException(error);
      expect(messageFromType).toBe(messageFromException);
    });
  });

  describe('USER_FRIENDLY_ERRORS constant', () => {
    it('should have entry for all OpenAIErrorType values', () => {
      const allTypes = Object.values(OpenAIErrorType);
      allTypes.forEach(type => {
        expect(USER_FRIENDLY_ERRORS[type]).toBeDefined();
        expect(typeof USER_FRIENDLY_ERRORS[type]).toBe('string');
        expect(USER_FRIENDLY_ERRORS[type].length).toBeGreaterThan(0);
      });
    });
  });

  describe('TECHNICAL_ERROR_DESCRIPTIONS constant', () => {
    it('should have entry for all OpenAIErrorType values', () => {
      const allTypes = Object.values(OpenAIErrorType);
      allTypes.forEach(type => {
        expect(TECHNICAL_ERROR_DESCRIPTIONS[type]).toBeDefined();
        expect(typeof TECHNICAL_ERROR_DESCRIPTIONS[type]).toBe('string');
        expect(TECHNICAL_ERROR_DESCRIPTIONS[type].length).toBeGreaterThan(0);
      });
    });
  });
});
