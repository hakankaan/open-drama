import { resolve } from 'node:path';
import { z } from 'zod';
import { API_VERSION, REPO_ROOT } from './lib/roots';

const flag = z
  .enum(['0', '1', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('127.0.0.1'),
  OPEN_DRAMA_DATA_DIR: z.string().optional(),
  SQLITE_PATH: z.string().optional(),
  STORAGE_PATH: z.string().optional(),
  WORKSPACE_PATH: z.string().optional(),
  PUBLIC_BASE_URL: z.url().optional(),
  FFMPEG_BIN: z.string().optional(),
  FFPROBE_BIN: z.string().optional(),
  OPEN_DRAMA_STUB_PROVIDERS: flag,
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  OPEN_DRAMA_VERSION: z.string().default(API_VERSION),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}
const raw = parsed.data;

const dataDir = resolve(raw.OPEN_DRAMA_DATA_DIR ?? resolve(REPO_ROOT, 'data'));

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  dataDir,
  sqlitePath: resolve(raw.SQLITE_PATH ?? resolve(dataDir, 'open-drama.sqlite3')),
  storageRoot: resolve(raw.STORAGE_PATH ?? resolve(dataDir, 'static')),
  workspaceDir: resolve(raw.WORKSPACE_PATH ?? resolve(dataDir, 'workspace')),
};
export type Env = typeof env;
