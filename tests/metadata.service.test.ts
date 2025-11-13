/**
 * Tests for MetadataService
 *
 * Validates AI metadata generation including:
 * - OpenAI API integration
 * - Retry logic for failed requests
 * - Response parsing (JSON and markdown code blocks)
 * - Error handling and wrapping
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetadataService } from '../src/services/metadata.service';
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
    },
  },
}));

// Mock retry utility
vi.mock('../src/utils/retry', () => ({
  withRetry: vi.fn(async fn => await fn()),
}));

describe('MetadataService', () => {
  let service: MetadataService;
  let mockOpenAI: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create service instance
    service = new MetadataService();

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
                category: 1045,
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
        category: 1045,
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-mini',
          temperature: 0.3,
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
        expect(extError.context?.originalError).toContain('Response missing required fields');
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

    it('should handle category as string and preserve it', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                keywords: ['test'],
                category: '1045', // String category
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateMetadata(imageUrl);

      expect(result.category).toBe('1045');
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
});
