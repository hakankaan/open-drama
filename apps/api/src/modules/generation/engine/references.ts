import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { env } from '../../../env';
import { mimeOf, toAbsolute } from '../../../lib/paths';
import { fetchPublic } from '../../../lib/remote';
import { ConfigError } from './errors';

const MAX_EDGE = 768;
/** A first frame is the video's opening picture, so it keeps far more detail than a reference does. */
const FRAME_EDGE = 1920;
/** Remote reference images are read into memory before compression; the upload limit applies to them too. */
const REMOTE_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

async function compress(input: Buffer | string, edge = MAX_EDGE, quality = 68): Promise<string> {
  const jpeg = await sharp(input).rotate().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).jpeg({ quality }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** A stored still (`static/…`) as the first frame of a video: a JPEG data URL fit in 1920 px at quality 90. */
export const normalizeFirstFrame = (path: string) => compress(toAbsolute(path), FRAME_EDGE, 90);

/**
 * Reference images for a provider (Plan 2 §8): data URLs pass through, stored `static/…` paths and remote URLs
 * become compressed JPEG data URLs (fit in 768 px, quality 68); duplicates are dropped and the list is capped.
 * Remote URLs go through fetchPublic (no loopback or cloud-metadata targets, bounded size, image content only).
 */
export async function normalizeReferenceImages(refs: string[], max: number): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (out.length >= max) break;
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    if (ref.startsWith('data:')) out.push(ref);
    else if (/^https?:\/\//.test(ref)) {
      const { bytes } = await fetchPublic(ref, { what: 'reference image', maxBytes: REMOTE_IMAGE_MAX_BYTES, accept: /^image\//i, timeoutMs: 30_000 });
      out.push(await compress(bytes));
    } else out.push(await compress(toAbsolute(ref)));
  }
  return out;
}

/**
 * Reference videos and audio (Plan 2 §8): providers fetch them by URL. http(s) and data URLs pass through; a stored
 * `static/…` file needs PUBLIC_BASE_URL so the provider can reach it, otherwise the task fails with a config error.
 */
export function resolvePublicMediaUrls(refs: string[], what: 'video' | 'audio'): string[] {
  return [...new Set(refs.filter(Boolean))].map((ref) => {
    if (/^(https?:|data:)/.test(ref)) return ref;
    if (!existsSync(toAbsolute(ref))) throw new ConfigError(`The reference ${what} ${ref} is no longer stored`);
    if (!env.PUBLIC_BASE_URL) {
      throw new ConfigError(
        `The video provider must download the reference ${what} ${ref}, so set PUBLIC_BASE_URL to an address it can reach`,
      );
    }
    return `${env.PUBLIC_BASE_URL.replace(/\/+$/, '')}/${ref.replace(/^\/+/, '')}`;
  });
}

/** A provider's own result URL is trusted to stay up this long after the task completed (ModelRunner keeps them about an hour). */
const RESULT_URL_FRESH_MS = 45 * 60_000;
/** The largest file sent inline as a data URI; beyond it the provider must be able to fetch the file. */
const DATA_URI_MAX_BYTES = 25 * 1024 * 1024;

/**
 * A stored file a provider must read (speech and lip sync, adr-0021): a PUBLIC_BASE_URL address, else the provider's
 * own result URL while it is fresh (`made`, the task that produced the file), else a data URI up to 25 MB; past that a
 * config error asks for PUBLIC_BASE_URL.
 */
export async function deliverStoredFile(
  path: string,
  what: string,
  made?: { resultUrl: string | null; completedAt: string | null },
): Promise<string> {
  const abs = toAbsolute(path);
  if (!existsSync(abs)) throw new ConfigError(`The ${what} ${path} is no longer stored`);
  if (env.PUBLIC_BASE_URL) return `${env.PUBLIC_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  if (made?.resultUrl && made.completedAt && Date.now() - Date.parse(made.completedAt) < RESULT_URL_FRESH_MS) return made.resultUrl;
  const { size } = await stat(abs);
  if (size > DATA_URI_MAX_BYTES) {
    throw new ConfigError(`The provider must download the ${what} ${path}, which is too large to send inline, so set PUBLIC_BASE_URL to an address it can reach`);
  }
  return `data:${mimeOf(abs)};base64,${(await readFile(abs)).toString('base64')}`;
}
