import type { AgentType } from '@open-drama/contracts';
import { env } from '../../../env';
import { precondition } from '../../../http/errors';
import { resolveService } from '../../configuration/services';
import { buildLanguageModel, type LanguageModel } from './sdk';
import { stubLanguageModel } from './stub-model';
import { patchedFetch } from './transport-patches';

export interface ResolvedModel {
  model: LanguageModel;
  modelId: string;
  serviceId: number | null;
  temperature?: number;
}

/** OpenAI-style endpoints live under /v1 and Gemini under /v1beta; a bare host gets the prefix added. */
function withPrefix(provider: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const prefix = provider === 'openai' ? '/v1' : provider === 'gemini' ? '/v1beta' : '';
  if (!prefix) return base;
  try {
    return new URL(base).pathname === '/' ? base + prefix : base;
  } catch {
    return base;
  }
}

/**
 * Text service: explicit id, else the active one. Model: request override, else the prompt file's `model`, else
 * the service's default model. With OPEN_DRAMA_STUB_PROVIDERS=1 a scripted offline model is used instead.
 */
export function resolveTextModel(opts: {
  agentType: AgentType;
  modelOverride?: string;
  promptModel?: string | null;
  textServiceId?: number;
}): ResolvedModel {
  if (env.OPEN_DRAMA_STUB_PROVIDERS) {
    return { model: stubLanguageModel(), modelId: 'stub-text', serviceId: null };
  }
  const resolved = resolveService('text', { explicitId: opts.textServiceId });
  if (!resolved) throw precondition('Add an active text service in Settings before running an agent');
  const { row } = resolved;
  const modelId = opts.modelOverride || opts.promptModel || row.models[0];
  if (!modelId) throw precondition(`The text service ${row.name} lists no model; add one in Settings`);
  if (!row.apiKey) throw precondition(`The text service ${row.name} has no API key`);
  return {
    model: buildLanguageModel({
      provider: row.provider,
      baseURL: withPrefix(row.provider, row.baseUrl),
      apiKey: row.apiKey,
      modelId,
      fetch: patchedFetch(row.provider, row.baseUrl),
    }),
    modelId,
    serviceId: row.id,
    temperature: row.settings.temperature ?? undefined,
  };
}
