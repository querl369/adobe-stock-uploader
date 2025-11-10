# Backend Utilities Documentation

## Overview

The `src/` directory contains modular utility functions that handle core business logic for the Adobe Stock Uploader application. Each file has a single responsibility, making the codebase maintainable and testable.

---

## Utility Modules

### 1. OpenAI Integration (`src/openai.ts`)

**Purpose**: Handles AI-powered metadata generation using OpenAI's GPT-5-mini vision model.

**Dependencies**:

- `openai` (^6.8.1)
- `dotenv` (^16.4.7)
- `./prompt-text.ts`

**Functions**:

#### `generateMetadata(imageUrl: string): Promise<any>`

Generates Adobe Stock metadata (title, keywords, category) from an image URL.

**Parameters**:

- `imageUrl` (string): Cloudinary URL of the image to analyze

**Returns**:

```typescript
Promise<{
  title: string; // Image title (max 70 chars)
  keywords: string; // Comma-separated keywords (max 25)
  category: number; // Adobe Stock category (1-21)
}>;
```

**Implementation Details**:

1. Uses GPT-5-mini model with vision capabilities
2. Sends image URL with custom prompt
3. Sets `detail: 'low'` for cost optimization
4. Handles JSON responses (with or without markdown code blocks)
5. Max completion tokens: 1000

**Error Handling**:

- Catches OpenAI API errors
- Logs error details
- Throws error for upstream handling

**Example Usage**:

```typescript
const metadata = await generateMetadata('https://cloudinary.com/image.jpg');
console.log(metadata);
// {
//   title: "Sunset Beach with Palm Trees",
//   keywords: "beach, sunset, ocean, tropical, palm trees",
//   category: 11
// }
```

**Known Issues**:

- **Easter Theme Bug**: Prompt contains hardcoded "It is Easter preparation image" on line 28, causing false positives
- **Low Temperature**: Default temperature not set (should be 0.3 for factual responses)
- See `IMPROVEMENT_PLAN.md` Section 11 for fix

**Optimization Opportunities**:

- Add temperature parameter (0.3)
- Remove Easter reference from prompt
- Add validation layer
- Implement retry logic with exponential backoff

---

### 2. Cloudinary Integration (`src/cloudinary.ts`)

**Purpose**: Manages temporary image uploads to Cloudinary for AI processing.

**Dependencies**:

- `cloudinary` (^2.8.0)
- `dotenv` (^16.4.7)

**Configuration**:

```typescript
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
```

**Functions**:

#### `uploadImage(filePath: string): Promise<{ url: string; publicId: string }>`

Uploads an image file to Cloudinary.

**Parameters**:

- `filePath` (string): Local file system path to image

**Returns**:

```typescript
Promise<{
  url: string; // Cloudinary secure URL
  publicId: string; // Unique Cloudinary identifier
}>;
```

**Configuration**:

- Folder: `adobe_stock`
- Returns: `secure_url` (HTTPS)

**Example Usage**:

```typescript
const { url, publicId } = await uploadImage('./images/photo.jpg');
console.log(url); // https://res.cloudinary.com/.../adobe_stock/abc123.jpg
console.log(publicId); // adobe_stock/abc123
```

**Error Handling**:

- Logs Cloudinary errors
- Throws error for upstream handling

**Cloudinary Free Tier Limits**:

- **Max File Size**: 10MB
- **Monthly Bandwidth**: 25 GB
- **Storage**: 25 GB
- **Transformations**: 25,000/month

---

#### `deleteImage(publicId: string): Promise<void>`

Deletes an image from Cloudinary after processing.

**Parameters**:

- `publicId` (string): Cloudinary identifier returned from upload

**Behavior**:

- Success: Logs deletion confirmation
- Not Found: Logs warning (non-fatal)
- Error: Logs error but doesn't throw

**Example Usage**:

```typescript
await deleteImage('adobe_stock/abc123');
// 🗑️ Image with public_id 'adobe_stock/abc123' deleted successfully.
```

**Note**: This function is called immediately after metadata generation to avoid storage costs.

---

### 3. File Manipulation (`src/files-manipulation.ts`)

**Purpose**: Handles image file operations (conversion, renaming).

**Dependencies**:

- `fs` (Node.js built-in)
- `path` (Node.js built-in)
- `sharp` (^0.33.5)

**Functions**:

#### `getCurrentFormattedDate(): string`

Internal helper that returns date in `YYYYMMDD` format.

**Returns**: `"20251108"` (string)

---

#### `convertPngToJpeg({ inputDir, outputDir }): Promise<void>`

Converts PNG images to JPEG format with maximum quality.

**Parameters**:

```typescript
{
  inputDir: string; // Directory containing PNG files
  outputDir: string; // Output directory for JPEG files
}
```

**Processing**:

1. Scans `inputDir` for `.png` files
2. Creates `outputDir` if it doesn't exist
3. Converts each PNG to JPEG:
   - Quality: 100
   - Chroma subsampling: 4:4:4 (maximum color detail)
4. Deletes original PNG after successful conversion

**Example Usage**:

```typescript
await convertPngToJpeg({
  inputDir: './images',
  outputDir: './images',
});
// ✅ Converted IMG_001.png → IMG_001.jpeg
```

**Use Case**: Preparing images for Adobe Stock (JPEG preferred over PNG for photos)

**Note**: Currently commented out in `src/index.ts`

---

#### `renameImages(directoryPath: string, initials: string): string[]`

Renames images with standardized naming convention: `IMG_{initials}_{date}_{counter}.{ext}`

**Parameters**:

- `directoryPath` (string): Directory containing images
- `initials` (string): User initials (e.g., "OY")

**Returns**: Array of renamed filenames

**Processing**:

1. Scans directory for image files (`.jpg`, `.jpeg`, `.png`)
2. Skips already-renamed files (matching pattern)
3. Renames each file with:
   - Prefix: `IMG_`
   - Initials: User-provided
   - Date: Current date (YYYYMMDD)
   - Counter: Sequential number starting at 1
   - Extension: Preserved from original

**Example**:

```typescript
const renamed = renameImages('./images', 'OY');
// Original files:
//   _MG_7942.jpg
//   landscape.png
//   photo_2025.jpeg
//
// Renamed files:
//   IMG_OY_20251108_1.jpg
//   IMG_OY_20251108_2.png
//   IMG_OY_20251108_3.jpeg
//
// Returns: ['IMG_OY_20251108_1.jpg', 'IMG_OY_20251108_2.png', 'IMG_OY_20251108_3.jpeg']
```

**Console Output**:

```
✅ Renamed: _MG_7942.jpg ➜ IMG_OY_20251108_1.jpg
✅ Renamed: landscape.png ➜ IMG_OY_20251108_2.png
```

**Important Note**: This function **modifies original filenames**, which is flagged in IMPROVEMENT_PLAN.md as an issue. Users need to map renamed files back to originals for Adobe Stock upload.

---

### 4. CSV Writer (`src/csv-writer.ts`)

**Purpose**: Generates Adobe Stock-compatible CSV files with metadata.

**Dependencies**:

- `csv-writer` (^1.6.0)

**Types**:

```typescript
interface Metadata {
  filename: string; // Image filename
  title: string; // Generated title
  keywords: string; // Comma-separated keywords
  category: number; // Adobe Stock category number
  releases?: string; // User initials or name
}
```

**Functions**:

#### `writeMetadataToCSV(metadataList: Metadata[], outputFilePath: string): Promise<void>`

Creates a CSV file formatted for Adobe Stock bulk upload.

**Parameters**:

- `metadataList` (Metadata[]): Array of metadata objects
- `outputFilePath` (string): Output CSV file path

**CSV Structure**:

```csv
Filename,Title,Keywords,Category,Releases
IMG_OY_20251108_1.jpg,"Sunset Beach","beach, sunset, ocean",11,OY
IMG_OY_20251108_2.jpg,"Mountain Peak","mountain, nature, landscape",11,OY
```

**CSV Headers**:

1. **Filename**: Image filename (must match uploaded file)
2. **Title**: Image title (max 70 characters)
3. **Keywords**: Comma-separated keywords (max 25)
4. **Category**: Adobe Stock category number (1-21)
5. **Releases**: Model/property release info (used for initials)

**Example Usage**:

```typescript
const metadata: Metadata[] = [
  {
    filename: 'IMG_OY_20251108_1.jpg',
    title: 'Tropical Beach at Sunset',
    keywords: 'beach, sunset, tropical, ocean, paradise',
    category: 11,
    releases: 'OY',
  },
];

await writeMetadataToCSV(metadata, './output/OY_1762644147709.csv');
// ✅ Metadata successfully written to ./output/OY_1762644147709.csv
```

**Adobe Stock CSV Requirements**:

- CSV must use UTF-8 encoding
- Filenames must exactly match uploaded files
- Title max 70 characters (no commas)
- Keywords separated by commas (max 25)
- Category must be valid number (1-21)

---

### 5. Prompt Text (`src/prompt-text.ts`)

**Purpose**: Defines the OpenAI prompt for metadata generation.

**Export**:

```typescript
export const PROMPT_TEXT: string;
```

**Prompt Structure**:

1. **Instructions**: Generate metadata for Adobe Stock
2. **Field Definitions**:
   - Title: Simple description, 70 chars, no commas
   - Keywords: Order of relevance, comma-separated, max 25, no technical data
   - Category: Most accurate category number
3. **Category List**: All 21 Adobe Stock categories with descriptions
4. **Format**: JSON response format
5. **⚠️ Bug**: Line 28 contains "It is Easter preparation image" - causes false positives

**Category List** (21 categories):

- Animals, Buildings and Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscape, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel

**Response Format**:

```json
{
  "title": "some title",
  "keywords": "some keywords",
  "category": "some category"
}
```

**Critical Issue**:

```typescript
// Line 28 - REMOVE THIS
'It is Easter preparation image, provide category accordingly.';
```

This hardcoded hint causes OpenAI to generate Easter-themed descriptions for unrelated images.

**Recommended Fix**: See `IMPROVEMENT_PLAN.md` Section 11 for detailed solution.

---

### 6. Main Processing Script (`src/index.ts`)

**Purpose**: Orchestrates batch image processing workflow (CLI version).

**Dependencies**:

- All other utility modules
- `fs`, `path` (Node.js built-in)

**Configuration**:

```typescript
const initials = 'OY'; // User initials
const imageDirectory = '../images'; // Input directory
const outputCsv = `../csv_output/${initials}_${Date.now()}.csv`; // Output CSV
```

**Main Function**:

#### `processImages(imageDir: string, outputCsvPath: string, initials: string): Promise<void>`

Processes all images in a directory with parallel batch processing.

**Parameters**:

- `imageDir` (string): Directory containing images
- `outputCsvPath` (string): Output CSV file path
- `initials` (string): User initials for file naming

**Processing Flow**:

1. **(Optional)** Convert PNGs to JPEGs (commented out)
2. Rename images with standard naming convention
3. **Batch Processing** (5 images at a time):
   - Upload to Cloudinary
   - Generate metadata via OpenAI
   - Delete from Cloudinary
   - Add to metadata list
4. Write successful metadata to CSV
5. Report processing summary

**Concurrency Control**:

```typescript
const CONCURRENCY_LIMIT = 5; // Process 5 images simultaneously
```

**Batch Processing**:

- Divides images into batches of 5
- Processes each batch in parallel using `Promise.all()`
- Sequentially processes batches (batch 1, then batch 2, etc.)

**Error Handling**:

- Individual image failures don't stop batch
- Failed images return `null`
- Only successful images included in CSV

**Example Output**:

```
Processing batch 1 of 2
Processing IMG_OY_20251108_1.jpg...
Uploaded IMG_OY_20251108_1.jpg to https://cloudinary.com/...
Generated metadata for IMG_OY_20251108_1.jpg
[Repeat for other images in batch]
✅ Metadata successfully written to ../csv_output/OY_1762645118799.csv
Processed 9 of 10 images successfully.
All images processed successfully.
```

**Usage** (CLI):

```bash
npx ts-node src/index.ts
```

**Note**: This is the original CLI version. The Express server (`server.ts`) provides a web interface with the same functionality.

---

## Module Dependencies Graph

```
server.ts
  ├── src/cloudinary.ts
  ├── src/openai.ts
  ├── src/files-manipulation.ts
  └── src/csv-writer.ts

src/index.ts (CLI version)
  ├── src/cloudinary.ts
  ├── src/openai.ts
  ├── src/files-manipulation.ts
  └── src/csv-writer.ts

src/openai.ts
  └── src/prompt-text.ts
```

---

## Environment Variables

Required in `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## Testing

### Unit Tests

**Location**: `tests/`

1. **`openai.test.ts`**: OpenAI integration tests
2. **`csv-writer.test.ts`**: CSV generation tests
3. **`files-manipulation.test.ts`**: File operations tests

**Test Runner**: Vitest (^4.0.8)

**Coverage**: Run `npm run test:coverage`

---

## Performance Characteristics

### Current Performance (Per Image)

| Operation         | Time      | Notes                     |
| ----------------- | --------- | ------------------------- |
| File rename       | <10ms     | Synchronous               |
| Cloudinary upload | 2-4s      | Network + full-size image |
| Delay (hardcoded) | 2s        | Wait for CDN              |
| OpenAI metadata   | 3-5s      | API call                  |
| Cloudinary delete | <500ms    | API call                  |
| **Total**         | **8-11s** | Sequential processing     |

### Batch Processing (10 images)

- **Current**: ~80-100 seconds (sequential within batches)
- **With optimizations**: ~10-15 seconds (see IMPROVEMENT_PLAN.md)

### Optimization Recommendations

1. **Upload thumbnails instead of full-size** (8x faster)
2. **Remove/reduce 2-second delay** (20% time savings)
3. **True parallel processing** (5x faster)
4. **Batch OpenAI requests** (potential API optimization)

---

## Error Scenarios

### Common Errors

1. **File Not Found**

```typescript
// In renameImages() or processImages()
Error: ENOENT: no such file or directory
```

**Cause**: Invalid directory path or file deleted  
**Fix**: Verify paths, check file existence

2. **Cloudinary File Size Error**

```typescript
{
  message: 'File size too large. Got 13553195. Maximum is 10485760.',
  name: 'Error',
  http_code: 400
}
```

**Cause**: Image >10MB (free tier limit)  
**Fix**: Compress or resize image, upgrade Cloudinary plan

3. **OpenAI API Error**

```typescript
Error: OpenAI API request failed
```

**Causes**: Invalid API key, rate limit, timeout  
**Fix**: Check API key, implement retry logic

4. **JSON Parse Error**

```typescript
Failed to parse JSON from response: [response text]
```

**Cause**: OpenAI returned invalid JSON  
**Fix**: Improve prompt, add validation, retry request

---

## Code Quality

### Strengths

✅ Modular design (single responsibility)  
✅ TypeScript for type safety  
✅ Async/await for readability  
✅ Error logging  
✅ Promise-based APIs  
✅ Batch processing with concurrency control

### Areas for Improvement

⚠️ Limited error recovery  
⚠️ No retry logic for API failures  
⚠️ Hardcoded configuration values  
⚠️ Easter bug in prompt  
⚠️ Original filenames not preserved  
⚠️ Missing input validation

See `IMPROVEMENT_PLAN.md` for detailed recommendations.

---

**Module Count**: 6 files  
**Total Lines**: ~267 lines (excluding comments)  
**Test Coverage**: Unit tests available  
**Dependencies**: 6 external packages

**Last Updated**: November 9, 2025
