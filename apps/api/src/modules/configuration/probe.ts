import type { ModelServiceProbe, ProviderName, ServiceType } from '@open-drama/contracts';

const TIMEOUT_MS = 15_000;

interface ProbeTarget {
  serviceType: ServiceType;
  provider: ProviderName;
  baseUrl: string;
  apiKey: string;
}

interface ProbeRequest {
  url: string;
  init: RequestInit;
}

const json = (body: unknown) => JSON.stringify(body);
const bearer = (key: string) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });

/**
 * The cheapest request per provider that proves the endpoint and the key without creating billable work:
 * listing models where the API offers it, otherwise an empty create request the provider rejects as invalid.
 */
function buildProbe({ serviceType, provider, baseUrl, apiKey }: ProbeTarget): ProbeRequest {
  const base = baseUrl.replace(/\/+$/, '');
  switch (provider) {
    case 'gemini':
      return { url: `${base}/models?pageSize=1`, init: { headers: { 'x-goog-api-key': apiKey } } };
    case 'volcengine': {
      const path =
        serviceType === 'video' ? 'contents/generations/tasks' : serviceType === 'image' ? 'images/generations' : 'chat/completions';
      return { url: `${base}/${path}`, init: { method: 'POST', headers: bearer(apiKey), body: json({}) } };
    }
    case 'minimax':
      return { url: `${base}/video_generation`, init: { method: 'POST', headers: bearer(apiKey), body: json({}) } };
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

export async function probeService(target: ProbeTarget): Promise<ModelServiceProbe> {
  const started = performance.now();
  const { url, init } = buildProbe(target);
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual' });
    const body = (await res.text().catch(() => '')).slice(0, 4000);
    const keyAccepted = keyVerdict(res.status, body);
    const reachable = [200, 204, 400, 401, 403, 422].includes(res.status);
    const message = !reachable
      ? `The endpoint answered ${res.status}. Check the base URL.`
      : keyAccepted === false
        ? 'The endpoint answered, but the API key was rejected.'
        : keyAccepted
          ? 'Connected. The API key was accepted.'
          : `The endpoint answered ${res.status}.`;
    return { reachable, keyAccepted: reachable ? keyAccepted : null, status: res.status, latencyMs: elapsed(), message };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    return {
      reachable: false,
      keyAccepted: null,
      status: null,
      latencyMs: elapsed(),
      message: timedOut ? 'No answer within 15 seconds.' : `Cannot connect: ${(err as Error).message}`,
    };
  }
}
