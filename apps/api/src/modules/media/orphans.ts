import { rmSync } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { OrphanedMedia } from '@open-drama/contracts';
import { sqlite } from '../../db/client';
import { env } from '../../env';
import { logger } from '../../http/logger';
import { invalidateStorageUsage } from './storage-usage';

/** Buckets holding kept media. temp/ is emptied at boot and holds renders in progress, so it is never swept. */
const BUCKETS = ['uploads', 'images', 'videos', 'merged'] as const;

/** Files written in the last day are never orphans: a result is stored before its row, an upload before it is attached. */
const GRACE_MS = 24 * 60 * 60_000;

/** A name the store wrote: `<uuid>.<ext>`, or a rendition `<uuid>_thumb.webp` / `<uuid>_poster.jpg` of one. */
const STORED_NAME =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:_thumb|_poster)?\.[a-z0-9]{1,5}$/i;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

interface Candidate {
  bucket: (typeof BUCKETS)[number];
  abs: string;
  uuid: string;
  bytes: number;
}

/** Files the store wrote more than a day ago. Anything else in a bucket (a file someone put there) is left alone. */
async function candidates(now: number): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const bucket of BUCKETS) {
    let names: string[];
    try {
      names = await readdir(join(env.storageRoot, bucket));
    } catch {
      continue;
    }
    for (const name of names) {
      const uuid = STORED_NAME.exec(name)?.[1];
      if (!uuid) continue;
      const abs = join(env.storageRoot, bucket, name);
      try {
        const st = await lstat(abs);
        if (!st.isFile() || now - st.mtimeMs < GRACE_MS) continue;
        out.push({ bucket, abs, uuid: uuid.toLowerCase(), bytes: st.size });
      } catch {
        // Vanished while listing.
      }
    }
  }
  return out;
}

/**
 * Every uuid mentioned anywhere in the database, read from every column of every table rather than from a list of
 * path columns: a column added later can never make a file look unused. Synchronous on the process's one
 * connection, so no write lands halfway through.
 */
function referencedUuids(): Set<string> {
  const found = new Set<string>();
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'`)
    .pluck()
    .all() as string[];
  for (const table of tables) {
    const rows = sqlite
      .prepare(`SELECT * FROM "${table.replaceAll('"', '""')}"`)
      .raw()
      .iterate() as IterableIterator<unknown[]>;
    for (const row of rows) {
      for (const value of row) {
        const text =
          typeof value === 'string' ? value : Buffer.isBuffer(value) ? value.toString('latin1') : null;
        if (text) for (const match of text.matchAll(UUID)) found.add(match[0].toLowerCase());
      }
    }
  }
  return found;
}

/** Synchronous from the database read on, so a caller can act on the list before any other request runs. */
function unreferenced(listed: Candidate[]): Candidate[] {
  const referenced = referencedUuids();
  return listed.filter((c) => !referenced.has(c.uuid));
}

function summarize(files: Candidate[]): OrphanedMedia {
  const byBucket = BUCKETS.map((bucket) => {
    const inBucket = files.filter((f) => f.bucket === bucket);
    return { bucket, files: inBucket.length, bytes: inBucket.reduce((sum, f) => sum + f.bytes, 0) };
  }).filter((b) => b.files > 0);
  return {
    files: files.length,
    bytes: files.reduce((sum, f) => sum + f.bytes, 0),
    byBucket,
    graceHours: GRACE_MS / 3_600_000,
  };
}

/** OrphanedMedia: stored files nothing in the database refers to any more, older than the grace period. */
export async function findOrphanedMedia(): Promise<OrphanedMedia> {
  return summarize(unreferenced(await candidates(Date.now())));
}

/**
 * CleanUpOrphanedMedia: removes them. The list is worked out again here, never taken from the client, and a file
 * that fails to delete is skipped and left out of the result. From the database read to the last delete nothing
 * awaits, so no request can start referring to a file in between.
 */
export async function cleanUpOrphanedMedia(): Promise<OrphanedMedia> {
  const listed = await candidates(Date.now());
  const removed: Candidate[] = [];
  for (const file of unreferenced(listed)) {
    try {
      rmSync(file.abs);
      removed.push(file);
    } catch (err) {
      logger.warn({ path: file.abs, err: (err as Error).message }, 'orphaned media file not removed');
    }
  }
  const result = summarize(removed);
  logger.info(
    { files: result.files, bytes: result.bytes, paths: removed.map((f) => f.abs) },
    'orphaned media removed',
  );
  if (removed.length > 0) invalidateStorageUsage();
  return result;
}
