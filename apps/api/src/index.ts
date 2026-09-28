import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { env } from './env';
import { logger } from './http/logger';

// Startup sequence (Plan 1 §6). Each step logs one line.
logger.info({ dataDir: env.dataDir, version: env.OPEN_DRAMA_VERSION }, 'env parsed');

for (const dir of [env.dataDir, env.storageRoot, env.workspaceDir]) mkdirSync(dir, { recursive: true });
for (const bucket of ['uploads', 'images', 'videos', 'merged', 'temp']) {
  mkdirSync(join(env.storageRoot, bucket), { recursive: true });
}
logger.info({ storageRoot: env.storageRoot, workspaceDir: env.workspaceDir }, 'directories ready');

// The database module opens the file on import, so it is loaded after the directories exist.
const { runMigrations, sqlite } = await import('./db/client');
logger.info({ sqlitePath: env.sqlitePath }, 'database opened');

runMigrations();
logger.info('migrations applied');

const { seedStylePresets } = await import('./db/seeds/style-presets');
logger.info(seedStylePresets(), 'style presets seeded');

const { ensureWorkspace } = await import('./modules/agents/workspace/copy');
logger.info(ensureWorkspace(), 'workspace ready');

// The probe can take seconds on a cold binary, so it only warns and never delays startup.
const { ffmpegAvailable, ffmpegBin } = await import('./lib/ffmpeg');
void ffmpegAvailable().then((available) => {
  if (available) logger.info({ bin: ffmpegBin() }, 'ffmpeg available');
  else logger.warn({ bin: ffmpegBin() }, 'ffmpeg not available: merges will fail until FFMPEG_BIN is set');
});

const { failInterrupted } = await import('./modules/jobs/boot-cleanup');
logger.info(failInterrupted(), 'interrupted work failed');

const { createApp } = await import('./app');
const server = serve({ fetch: createApp().fetch, hostname: env.HOST, port: env.PORT }, (info) =>
  logger.info({ url: `http://${info.address}:${info.port}` }, 'listening'),
);

const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    sqlite.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
