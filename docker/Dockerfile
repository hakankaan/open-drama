# Open Drama: one image running the API (127.0.0.1:4000) and the web app (0.0.0.0:3000) — Plan 1 Phase 8.

FROM node:22-bookworm-slim AS build
# Toolchain for native modules without a prebuilt binary (better-sqlite3 falls back to a source build).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1

# Manifests first, so dependency installs are cached across source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @open-drama/api build && pnpm --filter @open-drama/web build

# A self-contained API directory: production dependencies only, plus the bundle and the migrations.
RUN pnpm --filter @open-drama/api deploy --prod /out/api \
  && rm -rf /out/api/src /out/api/data \
  && cp -r apps/api/dist /out/api/dist \
  && cp -r apps/api/drizzle /out/api/ \
  && rm -rf /out/api/node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg \
            /out/api/node_modules/.pnpm/ffprobe-static@*/node_modules/ffprobe-static/bin

FROM node:22-bookworm-slim
# Debian's FFmpeg instead of the bundled npm binaries: ffprobe-static has no linux/arm64 build, and one source
# for every architecture keeps merges and posters identical on x64 and arm64 hosts.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    OPEN_DRAMA_DATA_DIR=/app/data \
    FFMPEG_BIN=/usr/bin/ffmpeg \
    FFPROBE_BIN=/usr/bin/ffprobe \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# The API finds its migrations next to its package.json and the agent workspace template two levels up
# (apps/api → /app), so the repository layout is kept.
COPY --from=build /out/api /app/apps/api
COPY --from=build /src/workspace /app/workspace
# Next's standalone output keeps the monorepo shape: the server is web/apps/web/server.js (the web build copies
# the static assets into it).
COPY --from=build /src/apps/web/.next/standalone /app/web
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
VOLUME /app/data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
