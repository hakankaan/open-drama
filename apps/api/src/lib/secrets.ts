// Secret scrubbing for text that leaves the process (task and job errors shown in the UI, log lines). Provider
// error bodies sometimes echo a request back; a key must never reach the database, the UI or the logs from there.

const known = new Set<string>();

/** Registers a key the process is about to send, so an echo of it is scrubbed even when it has no known shape. */
export function rememberSecret(value: string): void {
  if (value.length >= 8) known.add(value);
}

const PATTERNS: [RegExp, string][] = [
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [redacted]'],
  [/\b(?:sk|pk|ak|rk)-[A-Za-z0-9_-]{12,}/g, '[redacted]'],
  [/\bAIza[0-9A-Za-z_-]{20,}/g, '[redacted]'],
  [/([?&](?:api[_-]?key|key|token|access_token|sig|signature|x-amz-signature|x-goog-signature)=)[^&\s"'#]+/gi, '$1[redacted]'],
  [/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[redacted]@'],
];

export function scrubSecrets(text: string): string {
  let out = text;
  for (const secret of known) if (out.includes(secret)) out = out.split(secret).join('[redacted]');
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}
