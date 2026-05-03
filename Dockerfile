# ---- Stage 1: builder ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV HUSKY=0

# Build args for Vite. Vite inlines these into the JS bundle at build time;
# they have no effect if set only at runtime. Railway requires these as
# "Build Args" — runtime variables alone do NOT propagate to Dockerfile builds.
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

# Strip devDeps in-place. Native bindings (sharp, better-sqlite3) stay
# compiled for this OS/arch — saves a second `npm ci` in stage 2.
RUN npm prune --omit=dev

# ---- Stage 2: runtime ----
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HUSKY=0

# Reuse builder's pruned node_modules — guarantees the runtime native
# bindings match what we just built and tested.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy only what the runtime needs (no client/, no tests/, no dev tooling).
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

# Run node directly so PID 1 receives SIGTERM. Wrapping with `npm run` puts
# npm at PID 1 and npm does not reliably forward signals to the script it
# launched; the graceful shutdown handler (and the 25s force-exit timer it
# installs) would never fire on Railway redeploys. Mirrors the npm script
# `start:prod`.
#
# `ts-node/register/transpile-only` skips runtime type-checking. Type errors
# are caught by the IDE / Husky pre-commit / the test suite — doing them
# again at boot is both slow and brittle (any `@types/*` package in
# devDependencies gets stripped by `npm prune --omit=dev` and breaks the
# runtime compile, e.g. better-sqlite3's missing types).
CMD ["node", "-r", "ts-node/register/transpile-only", "-r", "tsconfig-paths/register", "server.ts"]
