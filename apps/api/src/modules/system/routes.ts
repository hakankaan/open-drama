import { Hono } from 'hono';
import type { Health } from '@open-drama/contracts';
import { env } from '../../env';
import { ok } from '../../http/envelope';

export const systemRoutes = new Hono().get('/health', (c) =>
  ok<Health>(c, { status: 'ok', version: env.OPEN_DRAMA_VERSION, timestamp: new Date().toISOString() }),
);
