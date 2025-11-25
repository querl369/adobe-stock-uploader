import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock the config before importing TempUrlService
vi.mock('@config/app.config', () => ({
  config: {
    server: {
      baseUrl: 'http://localhost:3000',
      port: 3000,
      isProduction: false,
      nodeEnv: 'test',
    },
    processing: {
      tempFileLifetime: 10,
      concurrencyLimit: 5,
      maxFileSizeMB: 50,
    },
    openai: {
      apiKey: 'test-key',
      model: 'gpt-5-mini',
      maxTokens: 1000,
      temperature: 0.3,
    },
    rateLimits: {
      anonymous: 10,
      freeTier: 100,
    },
  },
}));

import { TempUrlService } from '../src/services/temp-url.service';

// Mock logger for testing
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TempUrlService', () => {
  let service: TempUrlService;
  const testTempDir = path.join(process.cwd(), 'temp-test');

  beforeEach(async () => {
    // Create test temp directory
    await fs.mkdir(testTempDir, { recursive: true });
    service = new TempUrlService(testTempDir);
  });

  afterEach(async () => {
    // Stop background cleanup
    service.stopBackgroundCleanup();

    // Clean up test directory
    try {
      const files = await fs.readdir(testTempDir);
      for (const file of files) {
        await fs.unlink(path.join(testTempDir, file));
      }
      await fs.rmdir(testTempDir);
    } catch (error) {
      // Directory might not exist - ignore
    }
  });

  describe('createTempUrlFromPath', () => {
    it('should create temp URL from disk file path', async () => {
      const sharp = require('sharp');

      // Create a test image file on disk
      const testImagePath = path.join(testTempDir, 'source-test.png');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toFile(testImagePath);

      const url = await service.createTempUrlFromPath(testImagePath);

      // Verify URL format
      expect(url).toMatch(/^http:\/\/localhost:3000\/temp\/[a-f0-9-]{36}\.jpg$/);

      // Extract UUID from URL
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      expect(uuid).toBeTruthy();

      // Verify compressed file exists
      const outputPath = path.join(testTempDir, `${uuid}.jpg`);
      const fileExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file is JPEG
      const fileBuffer = await fs.readFile(outputPath);
      expect(fileBuffer[0]).toBe(0xff); // JPEG magic number
      expect(fileBuffer[1]).toBe(0xd8);

      // Cleanup test image
      await fs.unlink(testImagePath);
    });

    it('should compress large images from disk to max 1024px', async () => {
      const sharp = require('sharp');

      // Create a large test image file
      const testImagePath = path.join(testTempDir, 'large-source.png');
      await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .png()
        .toFile(testImagePath);

      const url = await service.createTempUrlFromPath(testImagePath);
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      const outputPath = path.join(testTempDir, `${uuid}.jpg`);

      const metadata = await sharp(outputPath).metadata();

      // Should be resized to max 1024px
      expect(metadata.width).toBeLessThanOrEqual(1024);
      expect(metadata.height).toBeLessThanOrEqual(1024);

      // Cleanup
      await fs.unlink(testImagePath);
    });

    it('should handle non-existent file path gracefully', async () => {
      const nonExistentPath = path.join(testTempDir, 'does-not-exist.jpg');

      await expect(service.createTempUrlFromPath(nonExistentPath)).rejects.toThrow(
        'Failed to create temp URL from path'
      );
    });

    it('should handle corrupted image file gracefully', async () => {
      const corruptedPath = path.join(testTempDir, 'corrupted.jpg');
      await fs.writeFile(corruptedPath, 'This is not an image');

      await expect(service.createTempUrlFromPath(corruptedPath)).rejects.toThrow(
        'Failed to create temp URL from path'
      );

      // Cleanup
      await fs.unlink(corruptedPath);
    });

    it('should schedule cleanup for files created from path', async () => {
      vi.useFakeTimers();
      const sharp = require('sharp');

      const testImagePath = path.join(testTempDir, 'cleanup-test.png');
      await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .png()
        .toFile(testImagePath);

      const url = await service.createTempUrlFromPath(testImagePath);
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      const outputPath = path.join(testTempDir, `${uuid}.jpg`);

      // File should exist initially
      let fileExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Fast-forward past cleanup time (10 seconds)
      await vi.advanceTimersByTimeAsync(11000);

      // Run all pending timers to ensure async cleanup completes
      await vi.runAllTimersAsync();

      // File should be deleted
      fileExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(false);

      vi.useRealTimers();
      await fs.unlink(testImagePath);
    });
  });

  describe('createTempUrl', () => {
    it('should create a compressed JPEG image with UUID filename', async () => {
      // Create a simple test image buffer (1x1 red pixel PNG)
      const testBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
        'base64'
      );

      const mockFile = {
        buffer: testBuffer,
        originalname: 'test.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      const url = await service.createTempUrl(mockFile);

      // Verify URL format
      expect(url).toMatch(/^http:\/\/localhost:3000\/temp\/[a-f0-9-]{36}\.jpg$/);

      // Extract UUID from URL
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      expect(uuid).toBeTruthy();

      // Verify file exists
      const filepath = path.join(testTempDir, `${uuid}.jpg`);
      const fileExists = await fs
        .access(filepath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file is JPEG
      const fileBuffer = await fs.readFile(filepath);
      expect(fileBuffer[0]).toBe(0xff); // JPEG magic number
      expect(fileBuffer[1]).toBe(0xd8);
    });

    it('should compress large images to max 1024px dimension', async () => {
      // Create a 2000x2000 test image
      const sharp = require('sharp');
      const largeImageBuffer = await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const mockFile = {
        buffer: largeImageBuffer,
        originalname: 'large.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      const url = await service.createTempUrl(mockFile);

      // Extract UUID and read compressed file
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      const filepath = path.join(testTempDir, `${uuid}.jpg`);

      const metadata = await sharp(filepath).metadata();

      // Should be resized to 1024x1024 max
      expect(metadata.width).toBeLessThanOrEqual(1024);
      expect(metadata.height).toBeLessThanOrEqual(1024);
    });

    it('should maintain aspect ratio when resizing', async () => {
      // Create a 2000x1000 test image (2:1 ratio)
      const sharp = require('sharp');
      const wideImageBuffer = await sharp({
        create: {
          width: 2000,
          height: 1000,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const mockFile = {
        buffer: wideImageBuffer,
        originalname: 'wide.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      const url = await service.createTempUrl(mockFile);
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      const filepath = path.join(testTempDir, `${uuid}.jpg`);

      const metadata = await sharp(filepath).metadata();

      // Should maintain 2:1 aspect ratio
      const ratio = (metadata.width || 0) / (metadata.height || 0);
      expect(ratio).toBeCloseTo(2, 1);
    });

    it('should schedule automatic cleanup after configured lifetime', async () => {
      vi.useFakeTimers();

      const testBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
        'base64'
      );

      const mockFile = {
        buffer: testBuffer,
        originalname: 'test.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      const url = await service.createTempUrl(mockFile);
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      const filepath = path.join(testTempDir, `${uuid}.jpg`);

      // File should exist initially
      let fileExists = await fs
        .access(filepath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Fast-forward past cleanup time (default 10 seconds)
      await vi.advanceTimersByTimeAsync(11000);

      // Run all pending timers to ensure async cleanup completes
      await vi.runAllTimersAsync();

      // File should be deleted
      fileExists = await fs
        .access(filepath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(false);

      vi.useRealTimers();
    });

    it('should throw error if compression fails', async () => {
      const invalidBuffer = Buffer.from('not an image');

      const mockFile = {
        buffer: invalidBuffer,
        originalname: 'invalid.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      await expect(service.createTempUrl(mockFile)).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should delete temp file by UUID', async () => {
      // Create a test file
      const testBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
        'base64'
      );

      const mockFile = {
        buffer: testBuffer,
        originalname: 'test.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      const url = await service.createTempUrl(mockFile);
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      const filepath = path.join(testTempDir, `${uuid}.jpg`);

      // File should exist
      let fileExists = await fs
        .access(filepath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Cleanup
      await service.cleanup(uuid!);

      // File should be deleted
      fileExists = await fs
        .access(filepath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should not throw error if file does not exist', async () => {
      // Should not throw
      await expect(service.cleanup('non-existent-uuid')).resolves.not.toThrow();
    });
  });

  describe('cleanupOldFiles', () => {
    it('should delete files older than 1 minute', async () => {
      // Create test files
      const oldFile = path.join(testTempDir, 'old-file.jpg');
      const newFile = path.join(testTempDir, 'new-file.jpg');

      await fs.writeFile(oldFile, 'test');
      await fs.writeFile(newFile, 'test');

      // Make old file appear older by modifying its mtime
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      await fs.utimes(oldFile, twoMinutesAgo, twoMinutesAgo);

      // Run cleanup
      await service.cleanupOldFiles();

      // Old file should be deleted
      const oldExists = await fs
        .access(oldFile)
        .then(() => true)
        .catch(() => false);
      expect(oldExists).toBe(false);

      // New file should still exist
      const newExists = await fs
        .access(newFile)
        .then(() => true)
        .catch(() => false);
      expect(newExists).toBe(true);
    });

    it('should only delete .jpg files', async () => {
      // Create different file types
      await fs.writeFile(path.join(testTempDir, 'old-image.jpg'), 'test');
      await fs.writeFile(path.join(testTempDir, 'old-text.txt'), 'test');

      // Make them both old
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      for (const file of ['old-image.jpg', 'old-text.txt']) {
        const filepath = path.join(testTempDir, file);
        await fs.utimes(filepath, twoMinutesAgo, twoMinutesAgo);
      }

      await service.cleanupOldFiles();

      // JPG should be deleted
      const jpgExists = await fs
        .access(path.join(testTempDir, 'old-image.jpg'))
        .then(() => true)
        .catch(() => false);
      expect(jpgExists).toBe(false);

      // TXT should remain (not a .jpg file)
      const txtExists = await fs
        .access(path.join(testTempDir, 'old-text.txt'))
        .then(() => true)
        .catch(() => false);
      expect(txtExists).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // cleanupOldFiles should not throw even if directory has issues
      await expect(service.cleanupOldFiles()).resolves.not.toThrow();
    });
  });

  describe('background cleanup job', () => {
    it('should run cleanup periodically', async () => {
      // Use real timers for this test as it involves actual file operations
      // Create old file
      const oldFile = path.join(testTempDir, 'old-file.jpg');
      await fs.writeFile(oldFile, 'test');
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      await fs.utimes(oldFile, twoMinutesAgo, twoMinutesAgo);

      // Verify file exists before cleanup
      let fileExists = await fs
        .access(oldFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Start service with background cleanup
      const testService = new TempUrlService(testTempDir);

      // Wait for background cleanup to run (runs immediately on startup)
      // Give more time for async file operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Old file should be cleaned up by background job
      fileExists = await fs
        .access(oldFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(false);

      testService.stopBackgroundCleanup();
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('temp directory creation', () => {
    it('should create temp directory if it does not exist', async () => {
      const nonExistentDir = path.join(process.cwd(), 'temp-test-new');

      // Ensure directory doesn't exist
      try {
        await fs.rmdir(nonExistentDir);
      } catch {}

      // Create service with non-existent directory
      const testService = new TempUrlService(nonExistentDir);

      // Create a temp URL to trigger directory creation
      const testBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
        'base64'
      );

      const mockFile = {
        buffer: testBuffer,
        originalname: 'test.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      await testService.createTempUrl(mockFile);

      // Directory should now exist
      const dirExists = await fs
        .access(nonExistentDir)
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);

      // Cleanup
      testService.stopBackgroundCleanup();
      const files = await fs.readdir(nonExistentDir);
      for (const file of files) {
        await fs.unlink(path.join(nonExistentDir, file));
      }
      await fs.rmdir(nonExistentDir);
    });
  });

  /**
   * Story 2.4: PNG Transparency Handling Tests
   */
  describe('PNG transparency handling (Story 2.4)', () => {
    it('should convert PNG transparency to white background', async () => {
      const sharp = require('sharp');

      // Create a PNG with transparency (RGBA with alpha channel)
      const transparentPngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4, // RGBA - includes alpha channel
          background: { r: 255, g: 0, b: 0, alpha: 0.5 }, // Semi-transparent red
        },
      })
        .png()
        .toBuffer();

      const mockFile = {
        buffer: transparentPngBuffer,
        originalname: 'transparent.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      const url = await service.createTempUrl(mockFile);

      // Extract UUID and read compressed file
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      const filepath = path.join(testTempDir, `${uuid}.jpg`);

      // JPEG doesn't support transparency, so flatten should have converted to opaque
      const metadata = await sharp(filepath).metadata();
      expect(metadata.channels).toBe(3); // RGB, no alpha channel

      // Verify the image is valid JPEG
      const buffer = await fs.readFile(filepath);
      expect(buffer[0]).toBe(0xff); // JPEG magic number
      expect(buffer[1]).toBe(0xd8);
    });

    it('should convert PNG transparency to white (not black) background from disk', async () => {
      const sharp = require('sharp');

      // Create PNG with full transparency on disk
      const testImagePath = path.join(testTempDir, 'transparent-test.png');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Fully transparent (invisible)
        },
      })
        .png()
        .toFile(testImagePath);

      const url = await service.createTempUrlFromPath(testImagePath);
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      const outputPath = path.join(testTempDir, `${uuid}.jpg`);

      // Check the pixel color - should be white (255, 255, 255), not black
      const { data, info } = await sharp(outputPath).raw().toBuffer({ resolveWithObject: true });

      // Sample center pixel (should be white from flatten)
      const centerIndex =
        (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;

      // With flatten to white background, transparent areas should be white
      // Allow some tolerance for JPEG compression artifacts
      expect(data[centerIndex]).toBeGreaterThan(240); // R
      expect(data[centerIndex + 1]).toBeGreaterThan(240); // G
      expect(data[centerIndex + 2]).toBeGreaterThan(240); // B

      // Cleanup
      await fs.unlink(testImagePath);
    });
  });

  /**
   * Story 2.4: Original File Deletion Tests
   */
  describe('original file deletion (Story 2.4)', () => {
    it('should delete original file when deleteOriginal option is true', async () => {
      const sharp = require('sharp');

      // Create test image on disk
      const testImagePath = path.join(testTempDir, 'to-delete.png');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toFile(testImagePath);

      // Verify original exists
      let originalExists = await fs
        .access(testImagePath)
        .then(() => true)
        .catch(() => false);
      expect(originalExists).toBe(true);

      // Compress with deleteOriginal: true
      await service.createTempUrlFromPath(testImagePath, { deleteOriginal: true });

      // Original should be deleted
      originalExists = await fs
        .access(testImagePath)
        .then(() => true)
        .catch(() => false);
      expect(originalExists).toBe(false);
    });

    it('should NOT delete original file when deleteOriginal option is false', async () => {
      const sharp = require('sharp');

      const testImagePath = path.join(testTempDir, 'keep-original.png');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .png()
        .toFile(testImagePath);

      // Compress with deleteOriginal: false (explicitly)
      await service.createTempUrlFromPath(testImagePath, { deleteOriginal: false });

      // Original should still exist
      const originalExists = await fs
        .access(testImagePath)
        .then(() => true)
        .catch(() => false);
      expect(originalExists).toBe(true);

      // Cleanup
      await fs.unlink(testImagePath);
    });

    it('should NOT delete original file when options not provided (default behavior)', async () => {
      const sharp = require('sharp');

      const testImagePath = path.join(testTempDir, 'default-behavior.png');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .png()
        .toFile(testImagePath);

      // Compress without options (default)
      await service.createTempUrlFromPath(testImagePath);

      // Original should still exist (default is to NOT delete)
      const originalExists = await fs
        .access(testImagePath)
        .then(() => true)
        .catch(() => false);
      expect(originalExists).toBe(true);

      // Cleanup
      await fs.unlink(testImagePath);
    });

    it('should handle deleteSourceFile gracefully when file does not exist', async () => {
      const nonExistentPath = path.join(testTempDir, 'non-existent.png');

      // Should not throw
      await expect(service.deleteSourceFile(nonExistentPath)).resolves.not.toThrow();
    });
  });

  /**
   * Story 2.4: Compression Metrics Logging Tests
   */
  describe('compression metrics logging (Story 2.4)', () => {
    it('should log compression metrics for buffer compression', async () => {
      const sharp = require('sharp');
      const { logger } = await import('../src/utils/logger');

      // Create a large test image
      const largeBuffer = await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .png()
        .toBuffer();

      const mockFile = {
        buffer: largeBuffer,
        originalname: 'metrics-test.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      await service.createTempUrl(mockFile);

      // Verify logger.info was called with compression metrics
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          originalName: 'metrics-test.png',
          compressionRatio: expect.stringMatching(/\d+%/),
          durationMs: expect.any(Number),
          dimensions: expect.stringMatching(/\d+x\d+ → \d+x\d+/),
        }),
        'Image compressed successfully'
      );
    });

    it('should log compression metrics for disk file compression', async () => {
      const sharp = require('sharp');
      const { logger } = await import('../src/utils/logger');

      const testImagePath = path.join(testTempDir, 'metrics-disk-test.png');
      await sharp({
        create: {
          width: 1500,
          height: 1000,
          channels: 3,
          background: { r: 50, g: 100, b: 150 },
        },
      })
        .png()
        .toFile(testImagePath);

      await service.createTempUrlFromPath(testImagePath);

      // Verify logger.info was called with metrics
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          originalName: 'metrics-disk-test.png',
          compressionRatio: expect.stringMatching(/\d+%/),
          durationMs: expect.any(Number),
        }),
        'Image compressed successfully'
      );

      // Cleanup
      await fs.unlink(testImagePath);
    });

    it('should log error when compression fails', async () => {
      const { logger } = await import('../src/utils/logger');

      const corruptedPath = path.join(testTempDir, 'corrupted-metrics-test.jpg');
      await fs.writeFile(corruptedPath, 'This is not an image');

      await expect(service.createTempUrlFromPath(corruptedPath)).rejects.toThrow();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: corruptedPath,
          error: expect.any(String),
        }),
        'Image compression from path failed'
      );

      // Cleanup
      await fs.unlink(corruptedPath);
    });
  });

  /**
   * Story 2.4: Compression Performance Tests
   */
  describe('compression performance (Story 2.4)', () => {
    it('should compress images within target time (<1 second)', async () => {
      const sharp = require('sharp');

      // Create a moderately large image (1500x1500)
      const testBuffer = await sharp({
        create: {
          width: 1500,
          height: 1500,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .png()
        .toBuffer();

      const mockFile = {
        buffer: testBuffer,
        originalname: 'performance-test.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      const startTime = Date.now();
      await service.createTempUrl(mockFile);
      const durationMs = Date.now() - startTime;

      // Story 2.4 AC6: Compression should take <1 second
      expect(durationMs).toBeLessThan(1000);
    });

    it('should achieve significant compression ratio', async () => {
      const sharp = require('sharp');

      // Create a large PNG (uncompressed PNG tends to be large)
      const testImagePath = path.join(testTempDir, 'compression-ratio-test.png');
      await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 200, g: 150, b: 100 },
        },
      })
        .png()
        .toFile(testImagePath);

      const originalStats = await fs.stat(testImagePath);
      const url = await service.createTempUrlFromPath(testImagePath);
      const uuid = url.split('/').pop()?.replace('.jpg', '');
      const outputPath = path.join(testTempDir, `${uuid}.jpg`);
      const compressedStats = await fs.stat(outputPath);

      // Story 2.4 AC5: Compressed size should be significantly smaller
      // Large PNG should compress to much smaller JPEG
      expect(compressedStats.size).toBeLessThan(originalStats.size);

      // Target: <500KB average for compressed images
      // 1024x1024 JPEG at 85% quality should typically be under 500KB
      expect(compressedStats.size).toBeLessThan(500 * 1024);

      // Cleanup
      await fs.unlink(testImagePath);
    });
  });
});
