import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { generateMetadata as GenerateMetadataType } from '../src/openai';

// Mock OpenAI at the module level
const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

// Mock dotenv
vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
}));

describe('openai', () => {
  let generateMetadata: typeof GenerateMetadataType;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import after mocks are set up
    const module = await import('../src/openai');
    generateMetadata = module.generateMetadata;
  });

  describe('generateMetadata', () => {
    it('should parse JSON from markdown code block', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '```json\n{"title":"Test","keywords":"test,image","category":"5"}\n```',
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateMetadata('http://example.com/image.jpg');

      expect(result).toEqual({
        title: 'Test',
        keywords: 'test,image',
        category: '5',
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.any(Array),
            }),
          ]),
        })
      );
    });

    it('should parse plain JSON response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"title":"Direct JSON","keywords":"direct,json","category":"1"}',
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateMetadata('http://example.com/test.jpg');

      expect(result).toEqual({
        title: 'Direct JSON',
        keywords: 'direct,json',
        category: '1',
      });
    });

    it('should throw error for invalid JSON', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Not valid JSON at all',
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      await expect(generateMetadata('http://example.com/bad.jpg')).rejects.toThrow(
        'Invalid JSON response from OpenAI'
      );
    });

    it('should handle OpenAI API errors', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(generateMetadata('http://example.com/error.jpg')).rejects.toThrow('API Error');
    });
  });
});
