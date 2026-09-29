import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { created, ok } from '../../http/envelope';
import { invalid } from '../../http/errors';
import { getStorageUsage } from './storage-usage';
import type { MediaKind } from './store';
import { UPLOAD_RULES, uploadMedia } from './upload';

// The request body is capped while it streams in, before the multipart parser holds it in memory; 1 MB covers the
// multipart framing around the largest allowed file.
const limit = (kind: MediaKind) =>
  bodyLimit({
    maxSize: UPLOAD_RULES[kind].maxBytes + 1024 * 1024,
    onError: () => {
      throw invalid(`${kind[0]!.toUpperCase()}${kind.slice(1)} files are limited to ${UPLOAD_RULES[kind].limit}`);
    },
  });

const upload = (kind: MediaKind) => async (c: Context) => {
  const body = await c.req.parseBody();
  return created(c, await uploadMedia(body.file, kind));
};

export const mediaRoutes = new Hono()
  .post('/media/upload/image', limit('image'), upload('image'))
  .post('/media/upload/video', limit('video'), upload('video'))
  .post('/media/upload/audio', limit('audio'), upload('audio'))
  .get('/storage', (c) => ok(c, getStorageUsage()));
