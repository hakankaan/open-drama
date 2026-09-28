import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { env } from '../../env';
import { logger } from '../../http/logger';
import { ffmpegBin, run } from '../../lib/ffmpeg';
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
