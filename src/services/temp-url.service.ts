import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { config } from '@config/app.config';

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
   * @returns Public HTTPS URL to the compressed image
   *
   * Process:
   * 1. Generate UUID for unique filename
   * 2. Compress image (1024px max, 85% quality JPEG)
   * 3. Save to /temp/{uuid}.jpg
   * 4. Schedule cleanup after configured lifetime
   * 5. Return public URL
   */
  async createTempUrl(file: Express.Multer.File): Promise<string> {
    const uuid = randomUUID();
    const filename = `${uuid}.jpg`;
    const filepath = path.join(this.tempDir, filename);

    try {
      // Compress image with Sharp
      await sharp(file.buffer)
        .resize(1024, 1024, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toFile(filepath);

      // Schedule cleanup after configured lifetime
      this.scheduleCleanup(uuid, this.lifetime);

      // Return public URL
      const url = `${this.baseUrl}/temp/${filename}`;
      return url;
    } catch (error) {
      // Clean up partial file if compression fails
      await this.cleanup(uuid).catch(() => {});
      throw new Error(
        `Failed to create temp URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Creates a temporary URL from a file path (disk storage)
   *
   * @param filePath - Absolute or relative path to the image file
   * @returns Public HTTPS URL to the compressed image
   *
   * This method is used when files are stored on disk (multer.diskStorage)
   * instead of in memory (multer.memoryStorage)
   */
  async createTempUrlFromPath(filePath: string): Promise<string> {
    const uuid = randomUUID();
    const filename = `${uuid}.jpg`;
    const outputPath = path.join(this.tempDir, filename);

    try {
      // Compress image with Sharp (Sharp can read directly from file path)
      await sharp(filePath)
        .resize(1024, 1024, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toFile(outputPath);

      // Schedule cleanup after configured lifetime
      this.scheduleCleanup(uuid, this.lifetime);

      // Return public URL
      const url = `${this.baseUrl}/temp/${filename}`;
      return url;
    } catch (error) {
      // Clean up partial file if compression fails
      await this.cleanup(uuid).catch(() => {});
      throw new Error(
        `Failed to create temp URL from path: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
        console.error(`Failed to cleanup temp file ${uuid}:`, error);
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
            console.log(`Cleaned up old temp file: ${file} (age: ${Math.round(age / 1000)}s)`);
          }
        } catch (error) {
          // File might be deleted by another process - ignore
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error(`Error checking temp file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error during cleanup of old files:', error);
    }
  }

  /**
   * Starts background cleanup job (every 30 seconds)
   */
  private startBackgroundCleanup(): void {
    // Run immediately on startup (fire-and-forget)
    this.cleanupOldFiles().catch(err => console.error('Background cleanup error:', err));

    // Then run every 30 seconds
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupOldFiles().catch(err => console.error('Background cleanup error:', err));
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
      console.log(`Created temp directory: ${this.tempDir}`);
    }
  }
}

// Export singleton instance
export const tempUrlService = new TempUrlService();
