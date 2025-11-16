/**
 * Dependency Injection Container
 *
 * Central registry for all application services.
 * Implements singleton pattern to ensure single instance of each service.
 *
 * This container:
 * - Manages service lifecycle
 * - Handles dependency injection
 * - Provides easy access to services throughout the application
 *
 * Usage:
 *   import { services } from '@/config/container';
 *   const result = await services.imageProcessing.processImage(file);
 */

import { TempUrlService } from '@/services/temp-url.service';
import { MetadataService } from '@/services/metadata.service';
import { ImageProcessingService } from '@/services/image-processing.service';
import { CsvExportService } from '@/services/csv-export.service';
import { logger } from '@/utils/logger';

/**
 * Service container interface
 * Defines all available services in the application
 */
export interface ServiceContainer {
  /**
   * Temporary URL service for hosting images
   */
  tempUrl: TempUrlService;

  /**
   * Metadata generation service (OpenAI)
   */
  metadata: MetadataService;

  /**
   * Image processing orchestration service
   */
  imageProcessing: ImageProcessingService;

  /**
   * CSV export service for Adobe Stock
   */
  csvExport: CsvExportService;
}

/**
 * Container class for managing service instances
 */
class Container {
  private static instance: Container;
  private _services: ServiceContainer | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Gets the singleton container instance
   */
  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Initializes all services with proper dependency injection
   *
   * Services are initialized in the correct order to satisfy dependencies:
   * 1. TempUrlService (no dependencies)
   * 2. MetadataService (no dependencies)
   * 3. ImageProcessingService (depends on TempUrlService, MetadataService)
   * 4. CsvExportService (no dependencies)
   */
  private initializeServices(): ServiceContainer {
    logger.info('Initializing service container');

    // Step 1: Initialize services with no dependencies
    const tempUrlService = new TempUrlService();
    const metadataService = new MetadataService();
    const csvExportService = new CsvExportService();

    // Step 2: Initialize services with dependencies
    const imageProcessingService = new ImageProcessingService(tempUrlService, metadataService);

    logger.info('Service container initialized successfully');

    return {
      tempUrl: tempUrlService,
      metadata: metadataService,
      imageProcessing: imageProcessingService,
      csvExport: csvExportService,
    };
  }

  /**
   * Gets all services (lazy initialization)
   *
   * Services are initialized on first access and cached for subsequent calls.
   */
  get services(): ServiceContainer {
    if (!this._services) {
      this._services = this.initializeServices();
    }
    return this._services;
  }

  /**
   * Resets the container (useful for testing)
   *
   * Forces re-initialization of all services on next access.
   */
  reset(): void {
    this._services = null;
    logger.info('Service container reset');
  }
}

/**
 * Global service container instance
 *
 * Import this in your application code to access services:
 *
 * @example
 * import { services } from '@/config/container';
 *
 * // In a route handler
 * app.post('/process', async (req, res) => {
 *   const result = await services.imageProcessing.processImage(req.file);
 *   res.json(result);
 * });
 *
 * @example
 * // In a service or utility
 * const metadata = await services.metadata.generateMetadata(imageUrl);
 * await services.csvExport.generateCSV(metadataList, outputPath);
 */
export const services = Container.getInstance().services;

/**
 * Export container instance for testing purposes
 *
 * @example
 * // In tests
 * import { container } from '@/config/container';
 *
 * afterEach(() => {
 *   container.reset();
 * });
 */
export const container = Container.getInstance();
