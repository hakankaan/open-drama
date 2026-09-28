import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { env } from '../../env';
import { logger } from '../../http/logger';
import { ffmpegBin, probeDurationSeconds, run } from '../../lib/ffmpeg';
import { toAbsolute, toMediaPath } from '../../lib/paths';

export type Bucket = 'uploads' | 'images' | 'videos' | 'merged' | 'temp';
export type MediaKind = 'image' | 'video' | 'audio';

/** Writes bytes under a fresh uuid name (paths are never reused, so immutable caching is safe, adr-0009). */
export async function storeBuffer(bucket: Bucket, ext: string, data: Uint8Array): Promise<string> {
  const safeExt = /^\.[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : '';
  const abs = join(env.storageRoot, bucket, `${randomUUID()}${safeExt}`);
  await writeFile(abs, data);
  return toMediaPath(abs);
}

const renditionPath = (abs: string, suffix: string) => abs.slice(0, abs.length - extname(abs).length) + suffix;

/**
 * DeriveRenditions: a 400 px WebP thumbnail for images, a 640 px JPEG poster at 0.5 s for videos. Never throws:
 * a missing rendition is tolerated by the UI.
 */
export async function deriveRenditions(mediaPath: string, kind: MediaKind): Promise<void> {
  try {
    const abs = toAbsolute(mediaPath);
    if (!existsSync(abs)) return;
    if (kind === 'image') {
      await sharp(abs, { animated: false })
        .rotate()
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(renditionPath(abs, '_thumb.webp'));
    } else if (kind === 'video') {
      const out = renditionPath(abs, '_poster.jpg');
      const result = await run(
        ffmpegBin(),
        ['-y', '-ss', '0.5', '-i', abs, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', out],
        30_000,
      );
      if (result.code !== 0) logger.warn({ mediaPath, stderr: result.stderr.slice(-400) }, 'poster extraction failed');
    }
  } catch (err) {
    logger.warn({ mediaPath, err: (err as Error).message }, 'rendition failed');
  }
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
};

const extFor = (mime: string | null, url: string, fallback: string) => {
  const byMime = mime ? EXT_BY_MIME[mime.split(';')[0]!.trim().toLowerCase()] : undefined;
  if (byMime) return byMime;
  const fromUrl = /\.([a-z0-9]{2,5})(?:$|[?#])/i.exec(new URL(url).pathname)?.[1];
  return fromUrl ? `.${fromUrl.toLowerCase()}` : fallback;
};

const MAX_REMOTE_BYTES = 200 * 1024 * 1024;

/** Refuses a stored result that is not a decodable image (an HTML error page, corrupt base64); the file is removed. */
export async function assertImage(mediaPath: string): Promise<void> {
  const abs = toAbsolute(mediaPath);
  try {
    const meta = await sharp(abs).metadata();
    if (!meta.width || !meta.height) throw new Error('no dimensions');
  } catch {
    await rm(abs, { force: true });
    throw new Error('The provider returned a file that is not a valid image');
  }
}

/** Refuses a stored result that is not a playable video and returns its duration; the file is removed on refusal. */
export async function assertVideo(mediaPath: string): Promise<number> {
  const abs = toAbsolute(mediaPath);
  const seconds = await probeDurationSeconds(abs);
  if (seconds === null) {
    await rm(abs, { force: true });
    throw new Error('The provider returned a file that is not a valid video');
  }
  return seconds;
}

/** StoreRemoteFile: downloads a provider result so the provider URL is never the source of truth (adr-0009). */
export async function storeRemoteFile(url: string, kind: MediaKind): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5 * 60_000) });
  if (!res.ok) throw new Error(`Downloading the result failed (${res.status})`);
  if (Number(res.headers.get('content-length') ?? 0) > MAX_REMOTE_BYTES) throw new Error('The result file is too large');
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_REMOTE_BYTES) throw new Error('The result file is too large');
  const bucket: Bucket = kind === 'image' ? 'images' : 'videos';
  return storeBuffer(bucket, extFor(res.headers.get('content-type'), url, kind === 'image' ? '.png' : '.mp4'), bytes);
}

/** StoreInlineImage: base64 results (for example Gemini) become an ordinary stored file. */
export async function storeInlineImage(base64: string, mimeType: string): Promise<string> {
  return storeBuffer('images', EXT_BY_MIME[mimeType] ?? '.png', new Uint8Array(Buffer.from(base64, 'base64')));
}
