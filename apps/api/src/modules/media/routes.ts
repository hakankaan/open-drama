import { Hono } from 'hono';
import { created, ok } from '../../http/envelope';
import { getStorageUsage } from './storage-usage';
import { uploadImage } from './upload';

export const mediaRoutes = new Hono()
  .post('/media/upload/image', async (c) => {
    const body = await c.req.parseBody();
    return created(c, await uploadImage(body.file));
  })
  .get('/storage', (c) => ok(c, getStorageUsage()));
