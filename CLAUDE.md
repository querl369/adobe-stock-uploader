# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Adobe Stock Uploader — an AI-powered web app for photographers to upload images, generate Adobe Stock-compliant metadata (title, keywords, category) via OpenAI Vision API, and export CSV files for Adobe Stock submission.

## Commands

| Task                       | Command                                         |
| -------------------------- | ----------------------------------------------- |
| Dev (client + server)      | `npm run dev`                                   |
| Dev client only            | `npm run dev:client`                            |
| Dev server only            | `npm run dev:server`                            |
| Run all tests              | `npm test`                                      |
| Run tests in watch mode    | `npm run test:watch`                            |
| Run a single test file     | `npx vitest run tests/metadata.service.test.ts` |
| Run tests matching pattern | `npx vitest run -t "pattern"`                   |
| Test coverage              | `npm run test:coverage`                         |
| Build (Vite client)        | `npm run build`                                 |
| Production start           | `npm start`                                     |

There is no separate lint command. Formatting is handled by Prettier via lint-staged on pre-commit.

## Architecture

**Two-part app:** React SPA (Vite, port 5173) + Express API (port 3000). Vite proxies `/api` to Express in dev.

### Backend (`src/`)

- **`server.ts`** — Express entry point, mounts all routes and middleware
- **`src/api/routes/`** — Route modules (upload, batch, csv, health)
- **`src/api/middleware/`** — Error handler with `asyncHandler` wrapper, correlation IDs, rate limiting, session tracking
- **`src/services/`** — Business logic layer: `MetadataService` (OpenAI Vision), `TempUrlService` (Sharp compression + temp URL hosting), `ImageProcessingService` (orchestration with p-limit concurrency), `CsvExportService`, `CategoryService` (Adobe Stock taxonomy), `MetadataValidationService`, `BatchTrackingService`, `SessionService`
- **`src/config/container.ts`** — Singleton DI container. Services created in dependency order, exported as `services`. Call `container.reset()` in tests
- **`src/config/app.config.ts`** — Zod-validated env config, exits on validation failure
- **`src/models/errors.ts`** — Typed error hierarchy: `AppError` → `ValidationError`, `NotFoundError`, `RateLimitError`, `ProcessingError`, `ExternalServiceError`
- **`src/utils/retry.ts`** — Generic `withRetry<T>()` with exponential backoff, used by MetadataService and ImageProcessingService

### Frontend (`client/`)

- **`client/src/app.tsx`** — Single main React component
- **`client/src/components/ui/`** — shadcn/ui component library (Radix-based)
- Built with Vite + React SWC plugin, Tailwind CSS

### Path Aliases

Configured in both `tsconfig.json` and `vitest.config.ts`:
`@/*` → `src/*`, `@api/*` → `src/api/*`, `@services/*` → `src/services/*`, `@models/*` → `src/models/*`, `@config/*` → `src/config/*`, `@utils/*` → `src/utils/*`

## Testing

- **Framework:** Vitest with `globals: true` (no explicit imports for `describe`, `it`, `expect`)
- **All tests in** `tests/` directory, named `*.test.ts`
- **Patterns:** Heavy `vi.mock()` for external deps (OpenAI, config, logger, fs). Lightweight services (CategoryService) used as real instances. Factory helpers like `createValidTestMetadata()` for test data
- **Pre-commit hook** (Husky): runs full test suite, then lint-staged runs `vitest related` on changed files + Prettier

## Commit Message Format

```
ASU-{short 10-15 words description}
```

Examples: `ASU-Add unit tests for file manipulation and CSV writer`, `ASU-Fix image upload bug in batch processing endpoint`

## Key Environment Variables

Copy `.env.example` to `.env`. Required: `OPENAI_API_KEY`. Model: `gpt-5-nano`. Server runs on port 3000 by default.

## Formatting

Prettier: single quotes, trailing commas (es5), 100 char width, 2-space indent, no parens on single arrow params.

## BMAD Method v6

Project uses BMAD Method v6 (`_bmad/` directory) with Claude Code slash commands in `.claude/commands/`. Key commands: `/bmad-help`, `/bmad-bmm-dev-story`, `/bmad-bmm-sprint-planning`, `/bmad-bmm-quick-spec`, `/bmad-bmm-create-story`. Planning artifacts output to `docs/`.
