import type { ModelServiceProbe, ProviderName, ServiceType } from '@open-drama/contracts';
import { minimaxBase } from '../generation/adapters/minimax-video';
import { joinProviderUrl } from '../generation/adapters/url';

const TIMEOUT_MS = 15_000;

interface ProbeTarget {
  serviceType: ServiceType;
  provider: ProviderName;
  baseUrl: string;
  apiKey: string;
  /** The model the service runs by default; providers that check it on an empty request report its availability. */
  model?: string;
}

interface ProbeRequest {
  url: string;
  init: RequestInit;
  /** The request names the model on an official Ark host, so the answer says whether the model is available. */
  checksModel?: boolean;
}

const ARK_HOST = /(^|\.)(volces\.com|bytepluses\.com)$/i;

const isArkHost = (baseUrl: string) => {
  try {
    return ARK_HOST.test(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
};

const json = (body: unknown) => JSON.stringify(body);
const bearer = (key: string) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });

/**
 * The cheapest request per provider that proves the endpoint and the key without creating billable work:
 * listing models where the API offers it, otherwise an empty create request the provider rejects as invalid.
 */
function buildProbe({ serviceType, provider, baseUrl, apiKey, model }: ProbeTarget): ProbeRequest {
  const base = baseUrl.replace(/\/+$/, '');
  switch (provider) {
    case 'gemini':
      return { url: `${base}/models?pageSize=1`, init: { headers: { 'x-goog-api-key': apiKey } } };
    case 'volcengine':
    case 'byteplus': {
      const path =
        serviceType === 'video' ? 'contents/generations/tasks' : serviceType === 'image' ? 'images/generations' : 'chat/completions';
      // Official Ark hosts check the key, then the model, then the body: naming the model tells an inactive model
      // from a working one. Relays configured under these providers may validate in another order, so they get `{}`.
      const checksModel = Boolean(model) && isArkHost(base);
      return {
        url: `${base}/${path}`,
        init: { method: 'POST', headers: bearer(apiKey), body: json(checksModel ? { model } : {}) },
        checksModel,
      };
    }
    case 'minimax':
      return { url: joinProviderUrl(minimaxBase(base), '/v2', 'video_generation'), init: { method: 'POST', headers: bearer(apiKey), body: json({}) } };
    case 'aliyun':
      return {
        url: `${base}/services/aigc/video-generation/video-synthesis`,
        init: {
          method: 'POST',
          headers: { ...bearer(apiKey), 'X-DashScope-Async': 'enable' },
          body: json({}),
        },
      };
    case 'openai':
    default:
      return { url: `${base}/models`, init: { headers: bearer(apiKey) } };
  }
}

/** Some providers answer 200 with an error body; read what the body says about the key. */
function keyVerdict(status: number, body: string): boolean | null {
  if (status === 401 || status === 403) return false;
  if (
    /invalid[_ ]?api[_ ]?key|incorrect api key|api[_ ]?key[_ ]?(not[_ ]?valid|invalid)|API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED|authentication|unauthori[sz]ed|"status_code":\s*1004/i.test(
      body,
    )
  ) {
    return false;
  }
  if (status >= 200 && status < 300) return true;
  // A validation error on an empty request means the key passed authentication.
  if (status === 400 || status === 422) return true;
  return null;
}

/** Ark error codes (docs: ModelArk error codes) for a model that is unknown or not activated for the account. */
const MODEL_UNAVAILABLE = /^(InvalidEndpointOrModel|ModelNotOpen|OperationDenied\.ServiceNotOpen)/;
/** Ark's validation codes: returned only after the key and the model passed their checks. */
const BODY_INVALID = /^(MissingParameter|InvalidParameter)/;

const errorCode = (body: string): string => {
  try {
    const code = (JSON.parse(body) as { error?: { code?: unknown } }).error?.code;
    return typeof code === 'string' ? code : '';
  } catch {
    return '';
  }
};

export async function probeService(target: ProbeTarget): Promise<ModelServiceProbe> {
  const started = performance.now();
  const { url, init, checksModel } = buildProbe(target);
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual' });
    const body = (await res.text().catch(() => '')).slice(0, 4000);
    if (checksModel) {
      const code = errorCode(body);
      if ((res.status === 404 || res.status === 403) && MODEL_UNAVAILABLE.test(code)) {
        return {
          reachable: true,
          keyAccepted: true,
          modelAvailable: false,
          status: res.status,
          latencyMs: elapsed(),
          message: `The API key was accepted, but the model ${target.model} is not available to it (${code}). Activate the model in the provider's console or check its ID.`,
        };
      }
      if (res.status === 400 && BODY_INVALID.test(code)) {
        return {
          reachable: true,
          keyAccepted: true,
          modelAvailable: true,
          status: res.status,
          latencyMs: elapsed(),
          message: `Connected. The API key was accepted and ${target.model} is available.`,
        };
      }
    }
    const keyAccepted = keyVerdict(res.status, body);
    const reachable = [200, 204, 400, 401, 403, 422].includes(res.status);
    const message = !reachable
      ? `The endpoint answered ${res.status}. Check the base URL.`
      : keyAccepted === false
        ? 'The endpoint answered, but the API key was rejected.'
        : keyAccepted
          ? 'Connected. The API key was accepted.'
          : `The endpoint answered ${res.status}.`;
    return {
      reachable,
      keyAccepted: reachable ? keyAccepted : null,
      modelAvailable: null,
      status: res.status,
      latencyMs: elapsed(),
      message,
    };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    return {
      reachable: false,
      keyAccepted: null,
      modelAvailable: null,
      status: null,
      latencyMs: elapsed(),
      message: timedOut ? 'No answer within 15 seconds.' : `Cannot connect: ${(err as Error).message}`,
    };
  }
}
