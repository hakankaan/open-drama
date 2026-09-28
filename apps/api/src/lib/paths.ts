import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { env } from '../env';
import { ApiError } from '../http/errors';

/**
 * Resolves a stored media path (`static/…`, with or without a leading slash) to an absolute path under the
 * storage root. Anything escaping the root is refused.
 */
export function toAbsolute(mediaPath: string): string {
  const cleaned = mediaPath.replace(/^\/+/, '').replace(/^static\//, '');
  const abs = resolve(env.storageRoot, cleaned);
  const rel = relative(env.storageRoot, abs);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new ApiError('VALIDATION_FAILED', 'Path is outside the storage root');
  }
  return abs;
}

/** Absolute path under the storage root → stored relative media path (`static/…`). */
export function toMediaPath(abs: string): string {
  return 'static/' + relative(env.storageRoot, abs).split(sep).join('/');
}

/** Browser URL of a stored media path (same origin through the web proxy). */
export const mediaUrl = (mediaPath: string) => '/' + mediaPath.replace(/^\/+/, '');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};

export const mimeOf = (path: string) => MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
