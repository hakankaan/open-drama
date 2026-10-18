import { resolve } from 'node:path';
import { z } from 'zod';
import { API_VERSION, REPO_ROOT } from './lib/roots';

const flag = z
  .enum(['0', '1', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true');

/** A switch that is on unless set to 0 or false. */
const onFlag = z
  .enum(['0', '1', 'true', 'false'])
  .default('1')
  .transform((v) => v === '1' || v === 'true');

/**
 * An optional secret from the environment. Blank counts as unset (Compose passes an unset variable as ''), surrounding
 * whitespace is dropped, and whitespace inside is refused: a bearer header cannot carry it.
 */
const optionalSecret = (min: number, message: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || undefined : v),
    z
      .string()
      .min(min, message)
      .refine((s) => !/\s/.test(s), { message: 'must not contain whitespace' })
      .optional(),
  );

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
  // Pause before every stub text reply, to watch running states and races (a slow recap, a restart) by hand.
  OPEN_DRAMA_STUB_DELAY_MS: z.coerce.number().int().min(0).max(600_000).default(0),
  // Shot videos generating at once per episode; further requests wait for a slot (cost and rate-limit guard).
  OPEN_DRAMA_VIDEO_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  // Text transport patches for relays (Plan 2 §4). Every agent run and shot check asks for thinking; 1 turns it off.
  // The two patches replace the default thinking-on and thinking-off keys.
  OPEN_DRAMA_AI_DISABLE_THINKING: z
    .enum(['0', '1', 'true', 'false'])
    .default('0')
    .transform((v) => v === '1' || v === 'true'),
  OPEN_DRAMA_AI_MAX_TOKENS: z.coerce.number().int().min(256).max(1_000_000).default(16384),
  OPEN_DRAMA_AI_THINKING_OFF_PATCH: z.string().optional(),
  OPEN_DRAMA_AI_THINKING_ON_PATCH: z.string().optional(),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  // Where the web server forwards /api; its name reaches this server as the Host.
  API_ORIGIN: z.string().optional(),
  // Names besides localhost and IP literals the servers answer to (adr-0010), comma-separated.
  OPEN_DRAMA_ALLOWED_HOSTS: z.string().optional(),
  // adr-0016. 0: the API runs alone (no web process; the studio's address is not reported to assistants).
  OPEN_DRAMA_WEB_UI: onFlag,
  // 0: the assistant endpoint (/mcp) answers 404.
  OPEN_DRAMA_ASSISTANT: onFlag,
  // The assistant endpoint's bearer token; unset, one is generated at first boot into app_settings.
  OPEN_DRAMA_ASSISTANT_TOKEN: optionalSecret(32, 'OPEN_DRAMA_ASSISTANT_TOKEN must be at least 32 characters'),
  // Seeds the ModelRunner services (text, image, video) with this key at boot, insert-only (adr-0013 amendment 6).
  OPEN_DRAMA_MODELRUNNER_API_KEY: optionalSecret(1, 'OPEN_DRAMA_MODELRUNNER_API_KEY must not be blank'),
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
