import type { TaskErrorClass } from '@open-drama/contracts';
import { scrubSecrets } from '../../../lib/secrets';
import { ProviderError } from '../adapters/types';

const MODERATION =
  /sensitive|moderat|policy|safety|inappropriate|real[- ]?person|celebrit|copyright|OutputVideoSensitiveContentDetected|InputTextSensitiveContentDetected|InputImageSensitiveContentDetected|blocked/i;

export class ConfigError extends Error {}

/** Maps a failure to TaskErrorClass so the UI can explain it (and suggest switching models on moderation). */
export function classify(err: unknown): TaskErrorClass {
  if (err instanceof ConfigError) return 'config';
  const message = err instanceof Error ? err.message : String(err);
  const status = err instanceof ProviderError ? err.status : undefined;
  const code = err instanceof ProviderError ? (err.code ?? '') : '';
  if (MODERATION.test(message) || MODERATION.test(code)) return 'moderation';
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'quota';
  if ((err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) || /timed? ?out/i.test(message)) {
    return 'timeout';
  }
  return 'provider';
}

/** The failure text stored on a task and shown in the UI, with any echoed secret scrubbed. */
export const messageOf = (err: unknown) => scrubSecrets(err instanceof Error ? err.message : String(err)).slice(0, 1000);
