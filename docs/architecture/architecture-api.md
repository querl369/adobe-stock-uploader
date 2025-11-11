# Backend Architecture - Express API

## Executive Summary

The Adobe Stock Uploader backend is an Express-based REST API that orchestrates image processing through modular utility functions. It handles file uploads, coordinates with external services (Cloudinary, OpenAI), and generates Adobe Stock-compatible CSV files.

**⚠️ IMPORTANT: This document describes TWO architectures:**

1. **Current State (Legacy)** - Existing flat structure with Cloudinary
2. **Target State (PRD-Aligned)** - Layered architecture with self-hosted temp URLs

**Migration Path:** Epic 1 refactors to layered architecture and removes Cloudinary.

---

## Current State (Legacy) - Tech Stack

**Tech Stack**: Express 4, TypeScript, Node.js  
**Architecture**: RESTful API + Utility Modules (flat src/ structure)  
**External Services**: Cloudinary (image hosting), OpenAI (AI metadata)  
**File Operations**: Multer (upload), Sharp (processing), csv-writer (export)

---

## Target State (PRD-Aligned) - Tech Stack

**Tech Stack**: Express 4, TypeScript, Node.js  
**Architecture**: Layered (API → Services → Models)  
**External Services**: OpenAI (AI metadata only - Cloudinary removed)  
**File Operations**: Multer (upload), Sharp (compression), Self-hosted temp URLs  
**New Components**: Parallel processing (p-limit), PostgreSQL (user accounts)

---

## Technology Stack

### Core Framework

| Technology | Version | Purpose              |
| ---------- | ------- | -------------------- |
| Node.js    | 20+     | JavaScript runtime   |
| Express    | 4.18.2  | Web server framework |
| TypeScript | 5.8.2   | Type safety          |
| ts-node    | 10.9.2  | TypeScript execution |

### File Handling

| Technology | Version    | Purpose                     |
| ---------- | ---------- | --------------------------- |
| Multer     | 2.0.0-rc.4 | File upload middleware      |
| Sharp      | 0.33.5     | Image processing/conversion |
| csv-writer | 1.6.0      | CSV file generation         |

### External Services

| Technology     | Version | Purpose                 |
| -------------- | ------- | ----------------------- |
| OpenAI SDK     | 6.8.1   | AI metadata generation  |
| Cloudinary SDK | 2.8.0   | Temporary image hosting |

### Development

| Technology | Version | Purpose                  |
| ---------- | ------- | ------------------------ |
| dotenv     | 16.4.7  | Environment variables    |
| Vitest     | 4.0.8   | Testing framework        |
| Supertest  | 7.1.4   | HTTP integration testing |

---

## Architecture Pattern - Current State (Legacy)

### Flat Utility-Based Architecture

```
┌─────────────────────────────────────────┐
│         REST API Layer (server.ts)      │
│  • Express routes & middleware          │
│  • Request validation                   │
│  • Error handling                       │
│  • Response formatting                  │
└───────────────┬─────────────────────────┘
                │
┌───────────────┴─────────────────────────┐
│      Business Logic Layer (src/)        │
│  • src/cloudinary.ts (upload/delete)    │
│  • src/openai.ts (AI generation)        │
│  • src/files-manipulation.ts (rename)   │
│  • src/csv-writer.ts (CSV export)       │
│  • src/prompt-text.ts (AI prompt)       │
└───────────────┬─────────────────────────┘
                │
┌───────────────┴─────────────────────────┐
│    External Services & File System      │
│  • Cloudinary API                       │
│  • OpenAI API                           │
│  • Local filesystem (uploads/, images/) │
└─────────────────────────────────────────┘
```

**Issues with Current Architecture:**

- Flat `src/` structure mixes concerns (utilities + services)
- No clear separation for authentication, rate limiting
- Duplicate logic between `server.ts` and `src/index.ts`
- Cloudinary dependency adds external costs
- Sequential processing (bottleneck)
- No database layer for user accounts

---

## 🎯 TARGET Architecture Pattern (PRD-Aligned)

**Implementation:** Epic 1 (Stories 1.1-1.2)

### Layered Service-Oriented Architecture

```
┌───────────────────────────────────────────────────────┐
│              REST API Layer (server.ts)               │
│         • Express app initialization                  │
│         • Static file serving (dist/, temp/)          │
└───────────────────────┬───────────────────────────────┘
                        │
┌───────────────────────┴───────────────────────────────┐
│            Routes Layer (src/api/routes/)             │
│  • image.routes.ts (upload, process batch)            │
│  • csv.routes.ts (generate, download)                 │
│  • auth.routes.ts (signup, login, logout)             │
│  • user.routes.ts (profile, usage stats)              │
└───────────────────────┬───────────────────────────────┘
                        │
┌───────────────────────┴───────────────────────────────┐
│          Middleware Layer (src/api/middleware/)       │
│  • auth.middleware.ts (JWT validation)                │
│  • rate-limit.middleware.ts (cookie + IP limits)      │
│  • validation.middleware.ts (request validation)      │
│  • error-handler.middleware.ts (centralized errors)   │
└───────────────────────┬───────────────────────────────┘
                        │
┌───────────────────────┴───────────────────────────────┐
│          Services Layer (src/services/)               │
│  • temp-url.service.ts ⚡NEW (self-hosted URLs)       │
│  • image-processing.service.ts (Sharp, UUID)          │
│  • ai-metadata.service.ts (OpenAI orchestration)      │
│  • parallel-processor.service.ts ⚡NEW (5 concurrent) │
│  • csv-export.service.ts (Adobe Stock format)         │
│  • auth.service.ts (JWT, bcrypt)                      │
│  • usage-tracking.service.ts (quota management)       │
└───────────────────────┬───────────────────────────────┘
                        │
┌───────────────────────┴───────────────────────────────┐
│          Models Layer (src/models/)                   │
│  • user.model.ts (User, UserTier)                     │
│  • batch.model.ts (ProcessingBatch)                   │
│  • usage.model.ts (UsageTracking)                     │
│  • metadata.model.ts (ImageMetadata)                  │
└───────────────────────┬───────────────────────────────┘
                        │
┌───────────────────────┴───────────────────────────────┐
│          Data Layer (Database + Filesystem)           │
│  • PostgreSQL (users, batches, usage tracking)        │
│  • Filesystem (uploads/, temp/, csv_output/)          │
└───────────────────────┬───────────────────────────────┘
                        │
┌───────────────────────┴───────────────────────────────┐
│          External Services                            │
│  • OpenAI API (GPT-5-mini Vision)                     │
│  • ❌ NO Cloudinary (self-hosted instead)             │
└───────────────────────────────────────────────────────┘
```

### Key Architectural Improvements

| Concern                    | Legacy                | Target                           | Benefit                       |
| -------------------------- | --------------------- | -------------------------------- | ----------------------------- |
| **Separation of Concerns** | Mixed in flat src/    | Layered (routes/services/models) | Easier testing, maintenance   |
| **Authentication**         | None                  | JWT middleware + auth service    | User accounts, security       |
| **Rate Limiting**          | None                  | Cookie + IP middleware           | Abuse prevention              |
| **Error Handling**         | Ad-hoc try-catch      | Centralized middleware           | Consistent error responses    |
| **Image Hosting**          | Cloudinary (external) | Self-hosted /temp                | Zero per-image costs          |
| **Processing**             | Sequential (1x)       | Parallel (5x)                    | 4-5x faster processing        |
| **Database**               | None                  | PostgreSQL + Prisma              | User accounts, quota tracking |
| **Code Reuse**             | Duplicate logic       | Shared services                  | DRY principle                 |

---

## Module Structure

### API Server (`server.ts`)

**Lines**: 374  
**Purpose**: HTTP request handling and workflow orchestration

**Responsibilities**:

1. **HTTP Server**: Express app on port 3000
2. **Middleware**: JSON parsing, static files, file uploads
3. **API Endpoints**: 5 REST endpoints
4. **Orchestration**: Coordinates utility modules
5. **Error Handling**: Catches and formats errors
6. **Static Serving**: Serves frontend build in production

**Key Sections**:

```typescript
// Middleware setup (lines 56-72)
app.use(express.json());
app.use(express.static('dist'));
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// API Endpoints (lines 85-353)
POST /api/upload
POST /api/process-image
POST /api/process-batch
POST /api/export-csv
POST /api/cleanup

// SPA Fallback (lines 359-363)
GET * → dist/index.html
```

---

### Utility Modules (`src/`)

#### 1. Cloud Service Integration

**`src/cloudinary.ts`** (38 lines):

- Upload image to Cloudinary
- Delete image from Cloudinary
- Returns secure HTTPS URL and public ID

**`src/openai.ts`** (61 lines):

- Send image URL to OpenAI GPT-5-mini
- Parse JSON response (handles markdown code blocks)
- Return metadata object

---

#### 2. File Operations

**`src/files-manipulation.ts`** (74 lines):

- `convertPngToJpeg()`: Convert PNG → JPEG (Sharp)
- `renameImages()`: Standardize filenames
- Format: `IMG_{initials}_{date}_{counter}.{ext}`

**`src/csv-writer.ts`** (25 lines):

- Generate Adobe Stock CSV format
- Headers: Filename, Title, Keywords, Category, Releases
- UTF-8 encoding

---

#### 3. Configuration

**`src/prompt-text.ts`** (30 lines):

- OpenAI prompt template
- Adobe Stock category definitions
- Response format specification
- ⚠️ **Known issue**: Line 28 contains Easter bug

---

#### 4. CLI Processor

**`src/index.ts`** (77 lines):

- Standalone CLI version
- Batch processing with concurrency control
- Parallel processing (5 images at a time)
- Alternative to web interface

---

## API Endpoint Design

### REST API Specification

#### 1. POST /api/upload

**Purpose**: Upload single image file

**Request**:

```
Content-Type: multipart/form-data
Body: image=[File]
```

**Response** (200):

```json
{
  "success": true,
  "file": {
    "id": "1762644101662-515354661-_MG_7942.jpg",
    "name": "_MG_7942.jpg",
    "size": 5242880,
    "path": "uploads/1762644101662-515354661-_MG_7942.jpg"
  }
}
```

**Implementation**:

```typescript
app.post('/api/upload', upload.single('image'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  res.json({ success: true, file: {...} });
});
```

---

#### 2. POST /api/process-batch

**Purpose**: Process all uploaded images and generate CSV

**Request**:

```json
{
  "initials": "OY"
}
```

**Response** (200):

```json
{
  "success": true,
  "metadataList": [
    {
      "fileName": "IMG_OY_20251108_1.jpg",
      "title": "Sunset Beach",
      "keywords": "beach, sunset, ocean",
      "category": 11
    },
    {
      "fileName": "IMG_OY_20251108_2.jpg",
      "error": "File size too large"
    }
  ],
  "csvFileName": "OY_1762644147709.csv"
}
```

**Implementation Flow**:

1. Clean `images/` directory
2. Validate `uploads/` has files
3. Copy `uploads/` → `images/`
4. Rename with initials and date
5. **For each image**:
   - Upload to Cloudinary → get URL
   - Wait 2 seconds (CDN propagation)
   - Generate metadata via OpenAI
   - Delete from Cloudinary
   - Add to results (success or error)
6. Filter successful metadata
7. Generate CSV file
8. Clean `uploads/` directory
9. Return results + CSV filename

**Error Handling**:

- Individual failures don't stop batch
- Failed images included with `error` property
- Only successful images in CSV

---

#### 3. POST /api/export-csv

**Purpose**: Download generated CSV file

**Request**:

```json
{
  "csvFileName": "OY_1762644147709.csv"
}
```

**Response** (200):

```
Content-Type: text/csv
Content-Disposition: attachment; filename="OY_1762644147709.csv"

[CSV content]
```

**Implementation**:

```typescript
app.post('/api/export-csv', (req, res) => {
  const { csvFileName } = req.body;
  const csvPath = path.join('csv_output', csvFileName);

  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({ error: 'CSV file not found' });
  }

  res.download(csvPath, csvFileName);
});
```

---

#### 4. POST /api/cleanup

**Purpose**: Delete temporary files

**Request**: Empty body

**Response** (200):

```json
{
  "success": true,
  "message": "Cleanup completed"
}
```

**Implementation**:

- Delete all files in `uploads/`
- Delete all files in `images/`
- Preserve directory structure

---

### 5. GET \* (SPA Fallback)

**Purpose**: Serve frontend for client-side routing

**Implementation**:

```typescript
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});
```

---

## Data Flow & Processing Pipeline

### Batch Processing Workflow

```
1. API Request
   POST /api/process-batch { initials: "OY" }
      ↓
2. Clean Working Directory
   • Delete old files in images/
      ↓
3. Validate Uploads
   • Check uploads/ has image files
   • Return 400 if empty
      ↓
4. Copy Files
   uploads/ → images/
   • Preserve original filenames initially
      ↓
5. Rename Files
   src/files-manipulation.ts::renameImages()
   • _MG_7942.jpg → IMG_OY_20251108_1.jpg
   • landscape.png → IMG_OY_20251108_2.png
      ↓
6. Process Each Image (Sequential Loop)
   ├─> Upload to Cloudinary
   │   src/cloudinary.ts::uploadImage()
   │   Returns: { url, publicId }
   │
   ├─> Wait 2 seconds
   │   await setTimeout(2000)
   │   (CDN propagation)
   │
   ├─> Generate Metadata
   │   src/openai.ts::generateMetadata(url)
   │   Returns: { title, keywords, category }
   │
   └─> Delete from Cloudinary
       src/cloudinary.ts::deleteImage(publicId)
      ↓
7. Generate CSV
   src/csv-writer.ts::writeMetadataToCSV()
   • Filter successful metadata
   • Write to csv_output/{initials}_{timestamp}.csv
      ↓
8. Cleanup
   • Delete files from uploads/
      ↓
9. Return Response
   { metadataList, csvFileName }
```

---

## File System Architecture

### Directory Structure

```
project-root/
├── uploads/                    # Temporary upload storage
│   └── [timestamp]-[random]-[filename]
│
├── images/                     # Processing directory
│   └── IMG_{initials}_{date}_{n}.{ext}
│
├── csv_output/                 # Generated CSV files
│   └── {initials}_{timestamp}.csv
│
└── dist/                       # Frontend build (served in prod)
    ├── index.html
    └── assets/
```

### Directory Management

**Auto-Creation** (`server.ts:74-79`):

```typescript
['uploads', 'images', 'csv_output'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
```

**Lifecycle**:

1. **Mount**: Create directories if missing
2. **Upload**: Save to `uploads/`
3. **Process**: Copy to `images/`, rename
4. **Generate**: Write CSV to `csv_output/`
5. **Cleanup**: Delete `uploads/` and optionally `images/`

---

## External Service Integration

### Cloudinary Integration

**Purpose**: Temporary image hosting for AI analysis

**Configuration**:

```typescript
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
```

**Upload**:

```typescript
const result = await cloudinary.uploader.upload(filePath, {
  folder: 'adobe_stock',
});
// Returns: { secure_url, public_id, ... }
```

**Delete**:

```typescript
await cloudinary.uploader.destroy(publicId);
```

**Free Tier Limits**:

- Max file size: 10MB
- Storage: 25 GB
- Bandwidth: 25 GB/month
- Requests: 500/hour

---

### OpenAI Integration

**Purpose**: AI-powered metadata generation

**Model**: GPT-5-mini (vision-capable)

**Configuration**:

```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

**Request**:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-5-mini',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: PROMPT_TEXT },
        {
          type: 'image_url',
          image_url: {
            url: cloudinaryUrl,
            detail: 'low', // Cost optimization
          },
        },
      ],
    },
  ],
  max_completion_tokens: 1000,
});
```

**Response Parsing**:

1. Extract content from `choices[0].message.content`
2. Check for markdown code block: ` ```json ... ``` `
3. Parse JSON from code block or full response
4. Return metadata object

---

## Error Handling Strategy

### Error Categories

#### 1. Client Errors (400)

```typescript
if (!file) {
  return res.status(400).json({ error: 'No file uploaded' });
}

if (!initials) {
  return res.status(400).json({ error: 'Initials are required' });
}

if (uploadedFiles.length === 0) {
  return res.status(400).json({
    error: 'No image files found in uploads directory',
  });
}
```

#### 2. Not Found Errors (404)

```typescript
if (!fs.existsSync(filePath)) {
  return res.status(404).json({ error: 'File not found' });
}

if (!fs.existsSync(csvPath)) {
  return res.status(404).json({ error: 'CSV file not found' });
}
```

#### 3. Server Errors (500)

```typescript
try {
  // Processing logic
} catch (error) {
  console.error('Processing error:', error);
  res.status(500).json({ error: error.message });
}
```

#### 4. Partial Failures (200 with errors)

```typescript
// Individual image failures
metadataList.push({
  fileName: file,
  error: error.message,
});

// Success response includes errors
res.json({ success: true, metadataList });
```

---

## Performance Characteristics

### Current Performance

**Per Image**:
| Operation | Time |
|-----------|------|
| Copy to images/ | <100ms |
| Rename | <10ms |
| Upload to Cloudinary | 2-4s |
| Wait (hardcoded) | 2s |
| OpenAI analysis | 3-5s |
| Delete from Cloudinary | <500ms |
| **Total** | **8-11s** |

**Batch of 10 images**: ~80-100 seconds (sequential)

### Bottlenecks

1. **Sequential Processing**: One image at a time
2. **Full Image Upload**: 8MB images slow
3. **2-Second Delay**: Hardcoded wait time
4. **No Retry Logic**: Transient failures fatal

### Optimization Opportunities

See `IMPROVEMENT_PLAN.md` for detailed recommendations:

1. Parallel processing (5x faster)
2. Upload thumbnails (8x faster uploads)
3. Remove/reduce delay (20% time savings)
4. Implement retry logic (handle transient failures)

---

## Security Considerations

### Authentication & Authorization

**Current State**: ❌ No authentication

**Risks**:

- Public API access
- No rate limiting
- No user tracking
- Potential abuse

**Recommendations**:

- API key authentication
- Rate limiting (express-rate-limit)
- User sessions
- CORS restrictions

---

### Input Validation

**File Uploads**:

```typescript
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});
```

**File Type Validation**:

```typescript
const imageFiles = fs
  .readdirSync('uploads')
  .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i));
```

**Path Validation**:

- Uses `path.join()` to prevent directory traversal
- Validates file existence before operations

---

### Environment Variables

**Required**:

```env
OPENAI_API_KEY=sk-proj-...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

**Security**:

- Stored in `.env` file (gitignored)
- Never exposed to frontend
- Loaded via dotenv on startup

---

## Testing Strategy

### Test Coverage

**Integration Tests** (`tests/server.integration.test.ts`):

- API endpoint testing
- Request/response validation
- Error handling verification

**Unit Tests**:

- `tests/openai.test.ts` - OpenAI integration
- `tests/csv-writer.test.ts` - CSV generation
- `tests/files-manipulation.test.ts` - File operations

**Test Framework**: Vitest + Supertest

**Example**:

```typescript
describe('POST /api/upload', () => {
  it('should upload image successfully', async () => {
    const response = await request(app).post('/api/upload').attach('image', 'test.jpg');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

---

## Deployment

### Development Mode

```bash
npm run dev:server
# → ts-node server.ts
# Port: 3000
# Hot reload: Manual restart
```

### Production Mode

```bash
npm start
# → npm run build && ts-node server.ts
# Serves: dist/ (frontend) + API
# Port: 3000
```

### Environment Setup

**Prerequisites**:

- Node.js 20+
- npm 8+
- Environment variables configured

**Directory Structure**:

```
/app/
├── server.ts
├── src/
├── dist/              # Built frontend
├── uploads/           # Created automatically
├── images/            # Created automatically
├── csv_output/        # Created automatically
└── node_modules/
```

---

## Monitoring & Logging

### Console Logging

**Server Startup**:

```
🚀 Adobe Stock Uploader is running!
📱 Open your browser and go to: http://localhost:3000

Press Ctrl+C to stop the server
```

**Processing Logs**:

```
🧹 Cleaning images directory...
📂 Checking uploads directory...
   Found 2 files in uploads: [...]
📋 Copying files to images directory...
   ✅ Copied: file.jpg
✅ Renamed: file.jpg ➜ IMG_OY_20251108_1.jpg
Processing 2 images in batch...
[1/2] Processing IMG_OY_20251108_1.jpg...
✅ Uploaded to Cloudinary: https://...
✅ Generated metadata for IMG_OY_20251108_1.jpg
🗑️ Image deleted successfully.
✅ CSV file created: OY_1762644147709.csv
```

**Recommendations**:

- Structured logging (Winston, Pino)
- Log levels (DEBUG, INFO, WARN, ERROR)
- Log rotation
- Error tracking (Sentry)

---

## Future Enhancements

### High Priority

1. **Authentication** (See IMPROVEMENT_PLAN.md)
   - API key system
   - Rate limiting
   - User sessions

2. **Performance** (See IMPROVEMENT_PLAN.md Section 1-3)
   - Parallel processing
   - Thumbnail uploads
   - Optimize delays

3. **Error Handling**
   - Retry logic with exponential backoff
   - Better error messages
   - Partial batch recovery

### Medium Priority

4. **Real-Time Updates** (See IMPROVEMENT_PLAN.md Section 2)
   - Server-Sent Events
   - WebSocket support
   - Live progress updates

5. **Queue System**
   - Background job processing
   - Redis queue (Bull)
   - Job status tracking

6. **Caching**
   - Cache OpenAI responses
   - Reduce API costs
   - Faster retries

---

## Dependencies

### Production

```json
{
  "express": "^4.18.2",
  "multer": "^2.0.0-rc.4",
  "sharp": "^0.33.5",
  "csv-writer": "^1.6.0",
  "cloudinary": "^2.8.0",
  "openai": "^6.8.1",
  "dotenv": "^16.4.7",
  "ts-node": "^10.9.2",
  "typescript": "^5.8.2"
}
```

### Development

```json
{
  "vitest": "^4.0.8",
  "supertest": "^7.1.4",
  "@types/express": "^4.17.21",
  "@types/multer": "^1.4.11",
  "@types/node": "^22.13.11"
}
```

---

---

## Migration Summary: Legacy → Target Architecture

### Epic 1: Foundation Refactoring (Stories 1.1-1.7)

**Story 1.1: Architecture Audit**

- Document current structure and identify gaps
- Create refactoring plan for layered architecture

**Story 1.2: Directory Structure Setup**

- Create `src/api/routes/`, `src/api/middleware/`, `src/services/`, `src/models/`
- Migrate existing utilities to appropriate layers
- Configure TypeScript path aliases

**Story 1.3: Self-Hosted Temp URLs**

- Create `temp-url.service.ts` for UUID-based image hosting
- Express serves `/temp` as static directory
- Auto-cleanup after 10 seconds

**Story 1.4: Remove Cloudinary**

- Delete `src/cloudinary.ts`
- Remove Cloudinary SDK from dependencies
- Update all image processing to use `temp-url.service.ts`

**Story 1.5: Database Setup**

- PostgreSQL + Prisma configuration
- Schema for users, batches, usage tracking
- Connection pooling and migrations

**Story 1.6: Error Handling Infrastructure**

- Centralized error handler middleware
- Custom error classes (ValidationError, AuthenticationError, etc.)
- Structured logging service

**Story 1.7: Deployment Configuration**

- Environment configuration for Railway/Render
- HTTPS setup and validation
- Health check endpoints

### File Structure Transformation

**Before (Legacy):**

```
src/
├── cloudinary.ts (38 lines)
├── openai.ts (61 lines)
├── files-manipulation.ts (74 lines)
├── csv-writer.ts (25 lines)
├── prompt-text.ts (30 lines)
└── index.ts (77 lines)
server.ts (374 lines)
```

**After (Target - Epic 1 Complete):**

```
src/
├── api/
│   ├── routes/
│   │   ├── image.routes.ts
│   │   ├── csv.routes.ts
│   │   ├── auth.routes.ts
│   │   └── user.routes.ts
│   └── middleware/
│       ├── auth.middleware.ts
│       ├── rate-limit.middleware.ts
│       ├── validation.middleware.ts
│       └── error-handler.middleware.ts
├── services/
│   ├── temp-url.service.ts ⚡NEW
│   ├── image-processing.service.ts (refactored from files-manipulation.ts)
│   ├── ai-metadata.service.ts (refactored from openai.ts)
│   ├── parallel-processor.service.ts ⚡NEW (Epic 3)
│   ├── csv-export.service.ts (refactored from csv-writer.ts)
│   ├── auth.service.ts ⚡NEW
│   └── usage-tracking.service.ts ⚡NEW
├── models/
│   ├── user.model.ts ⚡NEW
│   ├── batch.model.ts ⚡NEW
│   ├── usage.model.ts ⚡NEW
│   └── metadata.model.ts
├── utils/
│   ├── prompt-text.ts (preserved)
│   ├── logger.ts ⚡NEW
│   └── errors.ts ⚡NEW
└── config/
    ├── database.ts ⚡NEW
    ├── openai.ts ⚡NEW
    └── environment.ts ⚡NEW
server.ts (simplified, delegates to routes/)
```

### API Endpoints Transformation

**Before (Legacy - All in server.ts):**

- `POST /api/upload` (single file)
- `POST /api/process-batch` (sequential)
- `POST /api/export-csv`
- `POST /api/cleanup`

**After (Target - Epic 2 Complete):**

- `POST /api/upload-images` (batch, parallel) ⚡CHANGED
- `POST /api/generate-csv`
- `POST /api/auth/signup` ⚡NEW
- `POST /api/auth/login` ⚡NEW
- `GET /api/usage` ⚡NEW
- `GET /temp/{uuid}.jpg` ⚡NEW (self-hosted)

### Performance Comparison

| Metric           | Legacy     | Target           | Implementation                        |
| ---------------- | ---------- | ---------------- | ------------------------------------- |
| **Per Image**    | 8-11s      | <2s              | Epic 3, Story 3.3 (parallel)          |
| **Batch of 10**  | 80-100s    | <40s             | Epic 3, Story 3.3                     |
| **Cost/Image**   | $0.002     | $0               | Epic 1, Stories 1.3-1.4 (self-hosted) |
| **Free Tier**    | Not viable | 100 images/month | Cost elimination enables this         |
| **Architecture** | Flat       | Layered          | Epic 1, Stories 1.1-1.2               |

### Developer Checklist

**When implementing Epic 1:**

- [ ] Run Story 1.1 (architecture audit) to understand current state
- [ ] Complete Story 1.2 (directory setup) before other stories
- [ ] Test Story 1.3 (temp URLs) thoroughly before Story 1.4
- [ ] Only remove Cloudinary (Story 1.4) after temp URLs work
- [ ] Set up database (Story 1.5) early to enable Epic 6 (accounts)
- [ ] Implement error handling (Story 1.6) to catch migration issues
- [ ] Validate deployment (Story 1.7) after each major change

**When implementing Epic 3:**

- [ ] Complete Epic 1 first (layered architecture required)
- [ ] Benchmark performance before and after parallelization
- [ ] Ensure error handling works with parallel processing
- [ ] Test with various batch sizes (1, 10, 50, 100 images)
- [ ] Validate OpenAI rate limits not exceeded (5 concurrent is safe)

---

**Architecture Type**:

- **Current:** Flat REST API with Utility Modules
- **Target:** Layered Service-Oriented Architecture

**Lines of Code**:

- **Current:** ~374 (server.ts) + ~305 (src/) = ~679 total
- **Target:** ~200 (server.ts) + ~1,200 (src/\*) = ~1,400 total (better organized)

**API Endpoints**:

- **Current:** 5 endpoints
- **Target:** 8 endpoints (adds auth, usage tracking, temp URLs)

**External Services**:

- **Current:** 2 (Cloudinary, OpenAI)
- **Target:** 1 (OpenAI only - Cloudinary eliminated)

**File Operations**: Upload, Process (Parallel), Export

**Last Updated**: November 10, 2025 (Added Target State for PRD alignment)
