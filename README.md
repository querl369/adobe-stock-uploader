# Adobe Stock Uploader

An elegant, AI-powered web application for uploading images to Adobe Stock with automatic metadata generation.

## ✨ Features

- 🎨 **Modern UI**: Beautiful Figma-designed interface with glassmorphism effects
- 🤖 **AI-Powered Metadata**: Automatic title, keywords, and category generation using OpenAI GPT-5-mini
- 🖼️ **Batch Processing**: Upload and process multiple images simultaneously
- 📦 **CSV Export**: Generates Adobe Stock-compatible CSV files
- ☁️ **Cloud Integration**: Cloudinary for temporary image hosting
- 🔄 **Drag & Drop**: Intuitive file upload with visual feedback
- ⚡ **Real-time Progress**: Live progress tracking during processing

## 🚀 Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- npm or yarn
- OpenAI API key
- Cloudinary account

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd adobe-stock-uploader
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:

   ```env
   OPENAI_API_KEY=your_openai_api_key
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

### Development

Run both the client (Vite) and server (Express) concurrently:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Production

Build and start the production server:

```bash
npm run build
npm start
```

The app will be available at http://localhost:3000

## 🛠️ Technology Stack

### Frontend

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality UI components
- **Radix UI** - Accessible component primitives
- **React DnD** - Drag and drop functionality

### Backend

- **Express** - Web server framework
- **TypeScript** - Type-safe server code
- **Multer** - File upload handling
- **Sharp** - Image processing
- **OpenAI SDK** - AI metadata generation
- **Cloudinary SDK** - Image hosting

### Development

- **Vitest** - Unit and integration testing
- **Husky** - Git hooks
- **lint-staged** - Pre-commit linting
- **Prettier** - Code formatting

## 📁 Project Structure

```
adobe-stock-uploader/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   └── ui/        # shadcn/ui components
│   │   ├── styles/        # CSS and styling
│   │   ├── app.tsx        # Main App component
│   │   └── main.tsx       # Entry point
│   └── index.html         # HTML template
├── src/                   # Backend utilities
│   ├── cloudinary.ts     # Cloudinary integration
│   ├── openai.ts         # OpenAI integration
│   ├── files-manipulation.ts  # Image processing
│   └── csv-writer.ts     # CSV generation
├── tests/                # Test files
├── server.ts             # Express server
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## 🔑 API Endpoints

### POST `/api/upload`

Upload a single image file.

**Request**: `multipart/form-data` with `image` field

**Response**:

```json
{
  "success": true,
  "file": {
    "id": "unique-id",
    "name": "original-name.jpg",
    "size": 123456,
    "path": "uploads/unique-id-original-name.jpg"
  }
}
```

### POST `/api/process-batch`

Process all uploaded images with AI metadata generation.

**Request**:

```json
{
  "initials": "OY"
}
```

**Response**:

```json
{
  "metadataList": [
    {
      "fileName": "IMG_OY_20251108_1.jpg",
      "title": "AI-generated title",
      "keywords": "keyword1, keyword2, keyword3",
      "category": 5
    }
  ],
  "csvFileName": "OY_1731024000000.csv"
}
```

### POST `/api/export-csv`

Download the generated CSV file.

**Request**:

```json
{
  "csvFileName": "OY_1731024000000.csv"
}
```

**Response**: CSV file download

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## 📝 Workflow

1. **Upload Images**: Drag and drop or select image files
2. **Enter Initials**: Provide your initials for file naming
3. **Process**: Click "Generate & Export CSV" to:
   - Rename images with your initials and date
   - Upload to Cloudinary
   - Generate metadata using OpenAI
   - Create Adobe Stock CSV
   - Download CSV automatically
4. **Done**: Upload the CSV and images to Adobe Stock

## 🎨 Design Features

- **Grain Effect**: Subtle texture overlay for depth
- **Lava Button**: Animated gradient button with hover effects
- **Glassmorphism**: Frosted glass aesthetic with backdrop blur
- **Responsive**: Works on desktop and tablet devices
- **Dark Mode Ready**: CSS variables for easy theme switching

## 🔒 Security

- API keys stored in environment variables
- Sandbox restrictions on file operations
- Input validation on all endpoints
- Automatic cleanup of temporary files

## 📜 Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build for production
- `npm start` - Run production server (local: builds Vite + runs ts-node)
- `npm run start:prod` - Run production server inside the Docker image (skips `vite build`; expects `dist/` already built)
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report

## 🚢 Deployment

The app ships as a single Express service that also serves the SPA. The repo-root `Dockerfile` is host-agnostic — Railway is the day-1 host, but the same image runs on Fly.io, Render, a VPS, or self-hosted.

### Host

- **Railway Hobby plan** (~$5/mo flat) on the free `*.up.railway.app` URL.
- Single service. Express on `PORT` (Railway-injected) serves both `/api/*` and the built SPA from `dist/`.
- No custom domain for the beta.

### Build

Multi-stage Dockerfile:

1. **Builder stage** — `node:20-bookworm-slim`. Runs `npm ci`, `vite build`, then `npm prune --omit=dev`.
2. **Runtime stage** — `node:20-bookworm-slim` with the pruned `node_modules` copied over. Boots via `npm run start:prod` (`ts-node -r tsconfig-paths/register server.ts`).

`bookworm-slim` (glibc) is required: Sharp and `better-sqlite3` ship glibc prebuilt binaries and break on Alpine/musl. `HUSKY=0` is set so `npm ci` doesn't trip on the missing `.git` directory.

### Required runtime env vars

Set on Railway under "Variables" (see `.env.example` for the full list):

| Var                                                                                                                                 | Notes                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                                                          | Must be `production`. Activates the Zod refinements below.                                                                                                                                                                                                                        |
| `OPENAI_API_KEY`                                                                                                                    | Required.                                                                                                                                                                                                                                                                         |
| `OPENAI_MODEL`                                                                                                                      | `gpt-5-nano` for the beta.                                                                                                                                                                                                                                                        |
| `BASE_URL`                                                                                                                          | **Must be the public Railway URL** (e.g. `https://adobe-stock-uploader-production.up.railway.app`). The boot **fails fast** with a Zod error if this contains `localhost` or `127.0.0.1` while `NODE_ENV=production` — the Vision API can't fetch temp URLs from a loopback host. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`                                                                    | All three required in production. Without `SUPABASE_SERVICE_ROLE_KEY`, every authenticated request 401s silently — Zod boot-fails instead.                                                                                                                                        |
| `FEATURE_PLANS_PAGE`                                                                                                                | `false` for the beta.                                                                                                                                                                                                                                                             |
| `ANONYMOUS_LIMIT`, `FREE_TIER_LIMIT`, `AUTH_BATCH_MAX_FILES`, `MAX_FILE_SIZE_MB`, `CONCURRENCY_LIMIT`, `TEMP_FILE_LIFETIME_SECONDS` | Optional tuning.                                                                                                                                                                                                                                                                  |

Do **not** set `PORT` — Railway injects it. Do **not** set `DB_PATH` — the default `data/batches.db` is fine for ephemeral beta usage.

### Required build args (`VITE_*`)

Vite inlines `import.meta.env.VITE_*` into the bundle at build time. Railway runtime variables do **not** propagate to Docker builds — these must be set as **Build Args** on the Railway service:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FEATURE_PLANS_PAGE`

If these are missing from the build, the SPA loads but Supabase client auth breaks at runtime (`undefined` URL).

### Trust proxy

`server.ts` calls `app.set('trust proxy', 1)` so `req.ip` reads `X-Forwarded-For` from Railway's edge. The per-IP rate limiter relies on this. Keep the `1` (single hop) — `true` allows header-spoof bypass. If you switch to a host that puts more than one proxy in front of the app, increase the count.

### Healthcheck

Configure Railway's healthcheck path to `/health` (liveness — always 200 if the process is up). Do **not** point it at `/health/ready` — that endpoint pings OpenAI, and a transient OpenAI rate limit would mark a healthy app unhealthy and trigger a restart loop.

Healthcheck timeout: 30s. Restart policy: on-failure, max 3 retries.

### Verifying the Dockerfile locally before pushing

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
  --build-arg VITE_FEATURE_PLANS_PAGE=false \
  -t adobe-stock-uploader:local .

docker run --rm -p 3000:3000 --env-file .env adobe-stock-uploader:local
```

Smoke checks (against the running container):

- `curl http://localhost:3000/health` → 200
- `curl http://localhost:3000/` → SPA HTML
- `curl -X POST http://localhost:3000/api/process-batch-v2` → 401 with `code: AUTHENTICATION_ERROR`
- `curl -X POST http://localhost:3000/api/upload` → 401 (legacy single-upload, now gated)
- `curl -X POST http://localhost:3000/api/upload-images -F "images=@<some.jpg>"` → 200 (anonymous flow preserved)
- Re-run with `NODE_ENV=production BASE_URL=http://localhost:3000` in `.env` → process should exit with a Zod error mentioning `BASE_URL`.

### Deploy

Push to the branch Railway is watching; Railway auto-builds. **First deploy gotcha**: `BASE_URL` must be set to the public Railway URL before the production boot succeeds — the Zod refinement fails-fast on a localhost default. The recommended sequence:

1. First trigger deploys with `BASE_URL` unset → boot fails with a clear Zod error. Note Railway's auto-assigned domain.
2. Set `BASE_URL=https://<that-domain>` in runtime variables.
3. Redeploy.

### Roll back

Railway dashboard → Deployments → "Redeploy" the prior version. Note: SQLite (`data/batches.db`) is ephemeral and resets on every deploy. Supabase data is the source of truth for user-owned state.

### Cost guardrail

Configure an **OpenAI account-level monthly hard limit** in the OpenAI dashboard (Settings → Billing → Usage limits). Recommended: $30 hard cap, $15 soft warning. OpenAI is 95%+ of the variable cost; without a cap a viral moment can drain the wallet before you notice.

### Migration to Fly.io

The Dockerfile makes this a 1–3 hour task:

```bash
flyctl launch --no-deploy
fly secrets set OPENAI_API_KEY=... BASE_URL=https://<fly-url> ...
# Configure VITE_* build args under [build.args] in fly.toml
flyctl deploy
```

Same image, no code changes.

### Observability

Pino logs go to stdout → Railway dashboard. **No** error-rate alerts, **no** log aggregation, **no** metrics scraper beyond the in-process Prometheus exporter at `/metrics`. Acceptable for a closed beta; revisit (Logtail / Datadog / BetterStack) before public launch.

### Known beta limitations

- **SQLite is ephemeral** — `data/batches.db` resets on every redeploy. Anonymous re-download breaks across redeploys; moot in practice because the UI gates anonymous metadata generation. Authenticated history lives in Supabase.
- **Beta shares the dev Supabase project.** Migrate to a clean prod project before public launch.
- **`/api/cleanup` wipes globally** — pre-existing tech debt; no session scoping. Concurrent users can wipe each other's in-flight files. Logged as a follow-up story.
- **`extractUserId` makes a Supabase round-trip per protected request.** Fine at beta scale (Supabase free-tier auth is generous); revisit with a JWT-local verifier or short-TTL token-hash cache before public launch.
- **No CORS configured** — single-domain. When you add a custom domain or split client/API hosts, CORS work begins.
- **No CI** — Husky pre-commit covers local verification. Add GitHub Actions before public launch.

### What's auth-gated vs. public

| Public (b1 carve-outs)                        | Auth-required                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `/health`, `/health/ready`                    | `/api/process-batch-v2`, `/api/process-batch`, `/api/process-image`       |
| `/metrics`                                    | `/api/upload` (legacy single-file)                                        |
| `/api/upload-images` (drop-then-signup UX)    | `/api/generate-csv`, `/api/download-csv/:id`, `/api/export-csv`           |
| `/api/cleanup` (called on every page mount)   | `/api/batch-status/:id`, `/api/batches`, `/api/batches/:id`, `/api/usage` |
| `/temp/:uuid.jpg` (UUID-ACL'd OpenAI fetches) |                                                                           |

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Commit using format: `ASU-{description}`
5. Push and create a pull request

## 📄 License

ISC

## 🙏 Acknowledgments

- Design inspired by Figma minimalist templates
- UI components from shadcn/ui
- Icons from Lucide React

---

Built with ❤️ for Adobe Stock creators
