import { NextResponse, type NextRequest } from 'next/server';
import { allowedHostnames, hostAllowed, hostRefusal } from '@open-drama/contracts';

/**
 * adr-0010: the browser only talks to this server. /api and /static are forwarded to the API origin, read at
 * request time so one build can point at any API host. Only here is the Host the browser used still visible (the
 * API sees the API origin's), so this is where a name that is not Open Drama's is refused (DNS rebinding).
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get('host');
  const names = allowedHostnames([process.env.PUBLIC_BASE_URL], process.env.OPEN_DRAMA_ALLOWED_HOSTS);
  if (!hostAllowed(host, names)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: hostRefusal(host) } }, { status: 403 });
  }
  const origin = process.env.API_ORIGIN ?? 'http://localhost:4000';
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, origin);
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ['/api/:path*', '/static/:path*'],
};
