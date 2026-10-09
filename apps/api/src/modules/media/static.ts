import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import type { Context } from 'hono';
import { STATIC_PREFIX } from '@open-drama/contracts';
import { mimeOf, toAbsolute } from '../../lib/paths';

const notFound = () => new Response('Not found', { status: 404 });

/**
 * Serves the storage root under /static with immutable caching (file names are never reused, adr-0009)
 * and single-range requests so video seeking and paused-then-resumed playback work.
 */
export function serveStatic(c: Context): Response {
  let abs: string;
  try {
    abs = toAbsolute(decodeURIComponent(c.req.path.slice(STATIC_PREFIX.length)));
  } catch {
    return notFound();
  }
  let size: number;
  try {
    const st = statSync(abs);
    if (!st.isFile()) return notFound();
    size = st.size;
  } catch {
    return notFound();
  }

  const headers = new Headers({
    'Content-Type': mimeOf(abs),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    // The type is the one the name says; a browser never second-guesses it into something it would run.
    'X-Content-Type-Options': 'nosniff',
  });

  const range = c.req.header('range');
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (range && !match) {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  if (match) {
    const [, s, e] = match;
    let start: number;
    let end: number;
    if (s === '') {
      const suffix = Number(e);
      start = Math.max(0, size - suffix);
      end = size - 1;
    } else {
      start = Number(s);
      end = e === '' ? size - 1 : Math.min(Number(e), size - 1);
    }
    if (start > end || start >= size) {
      headers.set('Content-Range', `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    if (c.req.method === 'HEAD') return new Response(null, { status: 206, headers });
    const stream = Readable.toWeb(createReadStream(abs, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set('Content-Length', String(size));
  if (c.req.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(Readable.toWeb(createReadStream(abs)) as ReadableStream, { status: 200, headers });
}
