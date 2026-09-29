import { env } from '../../../env';
import { logger } from '../../../http/logger';
import { scrubSecrets } from '../../../lib/secrets';

const OFFICIAL_HOSTS = new Set(['api.openai.com', 'generativelanguage.googleapis.com']);

export const isOfficialHost = (baseUrl: string) => {
  try {
    return OFFICIAL_HOSTS.has(new URL(baseUrl).host);
  } catch {
    return false;
  }
};

function thinkingOffPatch(provider: string): Record<string, unknown> {
  if (env.OPEN_DRAMA_AI_THINKING_OFF_PATCH) {
    try {
      const parsed: unknown = JSON.parse(env.OPEN_DRAMA_AI_THINKING_OFF_PATCH);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      logger.warn('OPEN_DRAMA_AI_THINKING_OFF_PATCH is not valid JSON; using the default');
    }
  }
  // ModelRunner's chat models take OpenAI's effort switch; Ark and most OpenAI-compatible platforms take `thinking`.
  // Set the env var for relays that differ.
  if (provider === 'modelrunner') return { reasoning_effort: 'none' };
  return { thinking: { type: 'disabled' } };
}

const seen = new Set<string>();

/**
 * Wraps fetch for text requests (Plan 2 §4). On hosts other than the official OpenAI and Gemini APIs it turns
 * thinking off and raises the output limit, because relays often default to slow thinking and small limits.
 * Keys already present in the request body are never overwritten.
 */
export function patchedFetch(provider: string, baseUrl: string): typeof fetch {
  const official = isOfficialHost(baseUrl);
  return async (input, init) => {
    const key = `${provider} ${baseUrl}`;
    if (!seen.has(key)) {
      seen.add(key);
      logger.info({ provider, baseUrl: scrubSecrets(baseUrl), patched: !official }, 'text endpoint');
    }
    if (official || !init?.body || typeof init.body !== 'string') return fetch(input, init);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      return fetch(input, init);
    }
    if (provider === 'gemini') {
      if (env.OPEN_DRAMA_AI_DISABLE_THINKING) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const gen = (body.generationConfig ??= {}) as Record<string, unknown>;
        gen.thinkingConfig ??= /gemini-3/i.test(url) ? { thinkingLevel: 'low' } : { thinkingBudget: 0 };
      }
    } else {
      if (env.OPEN_DRAMA_AI_DISABLE_THINKING) {
        for (const [k, v] of Object.entries(thinkingOffPatch(provider))) if (!(k in body)) body[k] = v;
      }
      if (!('max_tokens' in body) && !('max_completion_tokens' in body)) body.max_tokens = env.OPEN_DRAMA_AI_MAX_TOKENS;
    }
    return fetch(input, { ...init, body: JSON.stringify(body) });
  };
}
