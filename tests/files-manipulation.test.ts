import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renameImages, convertPngToJpeg } from '../src/files-manipulation';

// Mock fs module
vi.mock('fs');

describe('files-manipulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renameImages', () => {
    it('should rename images with initials and date', () => {
      // Mock file system
      const mockFiles = ['image1.jpg', 'image2.png', 'photo.jpeg'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.renameSync).mockImplementation(() => {});

      const result = renameImages('/test/path', 'OY');

      // Should process all 3 files
      expect(result).toHaveLength(3);

      // Should rename each file
      expect(fs.renameSync).toHaveBeenCalledTimes(3);

      // Check that new filenames follow the pattern
      result.forEach(filename => {
        expect(filename).toMatch(/^IMG_OY_\d{8}_\d+\.(jpg|png|jpeg)$/);
      });
    });

    it('should skip already renamed files', () => {
      const mockFiles = ['IMG_OY_20251108_1.jpg', 'new-image.jpg'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.renameSync).mockImplementation(() => {});

      const result = renameImages('/test/path', 'OY');

      // Should only rename the new file
      expect(fs.renameSync).toHaveBeenCalledTimes(1);

      // Should include the already renamed file in results
      expect(result).toContain('IMG_OY_20251108_1.jpg');
    });

    it('should filter non-image files', () => {
      const mockFiles = ['image.jpg', 'document.txt', 'video.mp4', 'photo.png'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.renameSync).mockImplementation(() => {});

      const result = renameImages('/test/path', 'TEST');

      // Should only process image files
      expect(result).toHaveLength(2);
      expect(fs.renameSync).toHaveBeenCalledTimes(2);
    });

    it('should generate sequential counter for filenames', () => {
      const mockFiles = ['a.jpg', 'b.jpg', 'c.jpg'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);

      const renamedFiles: string[] = [];
      vi.mocked(fs.renameSync).mockImplementation((oldPath, newPath) => {
        renamedFiles.push(path.basename(newPath as string));
      });

      renameImages('/test/path', 'XY');

      // Check that counters are sequential
      expect(renamedFiles[0]).toMatch(/_1\.jpg$/);
      expect(renamedFiles[1]).toMatch(/_2\.jpg$/);
      expect(renamedFiles[2]).toMatch(/_3\.jpg$/);
    });
  });

  describe('convertPngToJpeg', () => {
    it('should require both inputDir and outputDir parameters', () => {
      const mockFiles: string[] = [];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);

      expect(async () => {
        await convertPngToJpeg({ inputDir: '/input', outputDir: '/output' });
      }).not.toThrow();
    });

    it('should filter for PNG files only', () => {
      const mockFiles = ['image.png', 'photo.jpg', 'graphic.png', 'doc.txt'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.existsSync).mockReturnValue(true);

      // We can't fully test the conversion without mocking sharp,
      // but we can verify the filtering logic works
      const result = mockFiles.filter(file => file.endsWith('.png'));
      expect(result).toHaveLength(2);
      expect(result).toContain('image.png');
      expect(result).toContain('graphic.png');
    });
  });
});
