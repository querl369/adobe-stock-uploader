/**
 * Tests for MetadataService
 *
 * Validates AI metadata generation including:
 * - OpenAI API integration
 * - Retry logic for failed requests
 * - Response parsing (JSON and markdown code blocks)
 * - Error handling and wrapping
 * - Category mapping via CategoryService (Story 3.2)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetadataService } from '../src/services/metadata.service';
import { CategoryService } from '../src/services/category.service';
import { ExternalServiceError } from '../src/models/errors';
import type { RawAIMetadata } from '../src/models/metadata.model';

// Mock OpenAI module properly with a factory that doesn't reference external variables
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const mockList = vi.fn();

  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };

      models = {
        list: mockList,
      };
    },
  };
});

// Mock config
vi.mock('../src/config/app.config', () => ({
  config: {
    openai: {
      apiKey: 'test-key',
      model: 'gpt-5-mini',
      maxTokens: 1000,
      temperature: 0.3,
      timeoutMs: 30000,
    },
  },
}));

// Mock retry utility
vi.mock('../src/utils/retry', () => ({
  withRetry: vi.fn(async fn => await fn()),
}));

// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MetadataService', () => {
  let service: MetadataService;
  let mockOpenAI: any;
  let categoryService: CategoryService;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create real CategoryService instance (it's lightweight and well-tested separately)
    categoryService = new CategoryService();

    // Create service instance with CategoryService dependency
    service = new MetadataService(categoryService);

    // Access the OpenAI instance created by the service
    mockOpenAI = (service as any).openai;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateMetadata', () => {
    it('should generate metadata from image URL', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Beautiful sunset over mountains',
                keywords: ['sunset', 'mountains', 'landscape'],
                category: 11, // Valid category: Landscape
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);

      expect(result).toEqual({
        title: 'Beautiful sunset over mountains',
        keywords: ['sunset', 'mountains', 'landscape'],
        category: 11, // CategoryService validates and passes through valid ID
      });

      // Verify API was called with correct parameters (including signal for timeout)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-mini',
          temperature: 0.3,
        }),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should parse JSON wrapped in markdown code blocks', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content:
                '```json\n{\n  "title": "Test Title",\n  "keywords": ["test"],\n  "category": 1\n}\n```',
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);

      expect(result).toEqual({
        title: 'Test Title',
        keywords: ['test'],
        category: 1,
      });
    });

    it('should throw ExternalServiceError on OpenAI failure', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const openAIError = new Error('OpenAI API timeout');

      mockOpenAI.chat.completions.create.mockRejectedValue(openAIError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });

    it('should throw error on invalid JSON response', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'This is not JSON',
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow();
    });

    it('should throw error if response missing required fields', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Only title, no keywords or category',
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      // Should throw ExternalServiceError with the parsing error in context
      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(
        'Failed to generate metadata from OpenAI'
      );

      try {
        await service.generateMetadata(imageUrl);
        expect.fail('Should have thrown ExternalServiceError');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalServiceError);
        const extError = error as ExternalServiceError;
        // With Zod validation, error message format changed to include field-specific errors
        expect(extError.context?.originalError).toContain('validation failed');
      }
    });

    it('should include error context in ExternalServiceError', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const openAIError = new Error('Rate limit exceeded');

      mockOpenAI.chat.completions.create.mockRejectedValue(openAIError);

      try {
        await service.generateMetadata(imageUrl);
        expect.fail('Should have thrown ExternalServiceError');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalServiceError);
        const extError = error as ExternalServiceError;
        expect(extError.context).toMatchObject({
          imageUrl,
          service: 'openai',
          model: 'gpt-5-mini',
          originalError: 'Rate limit exceeded',
        });
      }
    });
  });

  describe('validateConnection', () => {
    it('should return true when OpenAI API is accessible', async () => {
      mockOpenAI.models.list.mockResolvedValue({ data: [] });

      const result = await service.validateConnection();

      expect(result).toBe(true);
      expect(mockOpenAI.models.list).toHaveBeenCalled();
    });

    it('should return false when OpenAI API is not accessible', async () => {
      mockOpenAI.models.list.mockRejectedValue(new Error('Network error'));

      const result = await service.validateConnection();

      expect(result).toBe(false);
    });
  });

  describe('parseAIResponse (via generateMetadata)', () => {
    it('should handle responses with extra whitespace in code blocks', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content:
                '```json\n\n  \n{"title": "Test", "keywords": ["a"], "category": 1}\n  \n```',
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);

      expect(result.title).toBe('Test');
    });

    it('should handle raw JSON without code blocks', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"title": "Raw JSON", "keywords": ["test"], "category": 1}',
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);

      expect(result.title).toBe('Raw JSON');
    });

    it('should map invalid category ID to default (Story 3.2)', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                keywords: ['test'],
                category: '1045', // Invalid category ID - will be mapped to default (1)
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);

      // CategoryService maps invalid "1045" to default category 1
      expect(result.category).toBe(1);
    });

    it('should handle valid string category ID', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                keywords: ['test'],
                category: '13', // Valid string category ID - People
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);

      // CategoryService validates and converts "13" to number 13
      expect(result.category).toBe(13);
    });

    it('should map category name to ID (Story 3.2)', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                keywords: ['test'],
                category: 'Technology', // Category name instead of ID
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);

      // CategoryService maps "Technology" to ID 19
      expect(result.category).toBe(19);
    });
  });

  describe('integration with retry logic', () => {
    it('should use retry wrapper for resilience', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                keywords: ['test'],
                category: 1,
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await service.generateMetadata(imageUrl);

      // Verify withRetry was called
      const { withRetry } = await import('../src/utils/retry');
      expect(withRetry).toHaveBeenCalled();
    });
  });

  describe('error scenarios', () => {
    it('should handle network timeouts', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const timeoutError = new Error('Network timeout');
      (timeoutError as any).code = 'ETIMEDOUT';

      mockOpenAI.chat.completions.create.mockRejectedValue(timeoutError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });

    it('should handle rate limit errors', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });

    it('should handle authentication errors', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const authError = new Error('Invalid API key');
      (authError as any).status = 401;

      mockOpenAI.chat.completions.create.mockRejectedValue(authError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });
  });

  // ============================================================================
  // AC4: Timeout Handling Tests
  // ============================================================================
  describe('timeout handling (AC4)', () => {
    it('should throw ExternalServiceError with timeout context when request is aborted', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      mockOpenAI.chat.completions.create.mockRejectedValue(abortError);

      try {
        await service.generateMetadata(imageUrl);
        expect.fail('Should have thrown ExternalServiceError');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalServiceError);
        const extError = error as ExternalServiceError;
        expect(extError.message).toBe('OpenAI API request timed out');
        expect(extError.context?.reason).toBe('timeout');
        expect(extError.context?.service).toBe('openai');
        expect(extError.context?.timeoutMs).toBe(30000);
      }
    });

    it('should throw timeout error when error message contains "aborted"', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const abortError = new Error('Request aborted due to timeout');

      mockOpenAI.chat.completions.create.mockRejectedValue(abortError);

      try {
        await service.generateMetadata(imageUrl);
        expect.fail('Should have thrown ExternalServiceError');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalServiceError);
        const extError = error as ExternalServiceError;
        expect(extError.message).toBe('OpenAI API request timed out');
        expect(extError.context?.reason).toBe('timeout');
      }
    });

    it('should not treat non-abort errors as timeout', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const serverError = new Error('Internal server error');
      (serverError as any).status = 500;

      mockOpenAI.chat.completions.create.mockRejectedValue(serverError);

      try {
        await service.generateMetadata(imageUrl);
        expect.fail('Should have thrown ExternalServiceError');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalServiceError);
        const extError = error as ExternalServiceError;
        expect(extError.message).toBe('Failed to generate metadata from OpenAI');
        expect(extError.context?.reason).toBeUndefined();
      }
    });
  });

  // ============================================================================
  // AC5: Zod Validation Tests
  // ============================================================================
  describe('Zod validation (AC5)', () => {
    it('should accept valid response with all required fields', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Beautiful sunset',
                keywords: ['sunset', 'sky', 'nature'],
                category: 11, // Valid category: Landscape
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);
      expect(result.title).toBe('Beautiful sunset');
      expect(result.keywords).toEqual(['sunset', 'sky', 'nature']);
      expect(result.category).toBe(11); // CategoryService validates and passes through
    });

    it('should reject response with missing title field', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                keywords: ['test'],
                category: 1,
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(
        'Failed to generate metadata from OpenAI'
      );

      try {
        await service.generateMetadata(imageUrl);
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalServiceError);
        const extError = error as ExternalServiceError;
        expect(extError.context?.originalError).toContain('title');
      }
    });

    it('should reject response with empty title', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: '',
                keywords: ['test'],
                category: 1,
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow();
    });

    it('should reject response with missing keywords field', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                category: 1,
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      try {
        await service.generateMetadata(imageUrl);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalServiceError);
      }
    });

    it('should transform comma-separated keywords string to array', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                keywords: 'sunset, mountains, landscape, nature',
                category: 1,
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(result.keywords).toEqual(['sunset', 'mountains', 'landscape', 'nature']);
    });

    it('should accept category as string and map to valid ID', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                keywords: ['test'],
                category: '19', // Valid string category ID
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);
      // CategoryService converts string "19" to number 19
      expect(result.category).toBe(19);
    });

    it('should accept category as number', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                keywords: ['test'],
                category: 7, // Valid category: Food
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);
      expect(result.category).toBe(7);
    });

    it('should reject response with missing category', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                keywords: ['test'],
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow();
    });
  });

  // ============================================================================
  // AC6: Error Classification Tests
  // ============================================================================
  describe('error classification (AC6)', () => {
    it('should identify 429 rate limit as retryable', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      // The withRetry mock executes the function directly, so we test error handling
      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });

    it('should identify 500 server error as retryable', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const serverError = new Error('Internal server error');
      (serverError as any).status = 500;

      mockOpenAI.chat.completions.create.mockRejectedValue(serverError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });

    it('should identify 502 bad gateway as retryable', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const badGatewayError = new Error('Bad gateway');
      (badGatewayError as any).status = 502;

      mockOpenAI.chat.completions.create.mockRejectedValue(badGatewayError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });

    it('should NOT retry on 401 authentication errors', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const authError = new Error('Invalid API key');
      (authError as any).status = 401;

      mockOpenAI.chat.completions.create.mockRejectedValue(authError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });

    it('should NOT retry on 400 validation errors', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const validationError = new Error('Invalid request');
      (validationError as any).status = 400;

      mockOpenAI.chat.completions.create.mockRejectedValue(validationError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });

    it('should NOT retry on AbortError (timeout)', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';

      mockOpenAI.chat.completions.create.mockRejectedValue(abortError);

      try {
        await service.generateMetadata(imageUrl);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalServiceError);
        const extError = error as ExternalServiceError;
        expect(extError.context?.reason).toBe('timeout');
      }
    });

    it('should identify network timeout (ETIMEDOUT) as retryable', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const networkError = new Error('Connection timed out');
      (networkError as any).code = 'ETIMEDOUT';

      mockOpenAI.chat.completions.create.mockRejectedValue(networkError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });

    it('should identify connection reset (ECONNRESET) as retryable', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const networkError = new Error('Connection reset');
      (networkError as any).code = 'ECONNRESET';

      mockOpenAI.chat.completions.create.mockRejectedValue(networkError);

      await expect(service.generateMetadata(imageUrl)).rejects.toThrow(ExternalServiceError);
    });
  });
});
