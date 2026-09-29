import { cleanModelId as clean, type AspectRatio } from '@open-drama/contracts';
import { ConfigError } from '../engine/errors';
import { joinProviderUrl } from './url';
import {
  ProviderError,
  type GenerateOutcome,
  type ImageAdapter,
  type PollOutcome,
  type ProviderRequest,
  type ServiceConfig,
  type VideoAdapter,
} from './types';

/** The Seedream and Seedance families, whose ModelRunner schemas this adapter maps (adr-0013). */
const IMAGE_FAMILY = /^bytedance\/seedream-/;
const VIDEO_FAMILY = /^bytedance\/seedance-/;

/**
 * ModelRunner splits a family by mode, each with its own inputs: `…/text-to-image` has no references and `…/edit`
 * requires them; likewise `…/text-to-video` and `…/reference-to-video`. The service names one of the pair and the
 * request uses the one that fits whether references were sent. Endpoints without a mode suffix are used as named;
 * other modes are refused.
 */
const MODE_PAIRS = { image: ['/text-to-image', '/edit'], video: ['/text-to-video', '/reference-to-video'] } as const;

function endpointFor(model: string, kind: 'image' | 'video', withReferences: boolean): string {
  const endpoint = clean(model);
  const family = kind === 'image' ? IMAGE_FAMILY : VIDEO_FAMILY;
  if (!family.test(endpoint)) {
    throw new ConfigError(
      `The ModelRunner ${kind} adapter drives ${kind === 'image' ? 'bytedance/seedream-*' : 'bytedance/seedance-*'} endpoints; ${model} is not one`,
    );
  }
  const [plain, referenced] = MODE_PAIRS[kind];
  // Other modes (image-to-video, first-last-frame, video-to-video) take inputs this adapter does not map.
  const mode = endpoint.split('/').slice(2).join('/');
  if (mode && `/${mode}` !== plain && `/${mode}` !== referenced) {
    throw new ConfigError(`The ModelRunner ${kind} adapter drives the ${plain.slice(1)} and ${referenced.slice(1)} endpoints; ${model} is not one`);
  }
  if (withReferences && endpoint.endsWith(plain)) return endpoint.slice(0, -plain.length) + referenced;
  if (!withReferences && endpoint.endsWith(referenced)) return endpoint.slice(0, -referenced.length) + plain;
  return endpoint;
}

const headers = (config: ServiceConfig) => ({ Authorization: `Key ${config.apiKey}`, 'Content-Type': 'application/json' });

const submit = (config: ServiceConfig, endpoint: string, input: Record<string, unknown>): ProviderRequest => ({
  url: joinProviderUrl(config.baseUrl, '', endpoint),
  method: 'POST',
  headers: headers(config),
  body: JSON.stringify(input),
  redirect: 'error',
});

interface QueueRequest {
  request_id?: string;
  requestId?: string;
  status?: string;
  output?: unknown;
  error?: unknown;
  detail?: unknown;
}

/** Outputs are per model: a URL, a list of URLs, or an object carrying them (`url`, `images[]`, `video`). */
function firstUrl(output: unknown): string | undefined {
  if (typeof output === 'string') return /^https?:\/\//.test(output) ? output : undefined;
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = firstUrl(item);
      if (url) return url;
    }
    return undefined;
  }
  if (output && typeof output === 'object') {
    const o = output as Record<string, unknown>;
    return firstUrl(o.url) ?? firstUrl(o.images) ?? firstUrl(o.video) ?? firstUrl(o.image) ?? firstUrl(o.videos);
  }
  return undefined;
}

/** Errors arrive as a string, `{ message }`, or fal-style `{ detail }` (a string or a list of `{ msg }`). */
function errorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (Array.isArray(error)) return error.map(errorText).filter(Boolean).join('; ');
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; msg?: unknown; detail?: unknown };
    return errorText(e.message ?? e.msg ?? e.detail);
  }
  return '';
}

/** A request's status and result live under the endpoint's `owner/alias`, whatever mode subpath ran it. */
const appOf = (model: string) => clean(model).split('/').slice(0, 2).join('/');

/**
 * The queue answers a submit with a request id. Like ModelRunner's own clients, the adapter reads status and result
 * at `{owner}/{alias}/requests/{id}` on the service's origin, so the key never goes to a host the provider named.
 */
function parseSubmit(body: unknown, config: ServiceConfig): GenerateOutcome {
  const req = body as QueueRequest;
  const id = req.request_id ?? req.requestId;
  if (!id || !/^[\w-]+$/.test(id)) {
    const fields = body && typeof body === 'object' ? Object.keys(body).join(', ') : typeof body;
    throw new ProviderError(errorText(req.error) || `ModelRunner answered the submit without a request id (${fields})`);
  }
  return { kind: 'async', providerTaskId: `${appOf(config.model)}/requests/${id}` };
}

const queueGet = (config: ServiceConfig, path: string): ProviderRequest => ({
  url: new URL(path, new URL(config.baseUrl).origin + '/').href,
  method: 'GET',
  headers: { Authorization: `Key ${config.apiKey}` },
  redirect: 'error',
});

/** The status endpoint: queued and running are pending, COMPLETED means the result can be read. */
function parseStatus(body: unknown): PollOutcome {
  const req = body as QueueRequest;
  switch (req.status) {
    case 'IN_QUEUE':
    case 'IN_PROGRESS':
      return { status: 'pending' };
    case 'COMPLETED':
      return { status: 'ready' };
    default:
      return {
        status: 'failed',
        error: errorText(req.error) || errorText(req.detail) || `The ModelRunner request ended as ${req.status ?? 'an unknown status'}`,
      };
  }
}

/** The result is the request record (`{ status, output, error }`) or the bare output; a set `error` means it failed. */
function parseResult(body: unknown): PollOutcome {
  const record = body && typeof body === 'object' && !Array.isArray(body) && 'output' in body ? (body as QueueRequest) : null;
  if (record?.status === 'IN_QUEUE' || record?.status === 'IN_PROGRESS') return { status: 'pending' };
  const error = errorText((body as QueueRequest | null)?.error) || errorText((body as QueueRequest | null)?.detail);
  if (error) return { status: 'failed', error };
  const url = firstUrl(record ? record.output : body);
  return url ? { status: 'completed', url } : { status: 'failed', error: 'The ModelRunner request completed without an output URL' };
}

const polling = {
  parseGenerateResponse: parseSubmit,
  buildPollRequest: (config: ServiceConfig, path: string) => queueGet(config, `${path}/status`),
  parsePollResponse: parseStatus,
  buildResultRequest: (config: ServiceConfig, path: string) => queueGet(config, path),
  parseResultResponse: parseResult,
};

// Seedream 5 size presets at the 2K tier, the resolution the other image adapters generate at.
const SIZE: Record<AspectRatio, string> = {
  '16:9': '2752x1536',
  '9:16': '1536x2752',
  '1:1': '2048x2048',
  adaptive: '2400x1792',
};

/** ModelRunner queue (Seedream): submit, then poll the request's result URL. */
export const modelrunnerImage: ImageAdapter = {
  provider: 'modelrunner',
  limits: { images: 10 },
  // Inline reference images make the submit body large on a slow link.
  submitTimeoutMs: 120_000,
  buildGenerateRequest(config, record) {
    const refs = record.referenceImages.length > 0;
    return submit(config, endpointFor(config.model, 'image', refs), {
      prompt: record.prompt,
      size: SIZE[record.aspectRatio],
      ...(refs ? { image_urls: record.referenceImages } : {}),
    });
  },
  ...polling,
};

/** ModelRunner queue (Seedance): references are addressed in the prompt as @ImageN, numbered by array order. */
export const modelrunnerVideo: VideoAdapter = {
  provider: 'modelrunner',
  submitTimeoutMs: 120_000,
  formatMention: (slot, name) => `${name} (@Image${slot})`,
  buildGenerateRequest(config, record) {
    const refs = record.referenceImages.length > 0;
    if (record.referenceVideos.length > 0) throw new ConfigError('The ModelRunner Seedance endpoints used here take no reference videos');
    return submit(config, endpointFor(config.model, 'video', refs), {
      prompt: record.prompt,
      duration: record.durationSeconds,
      resolution: record.resolution,
      aspect_ratio: record.aspectRatio,
      generate_audio: record.generateAudio,
      ...(refs ? { reference_images: record.referenceImages } : {}),
      ...(record.referenceAudios.length > 0 ? { reference_audios: record.referenceAudios } : {}),
    });
  },
  ...polling,
};
