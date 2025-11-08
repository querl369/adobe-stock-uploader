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
// Serve static files from Vite build
app.use(express.static('dist'));

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
    console.log('🧹 Cleaning images directory...');
    if (fs.existsSync('images')) {
      const existingFiles = fs.readdirSync('images');
      for (const file of existingFiles) {
        if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          fs.unlinkSync(path.join('images', file));
          console.log(`   🗑️ Removed old file: ${file}`);
        }
      }
    }

    // Check uploads directory
    console.log('📂 Checking uploads directory...');
    if (!fs.existsSync('uploads')) {
      return res.status(400).json({ error: 'No files uploaded yet. Please upload images first.' });
    }

    const uploadedFiles = fs.readdirSync('uploads').filter(file => 
      file.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );

    console.log(`   Found ${uploadedFiles.length} files in uploads:`, uploadedFiles.map(f => f.substring(0, 30) + '...'));

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No image files found in uploads directory' });
    }

    // Copy uploaded files to images directory
    console.log('📋 Copying files to images directory...');
    for (const file of uploadedFiles) {
      const srcPath = path.join('uploads', file);
      const destPath = path.join('images', file);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`   ✅ Copied: ${file}`);
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

        metadataList.push({
          fileName: file,
          title: metadata.title,
          keywords: metadata.keywords,
          category: metadata.category,
        });
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
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
        category: String(item.category || ''),
        releases: initials,
      }));

    if (successfulMetadata.length > 0) {
      await writeMetadataToCSV(successfulMetadata, csvPath);
      console.log(`✅ CSV file created: ${csvFileName}`);
    }

    // Clean up uploads directory
    for (const file of uploadedFiles) {
      const filePath = path.join('uploads', file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    console.log('🧹 Cleaned uploads directory');

    res.json({ 
      success: true, 
      metadataList,
      csvFileName 
    });
  } catch (error) {
    console.error('Batch processing error:', error);
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

    console.log(`📥 Downloading CSV: ${csvFileName}`);

    // Send the CSV file as download
    res.download(csvPath, csvFileName, (err) => {
      if (err) {
        console.error('Error downloading CSV:', err);
      }
    });
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
// SPA Fallback - Serve index.html for all non-API routes
// ============================================

app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
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
