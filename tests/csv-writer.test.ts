import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeMetadataToCSV, Metadata } from '../src/csv-writer';
import fs from 'fs';

// Mock the csv-writer module
vi.mock('csv-writer', () => ({
  createObjectCsvWriter: vi.fn(() => ({
    writeRecords: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('csv-writer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('writeMetadataToCSV', () => {
    it('should write metadata to CSV file', async () => {
      const metadata: Metadata[] = [
        {
          filename: 'IMG_OY_20251108_1.jpg',
          title: 'Beautiful Sunset',
          keywords: 'sunset, sky, nature, beautiful, landscape',
          category: 5,
          releases: 'OY',
        },
        {
          filename: 'IMG_OY_20251108_2.jpg',
          title: 'Mountain View',
          keywords: 'mountain, view, landscape, nature, outdoor',
          category: 12,
          releases: 'OY',
        },
      ];

      await expect(writeMetadataToCSV(metadata, '/test/output.csv')).resolves.not.toThrow();
    });

    it('should handle empty metadata array', async () => {
      const metadata: Metadata[] = [];

      await expect(writeMetadataToCSV(metadata, '/test/empty.csv')).resolves.not.toThrow();
    });

    it('should handle metadata with all required fields', async () => {
      const metadata: Metadata[] = [
        {
          filename: 'test.jpg',
          title: 'Test Image',
          keywords: 'test, image, sample',
          category: 1,
          releases: 'TEST',
        },
      ];

      // Verify no errors when all required fields are present
      await expect(writeMetadataToCSV(metadata, '/test/valid.csv')).resolves.not.toThrow();
    });
  });

  describe('Metadata type validation', () => {
    it('should have correct structure', () => {
      const validMetadata: Metadata = {
        filename: 'test.jpg',
        title: 'Test',
        keywords: 'test',
        category: 1,
        releases: 'OY',
      };

      // TypeScript will catch if structure is wrong
      expect(validMetadata).toHaveProperty('filename');
      expect(validMetadata).toHaveProperty('title');
      expect(validMetadata).toHaveProperty('keywords');
      expect(validMetadata).toHaveProperty('category');
      expect(validMetadata).toHaveProperty('releases');
    });
  });
});
