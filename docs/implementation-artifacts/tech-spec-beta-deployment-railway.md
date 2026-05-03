---
title: 'Beta Deployment to Railway with Portable Dockerfile'
slug: 'beta-deployment-railway'
created: '2026-04-26'
status: 'review'
stepsCompleted: [1, 2, 3, 4]
implementationCompleted: '2026-05-01'
tech_stack:
  - Node.js 20 (bookworm-slim base image — glibc required for Sharp + better-sqlite3)
  - TypeScript 5.8 (run via ts-node in production — no tsc compile step)
  - Express 4 (single service, also serves SPA from dist/)
  - Vite 7 + React 19 (client built into dist/ at build time)
  - Sharp 0.33 / libvips (native, glibc prebuilt binary)
  - better-sqlite3 12 (native, ephemeral DB at data/batches.db)
  - Supabase JS 2 (DB + auth, external SaaS — reused dev project for beta)
  - Pino 10 (stdout logging — Railway-collected)
  - Railway (host)
  - Docker (build & runtime, multi-stage)
files_to_modify:
  - Dockerfile (NEW — repo root)
  - .dockerignore (NEW — repo root)
  - package.json (move `tsconfig-paths` from devDependencies to dependencies; add `"start:prod": "ts-node -r tsconfig-paths/register server.ts"` script; keep existing `start` for local use)
  - src/api/middleware/auth.middleware.ts (add `requireAuth` middleware that factors the existing inline `extractUserId` + `AuthenticationError` pattern out of route handlers; reuses `AuthenticationError` from `src/models/errors.ts`)
  - src/api/routes/batch.routes.ts (replace inline auth check at lines 130-133 with `requireAuth` middleware)
  - src/api/routes/csv.routes.ts (replace inline auth check at lines 185-193 with `requireAuth`; download is currently NOT 401-gated when userId is null)
  - src/api/routes/usage.routes.ts (replace inline auth check at lines 25-29 with `requireAuth`)
  - server.ts (mount `requireAuth` on legacy endpoints `/api/upload`, `/api/process-batch`, `/api/process-image`, `/api/export-csv`; add `app.set('trust proxy', 1)` for Railway; add force-exit timer to graceful shutdown; LEAVE `/api/cleanup` and `/api/upload-images` public)
  - src/config/app.config.ts (refine BASE_URL Zod schema: forbid `localhost`/`127.0.0.1` host when NODE_ENV is `production`; add startup assertion that `SUPABASE_SERVICE_ROLE_KEY` is set when NODE_ENV is `production`)
  - tests/auth-middleware.test.ts (extend existing file — add tests for `requireAuth` 401 vs pass-through paths)
  - tests/batch.routes.test.ts (update auth.middleware mock to also export `requireAuth`; add 401-on-unauth test)
  - tests/csv.routes.test.ts (update auth.middleware mock; add 401-on-unauth tests for csv routes)
  - tests/csv-download.routes.test.ts (update auth.middleware mock if it imports from it; add 401-on-unauth test)
  - tests/usage.routes.test.ts (update auth.middleware mock; add 401-on-unauth test)
  - tests/upload.routes.test.ts (assert anonymous upload-images still works — regression guard for b1)
  - README.md (append "Deployment" section with runbook)
code_patterns:
  - 'Single Express entry: server.ts mounts routes + serves dist/ + SPA fallback'
  - 'Zod-validated env at boot: src/config/app.config.ts; invalid env → process.exit(1)'
  - 'DI container singleton: src/config/container.ts'
  - 'Pino structured logs to stdout (no file shipping)'
  - 'Graceful shutdown: SIGTERM/SIGINT handler in server.ts drains server + closes DB'
  - 'Health endpoint: GET /health (liveness), GET /health/ready (readiness w/ OpenAI ping)'
test_patterns:
  - 'Vitest with globals=true; Husky pre-commit runs full suite + lint-staged'
  - 'No CI in repo; tests verified locally only'
---

# Tech-Spec: Beta Deployment to Railway with Portable Dockerfile

**Created:** 2026-04-26

## Overview

### Problem Statement

The Adobe Stock Uploader has reached feature-complete status for an alpha/beta release (Epics 1–4 verified, Epic 5 mostly done, Epic 6 user accounts done) but has **no deployment infrastructure**. The repo contains no Dockerfile, no host configuration, no CI workflows, and the app has only ever run on `localhost:3000`. The original PRD's "Epic 6: Deployment & DevOps" was replaced by the User Account System during the 2026-03-26 sprint change, leaving deployment as an untracked gap.

To validate whether real users will adopt the product before investing in Stripe/billing, the project needs a publicly accessible deployment with a path that costs near-zero at low traffic and can be migrated later without rework.

### Solution

Add a portable, multi-stage **Dockerfile** at the repo root and deploy the existing single-service Express+Vite app to **Railway** on its Hobby plan. Reuse the existing Supabase project for alpha/beta to minimize moving parts. Use Railway's free `*.up.railway.app` URL — no custom domain. Cap OpenAI API spend at the provider level to bound monthly cost. Skip GitHub Actions CI for the beta (Husky pre-commit hook continues to run tests locally).

The Dockerfile makes the deployment host-agnostic: the same image can later run on Fly.io, Render, a VPS, or a self-hosted MacBook with no code changes.

### Scope

**In Scope:**

- Multi-stage Dockerfile at repo root using `node:20-bookworm-slim` (avoids Alpine/musl Sharp issues)
- `.dockerignore` to keep build context lean and prevent secret/artifact leakage
- Local Docker build verification (`docker build` + `docker run` boots successfully)
- Railway project + service connected to the GitHub repo
- All required production env vars + build args set in Railway (OpenAI, Supabase, `BASE_URL`, feature flags, `VITE_*` build-time vars)
- Public HTTPS endpoint on `*.up.railway.app`
- Health check wired to Railway → `GET /health` (liveness, NOT `/health/ready`)
- OpenAI account-level monthly spend cap configured (defensive cost control)
- **API hardening (option b1)**: factor existing inline `extractUserId`+`AuthenticationError` checks (already present on `process-batch-v2`, `usage`, partially on `csv`) into a shared `requireAuth` middleware, and apply it to all metadata-generation, batch-status, history, usage, CSV download, and legacy endpoints (`/api/upload`, `/api/process-batch`, `/api/process-image`, `/api/export-csv`). Leave `/api/upload-images` and `/api/cleanup` public. Reuses existing `AuthenticationError` (code `AUTHENTICATION_ERROR`) — no new error class.
- **Pre-deploy hardening** (newly added in revision):
  - `app.set('trust proxy', 1)` so `req.ip` reads `X-Forwarded-For` and the IP rate limiter actually works behind Railway's load balancer
  - `BASE_URL` Zod refinement: when `NODE_ENV=production`, forbid `localhost` host so the first deploy can't boot with the localhost default and hand unreachable URLs to OpenAI
  - Startup assertion that `SUPABASE_SERVICE_ROLE_KEY` is set when `NODE_ENV=production` so misconfigured prod surfaces fast instead of silent 401-everyone
  - Force-exit timer in graceful shutdown handler (25s) so `server.close()` can't exceed Railway's 30s SIGTERM grace window during a redeploy
- Smoke test of the full user flow on the live URL: signup → upload → generate → CSV download → history → logout, plus negative tests (unauth direct curl returns 401, anonymous drop-files-only still works, `/api/upload-images` still public)
- README update with deployment runbook (build, deploy, env vars, rollback, observability gap, custom-domain follow-ups)

**Out of Scope:**

- Custom domain & DNS (deferred — start on free Railway URL)
- Production Supabase project separate from dev (deferred — reusing dev project for beta to validate demand first)
- GitHub Actions CI workflow (deferred — Husky pre-commit suffices for beta)
- Stripe / billing wiring (PRD: deferred post-release)
- Story 5.6 (responsive design) and Story 5.7 (error handling code review) — separate BMAD tracks
- TEA verification of Epics 3, 4, 6 — separate BMAD task
- Dark mode (Story 5.5 — deferred per 2026-03-26 change proposal)
- Multi-region deployment, auto-scaling rules, paid CDN
- Migration to Fly.io / Render / self-hosted MacBook — Dockerfile leaves these as one-day tasks for later, but no migration is performed in this spec

## Context for Development

### Codebase Patterns

- **Single Express server** (`server.ts`) mounts API routes and serves the built Vite client from `dist/`. Reads `process.env.PORT` via `config.server.port`; falls back to `3000`. SPA fallback wired in `app.get('*'...)` at line 444. Production = one process, one port.
- **Zod-validated env at boot** (`src/config/app.config.ts`) — invalid env triggers `process.exit(1)`. Every env var lives here. Build-time env (Vite) and runtime env (Node) must both be set on Railway.
- **DI container singleton** (`src/config/container.ts`) — services wired at boot. No global state to migrate. Container can be reset for tests.
- **Pino → stdout** (`src/utils/logger.ts`) — Railway collects stdout automatically. No external log shipper needed.
- **Health checks already exist** (`docs/HEALTH_CHECKS.md`):
  - `GET /health` → liveness (always 200 if process up)
  - `GET /health/ready` → readiness (config + OpenAI 5s ping + temp dir writable)
  - Railway healthcheck should point to `/health` (liveness). `/health/ready` can be checked manually post-deploy.
- **Graceful shutdown** (`server.ts:566-578`) — SIGTERM/SIGINT close server, clear cleanup intervals, close SQLite. Railway sends SIGTERM on redeploy; this is correct.
- **Sharp uses libvips C lib** — prebuilt binary requires **glibc**. Alpine (musl) breaks with "Could not load the sharp module". `node:20-bookworm-slim` is glibc and small.
- **better-sqlite3 is ALSO native** (`package.json:42`) — same constraint as Sharp. Uses `data/batches.db` (default `DB_PATH`). Container creates `data/` at boot (`server.ts:127`). Ephemeral disk is acceptable for beta — only batch tracking lives there; user history is in Supabase.
- **TypeScript runs via ts-node in production** (`package.json` start: `npm run build && ts-node server.ts`). `ts-node`, `tsconfig-paths`, and `typescript` are in `dependencies` (not `devDependencies`), so they survive `npm ci --omit=dev`. No `tsc` compile step needed.
- **Vite build output** (`vite.config.ts`): `root: 'client'`, `outDir: '../dist'`, `envDir: '..'`. Final path is repo-root `dist/` — matches `express.static('dist')` exactly.
- **Client uses Vite env vars at build time** (must be present BEFORE `vite build`):
  - `VITE_SUPABASE_URL` (used in `client/src/lib/supabase.ts`)
  - `VITE_SUPABASE_ANON_KEY` (same)
  - `VITE_FEATURE_PLANS_PAGE` (used in 5 files: AppHeader, AccountLayout, Plans, Billing, Home)
  - These are inlined into the JS bundle. Setting them at runtime has no effect.

### Files to Reference

| File                                        | Purpose                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `package.json`                              | Scripts (`build`, `start`); deps incl. `sharp`, `better-sqlite3`, `ts-node`              |
| `server.ts`                                 | Entry point: reads PORT, serves `dist/`, SPA fallback at `*`, graceful shutdown          |
| `src/config/app.config.ts`                  | Zod schema — source of truth for every server env var                                    |
| `client/src/lib/supabase.ts`                | Client uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` at build time                 |
| `client/src/components/AppHeader.tsx`       | Uses `VITE_FEATURE_PLANS_PAGE` at build time (also: AccountLayout, Plans, Billing, Home) |
| `vite.config.ts`                            | `root: 'client'`, `outDir: '../dist'`, `envDir: '..'` — confirms build output path       |
| `src/services/temp-url.service.ts`          | Builds temp URLs from `config.server.baseUrl` → `BASE_URL` env is critical               |
| `src/services/batch-persistence.service.ts` | Uses `config.database.path` → `DB_PATH` (default `data/batches.db`, ephemeral)           |
| `docs/HEALTH_CHECKS.md`                     | `/health` (liveness) + `/health/ready` (readiness) contract                              |
| `tsconfig.json`                             | `module: commonjs`, path aliases (used by ts-node via `tsconfig-paths`)                  |
| `supabase/migrations/`                      | Six existing migrations — already applied to dev project (reused for beta)               |
| `.env.example`                              | Template for env vars to copy into Railway dashboard                                     |

### Technical Decisions

| Decision                              | Choice                                                                                                                                                                                                                                                                                                                                                                                                | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host                                  | **Railway** (Hobby plan)                                                                                                                                                                                                                                                                                                                                                                              | Single-repo deploy in ~10 min. $5/mo flat covers beta. Switching later is a 1–3 hr task with the Dockerfile in place.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Base image                            | `node:20-bookworm-slim`                                                                                                                                                                                                                                                                                                                                                                               | Sharp + better-sqlite3 both need glibc. Alpine breaks both. Slim keeps the layer small.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Build pattern                         | Multi-stage (builder → runtime)                                                                                                                                                                                                                                                                                                                                                                       | Final image carries no devDeps and no source extras. Faster cold starts, smaller surface. **ts-node + typescript stay** (in `dependencies`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Build vs Nixpacks                     | **Dockerfile in repo root**                                                                                                                                                                                                                                                                                                                                                                           | Reproducible, host-agnostic. Railway prefers Dockerfile when present.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Service shape                         | **Single service** (Express serves SPA from `dist/`)                                                                                                                                                                                                                                                                                                                                                  | Matches existing topology. No CORS, no cookie-domain split, one log stream.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Database                              | **Reuse existing Supabase project**                                                                                                                                                                                                                                                                                                                                                                   | Beta is demand validation. Migrate to a clean prod project before public launch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CI                                    | **Skipped for beta**                                                                                                                                                                                                                                                                                                                                                                                  | Husky pre-commit covers local verification. Revisit when team or PR cadence justifies it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Domain                                | **Free `*.up.railway.app` URL**                                                                                                                                                                                                                                                                                                                                                                       | Zero cost, instant HTTPS. Buy a real domain after user feedback validates demand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| TS runtime                            | **Keep ts-node, add `start:prod` with path-alias loader**                                                                                                                                                                                                                                                                                                                                             | Existing `start` runs `vite build` at boot — would FAIL after `npm ci --omit=dev` strips Vite plugins. Existing `dev:server` (`package.json:13`) is `ts-node -r tsconfig-paths/register server.ts` — the `-r` flag is required because every server-side import uses path aliases (`@utils/*`, `@config/*`, `@api/*`, `@services/*`, `@models/*`). Add `"start:prod": "ts-node -r tsconfig-paths/register server.ts"` and use `CMD ["npm", "run", "start:prod"]`. ALSO move `tsconfig-paths` from `devDependencies` to `dependencies` in `package.json` — it's currently in `devDependencies` (line 84) and would be stripped by `npm ci --omit=dev`, causing module-resolution boot crashes. |
| Filesystem persistence                | **None** — ephemeral container disk                                                                                                                                                                                                                                                                                                                                                                   | Temp files have 10s TTL. SQLite resets on redeploy (acceptable: it tracks in-flight batches, not user history). User data lives in Supabase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Cost guardrail                        | **OpenAI account-level monthly spend cap**                                                                                                                                                                                                                                                                                                                                                            | OpenAI is 95%+ of variable cost. Hard cap before going live to bound a viral-moment scenario.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Healthcheck                           | Railway → `GET /health` (liveness)                                                                                                                                                                                                                                                                                                                                                                    | Already implemented. Don't use `/health/ready` as Railway healthcheck — its OpenAI ping would mark a healthy app unhealthy on rate limits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Log shipping                          | Pino → stdout → Railway built-in                                                                                                                                                                                                                                                                                                                                                                      | Zero config.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Husky in container build              | **`HUSKY=0` env at build time + `npm ci` (no `--ignore-scripts`)**                                                                                                                                                                                                                                                                                                                                    | `prepare` script runs `husky` which fails when `.git` is absent. `HUSKY=0` makes husky skip cleanly. Keeping scripts enabled lets sharp/better-sqlite3 prebuild hooks run if needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Vite build env                        | **Pass `VITE_*` vars as Docker `ARG` + `ENV`**                                                                                                                                                                                                                                                                                                                                                        | Railway does NOT auto-inject env vars into Dockerfile builds. Must declare `ARG VITE_SUPABASE_URL` etc. and configure Railway's "Build Args".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `BASE_URL` env                        | **Set to public Railway URL on deploy**                                                                                                                                                                                                                                                                                                                                                               | `TempUrlService` builds URLs OpenAI fetches from `config.server.baseUrl`. Default `http://localhost:3000` won't be reachable from OpenAI's network. Hard prereq.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.dockerignore`                       | **NEW file**                                                                                                                                                                                                                                                                                                                                                                                          | Exclude `node_modules/`, `dist/`, `temp/`, `data/`, `uploads/`, `images/`, `csv_output/`, `cache_images/`, `.git/`, `.env*`, `tests/` to keep build context small and avoid leaking secrets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| API hardening                         | **Option b1: gate generation endpoints, leave upload-images + cleanup open**                                                                                                                                                                                                                                                                                                                          | OpenAI is only called from `process-batch-v2`; gating generation/download endpoints fully closes the cost-burn vector. `/api/upload-images` open preserves the "drop → sign up to generate" UX. `/api/cleanup` open because `Home.tsx:46` calls it on every page mount.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Endpoints requiring auth              | `/api/process-batch-v2`, `/api/process-batch`, `/api/process-image`, `/api/generate-csv`, `/api/download-csv/:id`, `/api/batch-status/:id`, `/api/batches`, `/api/batches/session/:sessionId`, `/api/usage`, `/api/export-csv` (deprecated), **`/api/upload` (legacy single-file, currently fully public — closes CPU/disk-spam vector since per-IP rate limiter doesn't apply pre-trust-proxy fix)** | Every endpoint that triggers OpenAI work, returns user-scoped data, mutates user-owned state, OR does CPU-intensive Sharp compression. Health/metrics endpoints stay open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Endpoints staying public              | `/api/upload-images`, **`/api/cleanup`**, `/health`, `/health/ready`, `/metrics`, `/temp/:uuid.jpg`, SPA fallback                                                                                                                                                                                                                                                                                     | Upload-images preserves drop-then-signup UX. **Cleanup must stay public — `Home.tsx:46` calls it in a useEffect on every page mount, including anonymous; gating it would 401 every visitor.** Cleanup endpoint wiping all files globally is pre-existing tech debt, NOT introduced by this spec, logged as a follow-up story. Health endpoints needed by Railway. `/temp` files are OpenAI-fetched short-lived URLs; ACL via UUID.                                                                                                                                                                                                                                                           |
| `requireAuth` implementation          | **Factor existing inline pattern into shared middleware**                                                                                                                                                                                                                                                                                                                                             | The codebase already enforces auth on `process-batch-v2` (`batch.routes.ts:130-133`) and `usage` (`usage.routes.ts:25-29`) by calling `extractUserId(req)` inline and throwing `AuthenticationError` if null. `csv.routes.ts:185-193` calls `extractUserId` but does NOT 401 when null. Refactor: export a new `requireAuth` middleware in `src/api/middleware/auth.middleware.ts` that performs the same `extractUserId`+`AuthenticationError` flow, sets `req.userId`, and replaces the inline checks. **Reuse `AuthenticationError` from `src/models/errors.ts:173`** (code `AUTHENTICATION_ERROR`, status 401). Do NOT introduce a new `UnauthorizedError`.                               |
| Trust proxy (NEW)                     | **`app.set('trust proxy', 1)` in `server.ts`**                                                                                                                                                                                                                                                                                                                                                        | Without this, Express returns Railway's load-balancer IP for every request. The IP rate limiter at `rate-limit.middleware.ts:54` (`req.ip                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |     | req.socket.remoteAddress`) collapses all traffic into one bucket — defeating per-IP throttling. `1`trusts the first hop (Railway's edge) only; not`true` because that's spoofable. |
| BASE_URL production guard (NEW)       | **Zod refinement in `src/config/app.config.ts`**                                                                                                                                                                                                                                                                                                                                                      | Current schema (`app.config.ts:11`) defaults `BASE_URL` to `http://localhost:3000`. First deploy boots green, passes `/health`, and any request that triggers `temp-url.service.ts` hands `localhost:3000` URLs to OpenAI. Add `.refine(val => process.env.NODE_ENV !== 'production' \|\| (!val.includes('localhost') && !val.includes('127.0.0.1')), { message: 'BASE_URL must be a public URL when NODE_ENV=production' })` so the boot exits with a clear Zod error if BASE_URL isn't set on Railway.                                                                                                                                                                                      |
| SUPABASE_SERVICE_ROLE_KEY guard (NEW) | **Refinement: required when NODE_ENV=production**                                                                                                                                                                                                                                                                                                                                                     | `auth.middleware.ts:24-26` returns `null` (treats as anonymous) when `supabaseAdmin` is unavailable. With `requireAuth` checking that, a missing `SUPABASE_SERVICE_ROLE_KEY` 401's every authenticated user silently. Add Zod refinement: when `NODE_ENV=production`, require `SUPABASE_SERVICE_ROLE_KEY` (currently `.optional()` in schema). Boot fails fast with a clear error instead of silent prod regression.                                                                                                                                                                                                                                                                          |
| Graceful shutdown timeout (NEW)       | **25s force-exit in `shutdown` handler in `server.ts`**                                                                                                                                                                                                                                                                                                                                               | `server.ts:566-575` calls `server.close()` then `process.exit(0)` only inside its callback. Under load `server.close()` waits for in-flight requests indefinitely. Railway sends SIGKILL after 30s grace. Add `setTimeout(() => process.exit(1), 25_000).unref()` at the top of the shutdown handler so AC15 (zero downtime > 30s) holds even with slow drains.                                                                                                                                                                                                                                                                                                                               |

## Implementation Plan

Tasks are grouped into five phases, ordered by dependency. Phase 1 (factor inline auth into shared middleware) ships first because it's reversible local code changes verifiable with `npm test`. Phase 1.5 adds five small pre-deploy hardening changes uncovered during adversarial review. Phase 2 (Dockerfile) is locally verifiable. Phase 3 (Railway) needs cloud resources. Phase 4 (docs) closes out.

### Phase 1 — Factor Inline Auth into Shared Middleware (option b1)

> **Important context discovered during adversarial review**: `batch.routes.ts:130-133` and `usage.routes.ts:25-29` already do `const userId = await extractUserId(req); if (!userId) throw new AuthenticationError(...)` inline. `csv.routes.ts:185-193` calls `extractUserId` but does NOT 401 when null (silent ownership bypass). The phase factors that pattern into a shared middleware AND fixes the csv-routes gap. It does NOT introduce new error types — `AuthenticationError` (code `AUTHENTICATION_ERROR`, status 401) already exists at `src/models/errors.ts:173` and is reused.

- [x] **Task 1: Add `requireAuth` middleware**
  - File: `src/api/middleware/auth.middleware.ts`
  - Action: Export a new async middleware `requireAuth(req, res, next)` that calls the existing `extractUserId(req)` helper. If it returns `null`, call `next(new AuthenticationError('Sign up or log in to continue'))`. If non-null, set `req.userId = userId` and call `next()`.
  - Notes: Reuse `AuthenticationError` from `src/models/errors.ts` — do NOT create `UnauthorizedError`. Mirrors the inline pattern at `batch.routes.ts:130-133`. `attachUserIdMiddleware` (used only by `/api/upload-images`) stays untouched.

- [x] **Task 2: Replace inline auth in `batch.routes.ts` with `requireAuth`**
  - File: `src/api/routes/batch.routes.ts`
  - Action: Mount `requireAuth` as middleware on `POST /api/process-batch-v2`, `GET /api/batch-status/:batchId`, `GET /api/batches`, `GET /api/batches/session/:sessionId`. Remove the inline `extractUserId`+`AuthenticationError` block at lines 130-133. Use `req.userId!` (or rename to `userId` after pulling from `req`) downstream.
  - Notes: Middleware ordering on each route: session → rate-limit → requireAuth → handler. `req.userId` is now set by `requireAuth`, not extracted inline.

- [x] **Task 3: Replace inline auth in `csv.routes.ts` with `requireAuth` + close ownership gap**
  - File: `src/api/routes/csv.routes.ts`
  - Action: Mount `requireAuth` on `POST /api/generate-csv` and `GET /api/download-csv/:batchId`. The existing block at lines 185-193 only checks ownership when `userId && supabaseAdmin` — once `requireAuth` runs first, `userId` is guaranteed and the conditional becomes `if (supabaseAdmin)` only. (If `supabaseAdmin` is null in production, that's caught by the new startup assertion in Phase 1.5.)
  - Notes: This task closes a real bug: previously `/api/download-csv/:batchId` served files to anonymous callers because the ownership check was skipped when `userId === null`. Add an AC for it.

- [x] **Task 4: Replace inline auth in `usage.routes.ts` with `requireAuth`**
  - File: `src/api/routes/usage.routes.ts`
  - Action: Mount `requireAuth`. Remove the inline `extractUserId`+`AuthenticationError` block at lines 25-29.

- [x] **Task 5: Mount `requireAuth` on legacy endpoints in `server.ts`**
  - File: `server.ts`
  - Action: Apply `requireAuth` to `POST /api/process-batch` (line 221), `POST /api/process-image` (line 181), `POST /api/export-csv` (line 363), AND `POST /api/upload` (line 141) — the legacy single-file upload that's currently fully public and burns Sharp CPU + disk on anonymous traffic.
  - Notes: **DO NOT** apply to `POST /api/upload-images`, `POST /api/cleanup`, `/health/*`, `/metrics`, or `/temp/*`.

- [x] **Task 6: Move `tsconfig-paths` to `dependencies` and add `start:prod` script**
  - File: `package.json`
  - Action: Move `"tsconfig-paths": "^4.2.0"` from `devDependencies` (line 84) to `dependencies`. Add `"start:prod": "ts-node -r tsconfig-paths/register server.ts"` to `scripts`. Keep the existing `start`, `dev`, `dev:client`, `dev:server`, `build`.
  - Notes: `tsconfig-paths` is currently in devDependencies, so `npm ci --omit=dev` strips it from the runtime image → boot crashes on `@utils/*` import. The `-r tsconfig-paths/register` flag is required because the codebase uses path aliases everywhere (`@utils/*`, `@config/*`, etc.) — see existing `dev:server` script.

- [x] **Task 7: Extend `tests/auth-middleware.test.ts` with `requireAuth` tests**
  - File: `tests/auth-middleware.test.ts` (existing — extend, do NOT create a new file)
  - Action: Add tests for `requireAuth`: (a) valid Bearer token → `next()` called with no error and `req.userId` set; (b) missing `Authorization` header → `next(AuthenticationError)` with code `AUTHENTICATION_ERROR`; (c) invalid token → same; (d) malformed `Bearer` prefix → same. Mock `supabaseAdmin.auth.getUser` per existing pattern in this file.
  - Notes: Use existing file (with hyphen `auth-middleware.test.ts`). Do NOT create `auth.middleware.test.ts` (with dot) — that would create two near-identical files.

- [x] **Task 8: Update existing route tests' auth.middleware mocks**
  - Files: `tests/batch.routes.test.ts`, `tests/csv.routes.test.ts`, `tests/csv-download.routes.test.ts` (if it imports from auth.middleware), `tests/usage.routes.test.ts`
  - Action: Each file uses `vi.mock('../src/api/middleware/auth.middleware', () => ({ extractUserId: vi.fn() }))` or similar. Update each mock factory to ALSO export `requireAuth: vi.fn((req, res, next) => { req.userId = 'mock-user-id'; next(); })` (default pass-through behavior). Per-test override when the test needs to simulate unauth.
  - Notes: Without this, Vitest auto-returns `undefined` for the missing export → `TypeError: requireAuth is not a function` at module load → test files crash before any `it()` runs.

- [x] **Task 9: Add 401-on-unauth tests for protected routes**
  - Files: `tests/batch.routes.test.ts`, `tests/csv.routes.test.ts`, `tests/usage.routes.test.ts`
  - Action: For each protected route (per Endpoints table), add a test that overrides `requireAuth` to return 401 (`vi.mocked(requireAuth).mockImplementation((req, res, next) => next(new AuthenticationError('test')))`) and asserts the response is 401 with `code: 'AUTHENTICATION_ERROR'`. AC1 must be testable from these.
  - Notes: Match existing test patterns. `batch.routes.test.ts` already has scaffolding for this.

- [x] **Task 10: Anonymous-upload regression test**
  - File: `tests/upload.routes.test.ts`
  - Action: Add a test asserting `POST /api/upload-images` returns 200 (or 201) with NO `Authorization` header — confirms b1's intentional carve-out. Existing authed tests should still pass with the updated mock.
  - Notes: File is already in the working tree (per `git status`). Coordinate with any in-progress edits.

### Phase 1.5 — Pre-Deploy Hardening (added during revision)

Five small but operationally critical changes uncovered during adversarial review. Each is a few lines but materially affects what "deployed" actually does.

- [x] **Task 11: Trust proxy in `server.ts`**
  - File: `server.ts`
  - Action: Add `app.set('trust proxy', 1);` immediately after `const app = express();` (line 86) and before any middleware. Add a comment explaining: "Required on Railway / behind any reverse proxy so req.ip reads X-Forwarded-For. The IP rate limiter relies on this."
  - Notes: Without this, `rate-limit.middleware.ts:54` collapses all global traffic into one IP bucket → 429s legitimate users OR allows bypass entirely. `1` (not `true`) trusts only the first hop (Railway's edge), preventing header-spoof bypass.

- [x] **Task 12: BASE_URL Zod refinement (forbid localhost in production)**
  - File: `src/config/app.config.ts`
  - Action: Change `BASE_URL: z.string().url().default('http://localhost:3000'),` (line 11) to:
    ```ts
    BASE_URL: z
      .string()
      .url()
      .default('http://localhost:3000')
      .refine(
        val => process.env.NODE_ENV !== 'production' ||
               (!val.includes('localhost') && !val.includes('127.0.0.1')),
        { message: 'BASE_URL must be a public URL when NODE_ENV=production' }
      ),
    ```
  - Notes: First Railway deploy without `BASE_URL` set will Zod-fail at boot (clear error message in logs) instead of booting green and feeding `localhost:3000` URLs to OpenAI. This converts a silent runtime regression into a fast, loud boot failure.

- [x] **Task 13: SUPABASE_SERVICE_ROLE_KEY required in production**
  - File: `src/config/app.config.ts`
  - Action: Change the `SUPABASE_SERVICE_ROLE_KEY` line (currently `.optional()`) — wrap the whole envSchema in a `.superRefine()` block (or `.refine()` per field) that fails when `NODE_ENV=production` and any of `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are missing.
  - Notes: `auth.middleware.ts:24-26` returns null when `supabaseAdmin` is unavailable. Combined with `requireAuth`, that 401's every authenticated user silently in production if the service role key is unset. Boot-fail is the correct behavior.

- [x] **Task 14: Force-exit timer in graceful shutdown**
  - File: `server.ts`
  - Action: At the top of the `shutdown(signal)` function (line 566), before `clearInterval(...)`, add:
    ```ts
    setTimeout(() => {
      logger.error({ signal }, 'Graceful shutdown exceeded 25s, forcing exit');
      process.exit(1);
    }, 25_000).unref();
    ```
  - Notes: Railway sends SIGKILL after 30s grace. `server.close()` waits for in-flight requests indefinitely. The force-exit gives 5s margin so AC15 (zero downtime > 30s) holds even when request drains stall. `.unref()` so the timer doesn't keep the event loop alive after a clean shutdown.

- [x] **Task 15: Add tests for the four hardening changes**
  - Files: `tests/app.config.test.ts` (extend if exists, else create), `tests/server.shutdown.test.ts` (NEW, optional)
  - Action: Test BASE_URL Zod refinement: production+localhost throws, dev+localhost passes, production+https://x.up.railway.app passes. Test SUPABASE_SERVICE_ROLE_KEY refinement: production+missing throws, production+set passes, dev+missing passes. Skip the trust-proxy test (purely an Express-level setting; verified in smoke). Skip the shutdown timer test if test infrastructure for signals isn't trivial.
  - Notes: Lean tests — keep this task small. The Zod refinements are the high-value tests.

### Phase 2 — Containerization

- [x] **Task 16: Create `.dockerignore`**
  - File: `.dockerignore` (NEW, repo root)
  - Action: Add the following exclusions:
    ```
    node_modules
    dist
    temp
    data
    uploads
    images
    csv_output
    cache_images
    .git
    .env
    .env.*
    !.env.example
    tests
    docs
    references
    _bmad
    *.log
    .DS_Store
    coverage
    .vscode
    .idea
    ```
  - Notes: Keeps build context small (faster builds, fewer secrets at risk). Preserves `.env.example` for reference but blocks real `.env` files.

- [x] **Task 17: Create multi-stage `Dockerfile`**
  - File: `Dockerfile` (NEW, repo root)
  - Action: Write the following multi-stage Dockerfile:

    ```dockerfile
    # ---- Stage 1: builder ----
    FROM node:20-bookworm-slim AS builder
    WORKDIR /app
    ENV HUSKY=0

    # Build args for Vite (must be available at build time, NOT runtime)
    ARG VITE_SUPABASE_URL
    ARG VITE_SUPABASE_ANON_KEY
    ARG VITE_FEATURE_PLANS_PAGE=false
    ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
    ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
    ENV VITE_FEATURE_PLANS_PAGE=$VITE_FEATURE_PLANS_PAGE

    COPY package*.json ./
    RUN npm ci

    COPY . .
    RUN npm run build

    # Strip devDeps in-place (avoids re-running native compiles in stage 2)
    RUN npm prune --omit=dev

    # ---- Stage 2: runtime ----
    FROM node:20-bookworm-slim
    WORKDIR /app
    ENV NODE_ENV=production
    ENV HUSKY=0

    # Reuse builder's pruned node_modules — Sharp & better-sqlite3 native bins
    # built once, in the SAME OS/arch as runtime. No second `npm ci`.
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package*.json ./

    # Copy only what the runtime needs (no client/, no tests/, no dev tooling)
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/server.ts ./server.ts
    COPY --from=builder /app/src ./src
    COPY --from=builder /app/tsconfig.json ./tsconfig.json

    EXPOSE 3000
    CMD ["npm", "run", "start:prod"]
    ```

  - Notes: `bookworm-slim` for glibc (Sharp + better-sqlite3 prebuilt binaries). `HUSKY=0` skips the `prepare` script during `npm ci`. **`npm prune --omit=dev` in builder + `COPY --from=builder /app/node_modules` in runtime** avoids running `npm ci --omit=dev` a second time → cuts build time, prevents a second native-module compile, and guarantees runtime native bindings match what was tested in the build stage. `start:prod` uses `ts-node -r tsconfig-paths/register` so path aliases resolve. `tsconfig-paths` MUST be in `dependencies` (Task 6) — otherwise pruned.

- [ ] **Task 18: Verify local Docker build**
  - File: (none — terminal commands)
  - Action: Run:
    ```bash
    docker build \
      --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
      --build-arg VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
      --build-arg VITE_FEATURE_PLANS_PAGE=false \
      -t adobe-stock-uploader:local .
    docker run --rm -p 3000:3000 --env-file .env adobe-stock-uploader:local
    ```
    Then verify:
    - (a) container starts without errors AND no `Cannot find module '@utils/...'` boot error (validates F1+F2 fix)
    - (b) `curl http://localhost:3000/health` returns 200
    - (c) `curl http://localhost:3000/` returns the SPA HTML
    - (d) `curl -X POST http://localhost:3000/api/process-batch-v2` returns 401 with body containing `"code":"AUTHENTICATION_ERROR"`
    - (e) `curl -X POST http://localhost:3000/api/upload` returns 401 (legacy single-upload now gated, F17 fix)
    - (f) `curl -X POST http://localhost:3000/api/upload-images -F "images=@<some.jpg>"` returns 200 (anonymous flow preserved)
    - (g) For Phase 1.5 BASE_URL guard: re-run with `NODE_ENV=production BASE_URL=http://localhost:3000` → app must EXIT with Zod error referencing BASE_URL (validates F7 fix)
  - Notes: If `.env` is missing `BASE_URL`, dev-mode (`NODE_ENV=development`) boots fine. Production-mode boot WITHOUT a public BASE_URL is now an explicit failure thanks to Task 12.

### Phase 3 — Railway Deployment

- [ ] **Task 19: Create Railway project + connect GitHub repo**
  - File: (none — Railway dashboard)
  - Action: At [railway.app](https://railway.app), create a new project, "Deploy from GitHub repo," select this repo, choose master branch. Railway should auto-detect the `Dockerfile`.
  - Notes: Pick the Hobby plan ($5/mo). Confirm the build uses Dockerfile (NOT Nixpacks) — Railway shows the build method in the deployment log.

- [ ] **Task 20: Set Railway runtime env vars**
  - File: (none — Railway dashboard, "Variables" tab)
  - Action: Add these RUNTIME variables (all from `.env.example` mapping):
    - `NODE_ENV=production`
    - `OPENAI_API_KEY=<your-key>`
    - `OPENAI_MODEL=gpt-5-nano`
    - `SUPABASE_URL=<existing-dev-project-url>`
    - `SUPABASE_ANON_KEY=<existing-dev-project-anon>`
    - `SUPABASE_SERVICE_ROLE_KEY=<existing-dev-project-service>`
    - `BASE_URL=<railway-public-url>` ← **fill in AFTER first deploy**, e.g., `https://adobe-stock-uploader-production.up.railway.app`. Without this, OpenAI cannot fetch temp URLs.
    - `FEATURE_PLANS_PAGE=false`
    - `ANONYMOUS_LIMIT=10`
    - `FREE_TIER_LIMIT=500`
    - `AUTH_BATCH_MAX_FILES=100`
    - `MAX_FILE_SIZE_MB=50`
    - `CONCURRENCY_LIMIT=5`
    - `TEMP_FILE_LIFETIME_SECONDS=10`
  - Notes: Do NOT set `PORT` — Railway injects it. Do NOT set `DB_PATH` — default `data/batches.db` is fine for ephemeral beta usage.

- [ ] **Task 21: Set Railway BUILD args**
  - File: (none — Railway dashboard, service settings)
  - Action: Under "Build" / "Build Args" (or "Build Variables"), add:
    - `VITE_SUPABASE_URL=<same as runtime>`
    - `VITE_SUPABASE_ANON_KEY=<same as runtime>`
    - `VITE_FEATURE_PLANS_PAGE=false`
  - Notes: Railway does NOT auto-pass runtime variables to Dockerfile builds. Without these, `vite build` produces a bundle where `import.meta.env.VITE_SUPABASE_URL === undefined` → Supabase auth breaks at runtime. This is a common foot-gun; verify the build log shows the values being substituted.

- [ ] **Task 22: Configure Railway healthcheck**
  - File: (none — Railway dashboard, service settings → "Deploy")
  - Action: Set healthcheck path to `/health`. Set healthcheck timeout to 30s. Set restart policy to "On failure" with max 3 retries.
  - Notes: Use `/health` (liveness) NOT `/health/ready`. The readiness endpoint pings OpenAI; transient OpenAI rate limits would mark a healthy app unhealthy and trigger restart loops.

- [ ] **Task 23: Trigger first deploy + capture public URL**
  - File: (none — Railway dashboard)
  - Action: Two-pass deploy because of the BASE_URL chicken-and-egg:
    1. **First pass (boot expected to FAIL with the Phase 1.5 BASE_URL guard)**: trigger deploy with `BASE_URL` unset OR set to `http://localhost:3000`. Watch the Railway log: the container should crash with a Zod validation error mentioning `BASE_URL must be a public URL when NODE_ENV=production`. This is the desired behavior — the guard works.
    2. Note Railway's auto-assigned domain from the dashboard (`<service>-production.up.railway.app` or similar). Set `BASE_URL=https://<that-domain>` in runtime env vars (Task 20).
    3. **Second pass**: redeploy. Container should start cleanly. Confirm log shows `Adobe Stock Uploader server started`.
  - Notes: If the deploy succeeds on first pass with a localhost BASE_URL, the Phase 1.5 guard is broken — fix Task 12 before continuing. If the second pass fails to find the env var, Railway's runtime variable wasn't set properly — re-check Task 20.

- [ ] **Task 24: Configure OpenAI monthly spend cap**
  - File: (none — OpenAI dashboard at platform.openai.com)
  - Action: Settings → Billing → Usage limits → Set monthly hard limit (recommend $30 for beta, well above expected $1–15). Set soft limit at 50% of hard limit for email warning.
  - Notes: This is the actual cost guardrail. Per the cost analysis, OpenAI is 95%+ of variable cost; without a cap a viral moment can drain the wallet before you see it.

- [ ] **Task 25: Live smoke test**
  - File: (none — manual browser/curl)
  - Action: From the live URL:
    1. **Anonymous flow preserved**: open page → drop 3 images → see them in the dropzone → click "Sign Up to Generate" → land on signup. (Confirms `/api/upload-images` still public and UI flow works.)
    2. Sign up with a test email → confirm email if Supabase requires → log in.
    3. **Authed happy path**: drop 3 images → click Generate → wait for processing → CSV downloads → quota counter decremented.
    4. Visit `/account/history` → see the batch → re-download CSV (confirms `/api/download-csv/:id` still works for the owning user, F-fix from Task 3).
    5. Logout.
    6. **Auth gate negative tests** via curl from terminal (no `Authorization` header):
       - `curl -X POST <URL>/api/process-batch-v2` → expect 401, body contains `"code":"AUTHENTICATION_ERROR"`
       - `curl <URL>/api/batches` → expect 401
       - `curl <URL>/api/usage` → expect 401
       - `curl -X POST <URL>/api/generate-csv` → expect 401
       - `curl <URL>/api/download-csv/abc123` → expect 401 (closes csv-routes ownership gap)
       - `curl -X POST <URL>/api/upload` → expect 401 (legacy single-upload now gated, F17)
    7. **Carve-outs still public**:
       - `curl -X POST <URL>/api/upload-images -F "images=@<file.jpg>"` → expect 200
       - `curl -X POST <URL>/api/cleanup` → expect 200
       - `curl <URL>/health` → expect 200
       - `curl <URL>/health/ready` → expect 200 (or 503 if OpenAI rate-limited; either confirms readiness path)
    8. **Trust-proxy verification**: `curl -i -X POST <URL>/api/upload-images -F "images=@<file.jpg>"` and look at response headers / Railway logs. Confirm the logged client IP matches your egress IP (e.g., what `curl ifconfig.me` returns), NOT a Railway internal IP. If you see Railway's IP in logs, `trust proxy` is misconfigured (Task 11).
    9. **Force-exit verification (optional)**: trigger a manual redeploy from Railway and watch logs of the previous container — should see graceful shutdown messages, then either clean exit or the force-exit log line if drains stalled.
  - Notes: If any auth-gate negative test returns 200 instead of 401, the `requireAuth` middleware isn't wired correctly on that route — re-check Phase 1 wiring. If `/api/upload-images` returns 401, b1 is broken — that's the explicit carve-out.

### Phase 4 — Documentation

- [x] **Task 26: Append "Deployment" section to README**
  - File: `README.md`
  - Action: Add a new top-level section `## Deployment` covering:
    - **Host**: Railway Hobby. Free URL: `*.up.railway.app`.
    - **Build**: Multi-stage Dockerfile. Runs `vite build` in builder, `ts-node -r tsconfig-paths/register server.ts` in runtime.
    - **Required runtime env vars** (link to `.env.example`): `OPENAI_API_KEY`, `BASE_URL` (must be a public URL — `localhost` is rejected in production), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (required in production), `NODE_ENV=production`, plus optional tuning vars.
    - **Required build args** (`VITE_*`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FEATURE_PLANS_PAGE`. Set these as Railway "Build Args" — runtime variables alone do NOT propagate to Dockerfile builds.
    - **Trust proxy**: app sets `trust proxy = 1` so `req.ip` reads `X-Forwarded-For`. Required for IP rate limiting to work behind any reverse proxy. Be aware if you switch to a host that puts >1 hop in front of the app.
    - **Healthcheck path**: `/health` (liveness only — do NOT use `/health/ready` because it pings OpenAI and would cause restart loops on rate limits).
    - **How to deploy**: `git push origin master` → Railway auto-builds. First-deploy gotcha: `BASE_URL` must be set to a non-localhost value before the production build will boot (Zod refinement enforces this — boot will exit with a clear error otherwise).
    - **How to roll back**: Railway dashboard → Deployments → "Redeploy" prior version. Note: SQLite (`data/batches.db`) is ephemeral and resets on every deploy. Supabase data is the source of truth for user-owned state.
    - **Migration to Fly.io**: 1–3 hours, summarized as `flyctl launch --no-deploy` (uses the same Dockerfile), `fly secrets set ...` for env vars, configure build args via `fly.toml`'s `[build.args]`, `flyctl deploy`. The Dockerfile makes this a same-image migration.
    - **Observability gap**: pino logs go to stdout → Railway dashboard. NO error-rate alerts, NO log aggregation, NO metrics scraper. Acceptable for closed beta; revisit before public launch.
    - **Known beta limitations**:
      - SQLite ephemeral (anonymous re-download breaks across redeploys; moot since UI gates anonymous generation).
      - Supabase project shared with dev (migrate to a clean prod project before public launch).
      - `/api/cleanup` wipes `uploads/`+`images/` globally with no session scoping (pre-existing tech debt).
      - `extractUserId` makes a Supabase round-trip per protected request (no JWT-local verification or cache yet); fine at beta scale.
      - No CORS configured because the app is single-domain. When you add a custom domain or split client/API, CORS work begins.

### Acceptance Criteria

#### API Hardening (b1)

- [x] **AC 1**: Given an unauthenticated client, when it sends `POST /api/process-batch-v2` without an `Authorization` header, then the response is `401` with body matching `{ "error": { "code": "AUTHENTICATION_ERROR", "message": <string>, ... } }` (existing `AuthenticationError` shape from `src/models/errors.ts:173`).
- [x] **AC 2**: Given an authenticated client (valid Supabase JWT), when it sends `POST /api/process-batch-v2`, then the request is processed normally, `req.userId` is set by the `requireAuth` middleware, and the user id appears in pino logs for that request.
- [x] **AC 3**: Given an unauthenticated client, when it sends `POST /api/upload-images` with valid multipart files, then the response is `200/201` with the existing success shape and a session cookie is set (anonymous flow preserved — explicit b1 carve-out).
- [x] **AC 4**: Given an unauthenticated client, when it sends `POST /api/cleanup`, then the response is `200` (cleanup stays public — `Home.tsx:46` calls it on every mount).
- [x] **AC 5**: Given an unauthenticated client, when it sends `GET /api/batches`, `GET /api/batch-status/:id`, `GET /api/usage`, `POST /api/generate-csv`, `GET /api/download-csv/:id`, or `POST /api/upload`, then each response is `401` with `code: "AUTHENTICATION_ERROR"`.
- [x] **AC 6**: Given the existing `csv-download.routes` ownership check, when an authenticated user requests another user's batch CSV, then the response is `403` (or `404` if the existing implementation chooses to leak less). Phase 1 Task 3 must close the previous behavior where `userId === null` skipped the ownership check entirely.
- [x] **AC 7**: Given the existing Vitest suite, when it runs after Phase 1 changes, then all tests pass with no regressions, the `requireAuth` mock in route test files returns a fixed user id by default, and new 401-on-unauth tests pass.

#### Pre-Deploy Hardening (Phase 1.5)

- [x] **AC 8**: Given `NODE_ENV=production` and `BASE_URL=http://localhost:3000`, when the app boots, then it exits with a Zod validation error containing `"BASE_URL must be a public URL when NODE_ENV=production"`.
- [x] **AC 9**: Given `NODE_ENV=production` and `SUPABASE_SERVICE_ROLE_KEY` unset, when the app boots, then it exits with a Zod validation error referencing `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **AC 10**: Given the deployed app behind Railway's proxy, when a request arrives, then `req.ip` (as logged by pino) matches the client's egress IP — NOT Railway's internal load-balancer IP. (Verified in Task 25 step 8.)
- [ ] **AC 11**: Given a redeploy with in-flight requests, when the previous container receives SIGTERM, then either it exits cleanly within 25s OR the force-exit timer logs `Graceful shutdown exceeded 25s, forcing exit` and the process exits before Railway's 30s SIGKILL.

#### Containerization

- [ ] **AC 12**: Given a clean checkout, when `docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... --build-arg VITE_FEATURE_PLANS_PAGE=false -t adobe-stock-uploader:local .` runs locally, then the build completes without errors and produces an image under 350 MB.
- [ ] **AC 13**: Given the built image, when `docker run --rm -p 3000:3000 --env-file .env adobe-stock-uploader:local` runs (with a non-localhost `BASE_URL` and `NODE_ENV=production` in `.env`), then the container starts within 30 seconds, logs `Adobe Stock Uploader server started`, and `curl http://localhost:3000/health` returns `200`. **Boot must succeed without `Cannot find module '@utils/...'` errors** (validates `tsconfig-paths` is in `dependencies` and `-r tsconfig-paths/register` is wired).
- [ ] **AC 14**: Given the running container, when `curl http://localhost:3000/` is sent, then the response is the SPA `index.html` (not a 404 or default Express page).
- [ ] **AC 15**: Given the running container, when `curl -X POST http://localhost:3000/api/process-batch-v2` and `curl -X POST http://localhost:3000/api/upload` are sent without auth, then both return `401` with `code: "AUTHENTICATION_ERROR"`. `curl -X POST http://localhost:3000/api/upload-images -F "images=@..."` returns `200` (b1 carve-out preserved).

#### Railway Deployment

- [ ] **AC 16**: Given the configured Railway project with Dockerfile + build args + runtime env vars (including a non-localhost `BASE_URL`), when a deploy is triggered, then the deploy succeeds, the build log shows the Dockerfile in use, and the public URL responds with `200` on `/health`.
- [ ] **AC 17**: Given `BASE_URL` set to the live Railway URL, when an authenticated user uploads an image and triggers `process-batch-v2`, then the OpenAI Vision call succeeds (no "could not fetch temp URL" errors) and metadata is returned.
- [ ] **AC 18**: Given the live URL, when an anonymous user drops files into the dropzone, then the upload succeeds (200 from `/api/upload-images`), files appear in the UI, and the CTA shows "Sign Up to Generate" (UX preserved — explicit b1 carve-out).
- [ ] **AC 19**: Given the OpenAI dashboard, when the monthly spend cap is set, then any project usage approaching the cap triggers a warning email AND additional API calls are rejected at the cap.
- [ ] **AC 20**: Given a Railway redeploy (e.g., new git push), when the new container starts, then the previous container shuts down gracefully and the public URL has zero noticeable downtime longer than 30 seconds (the Phase 1.5 force-exit timer guarantees this).

#### Documentation

- [ ] **AC 21**: Given the README, when a fresh contributor reads the "Deployment" section, then they can identify the host, the env vars/build args required, how to deploy, how to roll back, the trust-proxy/BASE_URL/Supabase prod requirements, the observability gap (no alerting beyond Railway stdout), and known beta limitations without consulting any other doc.

## Additional Context

### Dependencies

- **Active Railway account** with payment method on Hobby plan (~$5/mo)
- **OpenAI API key** + access to OpenAI billing settings to set monthly spend cap
- **Existing Supabase project** credentials (URL, anon key, service role key) — reused for beta per scope decision
- **Local Docker Desktop** (or equivalent) installed for build verification before push
- **GitHub repo** connected to Railway service for git-push deploys
- A test email address for beta smoke-test signup (real email — Supabase may send confirmation)
- `flyctl` NOT required (Railway is the day-1 host; Fly.io migration is deferred)

### Testing Strategy

**Unit tests (Phase 1 + 1.5)**:

- Extend existing `tests/auth-middleware.test.ts` (NOT new file with dotted name) with `requireAuth` cases: valid token → pass, missing header → 401 `AUTHENTICATION_ERROR`, invalid token → 401, malformed Bearer prefix → 401.
- Update `vi.mock('../src/api/middleware/auth.middleware', ...)` blocks across all route test files (`batch.routes.test.ts`, `csv.routes.test.ts`, `csv-download.routes.test.ts`, `usage.routes.test.ts`) to also export a default-pass-through `requireAuth` mock. Without this, ALL route test files crash on module load.
- Add 401-on-unauth assertions for each protected route in the same files. Use `vi.mocked(requireAuth).mockImplementationOnce(...)` to simulate unauth per-test.
- `tests/upload.routes.test.ts`: assert anonymous upload-images still returns 200 (b1 carve-out regression guard).
- Phase 1.5: extend `tests/app.config.test.ts` (or create) to test the BASE_URL and SUPABASE_SERVICE_ROLE_KEY Zod refinements in production vs development.
- Whole suite (`npm test`) must pass before Phase 2 begins.

**Container tests (Phase 2)**:

- `docker build` succeeds locally with the three `--build-arg VITE_*` flags.
- `docker run` boots within 30s, logs the startup line, and `/health` returns 200.
- `curl` against the running container confirms (a) SPA loads, (b) `/api/process-batch-v2` returns 401 unauth, (c) `/api/upload-images` accepts files unauth.

**Live smoke (Phase 3, Task 20)**:

- Full happy path: signup → upload → generate → CSV → history → logout.
- Anonymous regression: file drop still works; "Sign Up to Generate" CTA shows.
- Negative API: unauth curl to protected endpoints returns 401; unauth upload returns 200; health returns 200.
- No automated post-deploy test suite for the beta — manual smoke is the gate.

### Notes

**Known beta limitations** (all acceptable for alpha/beta, must address before public launch):

- **Shared dev/beta Supabase project**: real beta users land in the same Supabase project as test data. Migrate to a clean prod project before public launch (separate story).
- **Ephemeral SQLite** on Railway's filesystem — `data/batches.db` resets on every redeploy. In practice this is moot because the live UI doesn't expose anonymous metadata generation (anonymous flow is dormant in the UI; it only persists data when authenticated, and authenticated history lives in Supabase). Document but don't fix.
- **`/api/cleanup` wipes globally**: this endpoint deletes ALL files in `uploads/` and `images/` with no session scoping. Pre-existing bug; not introduced by this spec. Open a follow-up story to scope cleanup to the calling session/user.
- **Anonymous backend path is alive but UI-gated**: `/api/upload-images`, `/api/upload`, `/api/cleanup` accept anonymous traffic. `requireAuth` covers the cost-burn endpoints; the upload endpoints are protected only by per-IP rate limit + 50 MB cap + 10s temp TTL. If beta data shows upload-spam abuse, tighten to b2 (gate upload too).
- **No CI**: tests run only via Husky pre-commit locally. A broken commit on master will deploy. Add GitHub Actions before public launch.
- **Single region**: Railway deploys to one region. Latency-sensitive global users may notice. Multi-region is a Fly.io territory, deferred.

**High-risk items** (where things most likely go wrong on first deploy):

1. **`tsconfig-paths` left in `devDependencies`** → runtime image strips it via `npm ci --omit=dev` → `Cannot find module '@utils/...'` boot crash. Fix in Task 6 (move to `dependencies`) + Task 17 (Dockerfile uses `npm prune --omit=dev` in builder, then COPY node_modules — so a misplaced `tsconfig-paths` would still strip).
2. **`start:prod` missing `-r tsconfig-paths/register`** → path aliases unresolved → identical boot crash. Fix in Task 6.
3. **`BASE_URL` set to localhost in production** → would have served unreachable URLs to OpenAI on first deploy; now caught by the Phase 1.5 Zod refinement (Task 12) which boot-fails instead. Verified by AC8.
4. **`SUPABASE_SERVICE_ROLE_KEY` missing in production** → would have silently 401'd every authenticated user; now caught by the Phase 1.5 refinement (Task 13). Verified by AC9.
5. **Trust proxy not set** → `req.ip` returns Railway's load-balancer IP, defeating per-IP rate limiter. Fix in Task 11. Verified by Task 25 step 8.
6. **`VITE_*` build args missing on Railway** → SPA loads but Supabase auth is broken (`undefined` URL). Fix in Task 21.
7. **Wrong base image** (Alpine, not bookworm-slim) → `Could not load the sharp module` or better-sqlite3 native binding errors. Fix in Task 17.
8. **`HUSKY=0` not set in Dockerfile** → `npm ci` errors during Dockerfile build because `husky` runs `git` in a non-git context. Fix in Task 17.
9. **Healthcheck pointed at `/health/ready`** → transient OpenAI rate limits trigger restart loops. Fix in Task 22.
10. **`requireAuth` mock not added to existing route test files** → all route test files crash on module load with `TypeError: requireAuth is not a function` before any test runs. Fix in Task 8.
11. **Existing `csv-download.routes.test.ts` ownership-bypass test (if any)** → previously the route returned 200 to anonymous callers because the ownership check was skipped when `userId === null`. Phase 1 Task 3 fixes this; old test that asserted the bypass behavior will need updating.

**Future considerations (out of scope):**

- **JWT-local verification / auth caching** (F9 deferred): `extractUserId` calls `supabaseAdmin.auth.getUser(token)` over the network on every protected request, including during the 2-second `batch-status` poll. For the closed beta this is acceptable (Supabase free-tier auth has generous limits), but at any user volume this becomes the dominant latency on protected paths. Fix later by either (a) verifying the JWT locally with the project's JWT secret, or (b) caching the userId by short-TTL token hash. Separate story.
- **Move anonymous batch persistence to Supabase** with NULL `user_id` + RLS update (cleaner than ephemeral SQLite — separate story).
- **Cleanup endpoint scoping** (F14): `/api/cleanup` currently wipes `uploads/` + `images/` globally with no session scoping. Pre-existing tech debt; concurrent users wipe each other's in-flight files. Open a follow-up story to scope cleanup to the calling session.
- **Global 401 handler in client SPA** (F15): when a session expires mid-page, in-flight API calls return 401 silently. Add a Supabase auth listener + `axios`/`fetch` response interceptor that redirects to `/login` on 401. Separate story.
- **Observability beyond Railway stdout** (F16): no error-rate alerts, no log aggregation, no metrics scraping. For a public launch, ship logs to a SaaS (Logtail, Datadog, BetterStack) and wire alerts on `level: 'error'` rate. Beta-acceptable as-is.
- **Tighten to b2 (gate upload-images)** if beta abuse data warrants — requires UI change to redirect anon dropzone to signup. Separate story.
- **Add GitHub Actions CI** (`npm test` on PR) — separate story; simple addition once team/PR cadence justifies.
- **Migrate to a clean production Supabase project** — separate story; involves migration replay and DNS-level switchover for clients.
- **Custom domain** — buy after beta validates demand; Railway has a "Custom Domain" feature that just needs a CNAME. Add CORS notes to README at that point (currently single-domain → no CORS needed).
- **Migration to Fly.io** — runbook in README; the Dockerfile makes this a 1–3 hour task with no code changes.

---

## Status

- **Status:** review
- **Implementation completed:** 2026-05-01 by AI dev agent (Phases 1, 1.5, 2 file creation, 4)
- **Code review fixes:** 2026-05-03 by AI review agent — see Change Log entries
- **Remaining (user-action only):** T18 local Docker verification, Phase 3 Railway/OpenAI dashboard deployment (T19–T25), live smoke test
- **Test suite:** 1167 / 1167 passing (8.5s wall) after review fixes — +10 client-side per-helper auth tests + 6 contract-completeness tests added to close the test gap that let the auth-gate client regression ship.

## File List

**Modified — Phase 1 (auth hardening):**

- `src/api/middleware/auth.middleware.ts` — added `requireAuth` strict-auth middleware that delegates to existing `extractUserId`. Reuses `AuthenticationError`. Existing `attachUserIdMiddleware` (used by `/api/upload-images`) untouched.
- `src/api/routes/batch.routes.ts` — mounted `requireAuth` on `/process-batch-v2`, `/batch-status/:id`, `/batches`, `/batches/:id`. Removed inline `extractUserId`+`AuthenticationError` block. Switched handler signature to `AuthAwareRequest` and read `req.userId!` from middleware.
- `src/api/routes/csv.routes.ts` — mounted `requireAuth` on `/generate-csv` and `/download-csv/:id`. Removed inline `extractUserId` call inside the ownership-fallback block; `userId` now comes from `req.userId!` set by middleware. **Closes prior bug**: anonymous callers could download other batches' CSVs because the ownership check was skipped when `userId === null`. **2026-05-03 review fix (F4):** `/generate-csv` now verifies that `req.userId` owns the supplied `batchId` (in-memory `batchTrackingService.getBatch()` first, then `batchPersistence.getBatchById()` fallback) before calling `associateCsv`; foreign / unknown batchIds throw `NotFoundError` (404, not 403, to avoid enumeration). Symmetric to the `/download-csv/:id` ownership check.
- `src/api/routes/usage.routes.ts` — mounted `requireAuth`. Removed inline auth block. Handler now reads `req.userId!`.
- `server.ts` — mounted `requireAuth` on legacy `/api/upload`, `/api/process-image`, `/api/process-batch`, `/api/export-csv`. `/api/upload-images`, `/api/cleanup`, `/health/*`, `/metrics`, `/temp/*` remain public per b1 carve-outs.
- `package.json` — moved `tsconfig-paths` from `devDependencies` to `dependencies` (otherwise stripped by `npm ci --omit=dev` and runtime crashes on `@utils/*` imports). Added `start:prod` script (`ts-node -r tsconfig-paths/register server.ts`).
- `package-lock.json` — regenerated to reflect dependency reorg.

**Modified — Phase 1.5 (pre-deploy hardening):**

- `server.ts` — added `app.set('trust proxy', 1)` immediately after `const app = express()` (T11). Added 25-second `setTimeout(...).unref()` force-exit at the top of the `shutdown` handler (T14) so we exit cleanly inside Railway's 30s SIGKILL grace window. **2026-05-03 review fixes:** (F1) moved `batchPersistence.close()` into the `server.close()` callback so SQLite stays open until the drain completes; (F3) SPA catch-all now calls `next()` for `/api` and `/metrics` paths so unknown routes hit `notFoundHandler` instead of hanging the socket.
- `src/config/app.config.ts` — split the schema into `envObjectSchema` + `superRefine` so the production-only refinements have access to the parsed `NODE_ENV`. Added refinements for: BASE_URL not localhost in production (T12), and SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY all required in production (T13).

**New — Phase 2 (containerization):**

- `Dockerfile` — multi-stage `node:20-bookworm-slim`. Builder runs `npm ci`, `vite build`, `npm prune --omit=dev`. Runtime copies the pruned `node_modules`, `dist/`, `server.ts`, `src/`, `tsconfig.json`. `HUSKY=0` set in both stages. **2026-05-03 review fix (F2):** CMD switched from `npm run start:prod` to `node -r ts-node/register -r tsconfig-paths/register server.ts` so SIGTERM reaches the Node process directly (npm-as-PID-1 does not reliably forward signals; without this the Phase 1.5 force-exit timer never fires). Build args (`VITE_*`) exposed as ARG + ENV.
- `.dockerignore` — excludes `node_modules`, `dist`, `temp`, `data`, `uploads`, `images`, `csv_output`, `cache_images`, `.git`, `.env*` (preserves `.env.example`), `tests`, `docs`, `references`, `_bmad`, IDE configs.

**Modified — Phase 4 (docs):**

- `README.md` — added `## 🚢 Deployment` section: host (Railway Hobby), build (multi-stage Dockerfile), required runtime env vars, required `VITE_*` build args, trust-proxy notes, healthcheck guidance (use `/health` not `/health/ready`), local Docker verification commands, deploy/rollback steps, OpenAI cost guardrail, Fly.io migration outline, observability gap, known beta limitations, and the public-vs-auth-required endpoint matrix. Also documented the new `start:prod` script in the Scripts table.

**Modified — 2026-05-03 review fixes (client regression caught during T18):**

- `client/src/api/client.ts` — `getBatchStatus()` (status polling) and `getBatches()` (history list) now attach `authHeaders()` + `credentials: 'include'`. Pre-spec these routes were session-cookie-gated only; Phase 1 made them `requireAuth`-gated so the JWT is now required. Without this fix, an authenticated user could start a batch (POST OK) but the 2-second status polls all 401 and the UI hangs at 0%.
- `tests/client-api.test.ts` (NEW) — contract tests for every typed client helper: stubs `fetch` + Supabase session, asserts the right URL, method, and `Authorization: Bearer <jwt>` header for every protected helper, plus that `cleanup()` and anonymous `uploadImages()` correctly omit the header. Adds a regression-named test specifically for the `getBatchStatus` / `getBatches` polling/history bugs surfaced by T18. Closes the test gap that let the spec-time auth-gate change ship without a client-side test failing. 10 tests.
- `tests/api-contract.fixture.ts` (NEW) — canonical table listing every API endpoint (path, method, auth posture: required / optional / public) and its corresponding typed-client helper. Single source of truth — both the per-helper assertions and the completeness check reference this.
- `tests/api-contract.test.ts` (NEW) — completeness check that fails when (a) a new helper is added to `client/src/api/client.ts` without an entry in the contract table, (b) a contract entry references a helper name that doesn't exist, or (c) a protected helper isn't listed in the regression-guard inventory. Catches silent additions that per-helper unit tests can't (a developer can add a helper and forget to test it; the contract makes that omission impossible to ship). 6 tests.

**New / modified — tests:**

- `tests/auth-middleware.test.ts` — added 5 tests for `requireAuth`: valid Bearer pass-through with `req.userId` set; missing header → `AuthenticationError`; invalid token → `AuthenticationError`; malformed `Basic` prefix → `AuthenticationError`; unavailable `supabaseAdmin` → `AuthenticationError`. Total 11 tests.
- `tests/batch.routes.test.ts` — updated `vi.mock('auth.middleware', ...)` to also export `requireAuth` (delegates to mocked `extractUserId`). Default mock = authenticated (`'mock-user-id'`); per-test `mockResolvedValueOnce(null)` simulates 401. Updated 2 anonymous-blocked tests with explicit null mocks. Added 3 new 401-on-unauth tests for `/batch-status`, `/batches`, `/batches/:id`. Total 22 tests.
- `tests/csv.routes.test.ts` — added auth.middleware mock with default-authenticated `requireAuth`. Added 2 new 401-on-unauth tests for `/generate-csv`. **2026-05-03 review fix (F4):** mocked `services.batchPersistence` and `batchTrackingService.getBatch` (default returns `{ userId: 'mock-user-id' }`) and added 3 ownership-check tests for `/generate-csv`: foreign userId in memory → 404, evicted batch + DB user_id mismatch → 404, unknown batchId → 404. Total 23 tests.
- `tests/csv-download.routes.test.ts` — flipped `mockExtractUserId` default to `'mock-user-default'` (authenticated) and updated mock factory to also export `requireAuth`. Replaced "anonymous + session mismatch → 404" test with "anonymous → 401 by requireAuth" (closes the documented bug). Replaced "auth is fallback only" assertion (`extractUserId.toHaveBeenCalledTimes(0)`) with the new semantics (`toHaveBeenCalledTimes(1)` — once by `requireAuth`, not twice). Added 1 new 401 test. Total 26 tests.
- `tests/usage.routes.test.ts` — added `requireAuth` to the auth.middleware mock factory (delegates to `mockExtractUserId`). Updated the 401 message assertion from "Authentication required" (inline) to "Sign up or log in to continue" (middleware). Total 3 tests.
- `tests/upload.routes.test.ts` — added explicit T10 regression guard: anonymous `POST /api/upload-images` returns 200 with a session cookie. Total 12 tests.
- `tests/batch-history.routes.test.ts` — added `auth.middleware` mock (this file previously didn't mock it). Default-authenticated `requireAuth` so existing tests for `/api/batches/:id` keep passing under the new gate.
- `tests/app-config-supabase.test.ts` — added "Production Hardening" describe with 11 tests: BASE_URL refinement (5 tests covering localhost / 127.0.0.1 / production-public / dev / test), Supabase production requirements (4 tests covering missing service-role key / missing URL / all-set / dev-still-optional). Total 20 tests.

## Dev Agent Record

### Implementation Plan

Sequencing chosen to avoid mid-implementation test breakage:

1. **Add `requireAuth`** symbol first (T1) so test files can import it.
2. **Update package.json** (T6) so subsequent test runs reflect the dep move.
3. **Write `requireAuth` unit tests** (T7) before any route uses it — pure-middleware verification.
4. **Update mocks across all route test files** (T8) BEFORE wiring routes. Without this, every test file would crash at module load with `TypeError: requireAuth is not a function`. Risk #10 in the spec.
5. **Wire routes** (T2 → T5) — once mocks are in place, route changes don't break test discovery. After each route file's wiring, the corresponding test file's anonymous-blocked tests needed `mockResolvedValueOnce(null)` because the test default flipped to authenticated.
6. **Add 401-tests** (T9) — covers AC1, AC5 explicitly.
7. **Anonymous-upload regression** (T10) — confirms b1 carve-out preserved.
8. **Phase 1.5 hardening** (T11–T15) — `trust proxy`, Zod refinements (split schema + `superRefine` so production guards see the parsed `NODE_ENV`), force-exit timer.
9. **Phase 2 file creation** (T16–T17) — `.dockerignore`, multi-stage Dockerfile.
10. **Phase 4 docs** (T26) — README runbook covers deploy, rollback, env, healthcheck, beta limitations.

Notable judgment calls:

- **Used `superRefine` over field-level `.refine()` for T12+T13** because the spec's literal field-level `.refine()` reads `process.env.NODE_ENV` at validation time, which is awkward to test (can't drive via `safeParse(...)` input). `superRefine` sees the parsed `NODE_ENV` from the input directly — same effect at boot, fully testable.
- **`requireAuth` mock chains to `mockExtractUserId`** (not an independent stub) so existing tests that drive auth state via `vi.mocked(extractUserId).mockResolvedValueOnce('user-123')` continue to work with no per-call updates.
- **Default mock = authenticated, not anonymous.** Most existing tests don't care about auth (they exercise validation, ownership, etc.); flipping to anonymous-by-default would have required updating dozens of tests. The 4–5 tests that care about anonymous explicitly set `mockResolvedValueOnce(null)`.
- **Middleware ordering on existing routes:** kept the existing `session → rate-limit → handler` order and inserted `requireAuth` as the last middleware before the handler. Validation in the handler runs after auth, so unauth requests don't even reach validation paths.
- **Did not change `attachUserIdMiddleware`** (used only by `/api/upload-images`) — it's the optional/non-throwing path, deliberately kept separate from `requireAuth`.

### Completion Notes

- All 18 implementable tasks (T1–T17 + T26) complete. Phase 3 (T19–T25) and T18 are environment-bound and require user action.
- Full test suite: **1148 / 1148 passing** in 8.15s wall (15.28s tests). Zero regressions across 46 test files.
- Pre-existing tech debt left untouched per spec: `/api/cleanup` global wipe (covered by a follow-up story), Supabase auth network round-trip per protected request (F9 deferred), shared dev/beta Supabase project.
- Closed one real bug along the way: `/api/download-csv/:id` previously served files to anonymous callers because the ownership check was skipped when `userId === null`. Now `requireAuth` blocks anonymous before the ownership check runs, AND the inner conditional dropped its `userId &&` guard since `userId` is guaranteed.

### Outstanding — User actions before going live

These are gated on cloud accounts / local Docker and cannot be done by the AI agent:

- **T18 — Local Docker build verification.** Run the `docker build` + `docker run` commands documented under "Verifying the Dockerfile locally before pushing" in the README. Confirm the listed smoke checks (200 on `/health`, 401 on protected endpoints, 200 on `/api/upload-images`, Zod boot-fail with localhost BASE_URL in production mode).
- **T19 — Railway project + GitHub repo connection.** New project on Hobby plan, connect this repo's `master` branch, confirm Railway picks the Dockerfile (not Nixpacks).
- **T20 — Railway runtime env vars.** Set `NODE_ENV=production`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BASE_URL` (after first deploy reveals the public URL), feature flags. Do NOT set `PORT` or `DB_PATH`.
- **T21 — Railway BUILD args.** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FEATURE_PLANS_PAGE`. Runtime env vars do NOT propagate to Docker builds; these must be set as Build Args separately.
- **T22 — Railway healthcheck.** Path `/health` (NOT `/health/ready`), 30s timeout, on-failure restart with max 3 retries.
- **T23 — Two-pass first deploy.** Pass 1 expected to fail with the Phase 1.5 BASE_URL Zod guard if `BASE_URL` isn't set / is localhost — verifies the guard works. Pass 2 with `BASE_URL=https://<railway-domain>` should boot cleanly.
- **T24 — OpenAI monthly hard limit.** $30 hard cap, $15 soft warning, in OpenAI Settings → Billing → Usage limits.
- **T25 — Live smoke test.** Authenticated happy path + anonymous flow preservation + curl negative tests + trust-proxy IP verification (should see your egress IP in logs, not Railway's). Per the AC list.

## Change Log

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Author          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-04-26 | Initial tech spec authored (steps 1–4 of spec workflow).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Planner         |
| 2026-05-01 | Phase 1 implemented: `requireAuth` middleware added, mounted across batch / csv / usage / legacy routes. csv-download anonymous bypass closed. `tsconfig-paths` moved to dependencies, `start:prod` script added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | AI dev agent    |
| 2026-05-01 | Phase 1.5 implemented: `trust proxy 1` set; Zod `superRefine` added for BASE_URL (forbid localhost in prod) and Supabase prod-required vars; 25s force-exit timer in graceful shutdown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | AI dev agent    |
| 2026-05-01 | Phase 2 file creation: multi-stage Dockerfile + `.dockerignore`. Local Docker build verification (T18) deferred to user (Docker not installed in dev env).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | AI dev agent    |
| 2026-05-01 | Phase 4 README runbook appended.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | AI dev agent    |
| 2026-05-03 | Code review fixes (HIGH/MEDIUM): (F1) shutdown order — `batchPersistence.close()` moved into `server.close()` callback so in-flight requests during the 25s drain don't 500 on a closed SQLite handle. (F2) Dockerfile `CMD` switched from `npm run start:prod` to direct `node -r ts-node/register -r tsconfig-paths/register server.ts` so SIGTERM reaches the Node process and the Phase 1.5 force-exit timer actually fires on Railway redeploys. (F3) SPA fallback now calls `next()` for `/api` and `/metrics` paths so unknown routes 404 via `notFoundHandler` instead of hanging. (F4) `/api/generate-csv` now verifies the caller owns the supplied `batchId` (in-memory + SQLite fallback) before associating a CSV — previously any authenticated user could re-point another user's csv association. | AI review agent |
| 2026-05-03 | T18 surfaced bug: ts-node tried to type-check `batch-persistence.service.ts` at runtime and failed with TS7016 because `@types/better-sqlite3` lives in `devDependencies` and is stripped by `npm prune --omit=dev`. Same shape as the original `tsconfig-paths` risk. Fixed structurally by switching ts-node to transpile-only mode in both the Dockerfile CMD (`ts-node/register/transpile-only`) and the `start:prod` npm script (`--transpile-only`). Type checking still runs via IDE / Husky pre-commit / `npm test` — runtime no longer needs `@types/*` packages. Removes the entire class of "missing type at runtime" bug for any future `@types/*` devDep.                                                                                                                                            | AI review agent |
| 2026-05-03 | T18 live smoke surfaced regression: client SPA's `getBatchStatus()` (status polling) and `getBatches()` (history list) in `client/src/api/client.ts` were not attaching the Supabase JWT. They worked pre-spec because those routes were session-cookie-gated only; Phase 1 added `requireAuth`, which requires the `Authorization: Bearer <jwt>` header. Symptom: authenticated user starts a batch (POST 200), then status polling 401's every 2 seconds and the UI hangs at 0%. Fix: both functions now call `authHeaders()` and set `credentials: 'include'` so JWT and session cookie both ride along.                                                                                                                                                                                                       | AI review agent |
| 2026-05-01 | Test suite: 1148/1148 passing. New tests added for `requireAuth`, BASE_URL/Supabase Zod refinements, 401-on-unauth across protected routes, anonymous-upload regression. Status moved to `review`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | AI dev agent    |
