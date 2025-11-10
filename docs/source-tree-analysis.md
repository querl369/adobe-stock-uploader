# Source Tree Analysis

## Project Structure Overview

Adobe Stock Uploader is a **multi-part web application** consisting of a React frontend and Express backend, with shared TypeScript configuration.

```
adobe-stock-uploader/
├── client/                          # Frontend (React + Vite)
│   ├── src/
│   │   ├── app.tsx                 # ⭐ Main App component (508 lines)
│   │   ├── main.tsx                # Entry point
│   │   ├── index.css               # Global styles + grain effect
│   │   ├── components/
│   │   │   └── ui/                 # shadcn/ui components (47 files)
│   │   │       ├── input.tsx       # Used: Initials input
│   │   │       ├── label.tsx       # Used: Form labels
│   │   │       ├── progress.tsx    # Used: Batch progress
│   │   │       ├── button.tsx      # Available (using custom)
│   │   │       └── [43 other components...]  # Ready for expansion
│   │   └── styles/
│   │       └── grain.css           # Grain texture effect
│   └── index.html                  # HTML template
│
├── src/                             # ⭐ Backend utilities (core logic)
│   ├── openai.ts                   # AI metadata generation (61 lines)
│   ├── cloudinary.ts               # Image upload/delete (38 lines)
│   ├── files-manipulation.ts       # File rename/convert (74 lines)
│   ├── csv-writer.ts               # CSV generation (25 lines)
│   ├── prompt-text.ts              # OpenAI prompt (30 lines)
│   └── index.ts                    # CLI batch processor (77 lines)
│
├── server.ts                        # ⭐ Express API server (374 lines)
│
├── tests/                           # Test suite
│   ├── server.integration.test.ts  # API endpoint tests
│   ├── openai.test.ts              # OpenAI integration tests
│   ├── csv-writer.test.ts          # CSV writer tests
│   └── files-manipulation.test.ts  # File operations tests
│
├── dist/                            # Frontend build output
│   ├── assets/
│   │   ├── index-BMXRjCNN.js       # Bundled JS
│   │   └── index-CMHlHnDu.css      # Bundled CSS
│   └── index.html                  # Built HTML
│
├── uploads/                         # 📁 Temporary uploaded files
├── images/                          # 📁 Renamed images for processing
├── csv_output/                      # 📁 Generated CSV files
│   └── [initials]_[timestamp].csv
│
├── reference_images/                # Sample/reference photos
├── cache_images/                    # Cached/processed images
│
├── bmad/                            # BMAD workflow documentation
│   ├── bmm/                         # BMM Module
│   │   ├── agents/                  # 8 specialized agents
│   │   ├── workflows/               # 33 workflows
│   │   └── docs/                    # BMM documentation
│   └── core/                        # BMAD Core
│       ├── agents/
│       ├── tasks/
│       └── workflows/
│
├── docs/                            # 📚 Project documentation
│   └── stories/                     # User stories
│
├── content_calendar/                # Content planning
│   ├── content_calendar.csv
│   └── cvs-requirements.txt
│
├── vite.config.ts                   # Vite configuration
├── tsconfig.json                    # TypeScript config (backend)
├── tsconfig.client.json             # TypeScript config (frontend)
├── vitest.config.ts                 # Test configuration
├── package.json                     # Dependencies & scripts
├── .env                             # Environment variables (gitignored)
├── README.md                        # Project documentation
├── IMPROVEMENT_PLAN.md              # 📝 Detailed improvement roadmap
└── Sample_Adobe_Stock_CSV_upload (1).csv  # Example CSV format
```

---

## Critical Directories

### 1. `client/` - React Frontend

**Purpose**: User interface for image upload and processing

**Key Files**:

- **`app.tsx`** (508 lines): Main application component
  - File upload (drag & drop + file picker)
  - Image preview grid
  - Batch processing UI
  - Progress tracking
  - CSV download

**Entry Point**: `client/src/main.tsx` → `client/src/app.tsx`

**Build Output**: `dist/`

**Tech Stack**:

- React 19
- TypeScript
- Vite (build tool)
- Tailwind CSS
- shadcn/ui (component library)
- react-dnd (drag & drop)

**Critical Dependencies**:

```
client/src/app.tsx
  ├── Uses API: /api/upload, /api/process-batch, /api/export-csv, /api/cleanup
  ├── Imports: ./components/ui/input
  ├── Imports: ./components/ui/label
  └── Imports: ./components/ui/progress
```

---

### 2. `src/` - Backend Utilities ⭐

**Purpose**: Core business logic for image processing

**Files**:

| File                    | Lines | Purpose                        |
| ----------------------- | ----- | ------------------------------ |
| `openai.ts`             | 61    | AI metadata generation         |
| `cloudinary.ts`         | 38    | Temporary image hosting        |
| `files-manipulation.ts` | 74    | File rename/convert operations |
| `csv-writer.ts`         | 25    | CSV file generation            |
| `prompt-text.ts`        | 30    | OpenAI prompt definition       |
| `index.ts`              | 77    | CLI batch processor            |

**Module Dependencies**:

```
src/index.ts (CLI entry point)
  ├── src/files-manipulation.ts
  │   └── sharp (image processing)
  ├── src/cloudinary.ts
  │   └── cloudinary SDK
  ├── src/openai.ts
  │   ├── openai SDK
  │   └── src/prompt-text.ts
  └── src/csv-writer.ts
      └── csv-writer
```

**Shared by**:

- `server.ts` (web API)
- `src/index.ts` (CLI)

---

### 3. `server.ts` - Express API Server

**Purpose**: REST API for web interface

**Lines**: 374

**API Endpoints**:

- `POST /api/upload` - Upload images
- `POST /api/process-image` - Process single image
- `POST /api/process-batch` - Process all images
- `POST /api/export-csv` - Download CSV
- `POST /api/cleanup` - Clean temp files
- `GET *` - Serve frontend (SPA fallback)

**Middleware**:

- `express.json()` - Parse JSON bodies
- `multer` - File upload handling
- `express.static('dist')` - Serve frontend build

**Dependencies**:

- All `src/` utility modules
- express
- multer
- dotenv

---

### 4. `tests/` - Test Suite

**Purpose**: Automated testing

**Test Files**:

- `server.integration.test.ts` - API endpoint tests
- `openai.test.ts` - OpenAI integration tests
- `csv-writer.test.ts` - CSV generation tests
- `files-manipulation.test.ts` - File operations tests

**Test Runner**: Vitest (^4.0.8)

**Coverage**: Available via `npm run test:coverage`

---

### 5. `uploads/`, `images/`, `csv_output/` - Working Directories

**Purpose**: Temporary file storage during processing

**Flow**:

```
uploads/       → images/        → csv_output/
(uploaded)       (renamed)        (CSV result)
```

**Lifecycle**:

1. User uploads → `uploads/` (temporary, with timestamp prefix)
2. Server copies → `images/` and renames (IMG_OY_20251108_1.jpg)
3. Server processes → generates CSV in `csv_output/`
4. Server cleans → `uploads/` and optionally `images/`

**Note**: These directories are created automatically if they don't exist.

---

### 6. `bmad/` - BMAD Documentation Framework

**Purpose**: AI-driven development methodology and workflows

**Structure**:

- `bmad/bmm/agents/` - 8 specialized AI agent personas
- `bmad/bmm/workflows/` - 33 development workflows
- `bmad/bmm/docs/` - BMM documentation
- `bmad/core/` - Core BMAD system

**Not Part of Application**: Documentation and methodology only

---

## Entry Points

### Development Mode

**Frontend** (Vite dev server):

```bash
npm run dev:client
# → vite (port 5173)
# Entry: client/src/main.tsx
```

**Backend** (ts-node):

```bash
npm run dev:server
# → ts-node server.ts (port 3000)
# Entry: server.ts
```

**Both** (concurrently):

```bash
npm run dev
# → Runs both servers simultaneously
```

---

### Production Mode

**Build**:

```bash
npm run build
# → vite build
# Output: dist/
```

**Start**:

```bash
npm start
# → npm run build && ts-node server.ts
# Entry: server.ts (serves dist/)
```

---

### CLI Mode (Direct Processing)

```bash
npx ts-node src/index.ts
# Entry: src/index.ts
# Direct image processing without web UI
```

---

## Configuration Files

### TypeScript Configuration

**`tsconfig.json`** (Backend):

- Target: ES2020
- Module: CommonJS
- Strict mode: enabled
- Used by: `server.ts`, `src/`, `tests/`

**`tsconfig.client.json`** (Frontend):

- Target: ES2020
- Module: ESNext
- JSX: React
- Used by: `client/src/`

---

### Build Configuration

**`vite.config.ts`**:

- Root: `client/`
- Build output: `dist/`
- Dev server: port 5173
- Proxy: `/api` → `http://localhost:3000`
- Alias: `@` → `client/src/`
- Plugin: `@vitejs/plugin-react-swc`

**`vitest.config.ts`**:

- Test environment: node
- Coverage provider: v8
- Test files: `tests/**/*.test.ts`

---

### Package Configuration

**`package.json`**:

- Main: `server.ts`
- Scripts: dev, build, start, test
- Type: `commonjs`
- Lint-staged: Vitest + Prettier
- Husky: Pre-commit hooks

---

## Integration Points

### Frontend ↔ Backend

**HTTP API** (JSON over REST):

```
client/src/app.tsx
   ↓ POST /api/upload (multipart/form-data)
server.ts (multer middleware)
   ↓ saves to uploads/

client/src/app.tsx
   ↓ POST /api/process-batch (JSON)
server.ts
   ↓ calls src/ utilities
   ↓ returns metadata + CSV filename

client/src/app.tsx
   ↓ POST /api/export-csv (JSON)
server.ts
   ↓ sends CSV file download
```

### Backend ↔ External APIs

**Cloudinary**:

```
src/cloudinary.ts
   ↓ upload(filePath)
Cloudinary API
   ↓ returns secure_url, public_id
```

**OpenAI**:

```
src/openai.ts
   ↓ chat.completions.create(image_url)
OpenAI GPT-5-mini API
   ↓ returns JSON metadata
```

---

## File Naming Conventions

### Source Code

- TypeScript files: `.ts` (backend)
- TypeScript React: `.tsx` (frontend)
- CSS: `.css`
- Config: `.config.ts`, `.config.js`

### Images

- Original: `_MG_7942.jpg`, `photo.png`, etc.
- Renamed: `IMG_{initials}_{YYYYMMDD}_{counter}.{ext}`
  - Example: `IMG_OY_20251108_1.jpg`

### CSV Files

- Pattern: `{initials}_{timestamp}.csv`
  - Example: `OY_1762644147709.csv`

### Temporary Files

- Uploads: `{timestamp}-{random}-{originalname}`
  - Example: `1762644101662-515354661-_MG_7942.jpg`

---

## Size Statistics

### Source Code Lines

- **Frontend**: ~508 lines (app.tsx) + 47 UI components
- **Backend Utilities**: ~305 lines (6 files in src/)
- **API Server**: ~374 lines (server.ts)
- **Tests**: ~4 test files
- **Total Application Code**: ~1,200+ lines

### File Counts

- TypeScript source: ~60 files
- React components: ~47 files (shadcn/ui)
- Test files: 4 files
- Config files: 6 files

### Build Output

- `dist/`: ~2-3 files (bundled)
- Chunk size: Optimized by Vite

---

## Critical Code Locations

### Core Logic (src/)

| What                   | Where                                |
| ---------------------- | ------------------------------------ |
| AI metadata generation | `src/openai.ts`                      |
| Image upload/delete    | `src/cloudinary.ts`                  |
| File renaming          | `src/files-manipulation.ts`          |
| CSV generation         | `src/csv-writer.ts`                  |
| OpenAI prompt          | `src/prompt-text.ts` ⚠️ (Easter bug) |

### API Endpoints (server.ts)

| Endpoint                | Lines   |
| ----------------------- | ------- |
| POST /api/upload        | 87-108  |
| POST /api/process-batch | 156-294 |
| POST /api/export-csv    | 297-325 |
| POST /api/cleanup       | 328-353 |

### UI Components (client/src/)

| Component  | Lines               |
| ---------- | ------------------- |
| App        | app.tsx (508 lines) |
| DropZone   | app.tsx:32-86       |
| Main entry | main.tsx (6 lines)  |

---

## Data Flow Diagram

```
User Browser
    ↓ drag & drop / file select
client/src/app.tsx (React)
    ↓ POST /api/upload (multipart)
server.ts (multer)
    ↓ saves files
uploads/ directory
    ↓ user clicks "Generate"
    ↓ POST /api/process-batch
server.ts
    ↓ copies files
images/ directory
    ↓ renames
src/files-manipulation.ts
    ↓ for each image:
    ├─ upload →  src/cloudinary.ts → Cloudinary API
    ├─ analyze → src/openai.ts → OpenAI API
    └─ delete →  src/cloudinary.ts → Cloudinary API
    ↓ write CSV
src/csv-writer.ts
    ↓ saves
csv_output/ directory
    ↓ POST /api/export-csv
server.ts
    ↓ download
User Browser (CSV file)
```

---

## Security Boundaries

### Public Access

- Frontend (dist/)
- API endpoints (no auth)

### Private/Server-Only

- Environment variables (.env)
- File system (uploads/, images/, csv_output/)
- Server logs

### External Services

- Cloudinary (temp storage, deleted after use)
- OpenAI (image analysis only)

**Note**: No permanent data storage. All files are temporary and cleaned up.

---

## Deployment Structure

### Development

```
/Users/oleksii/Documents_local/adobe-stock-uploader/
├── client/     (source)
├── src/        (source)
├── server.ts   (source)
├── uploads/    (temp)
├── images/     (temp)
└── csv_output/ (output)
```

### Production

```
/app/
├── dist/         (built frontend)
├── src/          (utilities)
├── server.ts     (API server)
├── node_modules/ (dependencies)
├── uploads/      (temp)
├── images/       (temp)
└── csv_output/   (output)
```

**Start Command**: `npm start` (builds + runs server)

---

## Important Notes

### ⚠️ Known Issues

1. **Easter Bug**: `src/prompt-text.ts` line 28 causes false positives
2. **File Renaming**: Original filenames not preserved in CSV
3. **No Auth**: API endpoints publicly accessible
4. **10MB Limit**: Cloudinary free tier restriction
5. **2s Delay**: Hardcoded wait after upload

### 🎯 Focus Areas (per user request)

- `src/` - Backend utilities (core business logic)
- `client/` - React frontend (UI and user interaction)

See `IMPROVEMENT_PLAN.md` for detailed optimization roadmap.

---

**Project Type**: Multi-part Web Application  
**Architecture**: Client-Server (React + Express)  
**Language**: TypeScript  
**Build Tool**: Vite  
**Test Framework**: Vitest

**Last Updated**: November 9, 2025
