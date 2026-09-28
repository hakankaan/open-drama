import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { env } from '../../../env';
import { toAbsolute } from '../../../lib/paths';
import { ConfigError } from './errors';

const MAX_EDGE = 768;

async function compress(input: Buffer | string): Promise<string> {
  const jpeg = await sharp(input).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 68 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/**
 * Reference images for a provider (Plan 2 §8): data URLs pass through, stored `static/…` paths and remote URLs
 * become compressed JPEG data URLs (fit in 768 px, quality 68); duplicates are dropped and the list is capped.
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
      const res = await fetch(ref, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`Fetching a reference image failed (${res.status})`);
      out.push(await compress(Buffer.from(await res.arrayBuffer())));
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
