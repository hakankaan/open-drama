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

/** The body keys that turn thinking on or off on an OpenAI-style relay; the env vars replace them for relays that differ. */
function thinkingPatch(provider: string, on: boolean): Record<string, unknown> {
  const name = on ? 'OPEN_DRAMA_AI_THINKING_ON_PATCH' : 'OPEN_DRAMA_AI_THINKING_OFF_PATCH';
  const override = env[name];
  if (override) {
    try {
      const parsed: unknown = JSON.parse(override);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      logger.warn(`${name} is not valid JSON; using the default`);
    }
  }
  // ModelRunner's chat models take OpenAI's effort switch; Ark and most OpenAI-compatible platforms take `thinking`.
  if (provider === 'modelrunner') return { reasoning_effort: on ? 'high' : 'none' };
  return { thinking: { type: on ? 'enabled' : 'disabled' } };
}

const seen = new Set<string>();

/**
 * Wraps fetch for text requests (Plan 2 §4). On hosts other than the official OpenAI and Gemini APIs it sets thinking
 * and raises the output limit, because relays often default to slow thinking and small limits: a `thinking` run (an
 * agent that writes something new) asks for thinking, any other turns it off unless OPEN_DRAMA_AI_DISABLE_THINKING=0.
 * Official hosts keep the model's own default. Keys already present in the request body are never overwritten.
 */
export function patchedFetch(provider: string, baseUrl: string, thinking: boolean): typeof fetch {
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
    const setThinking = thinking || env.OPEN_DRAMA_AI_DISABLE_THINKING;
    if (provider === 'gemini') {
      if (setThinking) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const gen = (body.generationConfig ??= {}) as Record<string, unknown>;
        // Gemini 3 takes a level; 2.x a token budget, where -1 lets the model size its thinking.
        gen.thinkingConfig ??= /gemini-3/i.test(url)
          ? { thinkingLevel: thinking ? 'high' : 'low' }
          : { thinkingBudget: thinking ? -1 : 0 };
      }
    } else {
      if (setThinking) {
        for (const [k, v] of Object.entries(thinkingPatch(provider, thinking))) if (!(k in body)) body[k] = v;
      }
      if (!('max_tokens' in body) && !('max_completion_tokens' in body)) body.max_tokens = env.OPEN_DRAMA_AI_MAX_TOKENS;
    }
    return fetch(input, { ...init, body: JSON.stringify(body) });
  };
}
