// Fetching a URL the server did not choose: reference images someone typed into the app, and the result URLs a
// provider hands back. The server must not become a way into itself or its cloud host: loopback, link-local (cloud
// metadata) and unspecified addresses are refused, checked on the address actually connected to (so DNS rebinding is
// covered) and again on every redirect. LAN addresses stay allowed: on a self-hosted tool, pointing at an image on
// your own network is a normal use. Requests go out directly: an operator-enabled environment proxy
// (NODE_USE_ENV_PROXY) would resolve hosts itself and bypass this check.
import { lookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { createWriteStream, type WriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
blocked.addSubnet('0.0.0.0', 8, 'ipv4');
blocked.addSubnet('127.0.0.0', 8, 'ipv4');
blocked.addSubnet('169.254.0.0', 16, 'ipv4');
blocked.addAddress('100.100.100.200', 'ipv4'); // Alibaba Cloud metadata
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');
blocked.addSubnet('fd00:ec2::', 32, 'ipv6'); // AWS IPv6 metadata

function isBlocked(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return blocked.check(mapped, 'ipv4');
  return blocked.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
}

/** A failed fetch; `transient` when trying again later may succeed (a timeout, a dropped connection, a 5xx, a 429). */
export class FetchError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
  }
}

const refused = (host: string) => new FetchError(`The address of ${host} is not allowed (loopback, link-local or cloud metadata)`, false);

/** dns.lookup that refuses blocked addresses; handles both the single and the `all` form Node's sockets use. */
function safeLookup(
  hostname: string,
  options: LookupOptions,
  callback: (err: Error | null, address: string | LookupAddress[], family?: number) => void,
) {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    if (addresses.length === 0 || addresses.some((a) => isBlocked(a.address))) return callback(refused(hostname), '');
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0]!.address, addresses[0]!.family);
  });
}

export interface FetchedFile {
  bytes: Buffer;
  contentType: string;
}

export interface DownloadedFile {
  contentType: string;
  size: number;
}

export interface FetchOptions {
  /** Names the file in error messages ("reference image", "result"). */
  what: string;
  maxBytes: number;
  timeoutMs: number;
  /** The content type must match; any type is taken when omitted (the caller decodes the bytes itself). */
  accept?: RegExp;
  /** A host the operator configured (a provider's base URL): reached without the address check, even on loopback. */
  trustedHost?: string;
}

/**
 * GETs a public http(s) URL into memory: at most `maxBytes` (the stream is cut off beyond it), at most 3 redirects,
 * and everything, redirects included, must finish within `timeoutMs`.
 */
export async function fetchPublic(url: string, opts: FetchOptions): Promise<FetchedFile> {
  const chunks: Buffer[] = [];
  const { contentType, size } = await get(url, opts, Date.now() + opts.timeoutMs, 0, () => ({
    write: (chunk) => void chunks.push(chunk),
    end: async () => {},
    abort: async () => {},
  }));
  return { bytes: Buffer.concat(chunks, size), contentType };
}

/** fetchPublic streamed into `file` instead of memory (a result video); a partial file is removed on any failure. */
export function downloadPublic(url: string, file: string, opts: FetchOptions): Promise<DownloadedFile> {
  return get(url, opts, Date.now() + opts.timeoutMs, 0, (res) => {
    const out: WriteStream = createWriteStream(file);
    return {
      write: (chunk) => {
        // Disk slower than the network: hold the response until the file catches up.
        if (!out.write(chunk)) {
          res.pause();
          out.once('drain', () => res.resume());
        }
      },
      end: () =>
        new Promise<void>((resolve, reject) => {
          out.once('error', reject);
          out.end(resolve);
        }),
      abort: async () => {
        out.destroy();
        await rm(file, { force: true });
      },
      onError: (fail) => out.once('error', fail),
    };
  });
}

interface Sink {
  write(chunk: Buffer): void;
  end(): Promise<void>;
  abort(): Promise<void>;
  onError?(fail: (err: Error) => void): void;
}

const httpFailure = (what: string, status: number) =>
  new FetchError(`Fetching the ${what} failed (${status})`, status >= 500 || status === 429 || status === 408);

function get(url: string, opts: FetchOptions, deadline: number, hops: number, open: (res: http.IncomingMessage) => Sink): Promise<DownloadedFile> {
  return new Promise((resolve, reject) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return reject(new FetchError(`The ${opts.what} URL is not valid`, false));
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return reject(new FetchError(`The ${opts.what} URL must be http or https`, false));
    const host = target.hostname.replace(/^\[|\]$/g, '');
    const trusted = opts.trustedHost !== undefined && host === opts.trustedHost.replace(/^\[|\]$/g, '').toLowerCase();
    if (!trusted && isIP(host) && isBlocked(host)) return reject(refused(host));
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new FetchError(`Fetching the ${opts.what} timed out`, true));

    let sink: Sink | null = null;
    let settled = false;
    const client = target.protocol === 'https:' ? https : http;
    // Every way out destroys the request, so a discarded or endless response never keeps the socket open.
    const req = client.get(target, { lookup: trusted ? undefined : safeLookup, timeout: remaining }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        let next: string;
        try {
          next = new URL(res.headers.location, target).toString();
        } catch {
          return fail(new FetchError(`The ${opts.what} URL redirects to an address that is not valid`, false));
        }
        done();
        settled = true;
        if (hops >= 3) return reject(new FetchError(`The ${opts.what} URL redirects too often`, false));
        return get(next, opts, deadline, hops + 1, open).then(resolve, reject);
      }
      if (status !== 200) return fail(httpFailure(opts.what, status));
      const contentType = String(res.headers['content-type'] ?? '');
      if (opts.accept && !opts.accept.test(contentType)) {
        return fail(new FetchError(`The ${opts.what} URL returned the wrong kind of file (${contentType || 'no content type'})`, false));
      }
      const into = open(res);
      sink = into;
      into.onError?.(fail);
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > opts.maxBytes) return fail(new FetchError(`The ${opts.what} is larger than ${Math.round(opts.maxBytes / 1024 / 1024)} MB`, false));
        into.write(chunk);
      });
      res.on('end', () => {
        if (settled) return;
        clearTimeout(timer);
        into.end().then(
          () => {
            settled = true;
            resolve({ contentType, size });
          },
          (err: Error) => fail(err),
        );
      });
      res.on('error', fail);
    });
    // The socket timeout catches a stalled connection; this one bounds the whole exchange (a trickling server too).
    const timer = setTimeout(() => fail(new FetchError(`Fetching the ${opts.what} timed out`, true)), remaining);
    function done() {
      clearTimeout(timer);
      req.destroy();
    }
    function fail(err: Error) {
      if (settled) return;
      settled = true;
      done();
      const reason = err instanceof FetchError ? err : new FetchError(err.message, true);
      void (sink?.abort() ?? Promise.resolve()).finally(() => reject(reason));
    }
    req.on('timeout', () => fail(new FetchError(`Fetching the ${opts.what} timed out`, true)));
    // A socket error (reset, refused, DNS) may pass; the address check's refusal is final.
    req.on('error', (err) => fail(err instanceof FetchError ? err : new FetchError(err.message, true)));
  });
}
