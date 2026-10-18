import type { AgentType } from '@open-drama/contracts';
import { env } from '../../../env';
import { precondition } from '../../../http/errors';
import { rememberSecret } from '../../../lib/secrets';
import { resolveService } from '../../configuration/services';
import { AGENTS } from '../agents/definitions';
import { buildLanguageModel, type LanguageModel } from './sdk';
import { stubLanguageModel } from './stub-model';
import { patchedFetch } from './transport-patches';

type ServiceRow = NonNullable<ReturnType<typeof resolveService>>['row'];

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
 * the service's default model; it thinks when the agent writes something new. With OPEN_DRAMA_STUB_PROVIDERS=1 a
 * scripted offline model is used instead.
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
  if (!resolved) throw precondition('Add an active text service with an API key in Settings before running an agent');
  return modelOf(resolved.row, opts.modelOverride || opts.promptModel || resolved.row.models[0], AGENTS[opts.agentType].thinking);
}

/**
 * Vision service (adr-0022): a chat model the creator declared able to read images, for shot checks. Explicit id,
 * else the active one; model: the request's, else the service's first. Offline with OPEN_DRAMA_STUB_PROVIDERS=1.
 */
export function resolveVisionModel(opts: { model?: string; serviceId?: number }): ResolvedModel {
  if (env.OPEN_DRAMA_STUB_PROVIDERS) {
    return { model: stubLanguageModel(), modelId: 'stub-vision', serviceId: null };
  }
  const resolved = resolveService('vision', { explicitId: opts.serviceId });
  if (!resolved) throw precondition('Add an active vision service (a chat model that reads images) in Settings to check shots');
  return modelOf(resolved.row, opts.model || resolved.row.models[0], false);
}

function modelOf(row: ServiceRow, modelId: string | undefined, thinking: boolean): ResolvedModel {
  if (!modelId) throw precondition(`The ${row.serviceType} service ${row.name} lists no model; add one in Settings`);
  if (!row.apiKey) throw precondition(`The ${row.serviceType} service ${row.name} has no API key`);
  rememberSecret(row.apiKey);
  return {
    model: buildLanguageModel({
      provider: row.provider,
      baseURL: withPrefix(row.provider, row.baseUrl),
      apiKey: row.apiKey,
      modelId,
      fetch: patchedFetch(row.provider, row.baseUrl, thinking),
    }),
    modelId,
    serviceId: row.id,
    temperature: row.settings.temperature ?? undefined,
  };
}
