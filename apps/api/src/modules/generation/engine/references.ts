import sharp from 'sharp';
import { toAbsolute } from '../../../lib/paths';

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
