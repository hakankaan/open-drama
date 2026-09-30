// Fetching a URL the server did not choose: reference images someone typed into the app, and the result URLs a
// provider hands back. The server must not become a way into itself or its cloud host: loopback, link-local (cloud
// metadata) and unspecified addresses are refused, checked on the address actually connected to (so DNS rebinding is
// covered) and again on every redirect. LAN addresses stay allowed: on a self-hosted tool, pointing at an image on
// your own network is a normal use. Requests go out directly: an operator-enabled environment proxy
// (NODE_USE_ENV_PROXY) would resolve hosts itself and bypass this check.
import { lookup, type LookupAddress, type LookupOptions } from 'node:dns';
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

const refused = (host: string) => new Error(`The address of ${host} is not allowed (loopback, link-local or cloud metadata)`);

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
export function fetchPublic(url: string, opts: FetchOptions): Promise<FetchedFile> {
  return get(url, opts, Date.now() + opts.timeoutMs, 0);
}

function get(url: string, opts: FetchOptions, deadline: number, hops: number): Promise<FetchedFile> {
  return new Promise((resolve, reject) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return reject(new Error(`The ${opts.what} URL is not valid`));
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return reject(new Error(`The ${opts.what} URL must be http or https`));
    const host = target.hostname.replace(/^\[|\]$/g, '');
    const trusted = opts.trustedHost !== undefined && host === opts.trustedHost.replace(/^\[|\]$/g, '').toLowerCase();
    if (!trusted && isIP(host) && isBlocked(host)) return reject(refused(host));
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new Error(`Fetching the ${opts.what} timed out`));

    const client = target.protocol === 'https:' ? https : http;
    // Every way out destroys the request, so a discarded or endless response never keeps the socket open.
    const req = client.get(target, { lookup: trusted ? undefined : safeLookup, timeout: remaining }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        const next = new URL(res.headers.location, target).toString();
        done();
        if (hops >= 3) return reject(new Error(`The ${opts.what} URL redirects too often`));
        return get(next, opts, deadline, hops + 1).then(resolve, reject);
      }
      if (status !== 200) return fail(new Error(`Fetching the ${opts.what} failed (${status})`));
      const contentType = String(res.headers['content-type'] ?? '');
      if (opts.accept && !opts.accept.test(contentType)) {
        return fail(new Error(`The ${opts.what} URL returned the wrong kind of file (${contentType || 'no content type'})`));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > opts.maxBytes) return fail(new Error(`The ${opts.what} is larger than ${Math.round(opts.maxBytes / 1024 / 1024)} MB`));
        chunks.push(chunk);
      });
      res.on('end', () => {
        clearTimeout(timer);
        resolve({ bytes: Buffer.concat(chunks, size), contentType });
      });
      res.on('error', fail);
    });
    // The socket timeout catches a stalled connection; this one bounds the whole exchange (a trickling server too).
    const timer = setTimeout(() => fail(new Error(`Fetching the ${opts.what} timed out`)), remaining);
    function done() {
      clearTimeout(timer);
      req.destroy();
    }
    function fail(err: Error) {
      done();
      reject(err);
    }
    req.on('timeout', () => fail(new Error(`Fetching the ${opts.what} timed out`)));
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
