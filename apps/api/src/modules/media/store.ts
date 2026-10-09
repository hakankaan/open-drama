import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { rename, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import sharp from 'sharp';
import { env } from '../../env';
import { logger } from '../../http/logger';
import { ffmpegBin, probeDurationSeconds, run } from '../../lib/ffmpeg';
import { downloadPublic, FetchError } from '../../lib/remote';
import { toAbsolute, toMediaPath } from '../../lib/paths';

export type Bucket = 'uploads' | 'images' | 'videos' | 'merged' | 'temp';
export type MediaKind = 'image' | 'video' | 'audio';

/** Writes bytes under a fresh uuid name (paths are never reused, so immutable caching is safe, adr-0009). */
const safeExt = (ext: string) => (/^\.[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : '');

export async function storeBuffer(bucket: Bucket, ext: string, data: Uint8Array): Promise<string> {
  const abs = join(env.storageRoot, bucket, `${randomUUID()}${safeExt(ext)}`);
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

/**
 * The raster formats a stored image may have, by the format sharp reads from the bytes. Anything else (an SVG, which
 * a browser would run scripts in, a TIFF, an HTML error page) is refused whatever its content type claimed.
 */
const IMAGE_EXT: Record<string, string> = { png: '.png', jpeg: '.jpg', webp: '.webp', gif: '.gif', avif: '.avif' };

/** The extension for the image in `abs`, from its decoded format; throws when it is not a supported raster image. */
async function imageExtOf(abs: string): Promise<string> {
  const meta = await sharp(abs)
    .metadata()
    .catch(() => null);
  const ext = meta?.format ? IMAGE_EXT[meta.format] : undefined;
  if (!meta?.width || !meta.height || !ext) throw new Error('The provider returned a file that is not a valid image');
  return ext;
}

/** Refuses a stored result that is not a decodable raster image (an HTML error page, corrupt base64, an SVG); the file is removed. */
export async function assertImage(mediaPath: string): Promise<void> {
  const abs = toAbsolute(mediaPath);
  try {
    await imageExtOf(abs);
  } catch (err) {
    await rm(abs, { force: true });
    throw err;
  }
}

/** Moves a downloaded or decoded image from temp/ into images/, named by the format its bytes have. */
async function keepImage(tempAbs: string): Promise<string> {
  const abs = join(env.storageRoot, 'images', `${randomUUID()}${await imageExtOf(tempAbs)}`);
  await rename(tempAbs, abs);
  return toMediaPath(abs);
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

/**
 * StoreRemoteFile: downloads a provider result so the provider URL is never the source of truth (adr-0009). The URL
 * comes from the provider's response, so it goes through the guarded fetch; only the service's own configured host
 * (`serviceBaseUrl`, possibly a local relay) is reached without the address check. The bytes are decoded by the caller.
 */
export async function storeRemoteFile(url: string, kind: MediaKind, serviceBaseUrl: string | undefined): Promise<string> {
  // The work is already paid for: a transient failure is tried again before the task gives up on it.
  for (let attempt = 0; ; attempt++) {
    const temp = join(env.storageRoot, 'temp', randomUUID());
    try {
      const { contentType } = await downloadPublic(url, temp, {
        what: 'result',
        maxBytes: MAX_REMOTE_BYTES,
        timeoutMs: 5 * 60_000,
        trustedHost: serviceBaseUrl ? hostOf(serviceBaseUrl) : undefined,
      });
      if (kind === 'image') return await keepImage(temp);
      const abs = join(env.storageRoot, 'videos', `${randomUUID()}${safeExt(extFor(contentType || null, url, '.mp4'))}`);
      await rename(temp, abs);
      return toMediaPath(abs);
    } catch (err) {
      await rm(temp, { force: true });
      const delay = RESULT_RETRY_DELAYS_MS[attempt];
      if (!(err instanceof FetchError && err.transient) || delay === undefined) throw err;
      logger.warn({ attempt: attempt + 1, err: err.message, retryInMs: delay }, 'result download failed; trying again');
      await sleep(delay);
    }
  }
}

/** Waits before the 2nd and 3rd download attempts of a result. */
const RESULT_RETRY_DELAYS_MS = [5_000, 20_000];

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
};

/** StoreInlineImage: base64 results (for example Gemini) become an ordinary stored file. */
export async function storeInlineImage(base64: string): Promise<string> {
  const temp = join(env.storageRoot, 'temp', randomUUID());
  await writeFile(temp, new Uint8Array(Buffer.from(base64, 'base64')));
  try {
    return await keepImage(temp);
  } catch (err) {
    await rm(temp, { force: true });
    throw err;
  }
}
