/** Joins a service base URL with a path, adding the provider's version prefix when the base is a bare host. */
export function joinProviderUrl(baseUrl: string, prefix: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  let withPrefix = base;
  try {
    if (prefix && new URL(base).pathname === '/') withPrefix = base + prefix;
  } catch {
    // Invalid URLs fail at fetch time with a clear error.
  }
  return `${withPrefix}/${path.replace(/^\/+/, '')}`;
}

/** Splits a data URL into mime type and base64 payload. */
export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  return m ? { mimeType: m[1]!, data: m[2]! } : null;
}
