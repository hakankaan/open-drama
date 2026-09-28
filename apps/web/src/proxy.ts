import { NextResponse, type NextRequest } from 'next/server';

/**
 * adr-0010: the browser only talks to this server. /api and /static are forwarded to the API origin, read at
 * request time so one build can point at any API host.
 */
export function proxy(request: NextRequest) {
  const origin = process.env.API_ORIGIN ?? 'http://localhost:4000';
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, origin);
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ['/api/:path*', '/static/:path*'],
};
