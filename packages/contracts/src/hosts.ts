// The WHATWG URL both runtimes have; this package's lib is plain ES.
declare const URL: new (input: string) => { hostname: string };

/** The hostname of a Host header, a URL or a bare name; undefined when it is none of them. */
export function hostnameOf(value: string): string | undefined {
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname || undefined;
  } catch {
    return undefined;
  }
}

/** The hostnames of the configured URLs and of a comma-separated OPEN_DRAMA_ALLOWED_HOSTS. */
export function allowedHostnames(urls: (string | undefined)[], list: string | undefined): string[] {
  return [...urls, ...(list ?? '').split(',')]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v))
    .map(hostnameOf)
    .filter((v): v is string => v !== undefined);
}

/**
 * adr-0010: the names Open Drama answers to. It has no accounts, so a page on another site whose name is made to
 * resolve to this machine (DNS rebinding) must not reach it. IP literals and localhost cannot be an attacker's
 * name; any other name is served only when the operator listed it.
 */
export function hostAllowed(host: string | null | undefined, names: readonly string[]): boolean {
  const hostname = host ? hostnameOf(host) : undefined;
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  return names.includes(hostname);
}

/** The refusal both servers give a name that is not allowed. */
export const hostRefusal = (host: string | null | undefined) =>
  `${host || 'This address'} is not an address Open Drama answers to; add its name to OPEN_DRAMA_ALLOWED_HOSTS`;
