import { createMiddleware } from 'hono/factory';
import { allowedHostnames, hostAllowed, hostRefusal } from '@open-drama/contracts';
import { env } from '../env';
import { forbidden } from './errors';

const names = allowedHostnames([env.PUBLIC_BASE_URL, env.WEB_ORIGIN, env.API_ORIGIN], env.OPEN_DRAMA_ALLOWED_HOSTS);
/** The pages Open Drama is served from, as exact origins: another port or scheme on the same name is another site. */
const pageOrigins = new Set([env.PUBLIC_BASE_URL, env.WEB_ORIGIN].flatMap((url) => (url && originOf(url)) || []));
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * adr-0010: whoever reaches Open Drama can spend its keys, so it refuses requests a browser makes for another site.
 * The Host must be a name it answers to (no DNS rebinding straight to this port; the web server checks the Host the
 * browser used). A request that changes something must come from Open Drama's own page: the browser says so in
 * Sec-Fetch-Site, or, in one too old to send it, the Origin is the address the request went to (the web server
 * forwards that as X-Forwarded-Host, which a page on another site cannot set without a preflight) or a configured
 * page origin. Requests without either header do not come from a page, so they are not a page's forgery.
 */
export const requestGuard = createMiddleware(async (c, next) => {
  const host = c.req.header('host');
  if (!hostAllowed(host, names)) throw forbidden(hostRefusal(host));
  if (!SAFE_METHODS.has(c.req.method) && !fromOwnPage(c.req.header('sec-fetch-site'), c.req.header('origin'), c.req.header('x-forwarded-host') ?? host)) {
    throw forbidden('Open Drama refuses changes requested by another site');
  }
  await next();
});

function fromOwnPage(site: string | undefined, origin: string | undefined, addressed: string | undefined): boolean {
  if (site) return site === 'same-origin' || site === 'none';
  if (!origin) return true;
  const from = originOf(origin);
  if (from !== undefined && pageOrigins.has(from)) return true;
  return addressed !== undefined && origin.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '') === addressed;
}

function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
