import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { config } from '@config/app.config';
import { logger } from '@utils/logger';

/**
 * Compression result metrics
 * Story 2.4: Track compression performance for monitoring
 */
export interface CompressionMetrics {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // percentage saved
  durationMs: number;
  originalDimensions: { width: number; height: number };
  compressedDimensions: { width: number; height: number };
}

/**
 * Options for createTempUrl methods
 * Story 2.4: Support original file deletion after compression
 */
export interface TempUrlOptions {
  /** Delete the original file after successful compression (default: false) */
  deleteOriginal?: boolean;
}

/**
 * TempUrlService
 *
 * Manages temporary image URLs for processing pipeline.
 * - Compresses images to reduce OpenAI API costs
 * - Generates secure, time-limited URLs
 * - Automatic cleanup of expired files
 *
 * @replaces Cloudinary dependency (eliminates $0.01-0.02 per image cost)
 */
export class TempUrlService {
  private readonly tempDir: string;
  private readonly baseUrl: string;
  private readonly lifetime: number; // seconds
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private scheduledCleanups: Map<string, NodeJS.Timeout> = new Map();

  constructor(tempDir: string = path.join(process.cwd(), 'temp')) {
    this.tempDir = tempDir;
    this.baseUrl = config.server.baseUrl;
    this.lifetime = config.processing.tempFileLifetime;

    // Ensure temp directory exists on initialization
    this.ensureTempDirExists();

    // Start background cleanup job (runs every 30 seconds)
    this.startBackgroundCleanup();
  }

  /**
   * Creates a temporary URL for an uploaded image
   *
   * @param file - Multer uploaded file
   * @param options - Optional configuration (deleteOriginal, etc.)
   * @returns Public HTTPS URL to the compressed image
   *
   * Process:
   * 1. Generate UUID for unique filename
   * 2. Compress image (1024px max, 85% quality JPEG)
   * 3. Handle PNG transparency with white background (Story 2.4)
   * 4. Save to /temp/{uuid}.jpg
   * 5. Schedule cleanup after configured lifetime
   * 6. Return public URL
   */
  async createTempUrl(file: Express.Multer.File, options?: TempUrlOptions): Promise<string> {
    const uuid = randomUUID();
    const filename = `${uuid}.jpg`;
    const filepath = path.join(this.tempDir, filename);
    const startTime = Date.now();

    try {
      // Ensure temp directory exists before writing
      await this.ensureTempDirExists();

      // Get original image metadata for metrics
      const originalMetadata = await sharp(file.buffer).metadata();
      const originalSize = file.buffer.length;

      // Compress image with Sharp
      // Story 2.4: Add .flatten() for PNG transparency handling (white background)
      await sharp(file.buffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // Story 2.4: White background for PNG transparency
        .resize(1024, 1024, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toFile(filepath);

      // Get compressed file metrics
      const compressedStats = await fs.stat(filepath);
      const compressedMetadata = await sharp(filepath).metadata();
      const durationMs = Date.now() - startTime;

      // Story 2.4: Log compression metrics
      const metrics: CompressionMetrics = {
        originalSize,
        compressedSize: compressedStats.size,
        compressionRatio: Math.round((1 - compressedStats.size / originalSize) * 100),
        durationMs,
        originalDimensions: {
          width: originalMetadata.width || 0,
          height: originalMetadata.height || 0,
        },
        compressedDimensions: {
          width: compressedMetadata.width || 0,
          height: compressedMetadata.height || 0,
        },
      };

      logger.info(
        {
          uuid,
          originalName: file.originalname,
          originalSize: `${Math.round(originalSize / 1024)}KB`,
          compressedSize: `${Math.round(compressedStats.size / 1024)}KB`,
          compressionRatio: `${metrics.compressionRatio}%`,
          durationMs,
          dimensions: `${metrics.originalDimensions.width}x${metrics.originalDimensions.height} → ${metrics.compressedDimensions.width}x${metrics.compressedDimensions.height}`,
        },
        'Image compressed successfully'
      );

      // Schedule cleanup after configured lifetime
      this.scheduleCleanup(uuid, this.lifetime);

      // Return public URL
      const url = `${this.baseUrl}/temp/${filename}`;
      return url;
    } catch (error) {
      // Clean up partial file if compression fails
      await this.cleanup(uuid).catch(() => {});
      logger.error(
        {
          uuid,
          originalName: file.originalname,
          error: error instanceof Error ? error.message : 'Unknown',
        },
        'Image compression failed'
      );
      throw new Error(
        `Failed to create temp URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Creates a temporary URL from a file path (disk storage)
   *
   * @param filePath - Absolute or relative path to the image file
   * @param options - Optional configuration (deleteOriginal, etc.)
   * @returns Public HTTPS URL to the compressed image
   *
   * This method is used when files are stored on disk (multer.diskStorage)
   * instead of in memory (multer.memoryStorage)
   *
   * Story 2.4: Added PNG transparency handling and original file deletion
   */
  async createTempUrlFromPath(filePath: string, options?: TempUrlOptions): Promise<string> {
    const uuid = randomUUID();
    const filename = `${uuid}.jpg`;
    const outputPath = path.join(this.tempDir, filename);
    const startTime = Date.now();

    try {
      // Ensure temp directory exists before writing
      await this.ensureTempDirExists();

      // Get original image metadata for metrics
      const originalMetadata = await sharp(filePath).metadata();
      const originalStats = await fs.stat(filePath);
      const originalSize = originalStats.size;

      // Compress image with Sharp (Sharp can read directly from file path)
      // Story 2.4: Add .flatten() for PNG transparency handling (white background)
      await sharp(filePath)
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // Story 2.4: White background for PNG transparency
        .resize(1024, 1024, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toFile(outputPath);

      // Get compressed file metrics
      const compressedStats = await fs.stat(outputPath);
      const compressedMetadata = await sharp(outputPath).metadata();
      const durationMs = Date.now() - startTime;

      // Story 2.4: Log compression metrics
      const metrics: CompressionMetrics = {
        originalSize,
        compressedSize: compressedStats.size,
        compressionRatio: Math.round((1 - compressedStats.size / originalSize) * 100),
        durationMs,
        originalDimensions: {
          width: originalMetadata.width || 0,
          height: originalMetadata.height || 0,
        },
        compressedDimensions: {
          width: compressedMetadata.width || 0,
          height: compressedMetadata.height || 0,
        },
      };

      const originalName = path.basename(filePath);
      logger.info(
        {
          uuid,
          originalName,
          originalSize: `${Math.round(originalSize / 1024)}KB`,
          compressedSize: `${Math.round(compressedStats.size / 1024)}KB`,
          compressionRatio: `${metrics.compressionRatio}%`,
          durationMs,
          dimensions: `${metrics.originalDimensions.width}x${metrics.originalDimensions.height} → ${metrics.compressedDimensions.width}x${metrics.compressedDimensions.height}`,
        },
        'Image compressed successfully'
      );

      // Story 2.4: Delete original file after successful compression if requested
      if (options?.deleteOriginal) {
        await this.deleteSourceFile(filePath);
      }

      // Schedule cleanup after configured lifetime
      this.scheduleCleanup(uuid, this.lifetime);

      // Return public URL
      const url = `${this.baseUrl}/temp/${filename}`;
      return url;
    } catch (error) {
      // Clean up partial file if compression fails
      await this.cleanup(uuid).catch(() => {});
      logger.error(
        { uuid, filePath, error: error instanceof Error ? error.message : 'Unknown' },
        'Image compression from path failed'
      );
      throw new Error(
        `Failed to create temp URL from path: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Deletes the source/original file after compression
   * Story 2.4: Free disk space by removing original uploads
   *
   * @param filePath - Path to the original file to delete
   */
  async deleteSourceFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug({ filePath }, 'Original file deleted after compression');
    } catch (error) {
      // Log warning but don't fail - original file might already be deleted
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn(
          { filePath, error: error instanceof Error ? error.message : 'Unknown' },
          'Failed to delete original file after compression'
        );
      }
    }
  }

  /**
   * Manually cleanup a specific temp file by UUID
   *
   * @param uuid - File UUID (without extension)
   */
  async cleanup(uuid: string): Promise<void> {
    const filename = `${uuid}.jpg`;
    const filepath = path.join(this.tempDir, filename);

    try {
      await fs.unlink(filepath);

      // Cancel scheduled cleanup if exists
      const scheduledTimeout = this.scheduledCleanups.get(uuid);
      if (scheduledTimeout) {
        clearTimeout(scheduledTimeout);
        this.scheduledCleanups.delete(uuid);
      }
    } catch (error) {
      // File might already be deleted - ignore error
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error(
          { uuid, error: error instanceof Error ? error.message : 'Unknown' },
          'Failed to cleanup temp file'
        );
      }
    }
  }

  /**
   * Schedules automatic cleanup after specified delay
   *
   * @param uuid - File UUID
   * @param delaySeconds - Delay in seconds before cleanup
   */
  private scheduleCleanup(uuid: string, delaySeconds: number): void {
    const timeout = setTimeout(async () => {
      await this.cleanup(uuid);
    }, delaySeconds * 1000);

    this.scheduledCleanups.set(uuid, timeout);
  }

  /**
   * Cleans up old files (>1 minute old)
   *
   * Background job that runs periodically to ensure
   * no orphaned files remain if scheduled cleanup fails
   */
  async cleanupOldFiles(): Promise<void> {
    try {
      await this.ensureTempDirExists();

      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 60 * 1000; // 1 minute

      for (const file of files) {
        if (!file.endsWith('.jpg')) continue;

        const filepath = path.join(this.tempDir, file);
        try {
          const stats = await fs.stat(filepath);
          const age = now - stats.mtimeMs;

          if (age > maxAge) {
            await fs.unlink(filepath);
            logger.debug({ file, ageSeconds: Math.round(age / 1000) }, 'Cleaned up old temp file');
          }
        } catch (error) {
          // File might be deleted by another process - ignore
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.error(
              { file, error: error instanceof Error ? error.message : 'Unknown' },
              'Error checking temp file'
            );
          }
        }
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown' },
        'Error during cleanup of old files'
      );
    }
  }

  /**
   * Starts background cleanup job (every 30 seconds)
   */
  private startBackgroundCleanup(): void {
    // Run immediately on startup (fire-and-forget)
    this.cleanupOldFiles().catch(err => logger.error({ error: err }, 'Background cleanup error'));

    // Then run every 30 seconds
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupOldFiles().catch(err => logger.error({ error: err }, 'Background cleanup error'));
    }, 30 * 1000);
  }

  /**
   * Stops background cleanup job (for testing/shutdown)
   */
  stopBackgroundCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // Clear all scheduled cleanups
    for (const timeout of this.scheduledCleanups.values()) {
      clearTimeout(timeout);
    }
    this.scheduledCleanups.clear();
  }

  /**
   * Ensures temp directory exists, creates if missing
   */
  private async ensureTempDirExists(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info({ tempDir: this.tempDir }, 'Created temp directory');
    }
  }
}

// Export singleton instance
export const tempUrlService = new TempUrlService();
