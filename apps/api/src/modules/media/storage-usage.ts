import { existsSync } from 'node:fs';
import { readdir, stat, statfs } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { StorageBucket, StorageUsage } from '@open-drama/contracts';
import { env } from '../../env';
import { logger } from '../../http/logger';

const FRESH_MS = 60_000;

let cache: { value: StorageUsage; at: number } | null = null;
let computing: Promise<void> | null = null;
/** Bumped by invalidateStorageUsage; a count that started before the bump is stored as already stale. */
let generation = 0;

async function* files(dir: string): AsyncGenerator<{ path: string; size: number }> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (entry.isFile()) {
      try {
        yield { path: full, size: (await stat(full)).size };
      } catch {
        // Vanished while walking.
      }
    }
  }
}

function bucketOf(abs: string): StorageBucket {
  if (abs.startsWith(env.sqlitePath)) return 'database'; // includes -wal and -shm
  if (abs.startsWith(env.workspaceDir + sep)) return 'workspace';
  if (abs.startsWith(env.storageRoot + sep)) {
    const top = relative(env.storageRoot, abs).split(sep)[0];
    if (top === 'images' || top === 'videos' || top === 'merged' || top === 'uploads' || top === 'temp') return top;
  }
  return 'other';
}

async function compute(): Promise<StorageUsage> {
  const totals = new Map<StorageBucket, { bytes: number; files: number }>();
  const roots = [...new Set([env.dataDir, env.storageRoot, env.workspaceDir])];
  const seen = new Set<string>();
  // The database may live outside the data directory (SQLITE_PATH); count it and its WAL files directly.
  for (const suffix of ['', '-wal', '-shm']) {
    const path = env.sqlitePath + suffix;
    try {
      const size = (await stat(path)).size;
      seen.add(path);
      const t = totals.get('database') ?? { bytes: 0, files: 0 };
      totals.set('database', { bytes: t.bytes + size, files: t.files + 1 });
    } catch {
      // Not present.
    }
  }
  for (const root of roots) {
    for await (const f of files(root)) {
      if (seen.has(f.path)) continue;
      seen.add(f.path);
      const bucket = bucketOf(f.path);
      const t = totals.get(bucket) ?? { bytes: 0, files: 0 };
      totals.set(bucket, { bytes: t.bytes + f.size, files: t.files + 1 });
    }
  }
  let freeBytes: number | null = null;
  try {
    const fs = await statfs(env.dataDir);
    freeBytes = fs.bavail * fs.bsize;
  } catch {
    // Not supported on this platform.
  }
  const usageByBucket = [...totals.entries()].map(([bucket, t]) => ({ bucket, ...t }));
  return {
    mode: existsSync('/.dockerenv') ? 'docker' : 'local',
    dataDir: env.dataDir,
    storageRoot: env.storageRoot,
    databasePath: env.sqlitePath,
    workspaceDir: env.workspaceDir,
    usageByBucket,
    totalBytes: usageByBucket.reduce((sum, b) => sum + b.bytes, 0),
    freeBytes,
    computedAt: new Date().toISOString(),
    stale: false,
  };
}

function refresh() {
  const startedAt = generation;
  computing ??= compute()
    .then((value) => {
      cache = { value, at: startedAt === generation ? Date.now() : 0 };
    })
    .catch((err) => logger.warn({ err: (err as Error).message }, 'storage usage failed'))
    .finally(() => {
      computing = null;
    });
}

/** The next read recounts (after files were removed), showing the old numbers as stale meanwhile. */
export function invalidateStorageUsage(): void {
  generation++;
  if (cache) cache = { ...cache, at: 0 };
}

/**
 * StorageUsage with stale-while-revalidate: a fresh cached value is returned as is; an old or missing one is
 * returned marked stale while a recount runs in the background (the UI polls until it is fresh).
 */
export function getStorageUsage(): StorageUsage {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.value;
  refresh();
  if (cache) return { ...cache.value, stale: true };
  return {
    mode: existsSync('/.dockerenv') ? 'docker' : 'local',
    dataDir: env.dataDir,
    storageRoot: env.storageRoot,
    databasePath: env.sqlitePath,
    workspaceDir: env.workspaceDir,
    usageByBucket: [],
    totalBytes: 0,
    freeBytes: null,
    computedAt: null,
    stale: true,
  };
}
