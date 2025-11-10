# Adobe Stock Uploader - Project Overview

## Project Purpose

Adobe Stock Uploader is a web application that streamlines the process of uploading images to Adobe Stock by automating metadata generation using AI. It significantly reduces the time content creators spend writing titles, keywords, and selecting categories for their stock photography.

---

## Executive Summary

- **Project Type**: Full-stack web application (multi-part)
- **Primary Language**: TypeScript
- **Architecture**: React frontend + Express backend
- **Core Technology**: OpenAI GPT-5-mini (vision AI) + Cloudinary (image hosting)
- **Target Users**: Adobe Stock contributors, photographers, content creators

---

## Key Features

### 1. 🖼️ Image Upload

- **Drag & Drop**: Native HTML5 drag-and-drop support
- **File Picker**: Traditional file selection dialog
- **Batch Upload**: Process multiple images simultaneously
- **Preview Grid**: Visual confirmation of uploaded images

### 2. 🤖 AI-Powered Metadata Generation

- **Automatic Title**: Descriptive, SEO-friendly titles (max 70 chars)
- **Smart Keywords**: Relevant, comma-separated keywords (max 25)
- **Category Classification**: Automatic categorization (1-21 Adobe Stock categories)
- **Model**: OpenAI GPT-5-mini with vision capabilities

### 3. 📦 CSV Export

- **Adobe Stock Format**: Direct compatibility with Adobe Stock bulk upload
- **Instant Download**: Automatic CSV file download after processing
- **File Naming**: Organized with initials and timestamps

### 4. 🎨 Modern UI/UX

- **Glassmorphism Design**: Frosted glass aesthetic with grain effect
- **Responsive**: Works on desktop and tablet devices
- **Progress Tracking**: Real-time processing status
- **Accessibility**: WCAG AA compliant

---

## Technology Stack Summary

### Frontend (Client)

| Technology   | Purpose                           |
| ------------ | --------------------------------- |
| React 19     | UI framework                      |
| TypeScript   | Type safety                       |
| Vite 7       | Build tool + dev server           |
| Tailwind CSS | Styling                           |
| shadcn/ui    | Component library (47 components) |
| react-dnd    | Drag & drop functionality         |

### Backend (API)

| Technology  | Purpose              |
| ----------- | -------------------- |
| Express 4   | Web server           |
| TypeScript  | Type safety          |
| Node.js 20+ | Runtime              |
| Multer      | File upload handling |
| Sharp       | Image processing     |

### External Services

| Service           | Purpose                 |
| ----------------- | ----------------------- |
| OpenAI GPT-5-mini | AI metadata generation  |
| Cloudinary        | Temporary image hosting |

### Development Tools

| Tool        | Purpose           |
| ----------- | ----------------- |
| Vitest      | Testing framework |
| Husky       | Git hooks         |
| Prettier    | Code formatting   |
| lint-staged | Pre-commit checks |

---

## Project Structure

```
adobe-stock-uploader/
├── client/              # React frontend (Vite)
│   └── src/
│       ├── app.tsx     # Main component (508 lines)
│       └── components/ # 47 shadcn/ui components
│
├── src/                # Backend utilities ⭐
│   ├── openai.ts      # AI metadata generation
│   ├── cloudinary.ts  # Image hosting
│   ├── files-manipulation.ts  # File operations
│   ├── csv-writer.ts  # CSV export
│   └── prompt-text.ts # AI prompt
│
├── server.ts           # Express API (374 lines)
├── tests/              # Test suite (Vitest)
├── uploads/            # Temporary uploads
├── images/             # Processing directory
└── csv_output/         # Generated CSV files
```

---

## Architecture Overview

### Multi-Part Application

**Part 1: Frontend (client/)**

- Project Type: Web
- Tech: React + Vite + TypeScript
- Responsibilities:
  - User interface
  - File upload
  - Progress display
  - CSV download

**Part 2: Backend (server.ts + src/)**

- Project Type: Backend API
- Tech: Express + TypeScript
- Responsibilities:
  - REST API endpoints
  - File management
  - External service integration
  - Business logic

### Integration Flow

```
User Browser (React)
    ↓ HTTP/JSON REST
Express Server
    ↓ SDK
Cloudinary API (temp hosting)
    ↓ HTTPS URL
OpenAI API (AI analysis)
    ↓ Metadata
CSV File Generation
    ↓ Download
User
```

---

## User Workflow

1. **Upload Images**
   - Drag & drop or select files
   - Preview thumbnails in grid
   - Add more images if needed

2. **Enter Initials**
   - Provide your initials (e.g., "OY")
   - Used for file naming convention

3. **Generate & Export**
   - Click "Generate & Export CSV"
   - Watch progress bar
   - CSV automatically downloads

4. **Upload to Adobe Stock**
   - Use generated CSV file
   - Upload corresponding images
   - Adobe Stock auto-fills metadata

---

## Current Statistics

### Codebase Size

- **Frontend**: ~508 lines (app.tsx) + 47 UI components
- **Backend Utilities**: ~305 lines (6 files)
- **API Server**: ~374 lines
- **Tests**: 4 test files
- **Total**: ~1,200+ lines of application code

### Dependencies

- **Production**: 18 npm packages
- **Development**: 7 dev dependencies
- **UI Components**: 47 shadcn/ui components available

---

## Performance Profile

### Current Performance

- **Single Image**: 8-11 seconds
- **10 Images**: 80-100 seconds (sequential)
- **Bottleneck**: Sequential processing + 2s delay

### Potential Performance (After Optimizations)

- **Single Image**: 1-2 seconds
- **10 Images**: 10-15 seconds (parallel)
- **Improvement**: 5-10x faster

---

## Development Status

### Implemented Features ✅

- ✅ Drag & drop file upload
- ✅ Image preview grid
- ✅ Batch processing
- ✅ OpenAI metadata generation
- ✅ CSV export (Adobe Stock format)
- ✅ Progress tracking
- ✅ Error handling
- ✅ Automatic cleanup
- ✅ Modern UI with glassmorphism
- ✅ Comprehensive test suite
- ✅ Pre-commit hooks (Husky)

### Known Issues ⚠️

1. **Easter Theme Bug**: Prompt contains hardcoded Easter reference (line 28 in `src/prompt-text.ts`)
2. **File Renaming**: Original filenames not preserved in CSV
3. **10MB Limit**: Cloudinary free tier restriction
4. **No Authentication**: API endpoints publicly accessible
5. **Sequential Processing**: No parallelization currently

### Planned Improvements 📋

See `IMPROVEMENT_PLAN.md` for 11 detailed improvements:

1. Parallel processing (3-5x speed)
2. Real-time progress updates (SSE/WebSocket)
3. Thumbnail upload (8x faster)
4. Preserve original filenames
5. Queue visualization
6. Cancel processing
7. Retry failed images
8. ETA display
9. Process in chunks
10. Optimize Cloudinary delay
11. **Fix Easter bug** (Critical)

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 8+
- OpenAI API key
- Cloudinary account (free tier works)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd adobe-stock-uploader

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### Development

```bash
# Run both frontend and backend
npm run dev

# Frontend only
npm run dev:client

# Backend only
npm run dev:server
```

### Production

```bash
# Build and start
npm start
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## API Overview

### Endpoints

| Endpoint             | Method | Purpose                          |
| -------------------- | ------ | -------------------------------- |
| `/api/upload`        | POST   | Upload single image              |
| `/api/process-batch` | POST   | Generate metadata for all images |
| `/api/export-csv`    | POST   | Download generated CSV           |
| `/api/cleanup`       | POST   | Clean temporary files            |
| `/*`                 | GET    | Serve frontend (SPA)             |

### Key API Flow

```
POST /api/upload (image file)
  → Returns file metadata

POST /api/process-batch ({initials})
  → Renames files
  → Uploads to Cloudinary
  → Generates metadata via OpenAI
  → Creates CSV
  → Returns metadata list + CSV filename

POST /api/export-csv ({csvFileName})
  → Downloads CSV file
```

---

## External Services

### Cloudinary

- **Purpose**: Temporary image hosting for AI analysis
- **Usage**: Upload → Analyze → Delete (immediately)
- **Free Tier**: 10MB max file size, 25GB storage
- **Cost**: Bandwidth-based pricing

### OpenAI

- **Model**: GPT-5-mini (vision-capable)
- **Purpose**: Analyze images and generate metadata
- **Detail Level**: "low" (cost optimization)
- **Cost**: Per image analysis (~$0.01-0.02 per image)

---

## Security & Privacy

### Data Handling

- **Images**: Temporarily stored on Cloudinary, deleted after processing
- **Local Storage**: Temporary uploads cleaned regularly
- **No Permanent Storage**: No image database or user data retention
- **CSV Files**: Stored locally, can be manually deleted

### API Security

- **Current**: No authentication (trusted environment)
- **Recommended**: API keys, rate limiting, CORS restrictions

### Environment Variables

- **Storage**: `.env` file (gitignored)
- **Exposure**: Never sent to frontend
- **Required**:
  - `OPENAI_API_KEY`
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`

---

## Documentation

### Available Documentation

- ✅ README.md - Getting started guide
- ✅ IMPROVEMENT_PLAN.md - Detailed improvement roadmap (11 enhancements)
- ✅ API Contracts - Complete API specification
- ✅ UI Component Inventory - All 47 components documented
- ✅ Backend Utilities - Detailed utility documentation
- ✅ Source Tree Analysis - Complete codebase map
- ✅ Integration Architecture - Service communication patterns
- ✅ Frontend Architecture - React app structure
- ✅ Backend Architecture - Express API design
- ✅ Project Overview - This document
- ✅ Development Guide - Setup and workflows
- ✅ Master Index - Navigation hub

---

## Contributing

### Development Workflow

1. Create feature branch
2. Make changes
3. Run tests: `npm test`
4. Commit with format: `ASU-{description}`
5. Push and create PR

### Commit Format

```
ASU-{short 10-15 word description}

Examples:
- ASU-Add parallel processing for batch uploads
- ASU-Fix Easter bug in OpenAI prompt
- ASU-Implement real-time progress with SSE
```

### Pre-Commit Hooks

- **Vitest**: Runs related tests
- **Prettier**: Auto-formats code
- **Configured**: Husky + lint-staged

---

## Project Goals

### Short-Term (Phase 1)

1. ✅ Basic upload and metadata generation
2. ✅ CSV export
3. ✅ Modern UI
4. 🎯 Fix Easter bug
5. 🎯 Preserve original filenames
6. 🎯 Optimize performance (thumbnails)

### Medium-Term (Phase 2)

1. Parallel processing
2. Real-time progress updates
3. Queue visualization
4. Error recovery (retry failed)

### Long-Term (Phase 3)

1. User authentication
2. Batch history
3. Custom templates
4. Advanced settings
5. Analytics dashboard

---

## Success Metrics

### Performance Targets

- **Processing Speed**: < 1 second per image
- **Error Rate**: < 5% failed images
- **CSV Accuracy**: 100% filename match
- **User Satisfaction**: Clear progress indication

### Quality Targets

- **Test Coverage**: > 80%
- **Type Safety**: 100% (TypeScript strict mode)
- **Accessibility**: WCAG AA compliant
- **Code Quality**: ESLint + Prettier enforced

---

## License

ISC License

---

## Acknowledgments

- **Design**: Inspired by Figma minimalist templates
- **UI Components**: shadcn/ui + Radix UI
- **Icons**: Lucide React
- **AI**: OpenAI GPT-5-mini
- **Hosting**: Cloudinary

---

**Project Status**: ✅ Production Ready (with known issues documented)  
**Last Updated**: November 9, 2025  
**Version**: 1.0.0

---

Built with ❤️ for Adobe Stock creators by content creators who understand the pain of manual metadata entry.
