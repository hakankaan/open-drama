import pino from 'pino';
import type { MiddlewareHandler } from 'hono';
import { env } from '../env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['apiKey', '*.apiKey', 'headers.authorization', '*.headers.authorization', 'authorization'],
    censor: '[redacted]',
  },
  ...(env.isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
});

/** One line per request: method, path, status, duration. Bodies are never logged. */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  await next();
  const ms = Math.round(performance.now() - start);
  const status = c.res.status;
  const line = { method: c.req.method, path: c.req.path, status, ms };
  if (status >= 500) logger.error(line, 'request');
  else logger.info(line, 'request');
};
