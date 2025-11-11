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
      await new Promise(resolve => setTimeout(resolve, 100));

      // Old file should be cleaned up by background job
      fileExists = await fs
        .access(oldFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(false);

      testService.stopBackgroundCleanup();
    });
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
});
