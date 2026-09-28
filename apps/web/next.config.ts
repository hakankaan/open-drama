import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: join(here, '..', '..'),
  // The contracts package ships TypeScript source (no build step).
  transpilePackages: ['@open-drama/contracts'],
  experimental: {
    // adr-0010: synchronous agent-backed endpoints and stalled media streams outlive the default 30 s.
    proxyTimeout: 15 * 60 * 1000,
    // Reference video uploads are up to 50 MB (adr-0009); the proxy default is 10 MB.
    proxyClientMaxBodySize: '60mb',
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
