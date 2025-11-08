// Simple Express server for Adobe Stock Uploader
// TypeScript version - type-safe and well-documented!

import express, { Request, Response } from 'express';
import multer, { StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import your existing backend functions (they work as-is!)
// Note: Using require here because your src files are CommonJS
const { uploadImage, deleteImage } = require('./src/cloudinary');
const { generateMetadata } = require('./src/openai');
const { renameImages } = require('./src/files-manipulation');
const { writeMetadataToCSV } = require('./src/csv-writer');

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
const PORT = 3000;

// Middleware - allows receiving JSON data and serving static files
app.use(express.json());
app.use(express.static('public')); // Serves your HTML/CSS/JS files

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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Ensure directories exist
['uploads', 'images', 'csv_output'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================
// API ENDPOINTS (These are like functions the web page calls)
// ============================================

// Endpoint: Upload images
// Called when user selects images in the web interface
app.post('/api/upload', upload.array('images'), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Return information about uploaded files
    const fileInfo: UploadedFile[] = files.map(file => ({
      id: file.filename,
      name: file.originalname,
      size: file.size,
      path: file.path,
    }));

    res.json({ success: true, files: fileInfo });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Endpoint: Process a single image
// Uploads to Cloudinary, generates metadata with OpenAI, then cleans up
app.post('/api/process-image', async (req: Request, res: Response) => {
  try {
    const { fileId, filename } = req.body;
    const filePath = path.join('uploads', fileId);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    console.log(`Processing ${filename}...`);

    // Upload to Cloudinary (temporary)
    const { url, publicId } = await uploadImage(filePath);
    console.log(`Uploaded ${filename} to Cloudinary`);

    // Generate metadata using OpenAI
    const metadata = await generateMetadata(url);
    console.log(`Generated metadata for ${filename}`);

    // Delete from Cloudinary (we don't need it anymore)
    await deleteImage(publicId);

    // Send back the results
    const result: ProcessResult = {
      success: true,
      filename: filename,
      title: metadata.title,
      keywords: metadata.keywords,
      category: metadata.category,
    };

    res.json(result);
  } catch (error) {
    console.error('Processing error:', error);
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
    const { files, initials } = req.body as {
      files: UploadedFile[];
      initials: string;
    };
    const results: ProcessResult[] = [];

    // Clean the images directory first to avoid processing old files
    if (fs.existsSync('images')) {
      const existingFiles = fs.readdirSync('images');
      for (const file of existingFiles) {
        if (file.match(/\.(jpg|jpeg|png)$/i)) {
          fs.unlinkSync(path.join('images', file));
          console.log(`🗑️ Cleaned old file: ${file}`);
        }
      }
    }

    // Copy uploaded files to images directory
    for (const file of files) {
      const srcPath = path.join('uploads', file.id);
      const destPath = path.join('images', file.name);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`📋 Copied: ${file.name}`);
      }
    }

    // Rename images with initials
    const renamedFiles: string[] = renameImages('images', initials);

    console.log(`Processing ${renamedFiles.length} images in batch...`);

    // Process each image
    for (let i = 0; i < renamedFiles.length; i++) {
      const file = renamedFiles[i];
      const filePath = path.join('images', file);

      try {
        console.log(`[${i + 1}/${renamedFiles.length}] Processing ${file}...`);

        // Upload to Cloudinary
        const { url, publicId } = await uploadImage(filePath);
        console.log(`✅ Uploaded to Cloudinary: ${url}`);

        // Wait a moment for Cloudinary to process the image
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Generate metadata
        const metadata = await generateMetadata(url);
        console.log(`✅ Generated metadata for ${file}`);

        // Delete from Cloudinary
        await deleteImage(publicId);

        results.push({
          success: true,
          filename: file,
          title: metadata.title,
          keywords: metadata.keywords,
          category: metadata.category,
        });
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
        results.push({
          success: false,
          filename: file,
          error: (error as Error).message,
        });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Batch processing error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Endpoint: Export metadata to CSV
app.post('/api/export-csv', async (req: Request, res: Response) => {
  try {
    const { metadata, initials } = req.body as {
      metadata: MetadataItem[];
      initials: string;
    };

    const outputPath = path.join('csv_output', `${initials}_${Date.now()}.csv`);

    // Add releases field (your name/initials)
    const metadataWithReleases: MetadataItem[] = metadata.map(item => ({
      filename: item.filename,
      title: item.title,
      keywords: item.keywords,
      category: item.category,
      releases: initials,
    }));

    // Write to CSV using your existing function
    await writeMetadataToCSV(metadataWithReleases, outputPath);

    console.log(`CSV exported to ${outputPath}`);

    // Send the CSV file as download
    res.download(outputPath, path.basename(outputPath));
  } catch (error) {
    console.error('CSV export error:', error);
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
    console.error('Cleanup error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// Start the Server
// ============================================

app.listen(PORT, () => {
  console.log('\n🚀 Adobe Stock Uploader is running!');
  console.log(`📱 Open your browser and go to: http://localhost:${PORT}`);
  console.log(`\nPress Ctrl+C to stop the server\n`);
});
