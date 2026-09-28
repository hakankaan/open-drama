import { Hono, type Context } from 'hono';
import { created, ok } from '../../http/envelope';
import { getStorageUsage } from './storage-usage';
import type { MediaKind } from './store';
import { uploadMedia } from './upload';

const upload = (kind: MediaKind) => async (c: Context) => {
  const body = await c.req.parseBody();
  return created(c, await uploadMedia(body.file, kind));
};

export const mediaRoutes = new Hono()
  .post('/media/upload/image', upload('image'))
  .post('/media/upload/video', upload('video'))
  .post('/media/upload/audio', upload('audio'))
  .get('/storage', (c) => ok(c, getStorageUsage()));
