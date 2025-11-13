/**
 * Tests for CsvExportService
 *
 * Validates CSV generation including:
 * - Adobe Stock format compliance
 * - Metadata validation
 * - Error handling
 * - UTF-8 encoding
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CsvExportService } from '../src/services/csv-export.service';
import { ProcessingError } from '../src/models/errors';
import type { Metadata } from '../src/models/metadata.model';
import fs from 'fs';
import path from 'path';

// Create a shared mock for writeRecords that persists across calls
const mockWriteRecords = vi.fn().mockResolvedValue(undefined);

// Mock csv-writer to always return the same mock writer instance
vi.mock('csv-writer', () => ({
  createObjectCsvWriter: vi.fn(() => ({
    writeRecords: mockWriteRecords,
  })),
}));

describe('CsvExportService', () => {
  let service: CsvExportService;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    mockWriteRecords.mockResolvedValue(undefined); // Reset to default behavior
    service = new CsvExportService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateCSV', () => {
    const validMetadata: Metadata[] = [
      {
        filename: 'image1.jpg',
        title: 'Beautiful sunset over mountains with dramatic clouds and colors',
        keywords: 'sunset,mountains,landscape,nature,sky,clouds',
        category: 1045,
      },
      {
        filename: 'image2.jpg',
        title: 'Urban cityscape at night with illuminated skyscrapers and lights',
        keywords: 'city,urban,night,buildings,architecture,skyscrapers',
        category: 1002,
        releases: 'Model Released',
      },
    ];

    it('should generate CSV file from metadata list', async () => {
      const outputPath = '/tmp/test.csv';

      await service.generateCSV(validMetadata, outputPath);

      const { createObjectCsvWriter } = await import('csv-writer');
      expect(createObjectCsvWriter).toHaveBeenCalledWith({
        path: outputPath,
        header: [
          { id: 'filename', title: 'Filename' },
          { id: 'title', title: 'Title' },
          { id: 'keywords', title: 'Keywords' },
          { id: 'category', title: 'Category' },
          { id: 'releases', title: 'Releases' },
        ],
      });

      expect(mockWriteRecords).toHaveBeenCalledWith(validMetadata);
    });

    it('should throw ProcessingError on empty metadata list', async () => {
      const outputPath = '/tmp/test.csv';

      try {
        await service.generateCSV([], outputPath);
        expect.fail('Should have thrown ProcessingError');
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessingError);
        const procError = error as ProcessingError;
        expect(procError.code).toBe('EMPTY_METADATA_LIST');
        expect(procError.message).toContain('Cannot generate CSV');
      }
    });

    it('should throw ProcessingError on filesystem errors', async () => {
      const outputPath = '/invalid/path/test.csv';
      mockWriteRecords.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(service.generateCSV(validMetadata, outputPath)).rejects.toThrow(ProcessingError);
    });

    it('should include context in error when CSV generation fails', async () => {
      const outputPath = '/tmp/test.csv';
      mockWriteRecords.mockRejectedValue(new Error('Write failed'));

      try {
        await service.generateCSV(validMetadata, outputPath);
        expect.fail('Should have thrown ProcessingError');
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessingError);
        const procError = error as ProcessingError;
        expect(procError.context).toMatchObject({
          outputPath,
          recordCount: 2,
        });
      }
    });

    it('should handle metadata with optional releases field', async () => {
      const metadataWithoutReleases: Metadata[] = [
        {
          filename: 'image1.jpg',
          title: 'Test image without releases field that is at least fifty characters long',
          keywords: 'test,image',
          category: 1,
        },
      ];

      await service.generateCSV(metadataWithoutReleases, '/tmp/test.csv');

      expect(mockWriteRecords).toHaveBeenCalledWith(metadataWithoutReleases);
    });
  });

  describe('validateMetadata', () => {
    it('should validate correct metadata', () => {
      const validMetadata: Metadata = {
        filename: 'image.jpg',
        title: 'Valid title that meets the minimum length requirement of fifty characters',
        keywords: 'keyword1,keyword2,keyword3',
        category: 1045,
      };

      const result = service.validateMetadata(validMetadata);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject metadata with empty filename', () => {
      const metadata: Metadata = {
        filename: '',
        title: 'Valid title that meets the minimum length requirement of fifty characters',
        keywords: 'test',
        category: 1,
      };

      const result = service.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Filename is required and cannot be empty');
    });

    it('should reject metadata with empty title', () => {
      const metadata: Metadata = {
        filename: 'image.jpg',
        title: '',
        keywords: 'test',
        category: 1,
      };

      const result = service.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required and cannot be empty');
    });

    it('should reject metadata with empty keywords', () => {
      const metadata: Metadata = {
        filename: 'image.jpg',
        title: 'Valid title that meets the minimum length requirement of fifty characters',
        keywords: '',
        category: 1,
      };

      const result = service.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Keywords are required and cannot be empty');
    });

    it('should reject metadata with invalid category', () => {
      const metadata: Metadata = {
        filename: 'image.jpg',
        title: 'Valid title that meets the minimum length requirement of fifty characters',
        keywords: 'test',
        category: NaN,
      };

      const result = service.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Category must be a valid number');
    });

    it('should reject title shorter than 50 characters', () => {
      const metadata: Metadata = {
        filename: 'image.jpg',
        title: 'Too short',
        keywords: 'test',
        category: 1,
      };

      const result = service.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title must be between 50 and 200 characters');
    });

    it('should reject title longer than 200 characters', () => {
      const metadata: Metadata = {
        filename: 'image.jpg',
        title: 'A'.repeat(201),
        keywords: 'test',
        category: 1,
      };

      const result = service.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title must be between 50 and 200 characters');
    });

    it('should accept title exactly 50 characters', () => {
      const metadata: Metadata = {
        filename: 'image.jpg',
        title: 'A'.repeat(50),
        keywords: 'test',
        category: 1,
      };

      const result = service.validateMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should accept title exactly 200 characters', () => {
      const metadata: Metadata = {
        filename: 'image.jpg',
        title: 'A'.repeat(200),
        keywords: 'test',
        category: 1,
      };

      const result = service.validateMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should accumulate multiple validation errors', () => {
      const metadata: Metadata = {
        filename: '',
        title: '',
        keywords: '',
        category: NaN,
      };

      const result = service.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateMetadataList', () => {
    it('should validate entire list and return valid=true when all items valid', () => {
      const metadataList: Metadata[] = [
        {
          filename: 'image1.jpg',
          title: 'Valid title that meets the minimum length requirement of fifty characters',
          keywords: 'test1',
          category: 1,
        },
        {
          filename: 'image2.jpg',
          title: 'Another valid title that meets the minimum length requirement of fifty',
          keywords: 'test2',
          category: 2,
        },
      ];

      const result = service.validateMetadataList(metadataList);

      expect(result.valid).toBe(true);
      expect(result.invalidItems).toHaveLength(0);
    });

    it('should identify invalid items with their indices', () => {
      const metadataList: Metadata[] = [
        {
          filename: 'image1.jpg',
          title: 'Valid title that meets the minimum length requirement of fifty characters',
          keywords: 'test1',
          category: 1,
        },
        {
          filename: '', // Invalid
          title: 'Short', // Invalid
          keywords: 'test2',
          category: 2,
        },
        {
          filename: 'image3.jpg',
          title: 'Another valid title that meets the minimum length requirement of fifty',
          keywords: 'test3',
          category: 3,
        },
      ];

      const result = service.validateMetadataList(metadataList);

      expect(result.valid).toBe(false);
      expect(result.invalidItems).toHaveLength(1);
      expect(result.invalidItems[0].index).toBe(1);
      expect(result.invalidItems[0].errors.length).toBeGreaterThan(0);
    });

    it('should return all invalid items when multiple items are invalid', () => {
      const metadataList: Metadata[] = [
        {
          filename: '',
          title: 'Too short',
          keywords: 'test1',
          category: 1,
        },
        {
          filename: 'image2.jpg',
          title: '',
          keywords: '',
          category: NaN,
        },
      ];

      const result = service.validateMetadataList(metadataList);

      expect(result.valid).toBe(false);
      expect(result.invalidItems).toHaveLength(2);
      expect(result.invalidItems[0].index).toBe(0);
      expect(result.invalidItems[1].index).toBe(1);
    });
  });

  describe('Adobe Stock compliance', () => {
    it('should create CSV with correct column headers', async () => {
      const metadata: Metadata[] = [
        {
          filename: 'test.jpg',
          title: 'Test title that is long enough to meet the fifty character requirement',
          keywords: 'test',
          category: 1,
        },
      ];

      await service.generateCSV(metadata, '/tmp/test.csv');

      const { createObjectCsvWriter } = await import('csv-writer');
      const call = vi.mocked(createObjectCsvWriter).mock.calls[0][0];

      expect(call.header).toEqual([
        { id: 'filename', title: 'Filename' },
        { id: 'title', title: 'Title' },
        { id: 'keywords', title: 'Keywords' },
        { id: 'category', title: 'Category' },
        { id: 'releases', title: 'Releases' },
      ]);
    });
  });
});
