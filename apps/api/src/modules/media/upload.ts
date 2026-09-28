import { extname } from 'node:path';
import {
  AUDIO_UPLOAD_EXTENSIONS,
  AUDIO_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_EXTENSIONS,
  IMAGE_UPLOAD_MAX_BYTES,
  VIDEO_UPLOAD_EXTENSIONS,
  VIDEO_UPLOAD_MAX_BYTES,
  type UploadedMedia,
} from '@open-drama/contracts';
import { invalid } from '../../http/errors';
import { mediaUrl } from '../../lib/paths';
import { deriveRenditions, storeBuffer, type MediaKind } from './store';

const RULES: Record<MediaKind, { extensions: readonly string[]; maxBytes: number; limit: string }> = {
  image: { extensions: IMAGE_UPLOAD_EXTENSIONS, maxBytes: IMAGE_UPLOAD_MAX_BYTES, limit: '20 MB' },
  video: { extensions: VIDEO_UPLOAD_EXTENSIONS, maxBytes: VIDEO_UPLOAD_MAX_BYTES, limit: '50 MB' },
  audio: { extensions: AUDIO_UPLOAD_EXTENSIONS, maxBytes: AUDIO_UPLOAD_MAX_BYTES, limit: '20 MB' },
};

/**
 * UploadMedia: validated by extension, size and, when the browser sends a real one, by MIME type. Images get a
 * thumbnail and videos a poster; everything lands in the uploads bucket under a fresh name.
 */
export async function uploadMedia(file: unknown, kind: MediaKind): Promise<UploadedMedia> {
  if (!(file instanceof File)) throw invalid(`Send the ${kind} as a multipart field named "file"`);
  const rule = RULES[kind];
  const ext = extname(file.name).toLowerCase();
  if (!rule.extensions.includes(ext)) {
    throw invalid(`Unsupported ${kind} type ${ext || '(none)'}; use ${rule.extensions.join(', ')}`);
  }
  if (file.type && file.type !== 'application/octet-stream' && !file.type.startsWith(`${kind}/`)) {
    throw invalid(`The file is ${file.type}, not ${kind === 'image' ? 'an image' : `a ${kind} file`}`);
  }
  if (file.size === 0) throw invalid('The file is empty');
  if (file.size > rule.maxBytes) throw invalid(`${kind[0]!.toUpperCase()}${kind.slice(1)} files are limited to ${rule.limit}`);
  const path = await storeBuffer('uploads', ext, new Uint8Array(await file.arrayBuffer()));
  await deriveRenditions(path, kind);
  return { path, url: mediaUrl(path) };
}
