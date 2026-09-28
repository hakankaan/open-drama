import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { API_BASE, STATIC_PREFIX } from '@open-drama/contracts';
import { env } from './env';
import { ApiError } from './http/errors';
import { logger, requestLogger } from './http/logger';
import { agentsRoutes } from './modules/agents/routes';
import { assetsRoutes } from './modules/assets/routes';
import { configurationRoutes } from './modules/configuration/routes';
import { generationRoutes } from './modules/generation/routes';
import { mediaRoutes } from './modules/media/routes';
import { productionRoutes } from './modules/production/routes';
import { serveStatic } from './modules/media/static';
import { storyboardRoutes } from './modules/storyboard/routes';
import { systemRoutes } from './modules/system/routes';

export function createApp() {
  const app = new Hono();

  app.use('*', requestLogger);
  // Production traffic is same-origin through the Next proxy (adr-0010); CORS only helps direct calls in dev.
  if (!env.isProduction) app.use(`${API_BASE}/*`, cors({ origin: env.WEB_ORIGIN }));

  const api = new Hono()
    .route('/', systemRoutes)
    .route('/', configurationRoutes)
    .route('/', productionRoutes)
    .route('/', assetsRoutes)
    .route('/', storyboardRoutes)
    .route('/', generationRoutes)
    .route('/', mediaRoutes)
    .route('/', agentsRoutes);
  app.route(API_BASE, api);

  app.on(['GET', 'HEAD'], `${STATIC_PREFIX}/*`, (c) => serveStatic(c));

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: `No route for ${c.req.method} ${c.req.path}` } }, 404),
  );

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
    }
    // Hono's own request errors (e.g. malformed JSON) are client errors.
    if (err instanceof HTTPException && err.status < 500) {
      return c.json({ error: { code: 'VALIDATION_FAILED', message: err.message } }, 400);
    }
    logger.error({ err, method: c.req.method, path: c.req.path }, 'unhandled error');
    return c.json({ error: { code: 'INTERNAL', message: 'Internal server error' } }, 500);
  });

  return app;
}
