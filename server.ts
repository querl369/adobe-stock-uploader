// Simple Express server for Adobe Stock Uploader
// TypeScript version - type-safe and well-documented!

import express, { Request, Response } from 'express';
import multer, { StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';

// Import config service (validates environment variables on startup)
import { config } from './src/config/app.config';

// Import service container (centralized dependency injection)
import { services } from './src/config/container';

// Import error handling middleware
import { errorHandler, notFoundHandler } from './src/api/middleware/error-handler';

// Import correlation ID middleware for request tracking
import { correlationIdMiddleware } from './src/api/middleware/correlation-id.middleware';

// Import logger
import { logger } from './src/utils/logger';

// Import legacy file utilities (will be refactored in future stories)
const { renameImages } = require('./src/files-manipulation');

// ============================================
// Type Definitions
// ============================================

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  path: string;
}

interface ProcessResult {
  success: boolean;
  filename: string;
  title?: string;
  keywords?: string;
  category?: string;
  error?: string;
}

interface MetadataItem {
  filename: string;
  title: string;
  keywords: string;
  category: string;
  releases?: string;
}

// ============================================
// Express Setup
// ============================================

const app = express();
const PORT = config.server.port;

// Middleware - allows receiving JSON data and serving static files
app.use(express.json());

// Add correlation ID middleware early (for request tracking)
app.use(correlationIdMiddleware);

// Serve static files from Vite build
app.use(express.static('dist'));
// Serve temporary image files (for OpenAI Vision API access)
app.use('/temp', express.static(path.join(process.cwd(), 'temp')));

// Configure file upload - saves uploaded images temporarily
const storage: StorageEngine = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: config.processing.maxFileSizeMB * 1024 * 1024 }, // Configurable MB limit
});

// Ensure directories exist
['uploads', 'images', 'csv_output', 'temp'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================
// API ENDPOINTS (These are like functions the web page calls)
// ============================================

// Endpoint: Upload images
// Called when user selects images in the web interface
app.post('/api/upload', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return information about uploaded file
    const fileInfo: UploadedFile = {
      id: file.filename,
      name: file.originalname,
      size: file.size,
      path: file.path,
    };

    res.json({ success: true, file: fileInfo });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown', file: req.file?.originalname },
      'Upload error'
    );
    res.status(500).json({ error: (error as Error).message });
  }
});

// Endpoint: Process a single image
// Creates temp URL, generates metadata with OpenAI, cleanup is automatic
app.post('/api/process-image', async (req: Request, res: Response) => {
  try {
    const { fileId, filename } = req.body;
    const filePath = path.join('uploads', fileId);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    req.log.info({ filename }, 'Processing image');

    // Create temporary URL (self-hosted, replaces Cloudinary)
    const url = await services.tempUrl.createTempUrlFromPath(filePath);
    req.log.debug({ filename, url }, 'Created temp URL');

    // Generate metadata using AI service
    const rawMetadata = await services.metadata.generateMetadata(url);
    req.log.info({ filename }, 'Generated metadata');

    // Note: Cleanup is automatic via TempUrlService scheduled cleanup

    // Send back the results
    const result: ProcessResult = {
      success: true,
      filename: filename,
      title: rawMetadata.title,
      keywords: Array.isArray(rawMetadata.keywords)
        ? rawMetadata.keywords.join(',')
        : String(rawMetadata.keywords),
      category: String(rawMetadata.category),
    };

    res.json(result);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown', filename: req.body.filename },
      'Processing error'
    );
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      filename: req.body.filename,
    } as ProcessResult);
  }
});

// Endpoint: Process multiple images in batch
app.post('/api/process-batch', async (req: Request, res: Response) => {
  try {
    const { initials } = req.body as {
      initials: string;
    };

    if (!initials) {
      return res.status(400).json({ error: 'Initials are required' });
    }

    const metadataList: Array<{
      fileName: string;
      title?: string;
      keywords?: string;
      category?: number;
      error?: string;
    }> = [];

    // Clean the images directory first to avoid processing old files
    logger.info('Cleaning images directory');
    if (fs.existsSync('images')) {
      const existingFiles = fs.readdirSync('images');
      for (const file of existingFiles) {
        if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          fs.unlinkSync(path.join('images', file));
          logger.debug({ file }, 'Removed old file');
        }
      }
    }

    // Check uploads directory
    logger.info('Checking uploads directory');
    if (!fs.existsSync('uploads')) {
      return res.status(400).json({ error: 'No files uploaded yet. Please upload images first.' });
    }

    const uploadedFiles = fs
      .readdirSync('uploads')
      .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i));

    logger.info({ count: uploadedFiles.length }, 'Found files in uploads');

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No image files found in uploads directory' });
    }

    // Copy uploaded files to images directory
    logger.info('Copying files to images directory');
    for (const file of uploadedFiles) {
      const srcPath = path.join('uploads', file);
      const destPath = path.join('images', file);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        logger.debug({ file }, 'Copied file');
      }
    }

    // Rename images with initials
    const renamedFiles: string[] = renameImages('images', initials);

    logger.info({ count: renamedFiles.length, initials }, 'Processing batch');

    // Process each image
    for (let i = 0; i < renamedFiles.length; i++) {
      const file = renamedFiles[i];
      const filePath = path.join('images', file);

      try {
        req.log.info({ file, progress: `${i + 1}/${renamedFiles.length}` }, 'Processing image');

        // Create temporary URL (self-hosted, replaces Cloudinary)
        const url = await services.tempUrl.createTempUrlFromPath(filePath);
        req.log.debug({ file, url }, 'Created temp URL');

        // Generate metadata using AI service
        const rawMetadata = await services.metadata.generateMetadata(url);
        req.log.info({ file }, 'Generated metadata');

        // Note: Cleanup is automatic via TempUrlService scheduled cleanup

        metadataList.push({
          fileName: file,
          title: rawMetadata.title,
          keywords: Array.isArray(rawMetadata.keywords)
            ? rawMetadata.keywords.join(',')
            : String(rawMetadata.keywords),
          category: Number(rawMetadata.category),
        });
      } catch (error) {
        logger.error(
          { file, error: error instanceof Error ? error.message : 'Unknown' },
          'Error processing file'
        );
        metadataList.push({
          fileName: file,
          error: (error as Error).message,
        });
      }
    }

    // Generate CSV file
    const csvFileName = `${initials}_${Date.now()}.csv`;
    const csvPath = path.join('csv_output', csvFileName);

    // Prepare metadata for CSV (only successful ones)
    const successfulMetadata = metadataList
      .filter(item => !item.error)
      .map(item => ({
        filename: item.fileName,
        title: item.title || '',
        keywords: item.keywords || '',
        category: Number(item.category || 0),
        releases: initials,
      }));

    if (successfulMetadata.length > 0) {
      await services.csvExport.generateCSV(successfulMetadata, csvPath);
      logger.info({ csvFileName, count: successfulMetadata.length }, 'CSV file created');
    }

    // Clean up uploads directory
    for (const file of uploadedFiles) {
      const filePath = path.join('uploads', file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    logger.info('Cleaned uploads directory');

    res.json({
      success: true,
      metadataList,
      csvFileName,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown' },
      'Batch processing error'
    );
    res.status(500).json({ error: (error as Error).message });
  }
});

// Endpoint: Export metadata to CSV
app.post('/api/export-csv', async (req: Request, res: Response) => {
  try {
    const { csvFileName } = req.body as {
      csvFileName: string;
    };

    if (!csvFileName) {
      return res.status(400).json({ error: 'CSV filename is required' });
    }

    const csvPath = path.join('csv_output', csvFileName);

    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: 'CSV file not found' });
    }

    req.log.info({ csvFileName }, 'Downloading CSV');

    // Send the CSV file as download
    res.download(csvPath, csvFileName, err => {
      if (err) {
        logger.error({ csvFileName, error: err.message }, 'Error downloading CSV');
      }
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown' }, 'CSV export error');
    res.status(500).json({ error: (error as Error).message });
  }
});

// Endpoint: Clean up temporary files
app.post('/api/cleanup', (req: Request, res: Response) => {
  try {
    // Clean uploads folder
    const uploadFiles = fs.readdirSync('uploads');
    uploadFiles.forEach(file => {
      const filePath = path.join('uploads', file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });

    // Clean images folder
    const imageFiles = fs.readdirSync('images');
    imageFiles.forEach(file => {
      const filePath = path.join('images', file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });

    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown' }, 'Cleanup error');
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SPA Fallback - Serve index.html for all non-API routes
// ============================================

app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

// ============================================
// Error Handling Middleware (MUST be last)
// ============================================

// Handle 404 errors for undefined routes
app.use(notFoundHandler);

// Handle all other errors
app.use(errorHandler);

// ============================================
// Start the Server
// ============================================

app.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      url: `http://localhost:${PORT}`,
      nodeEnv: config.server.nodeEnv,
    },
    'Adobe Stock Uploader server started'
  );
});
