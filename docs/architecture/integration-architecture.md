# Integration Architecture

## Overview

The Adobe Stock Uploader integrates three distinct architectural layers: a React frontend (`client`), an Express backend API (`server`), and external cloud services (Cloudinary, OpenAI). This document details how these parts communicate and integrate.

**⚠️ IMPORTANT: This document describes TWO architectures:**

1. **Current State (Legacy)** - Existing implementation using Cloudinary
2. **Target State (PRD-Aligned)** - Future implementation with self-hosted temp URLs and parallel processing

**Migration Path:** Epic 1 (Stories 1.3-1.4) removes Cloudinary, Epic 3 (Story 3.3) adds parallel processing.

---

## System Architecture Diagram - Current State (Legacy)

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          React Frontend (localhost:5173)               │ │
│  │  • client/src/app.tsx                                  │ │
│  │  • Drag & drop UI                                      │ │
│  │  • Image preview grid                                  │ │
│  │  • Progress tracking                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP/JSON REST API
                       │ Vite Proxy: /api → :3000
                       ↓
┌─────────────────────────────────────────────────────────────┐
│            Express Backend (localhost:3000)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  server.ts - API Endpoints                             │ │
│  │  • POST /api/upload (multer)                           │ │
│  │  • POST /api/process-batch                             │ │
│  │  • POST /api/export-csv                                │ │
│  │  • POST /api/cleanup                                   │ │
│  │  • GET * (SPA fallback)                                │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│  ┌───────────────────┴────────────────────────────────────┐ │
│  │  Business Logic Utilities (src/)                       │ │
│  │  • src/cloudinary.ts                                   │ │
│  │  • src/openai.ts                                       │ │
│  │  • src/files-manipulation.ts                           │ │
│  │  • src/csv-writer.ts                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────┬──────────────────────────────────────┬───────────────┘
       │                                      │
       │ Cloudinary SDK                       │ OpenAI SDK
       │ (temp image hosting)                 │ (AI analysis)
       ↓                                      ↓
┌──────────────────┐                  ┌─────────────────────┐
│   Cloudinary API │                  │    OpenAI GPT-5     │
│  (Image CDN)     │                  │  (Vision API)       │
│  • Upload image  │                  │  • Analyze image    │
│  • Return URL    │                  │  • Generate title   │
│  • Delete image  │                  │  • Generate keywords│
└──────────────────┘                  │  • Categorize       │
                                      └─────────────────────┘
```

---

## Integration Point 1: Frontend ↔ Backend API

### Technology

- **Protocol**: HTTP/REST
- **Data Format**: JSON (API requests) + multipart/form-data (file uploads)
- **Transport**: Fetch API (native browser)
- **Development Proxy**: Vite dev server proxies `/api` → `http://localhost:3000`

### API Contract

#### 1. Image Upload

```typescript
// Frontend (client/src/app.tsx)
const formData = new FormData();
formData.append('image', file);

await fetch('/api/upload', {
  method: 'POST',
  body: formData,  // multipart/form-data
});

// Backend (server.ts)
app.post('/api/upload', upload.single('image'), (req, res) => {
  const file = req.file;  // Multer processes multipart
  res.json({ success: true, file: {...} });
});
```

**Data Flow**:

1. User selects/drops files
2. Frontend creates FormData for each file
3. POST request to `/api/upload`
4. Multer middleware processes upload
5. File saved to `uploads/` directory
6. Backend returns file metadata
7. Frontend stores in state for preview

---

#### 2. Batch Processing

```typescript
// Frontend (client/src/app.tsx:149-227)
const response = await fetch('/api/process-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ initials: 'OY' }),
});

const result = await response.json();
// result: { metadataList: [...], csvFileName: '...' }

// Backend (server.ts:156-294)
app.post('/api/process-batch', async (req, res) => {
  const { initials } = req.body;

  // 1. Clean images directory
  // 2. Copy uploads → images
  // 3. Rename files
  // 4. Process each image (Cloudinary + OpenAI)
  // 5. Generate CSV
  // 6. Cleanup uploads

  res.json({ success: true, metadataList, csvFileName });
});
```

**Data Flow**:

1. User enters initials and clicks "Generate"
2. Frontend sends POST with `{initials}`
3. Backend cleans working directories
4. Backend renames files: `IMG_{initials}_{date}_{n}.jpg`
5. For each image:
   - Upload to Cloudinary → get URL
   - Send URL to OpenAI → get metadata
   - Delete from Cloudinary
6. Backend writes CSV file
7. Backend returns metadata array + CSV filename
8. Frontend updates UI with metadata
9. Frontend triggers CSV download automatically

---

#### 3. CSV Export

```typescript
// Frontend (client/src/app.tsx:200-216)
const csvResponse = await fetch('/api/export-csv', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ csvFileName: 'OY_1762644147709.csv' }),
});

const blob = await csvResponse.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = csvFileName;
a.click();
URL.revokeObjectURL(url);

// Backend (server.ts:297-325)
app.post('/api/export-csv', (req, res) => {
  const { csvFileName } = req.body;
  const csvPath = path.join('csv_output', csvFileName);

  res.download(csvPath, csvFileName); // Streams file download
});
```

**Data Flow**:

1. Frontend receives CSV filename from batch processing
2. Frontend requests CSV download
3. Backend streams file using `res.download()`
4. Frontend creates blob URL
5. Frontend programmatically clicks download link
6. Browser downloads CSV file
7. Frontend cleans up blob URL

---

#### 4. Cleanup

```typescript
// Frontend (client/src/app.tsx:229-246)
await fetch('/api/cleanup', { method: 'POST' });

// Backend (server.ts:328-353)
app.post('/api/cleanup', (req, res) => {
  // Delete all files in uploads/
  // Delete all files in images/
  res.json({ success: true, message: 'Cleanup completed' });
});
```

**Data Flow**:

1. User clicks "Clear" button (or on mount)
2. Frontend sends cleanup request
3. Backend deletes temporary files
4. Frontend clears local state (images, initials)

---

### Error Handling

**Frontend**:

```typescript
try {
  const response = await fetch('/api/process-batch', {...});
  if (!response.ok) throw new Error('Failed to process images');
  // ... handle success
} catch (error) {
  console.error('Error generating metadata:', error);
  alert('Error generating metadata. Please try again.');
}
```

**Backend**:

```typescript
app.post('/api/process-batch', async (req, res) => {
  try {
    // ... processing logic
    res.json({ success: true, ... });
  } catch (error) {
    console.error('Batch processing error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Partial Failures**:

- Individual image failures don't stop batch
- Failed images included in response with `error` property
- Only successful images written to CSV
- Frontend can display mix of successes and failures

---

## Integration Point 2: Backend ↔ Cloudinary

### Technology

- **SDK**: `cloudinary` (^2.8.0)
- **Protocol**: HTTPS/REST (abstracted by SDK)
- **Authentication**: API key + secret (environment variables)
- **Purpose**: Temporary image hosting for AI analysis

### Configuration

```typescript
// src/cloudinary.ts
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
```

### Upload Flow

```typescript
// src/cloudinary.ts:12-25
const result = await cloudinary.uploader.upload(filePath, {
  folder: 'adobe_stock',
});

return {
  url: result.secure_url, // HTTPS URL for image
  publicId: result.public_id, // Unique identifier
};
```

**Data Flow**:

1. Backend has local image file in `images/` directory
2. Call `uploadImage(filePath)`
3. SDK uploads file to Cloudinary
4. Cloudinary processes and stores image
5. Returns secure HTTPS URL: `https://res.cloudinary.com/.../adobe_stock/abc123.jpg`
6. Returns public ID: `adobe_stock/abc123`
7. Backend uses URL for OpenAI analysis
8. Backend stores public ID for deletion

**Cloudinary Response Example**:

```javascript
{
  asset_id: "abc123...",
  public_id: "adobe_stock/xyz789",
  secure_url: "https://res.cloudinary.com/dxrruguzv/image/upload/v1762644108/adobe_stock/xyz789.jpg",
  format: "jpg",
  width: 4000,
  height: 3000,
  bytes: 5242880,
  created_at: "2025-11-08T12:30:00Z"
}
```

### Delete Flow

```typescript
// src/cloudinary.ts:27-38
const result = await cloudinary.uploader.destroy(publicId);

if (result.result === 'not found') {
  console.warn(`⚠️ Image not found: ${publicId}`);
} else {
  console.log(`🗑️ Image deleted: ${publicId}`);
}
```

**Data Flow**:

1. After OpenAI analysis complete
2. Call `deleteImage(publicId)`
3. SDK deletes image from Cloudinary
4. Cloudinary confirms deletion
5. Backend logs result (non-fatal if not found)

**Why Delete?**:

- Reduce Cloudinary storage costs
- Privacy (images not needed after metadata generated)
- Free tier limits: 25 GB storage

---

## 🎯 TARGET STATE: System Architecture Diagram (PRD-Aligned)

**Implementation:** Epic 1 (Stories 1.3-1.4) + Epic 3 (Story 3.3)

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          React Frontend (localhost:5173)               │ │
│  │  • client/src/app.tsx                                  │ │
│  │  • Drag & drop UI                                      │ │
│  │  │  • Image preview grid                                  │ │
│  │  • Real-time progress (SSE)                            │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP/JSON REST API
                       │ Vite Proxy: /api → :3000
                       ↓
┌─────────────────────────────────────────────────────────────┐
│            Express Backend (localhost:3000)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Routes (src/api/routes/)                          │ │
│  │  • POST /api/upload-images (batch processing)          │ │
│  │  • POST /api/generate-csv                              │ │
│  │  • POST /api/auth/signup|login                         │ │
│  │  • GET /api/usage                                      │ │
│  │  • GET /temp/{uuid}.jpg (4-6 sec lifetime) ⚡NEW       │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│  ┌───────────────────┴────────────────────────────────────┐ │
│  │  Services Layer (src/services/)                        │ │
│  │  • temp-url.service.ts ⚡NEW (self-hosted URLs)        │ │
│  │  • image-processing.service.ts (Sharp, UUID gen)       │ │
│  │  • ai-metadata.service.ts (OpenAI orchestration)       │ │
│  │  • parallel-processor.service.ts ⚡NEW (5 concurrent)  │ │
│  │  • csv-export.service.ts                               │ │
│  └────────────────────────────────────────────────────────┘ │
└──────┬──────────────────────────────────────┬───────────────┘
       │                                      │
       │ ❌ NO Cloudinary                     │ OpenAI SDK
       │ ✅ Self-hosted /temp URLs            │ (AI analysis)
       │ ✅ ZERO external image costs         │
       ↓                                      ↓
┌──────────────────┐                  ┌─────────────────────┐
│   /temp/ folder  │                  │    OpenAI GPT-5     │
│  (Express static)│                  │  (Vision API)       │
│  • UUID-based    │                  │  • Analyze image    │
│  • 4-6 sec life  │                  │  • Generate title   │
│  • Auto-cleanup  │                  │  • Generate keywords│
│  • HTTPS URLs    │                  │  • Categorize       │
└──────────────────┘                  └─────────────────────┘
```

### Key Changes from Legacy Architecture

| Component          | Current (Legacy)          | Target (PRD-Aligned)          | Story           |
| ------------------ | ------------------------- | ----------------------------- | --------------- |
| **Image Hosting**  | Cloudinary API            | Self-hosted /temp/            | Story 1.3       |
| **Cost per Image** | $0.001-0.002 (Cloudinary) | $0 (self-hosted)              | Story 1.4       |
| **Processing**     | Sequential (1 at a time)  | Parallel (5 concurrent)       | Story 3.3       |
| **Speed**          | 8-11s per image           | <2s per image (target)        | Story 3.3       |
| **Batch of 10**    | 80-100 seconds            | <40 seconds (target)          | Story 3.3       |
| **Architecture**   | Flat src/ structure       | Layered (api/services/models) | Stories 1.1-1.2 |
| **Dependencies**   | Cloudinary SDK required   | No external image hosting     | Story 1.4       |

---

## TARGET: Integration Point 2 (Self-Hosted Temp URLs)

### Technology

- **No External Service** - Images served from Express backend
- **Protocol:** HTTPS (required for OpenAI Vision API)
- **Storage:** Temporary filesystem storage (/temp directory)
- **Security:** UUID-based filenames (cryptographically random)
- **Lifecycle:** 4-6 seconds (create → OpenAI processing → delete)

### Self-Hosted URL Flow (Story 1.3)

```typescript
// src/services/temp-url.service.ts
import crypto from 'crypto';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export async function createTempUrl(uploadedFilePath: string): Promise<string> {
  // 1. Generate secure UUID
  const uuid = crypto.randomUUID();
  const tempFileName = `${uuid}.jpg`;
  const tempPath = path.join('temp', tempFileName);

  // 2. Compress image with Sharp (1024px, 85% quality)
  await sharp(uploadedFilePath)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(tempPath);

  // 3. Generate public HTTPS URL
  const baseUrl = process.env.PUBLIC_URL; // e.g., https://myapp.railway.app
  const publicUrl = `${baseUrl}/temp/${tempFileName}`;

  // 4. Schedule cleanup after 10 seconds
  setTimeout(() => cleanupTempFile(uuid), 10000);

  return publicUrl;
}

function cleanupTempFile(uuid: string): void {
  const tempPath = path.join('temp', `${uuid}.jpg`);
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
    console.log(`🗑️ Cleaned up temp file: ${uuid}.jpg`);
  }
}
```

**Data Flow:**

1. User uploads image → saved to `uploads/`
2. Backend calls `createTempUrl(filePath)`
3. Sharp compresses image → saves to `temp/{uuid}.jpg`
4. Express serves `/temp` as static directory
5. Public HTTPS URL generated: `https://domain.com/temp/{uuid}.jpg`
6. URL sent to OpenAI Vision API
7. OpenAI downloads image from our server (4-6 seconds)
8. Metadata received
9. Temp file auto-deleted (10-second timer)

**Cost Comparison:**

- **Legacy (Cloudinary):** $0.001-0.002 per image upload + bandwidth
- **Target (Self-hosted):** $0 per image (only server hosting costs)
- **Savings at scale:** 10,000 images/month = $10-20/month saved

**Security:**

- UUIDs prevent enumeration attacks (no sequential IDs)
- Short lifetime prevents long-term exposure
- Auto-cleanup prevents storage bloat
- No image content stored after processing

---

## TARGET: Integration Point 3 (Parallel Processing)

### Technology (Story 3.3)

- **Concurrency Library:** `p-limit` (npm package)
- **Concurrent Processes:** 5 simultaneous image processing tasks
- **Error Handling:** Individual failures don't block batch
- **Performance Target:** <2 seconds per image average

### Parallel Processing Flow

```typescript
// src/services/parallel-processor.service.ts
import pLimit from 'p-limit';

const limit = pLimit(5); // 5 concurrent processes

export async function processBatchParallel(imagePaths: string[]): Promise<MetadataResult[]> {
  const promises = imagePaths.map(imagePath =>
    limit(async () => {
      try {
        // 1. Create temp URL (self-hosted)
        const tempUrl = await createTempUrl(imagePath);

        // 2. Generate metadata with OpenAI (parallel)
        const metadata = await generateMetadata(tempUrl);

        // 3. Cleanup temp file
        await cleanupTempFile(tempUrl);

        return { success: true, ...metadata };
      } catch (error) {
        return { success: false, error: error.message, fileName: imagePath };
      }
    })
  );

  return await Promise.all(promises);
}
```

**Performance Comparison:**

| Metric               | Legacy (Sequential)   | Target (Parallel) | Improvement        |
| -------------------- | --------------------- | ----------------- | ------------------ |
| Per image            | 8-11s                 | <2s               | **4-5x faster**    |
| Batch of 10          | 80-100s               | <40s              | **2.5x faster**    |
| Batch of 100         | 800-1000s (13-16 min) | <400s (<7 min)    | **2.5x faster**    |
| Concurrent processes | 1                     | 5                 | **5x parallelism** |

**Why 5 Concurrent?**

- OpenAI API rate limits: ~500 requests/minute (free tier)
- 5 concurrent = ~12 requests/minute (safe margin)
- Server CPU/memory constraints (Railway/Render free tier)
- Optimal balance: speed vs resource usage

---

## Integration Point 3: Backend ↔ OpenAI

### Technology

- **SDK**: `openai` (^6.8.1)
- **Model**: GPT-5-mini (vision-capable)
- **Protocol**: HTTPS/REST (abstracted by SDK)
- **Authentication**: API key (environment variable)
- **Purpose**: AI-powered metadata generation from images

### Configuration

```typescript
// src/openai.ts
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### Metadata Generation Flow

```typescript
// src/openai.ts:12-60
const response = await openai.chat.completions.create({
  model: 'gpt-5-nano',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: PROMPT_TEXT },
        {
          type: 'image_url',
          image_url: {
            url: imageUrl, // Cloudinary HTTPS URL
            detail: 'low', // Cost optimization
          },
        },
      ],
    },
  ],
  max_completion_tokens: 1000,
});

const responseText = response.choices[0].message.content;
```

**Data Flow**:

1. Backend has Cloudinary URL for image
2. Call `generateMetadata(url)`
3. SDK sends request to OpenAI:
   - Prompt text (instructions + categories)
   - Image URL (Cloudinary HTTPS)
   - Detail level: "low" (faster, cheaper)
4. OpenAI downloads image from Cloudinary
5. GPT-5-mini analyzes image
6. OpenAI returns JSON response
7. Backend parses JSON (handles markdown code blocks)
8. Returns metadata object

**OpenAI Response Example**:

````json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1731096000,
  "model": "gpt-5-nano",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "```json\n{\n  \"title\": \"Tropical Beach at Sunset\",\n  \"keywords\": \"beach, sunset, ocean, tropical, paradise, palm trees, vacation, travel, seascape, coastline\",\n  \"category\": 11\n}\n```"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 1024,
    "completion_tokens": 50,
    "total_tokens": 1074
  }
}
````

**JSON Parsing**:

- Checks for markdown code block: ` ```json ... ``` `
- Extracts JSON if found
- Falls back to parsing entire response
- Throws error if invalid JSON

---

## Integration Sequence Diagram

### Complete Processing Flow

```
User          Frontend         Backend          Cloudinary       OpenAI
 |               |                 |                 |              |
 | Select files  |                 |                 |              |
 |-------------->|                 |                 |              |
 |               |                 |                 |              |
 |               | POST /api/upload                  |              |
 |               |---------------->|                 |              |
 |               |                 | Save to uploads/|              |
 |               |<----------------|                 |              |
 |               | {file metadata} |                 |              |
 |               |                 |                 |              |
 | Enter initials|                 |                 |              |
 |-------------->|                 |                 |              |
 |               |                 |                 |              |
 | Click Generate|                 |                 |              |
 |-------------->|                 |                 |              |
 |               |                 |                 |              |
 |               | POST /api/process-batch           |              |
 |               |---------------->|                 |              |
 |               |                 |                 |              |
 |               |                 | Copy & rename   |              |
 |               |                 | uploads→images  |              |
 |               |                 |                 |              |
 |               |                 | For each image: |              |
 |               |                 |                 |              |
 |               |                 | Upload image    |              |
 |               |                 |---------------->|              |
 |               |                 |<----------------|              |
 |               |                 | {url, publicId} |              |
 |               |                 |                 |              |
 |               |                 | Wait 2 seconds  |              |
 |               |                 |                 |              |
 |               |                 | Analyze image   |              |
 |               |                 |------------------------------->|
 |               |                 |                 |              |
 |               |                 |                 | Download URL |
 |               |                 |                 |<-------------|
 |               |                 |                 |              |
 |               |                 |                 | AI Analysis  |
 |               |                 |                 |              |
 |               |                 |<-------------------------------|
 |               |                 | {title, keywords, category}    |
 |               |                 |                 |              |
 |               |                 | Delete image    |              |
 |               |                 |---------------->|              |
 |               |                 |<----------------|              |
 |               |                 |                 |              |
 |               |                 | Generate CSV    |              |
 |               |                 |                 |              |
 |               |<----------------|                 |              |
 |               | {metadataList,  |                 |              |
 |               |  csvFileName}   |                 |              |
 |               |                 |                 |              |
 |               | POST /api/export-csv              |              |
 |               |---------------->|                 |              |
 |               |<----------------|                 |              |
 |               | CSV file        |                 |              |
 |<--------------|                 |                 |              |
 | Download CSV  |                 |                 |              |
```

---

## Data Transformation Pipeline

### Image → Metadata → CSV

```
Input: _MG_7942.jpg (original filename, 8MB)
   ↓
1. Upload to server
   → uploads/1762644101662-515354661-_MG_7942.jpg
   ↓
2. Copy to images/
   → images/1762644101662-515354661-_MG_7942.jpg
   ↓
3. Rename
   → images/IMG_OY_20251108_1.jpg
   ↓
4. Upload to Cloudinary
   → https://res.cloudinary.com/.../adobe_stock/xyz789.jpg
   ↓
5. Send to OpenAI
   → Analyze image at URL
   ↓
6. Receive metadata
   → {
        title: "Sunset Beach with Palm Trees",
        keywords: "beach, sunset, ocean, tropical, paradise",
        category: 11
      }
   ↓
7. Write to CSV
   → csv_output/OY_1762644147709.csv
      Filename,Title,Keywords,Category,Releases
      IMG_OY_20251108_1.jpg,"Sunset Beach...","beach, sunset...",11,OY
   ↓
8. Download CSV
   → User receives CSV file
   ↓
9. Cleanup
   → Delete uploads/1762644101662-515354661-_MG_7942.jpg
```

---

## Environment Configuration

### Required Environment Variables

```env
# .env file (not committed to git)

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuv
```

### Configuration Loading

**Backend** (server.ts, src/):

```typescript
import dotenv from 'dotenv';
dotenv.config(); // Loads .env file

// Environment variables available:
process.env.OPENAI_API_KEY;
process.env.CLOUDINARY_CLOUD_NAME;
process.env.CLOUDINARY_API_KEY;
process.env.CLOUDINARY_API_SECRET;
```

**Frontend**: No environment variables needed (proxied through backend)

---

## Network Communication

### Development Mode

**Ports**:

- Frontend dev server: `5173` (Vite)
- Backend API server: `3000` (Express)

**Proxy Configuration** (vite.config.ts):

```typescript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

**Effect**:

- Frontend makes requests to `/api/upload`
- Vite proxies to `http://localhost:3000/api/upload`
- No CORS issues in development

---

### Production Mode

**Single Port**: `3000`

**Static File Serving**:

```typescript
// server.ts
app.use(express.static('dist')); // Serve built frontend

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});
```

**Effect**:

- Backend serves frontend files from `dist/`
- Frontend and API on same origin
- No proxy needed
- SPA routing works (all routes → index.html)

---

## Error Propagation

### Chain of Error Handling

```
Cloudinary API Error
    ↓
src/cloudinary.ts (logs + throws)
    ↓
server.ts (catches + includes in metadata)
    ↓
Frontend (displays in UI or lists error)
    ↓
User sees error message
```

**Example Error Flow**:

1. Image exceeds 10MB limit
2. Cloudinary returns 400 error
3. `src/cloudinary.ts` throws error
4. `server.ts` catches in try/catch
5. Adds to metadataList with `error` property
6. Returns in JSON response
7. Frontend displays "Error: File size too large"

**Non-Fatal Errors**:

- Individual image failures don't stop batch
- Successful images still processed
- CSV generated with successful images only
- Frontend shows mix of success/error states

---

## Performance Characteristics

### Latency Breakdown (Per Image)

| Step                      | Time       | Notes                |
| ------------------------- | ---------- | -------------------- |
| Frontend → Backend upload | 500ms - 2s | Network + file size  |
| Copy to images/           | <100ms     | Local filesystem     |
| Rename                    | <10ms      | Local filesystem     |
| Upload to Cloudinary      | 2-4s       | Network + image size |
| **Hardcoded delay**       | 2s         | CDN propagation wait |
| OpenAI analysis           | 3-5s       | API + AI processing  |
| Delete from Cloudinary    | <500ms     | API call             |
| Write to CSV              | <100ms     | Local filesystem     |
| **Total per image**       | **8-12s**  | Varies by file size  |

### Batch Performance

- **Sequential within batches**: One image at a time currently
- **Batch size**: All images in one request
- **10 images**: ~80-100 seconds
- **Optimization potential**: 5-10x faster (see IMPROVEMENT_PLAN.md)

---

## Security Considerations

### Authentication

- **Frontend ↔ Backend**: None (local development/trusted environment)
- **Backend ↔ Cloudinary**: API key + secret
- **Backend ↔ OpenAI**: API key

### Data Privacy

- Images temporarily stored on Cloudinary
- Deleted immediately after processing
- No permanent storage of user images
- CSV files stored locally (can be cleaned up)

### API Keys

- Stored in `.env` file (gitignored)
- Never exposed to frontend
- Backend acts as proxy

---

## Testing Integration Points

### API Endpoint Tests

```typescript
// tests/server.integration.test.ts
describe('POST /api/upload', () => {
  it('should upload image successfully', async () => {
    const response = await request(app).post('/api/upload').attach('image', 'test-image.jpg');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### External Service Mocking

- Cloudinary: Mock SDK calls
- OpenAI: Mock API responses
- Filesystem: Use temporary directories

---

## Improvement Opportunities

### Current Bottlenecks

1. **Sequential processing**: No parallelization
2. **Full image upload**: Should use thumbnails
3. **2-second delay**: Can be optimized/removed
4. **No retry logic**: Transient failures not handled

### Recommended Changes

(See IMPROVEMENT_PLAN.md for details)

1. Parallel processing (3-5 images at once)
2. Upload thumbnails to Cloudinary (8x faster)
3. Remove/reduce delay after upload
4. Add retry logic with exponential backoff
5. Implement real-time progress via WebSocket/SSE

---

---

## Migration Summary: Legacy → Target

### What Changes (Epic 1-3)

**Epic 1: Foundation Refactoring**

- ✅ Story 1.3: Implement self-hosted temp URL service
- ✅ Story 1.4: Remove Cloudinary SDK and dependencies
- ✅ Story 1.2: Refactor to layered architecture (api/services/models)

**Epic 3: Parallel Processing**

- ✅ Story 3.3: Implement `p-limit` with 5 concurrent processes
- ✅ Story 3.4: Update error handling for parallel execution
- ✅ Story 3.5: Performance optimization and benchmarking

### What Stays the Same

- Frontend React architecture (already implemented well)
- OpenAI integration pattern (just parallelized, not changed)
- CSV generation logic (no changes needed)
- Authentication strategy (will be added in Epic 6)
- Dark mode UI/UX (already excellent)

### Performance Impact

| Metric              | Before (Legacy)    | After (Target)    | User Impact                |
| ------------------- | ------------------ | ----------------- | -------------------------- |
| **Processing Time** | 8-11s/image        | <2s/image         | 4-5x faster feedback       |
| **Batch of 10**     | 80-100 seconds     | <40 seconds       | "3 minutes" → "30 seconds" |
| **Costs**           | $0.002/image       | $0/image          | 100% cost reduction        |
| **Free Tier**       | Not sustainable    | 100 images/month  | Competitive advantage      |
| **Scale Economics** | Linear cost growth | Fixed server cost | Profitable at scale        |

### Developer Migration Guide

**If starting NEW implementation:**

- Follow TARGET architecture from Epic 1 onwards
- Skip Cloudinary setup entirely
- Use `temp-url.service.ts` pattern from Story 1.3
- Use `parallel-processor.service.ts` pattern from Story 3.3

**If refactoring EXISTING code:**

- Complete Epic 1 Stories 1.1-1.7 (foundation)
- Story 1.3: Add temp URL service alongside Cloudinary
- Story 1.4: Switch image processing to temp URLs, then remove Cloudinary
- Epic 3 Story 3.3: Refactor sequential processing to parallel
- Test thoroughly at each step (integration tests in place)

---

**Integration Points**:

- **Current:** 3 (Frontend-Backend, Backend-Cloudinary, Backend-OpenAI)
- **Target:** 2 (Frontend-Backend, Backend-OpenAI) - Cloudinary eliminated

**Protocols**: HTTP/REST, JSON, Multipart form-data  
**Authentication**: API keys (environment variables)  
**Data Flow**: Upload → Process → Generate → Download

**Last Updated**: November 10, 2025 (Added Target State for PRD alignment)
