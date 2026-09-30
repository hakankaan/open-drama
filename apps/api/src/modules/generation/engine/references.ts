import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { env } from '../../../env';
import { toAbsolute } from '../../../lib/paths';
import { fetchPublic } from '../../../lib/remote';
import { ConfigError } from './errors';

const MAX_EDGE = 768;
/** Remote reference images are read into memory before compression; the upload limit applies to them too. */
const REMOTE_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

async function compress(input: Buffer | string): Promise<string> {
  const jpeg = await sharp(input).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 68 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

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
