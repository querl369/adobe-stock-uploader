# API Contracts - Backend API

## Overview

The Adobe Stock Uploader backend provides a REST API for image processing and metadata generation. All endpoints follow RESTful conventions and return JSON responses.

**Base URL**: `http://localhost:3000/api`

## API Endpoints

### 1. Upload Image

**Endpoint**: `POST /api/upload`

**Description**: Uploads a single image file to the server for later processing.

**Request**:

- Content-Type: `multipart/form-data`
- Body Parameter:
  - `image` (file, required): Image file to upload

**Response** (200 OK):

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

**Error Response** (400):

```json
{
  "error": "No file uploaded"
}
```

**Error Response** (500):

```json
{
  "error": "Error message details"
}
```

---

### 2. Process Single Image

**Endpoint**: `POST /api/process-image`

**Description**: Processes a single uploaded image through Cloudinary and OpenAI to generate metadata.

**Request**:

- Content-Type: `application/json`
- Body:

```json
{
  "fileId": "1762644101662-515354661-_MG_7942.jpg",
  "filename": "_MG_7942.jpg"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "filename": "_MG_7942.jpg",
  "title": "Sunset Beach with Palm Trees",
  "keywords": "beach, ocean, sunset, palm trees, tropical, paradise, vacation",
  "category": 11
}
```

**Error Response** (404):

```json
{
  "error": "File not found"
}
```

**Error Response** (500):

```json
{
  "success": false,
  "error": "OpenAI API error",
  "filename": "_MG_7942.jpg"
}
```

**Processing Flow**:

1. Validates file exists in uploads directory
2. Uploads image to Cloudinary (temporary storage)
3. Sends Cloudinary URL to OpenAI Vision API for metadata generation
4. Deletes image from Cloudinary
5. Returns generated metadata

---

### 3. Process Batch

**Endpoint**: `POST /api/process-batch`

**Description**: Processes all uploaded images in batch, generates metadata for each, creates a CSV file, and cleans up temporary files.

**Request**:

- Content-Type: `application/json`
- Body:

```json
{
  "initials": "OY"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "metadataList": [
    {
      "fileName": "IMG_OY_20251108_1.jpg",
      "title": "Mountain Landscape at Dawn",
      "keywords": "mountain, landscape, dawn, nature, scenery",
      "category": 11
    },
    {
      "fileName": "IMG_OY_20251108_2.jpg",
      "title": "Urban Architecture Modern Building",
      "keywords": "architecture, building, modern, urban, city",
      "category": 2
    },
    {
      "fileName": "IMG_OY_20251108_3.jpg",
      "error": "File size too large. Got 13553195. Maximum is 10485760."
    }
  ],
  "csvFileName": "OY_1762644147709.csv"
}
```

**Error Response** (400):

```json
{
  "error": "Initials are required"
}
```

**Error Response** (400):

```json
{
  "error": "No files uploaded yet. Please upload images first."
}
```

**Error Response** (500):

```json
{
  "error": "Batch processing error message"
}
```

**Processing Flow**:

1. Cleans images directory of any old files
2. Validates uploads directory has image files
3. Copies files from uploads/ to images/
4. Renames images with pattern `IMG_{initials}_{date}_{counter}.{ext}`
5. For each image:
   - Uploads to Cloudinary
   - Waits 2 seconds for Cloudinary processing
   - Generates metadata via OpenAI
   - Deletes from Cloudinary
   - Adds to metadata list (or error)
6. Generates CSV file with successful metadata
7. Cleans up uploads directory
8. Returns metadata list and CSV filename

**Important Notes**:

- Images are renamed with user initials and timestamp
- Failed images are included in response with error property
- Only successful images are included in CSV
- 2-second delay between upload and metadata generation (Cloudinary CDN propagation)

---

### 4. Export CSV

**Endpoint**: `POST /api/export-csv`

**Description**: Downloads the generated CSV file containing metadata for all processed images.

**Request**:

- Content-Type: `application/json`
- Body:

```json
{
  "csvFileName": "OY_1762644147709.csv"
}
```

**Response** (200 OK):

- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="OY_1762644147709.csv"`
- Body: CSV file download

**CSV Format**:

```csv
Filename,Title,Keywords,Category,Releases
IMG_OY_20251108_1.jpg,"Mountain Landscape at Dawn","mountain, landscape, dawn, nature, scenery",11,OY
IMG_OY_20251108_2.jpg,"Urban Architecture Modern Building","architecture, building, modern, urban, city",2,OY
```

**Error Response** (400):

```json
{
  "error": "CSV filename is required"
}
```

**Error Response** (404):

```json
{
  "error": "CSV file not found"
}
```

---

### 5. Cleanup

**Endpoint**: `POST /api/cleanup`

**Description**: Removes all temporary files from uploads/ and images/ directories.

**Request**:

- Content-Type: `application/json`
- Body: (empty)

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Cleanup completed"
}
```

**Error Response** (500):

```json
{
  "error": "Cleanup error message"
}
```

**Cleanup Actions**:

- Deletes all files in `uploads/` directory
- Deletes all files in `images/` directory
- Preserves directory structure

---

## Data Models

### UploadedFile

```typescript
interface UploadedFile {
  id: string; // Unique filename with timestamp
  name: string; // Original filename
  size: number; // File size in bytes
  path: string; // Server path to file
}
```

### ProcessResult

```typescript
interface ProcessResult {
  success: boolean; // Processing success/failure
  filename: string; // Image filename
  title?: string; // Generated title (if successful)
  keywords?: string; // Comma-separated keywords (if successful)
  category?: string; // Adobe Stock category number (if successful)
  error?: string; // Error message (if failed)
}
```

### MetadataItem

```typescript
interface MetadataItem {
  filename: string; // Image filename
  title: string; // Generated title
  keywords: string; // Comma-separated keywords
  category: string; // Adobe Stock category number
  releases?: string; // User initials
}
```

---

## Adobe Stock Categories

The API uses Adobe Stock's category system:

| Category | Description                |
| -------- | -------------------------- |
| 1        | Animals                    |
| 2        | Buildings and Architecture |
| 3        | Business                   |
| 4        | Drinks                     |
| 5        | The Environment            |
| 6        | States of Mind             |
| 7        | Food                       |
| 8        | Graphic Resources          |
| 9        | Hobbies and Leisure        |
| 10       | Industry                   |
| 11       | Landscape                  |
| 12       | Lifestyle                  |
| 13       | People                     |
| 14       | Plants and Flowers         |
| 15       | Culture and Religion       |
| 16       | Science                    |
| 17       | Social Issues              |
| 18       | Sports                     |
| 19       | Technology                 |
| 20       | Transport                  |
| 21       | Travel                     |

---

## Error Handling

### Common Error Scenarios

1. **File Upload Errors**
   - Status: 400 Bad Request
   - Cause: No file provided, invalid file type
   - Resolution: Ensure file is selected and is an image

2. **File Size Errors**
   - Status: 400 Bad Request (from Cloudinary)
   - Cause: Image exceeds 10MB limit (Cloudinary free tier)
   - Resolution: Compress or resize image before upload

3. **OpenAI API Errors**
   - Status: 500 Internal Server Error
   - Cause: API timeout, rate limit, invalid API key
   - Resolution: Retry after delay, check API key configuration

4. **File Not Found**
   - Status: 404 Not Found
   - Cause: File was deleted or never existed
   - Resolution: Re-upload image

5. **Batch Processing Partial Failures**
   - Status: 200 OK (with errors in metadata list)
   - Cause: Individual image processing failures
   - Response: Includes error property for failed images

---

## Rate Limits

- **Multer File Upload**: 50MB per file
- **Cloudinary (Free Tier)**:
  - 10MB max file size
  - 500 requests/hour
- **OpenAI GPT-5-mini**:
  - Tier 1: 3,500 requests/minute
  - No strict rate limiting implemented in API

**Recommendation**: For large batches (>50 images), consider implementing client-side rate limiting or backend queuing.

---

## Authentication

Currently, the API does not implement authentication. All endpoints are publicly accessible when the server is running.

**Security Note**: In production, consider adding:

- API key authentication
- CORS restrictions
- Request rate limiting
- File type validation
- Virus scanning for uploads

---

## Testing

### Manual Testing with curl

**Upload Image**:

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "image=@path/to/image.jpg"
```

**Process Batch**:

```bash
curl -X POST http://localhost:3000/api/process-batch \
  -H "Content-Type: application/json" \
  -d '{"initials": "OY"}'
```

**Export CSV**:

```bash
curl -X POST http://localhost:3000/api/export-csv \
  -H "Content-Type: application/json" \
  -d '{"csvFileName": "OY_1762644147709.csv"}' \
  -o output.csv
```

### Automated Testing

Test files located in `tests/`:

- `server.integration.test.ts` - API endpoint integration tests
- `openai.test.ts` - OpenAI integration tests
- `csv-writer.test.ts` - CSV generation tests

---

## Dependencies

### Core API Dependencies

- **express** (^4.18.2): Web server framework
- **multer** (^2.0.0-rc.4): File upload handling
- **dotenv** (^16.4.7): Environment variable management

### Integration Dependencies

- **cloudinary** (^2.8.0): Temporary image hosting
- **openai** (^6.8.1): AI metadata generation
- **sharp** (^0.33.5): Image processing
- **csv-writer** (^1.6.0): CSV file generation

---

## Performance Considerations

### Current Performance

- Sequential processing: ~8-10 seconds per image
- Batch of 10 images: ~80-100 seconds

### Performance Bottlenecks

1. **Cloudinary Upload**: ~2-4 seconds per image
2. **2-second delay**: Hardcoded wait for CDN propagation
3. **OpenAI API**: ~3-5 seconds per image
4. **Sequential processing**: No parallelization

### Optimization Opportunities

(See IMPROVEMENT_PLAN.md for detailed recommendations)

1. Upload image thumbnails instead of full size (8x faster)
2. Parallel processing (3-5x speed improvement)
3. Optimize Cloudinary delay (remove or reduce)
4. Batch OpenAI requests

---

**Last Updated**: November 9, 2025  
**API Version**: 1.0.0  
**Server**: Express + TypeScript
