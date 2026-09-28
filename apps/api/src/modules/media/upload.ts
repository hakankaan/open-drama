import { extname } from 'node:path';
import { IMAGE_UPLOAD_EXTENSIONS, IMAGE_UPLOAD_MAX_BYTES, type UploadedMedia } from '@open-drama/contracts';
import { invalid } from '../../http/errors';
import { mediaUrl } from '../../lib/paths';
import { deriveRenditions, storeBuffer } from './store';

/** UploadMedia (image): validated by extension and, when the browser sends a real one, by MIME type. */
export async function uploadImage(file: unknown): Promise<UploadedMedia> {
  if (!(file instanceof File)) throw invalid('Send the image as a multipart field named "file"');
  const ext = extname(file.name).toLowerCase();
  if (!(IMAGE_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    throw invalid(`Unsupported image type ${ext || '(none)'}; use ${IMAGE_UPLOAD_EXTENSIONS.join(', ')}`);
  }
  if (file.type && file.type !== 'application/octet-stream' && !file.type.startsWith('image/')) {
    throw invalid(`The file is ${file.type}, not an image`);
  }
  if (file.size === 0) throw invalid('The file is empty');
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) throw invalid('Images are limited to 20 MB');
  const path = await storeBuffer('uploads', ext, new Uint8Array(await file.arrayBuffer()));
  await deriveRenditions(path, 'image');
  return { path, url: mediaUrl(path) };
}
