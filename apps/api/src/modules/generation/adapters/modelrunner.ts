import { AspectRatio, cleanModelId as clean, Resolution, type VideoProviderCaps } from '@open-drama/contracts';
import { ConfigError } from '../engine/errors';
import { readInputs, type EndpointInputs, type Field } from './modelrunner-inputs';
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

type Kind = 'image' | 'video';

/**
 * ModelRunner endpoints name the same input differently (adr-0013 amendment 5): the adapter reads each endpoint's
 * input schema and fills the fields that play a role it knows, in the endpoint's own literals. Fields with no role
 * keep the endpoint's defaults; an endpoint that requires one is refused.
 */
const ASPECT = ['aspect_ratio', 'ratio'];
const AUDIO_FLAG = ['generate_audio', 'audio'];
const IMAGE_LIST = ['reference_images', 'reference_image_urls', 'image_urls', 'images'];
const IMAGE_SLOT = /^reference_image_(\d+)$/;
const AUDIO_LIST = ['reference_audios', 'reference_audio_urls', 'audio_urls'];
const SIZE = ['size', 'image_size'];

interface Endpoint {
  id: string;
  duration?: Field;
  resolution?: Field;
  aspect?: Field;
  audioFlag?: Field;
  size?: Field;
  /** Reference images: one list field, or single-image fields in slot order (`reference_image_1`, `_2`…). */
  images?: { list: Field } | { slots: Field[] };
  /** How many reference images it takes, when its schema says. */
  imageMax?: number;
  imagesRequired: boolean;
  audios?: Field;
  audioMax?: number;
  /** How the prompt addresses reference image N, as the schema's descriptions spell it. */
  mention: 'at' | 'bracket' | 'plain';
  /** Required inputs no role fills (an image-to-video `image_url`, say): the adapter cannot drive the endpoint. */
  unfilled: string[];
  hasPrompt: boolean;
}

const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** A list's limit: `maxItems`, else the "up to N" its description states. */
function maxOf(field: Field): number | undefined {
  if (field.maxItems !== undefined) return field.maxItems;
  const m = /\b(?:up to|maximum of)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.exec(field.description);
  if (!m) return undefined;
  const word = WORDS.indexOf(m[1]!.toLowerCase());
  return word >= 0 ? word + 1 : Number(m[1]);
}

const pick = (inputs: EndpointInputs, names: string[], type?: string) =>
  names.map((n) => inputs.fields.get(n)).find((f) => f && (!type || f.types.includes(type)));

function endpointOf(inputs: EndpointInputs): Endpoint {
  const list = pick(inputs, IMAGE_LIST, 'array');
  const slots = [...inputs.fields.values()]
    .filter((f) => IMAGE_SLOT.test(f.name))
    .sort((a, b) => Number(IMAGE_SLOT.exec(a.name)![1]) - Number(IMAGE_SLOT.exec(b.name)![1]));
  const images = list ? { list } : slots.length > 0 ? { slots } : undefined;
  const audios = pick(inputs, AUDIO_LIST, 'array');
  const roles = {
    duration: inputs.fields.get('duration'),
    resolution: inputs.fields.get('resolution'),
    aspect: pick(inputs, ASPECT),
    audioFlag: pick(inputs, AUDIO_FLAG, 'boolean'),
    size: pick(inputs, SIZE),
  };
  const filled = new Set(['prompt', ...[...Object.values(roles), list, audios, ...slots].flatMap((f) => (f ? [f.name] : []))]);
  const imageFields = list ? [list] : slots;
  const prose = [inputs.fields.get('prompt'), ...imageFields].map((f) => f?.description ?? '').join(' ');
  return {
    id: inputs.endpoint,
    ...roles,
    images,
    imageMax: list ? maxOf(list) : slots.length || undefined,
    imagesRequired: imageFields.some((f) => f.required),
    audios,
    audioMax: audios && maxOf(audios),
    mention: /\[Image ?1\]/.test(prose) ? 'bracket' : /@Image ?1/.test(prose) ? 'at' : 'plain',
    unfilled: [...inputs.fields.values()].filter((f) => f.required && !filled.has(f.name)).map((f) => f.name),
    hasPrompt: inputs.fields.get('prompt')?.types.includes('string') ?? false,
  };
}

/**
 * ModelRunner splits a family by mode: `…/text-to-video` and `…/reference-to-video`; `…/edit` beside `…/text-to-image`
 * or the bare family id. The service names one; the other is found by name and used when references are (or are not)
 * sent.
 */
function siblingsOf(id: string, kind: Kind): string[] {
  const swap = (from: string, to: string[]) => (id.endsWith(from) ? to.map((t) => id.slice(0, -from.length) + t) : null);
  if (kind === 'video') return swap('/text-to-video', ['/reference-to-video']) ?? swap('/reference-to-video', ['/text-to-video']) ?? [];
  return swap('/edit', ['/text-to-image', '']) ?? swap('/text-to-image', ['/edit']) ?? [`${id}/edit`];
}

const usable = (e: Endpoint) => e.hasPrompt && e.unfilled.length === 0;

interface Pair {
  /** The endpoint for requests without reference images. */
  plain?: Endpoint;
  /** The endpoint that takes reference images. */
  referenced?: Endpoint;
}

/** The named endpoint with its mode sibling, when one exists and fits: the candidates are read together. */
async function withSibling(named: Endpoint, kind: Kind): Promise<Pair> {
  const candidates = await Promise.all(
    siblingsOf(named.id, kind).map(async (id) => {
      const inputs = await readInputs(id);
      return inputs && endpointOf(inputs);
    }),
  );
  const sibling = candidates.find((e) => e && usable(e) && (named.images ? !e.imagesRequired : Boolean(e.images))) ?? undefined;
  return named.images ? { plain: sibling, referenced: named } : { plain: named, referenced: sibling };
}

/** The endpoints a configured model runs on; ConfigError when the named one does not exist or cannot be driven. */
async function pairOf(model: string, kind: Kind): Promise<Pair> {
  const id = clean(model);
  const inputs = await readInputs(id);
  if (!inputs) throw new ConfigError(`ModelRunner has no endpoint ${id}`);
  const named = endpointOf(inputs);
  if (!named.hasPrompt) throw new ConfigError(`${id} takes no text prompt, so the ${kind} adapter cannot drive it`);
  if (named.unfilled.length > 0) {
    throw new ConfigError(`${id} requires ${named.unfilled.join(', ')}, which the ${kind} adapter does not send; pick its text or reference endpoint`);
  }
  // An endpoint whose references are optional serves both kinds of request.
  const pair = named.images && !named.imagesRequired ? { plain: named, referenced: named } : await withSibling(named, kind);
  // Every video request sets a length; an endpoint that counts frames instead cannot be timed.
  if (kind === 'video' && !pair.plain?.duration && !pair.referenced?.duration) {
    throw new ConfigError(`${id} takes no length in seconds, so the video adapter cannot time its clips`);
  }
  return pair;
}

/** The whole-second lengths a duration field allows: its literals, else every second of its range. */
function secondsOf(field: Field): number[] {
  const values = field.values.map(Number).filter((v) => Number.isInteger(v) && v > 0);
  if (values.length > 0) return [...new Set(values)].sort((a, b) => a - b);
  if (field.min === undefined || field.max === undefined) return [];
  const low = Math.max(1, Math.ceil(field.min));
  const high = Math.floor(field.max);
  return high >= low && high - low <= 600 ? Array.from({ length: high - low + 1 }, (_, i) => low + i) : [];
}

/** The nearest of the values to the target, ties going to the larger. */
const nearest = (values: number[], target: number) =>
  values.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) || (Math.abs(v - target) === Math.abs(best - target) && v > best) ? v : best));

function durationValue(field: Field, seconds: number): number | string {
  const allowed = secondsOf(field);
  const value = allowed.length > 0 ? nearest(allowed, Math.round(seconds)) : Math.round(seconds);
  return field.types.includes('string') && !field.types.includes('integer') ? String(value) : value;
}

/** Video resolution literals (`720p`, `1080P`) with their heights. */
const heightsOf = (field: Field) =>
  field.values.flatMap((v) => {
    const m = /^(\d+)p$/i.exec(String(v));
    return m ? [{ literal: v, height: Number(m[1]) }] : [];
  });
const heightOf = (tier: Resolution) => Number.parseInt(tier, 10);
const tierOf = (height: number) => Resolution.options.find((t) => heightOf(t) === nearest(Resolution.options.map(heightOf), height))!;

/** The endpoint's literal nearest a tier by height. */
function resolutionValue(field: Field, tier: Resolution): string | number | undefined {
  const literals = heightsOf(field);
  if (literals.length === 0) return undefined;
  const height = nearest(literals.map((l) => l.height), heightOf(tier));
  return literals.find((l) => l.height === height)!.literal;
}

/** Our tiers an endpoint renders: those whose literal stands for the tier again (360p and 540p both read as 480p). */
const tiersOf = (field: Field) =>
  Resolution.options.filter((tier) => {
    const literal = resolutionValue(field, tier);
    return literal !== undefined && tierOf(Number.parseInt(String(literal), 10)) === tier;
  });

/** `16:9`, `16_9`, `landscape_16_9`, `square`: the ratio a literal names, or undefined. */
function ratioOf(literal: string): number | undefined {
  const m = /(\d+(?:\.\d+)?)[:_](\d+(?:\.\d+)?)/.exec(literal);
  const r = m ? Number(m[1]) / Number(m[2]) : /^square/.test(literal) ? 1 : undefined;
  if (!r) return undefined;
  return /^portrait/.test(literal) && r > 1 ? 1 / r : r;
}

const RATIO: Record<Exclude<AspectRatio, 'adaptive'>, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 };
/** An image asked for as `adaptive` is framed 4:3 where the model cannot choose its own shape. */
const ADAPTIVE_IMAGE = 4 / 3;
const AUTO = ['adaptive', 'auto'];
const ratioGap = (a: number, b: number) => Math.abs(Math.log(a / b));

/** Whether a literal names exactly this shape (`adaptive` being the model's own choice). */
function names(literal: string, aspect: AspectRatio): boolean {
  if (aspect === 'adaptive') return AUTO.includes(literal);
  const r = ratioOf(literal);
  return r !== undefined && ratioGap(r, RATIO[aspect]) < 0.01;
}

/** The shapes an aspect field offers, or undefined when it lists none. */
function aspectsOf(field: Field): AspectRatio[] | undefined {
  const literals = field.values.map(String);
  return literals.length > 0 ? AspectRatio.options.filter((a) => literals.some((l) => names(l, a))) : undefined;
}

/**
 * A video's shape is sent exactly or refused: a clip of another shape would be letterboxed in the film. `adaptive`
 * without a literal of its own is left to the model.
 */
function videoAspect(field: Field, aspect: AspectRatio): string | undefined {
  const literals = field.values.map(String);
  if (literals.length === 0) return aspect === 'adaptive' ? undefined : aspect;
  const match = literals.find((l) => names(l, aspect));
  if (match || (aspect === 'adaptive' && !field.required)) return match;
  throw new ConfigError(`This model renders no ${aspect} video; it offers ${literals.join(', ')}`);
}

/**
 * A mode that cannot be told the shape while its sibling can (Veo 3.1's reference endpoint) is taken to render the
 * sibling's default; a request for another shape is refused before anything is paid.
 */
function assertDefaultShape(target: Endpoint, sibling: Endpoint | undefined, aspect: AspectRatio) {
  if (target.aspect || !sibling?.aspect || aspect === 'adaptive') return;
  const assumed = typeof sibling.aspect.default === 'string' ? sibling.aspect.default : undefined;
  if (assumed && names(assumed, aspect)) return;
  throw new ConfigError(
    `${target.id} cannot be told the shape${assumed ? ` and renders ${assumed}` : ''}, so it cannot make a ${aspect} video; generate without reference images or pick another model`,
  );
}

/** An image takes the nearest shape the model offers: assets are framed, not composited. */
function imageAspect(field: Field, aspect: AspectRatio): string | undefined {
  const literals = field.values.map(String);
  const auto = aspect === 'adaptive' ? literals.find((l) => AUTO.includes(l)) : undefined;
  if (auto || literals.length === 0) return auto ?? (aspect === 'adaptive' ? undefined : aspect);
  const target = aspect === 'adaptive' ? ADAPTIVE_IMAGE : RATIO[aspect];
  const ratios = literals.flatMap((l) => {
    const r = ratioOf(l);
    return r ? [{ l, gap: ratioGap(r, target) }] : [];
  });
  return ratios.length > 0 ? ratios.reduce((best, c) => (c.gap < best.gap ? c : best)).l : undefined;
}

/** Image sizes are compared by ratio first, then by how close they come to the 2K tier the other adapters render. */
const TARGET_PIXELS = 2048 * 2048;
const TIER_EDGE: Record<string, number> = { '512': 512, '1k': 1024, '2k': 2048, '4k': 4096 };

function pixelsOf(literal: string): number {
  const wxh = /^(\d+)x(\d+)$/.exec(literal);
  if (wxh) return Number(wxh[1]) * Number(wxh[2]);
  const tier = /_(512|1k|2k|4k)$/i.exec(literal);
  if (tier) return TIER_EDGE[tier[1]!.toLowerCase()]! ** 2;
  // Named presets: only `square_hd` is larger than the rest.
  return literal.endsWith('_hd') ? 1024 ** 2 : 768 * 1024;
}

function sizeValue(field: Field, aspect: AspectRatio): string | undefined {
  const literals = field.values.map(String);
  if (aspect === 'adaptive' && literals.includes('auto')) return 'auto';
  const target = aspect === 'adaptive' ? ADAPTIVE_IMAGE : RATIO[aspect];
  const scored = literals.flatMap((l) => {
    const wxh = /^(\d+)x(\d+)$/.exec(l);
    const r = wxh ? Number(wxh[1]) / Number(wxh[2]) : ratioOf(l);
    return r ? [{ l, ratio: ratioGap(r, target), pixels: ratioGap(pixelsOf(l), TARGET_PIXELS) }] : [];
  });
  if (scored.length === 0) return undefined;
  return scored.reduce((best, c) =>
    c.ratio < best.ratio - 1e-9 || (Math.abs(c.ratio - best.ratio) <= 1e-9 && c.pixels < best.pixels) ? c : best,
  ).l;
}

/** Image `resolution` tiers (`1k`, `2k`): the largest up to 2K, else the smallest. */
function imageTierValue(field: Field): string | undefined {
  const tiers = field.values.map(String).filter((v) => /^\d+k$/i.test(v)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  return tiers.filter((t) => parseInt(t, 10) <= 2).at(-1) ?? tiers[0];
}

function placeImages(body: Record<string, unknown>, endpoint: Endpoint, images: string[]) {
  if (images.length === 0 || !endpoint.images) return;
  if ('list' in endpoint.images) body[endpoint.images.list.name] = images;
  else endpoint.images.slots.forEach((slot, i) => images[i] !== undefined && (body[slot.name] = images[i]));
}

const set = (body: Record<string, unknown>, field: Field | undefined, value: unknown) => {
  if (field && value !== undefined) body[field.name] = value;
};

const MENTION: Record<Endpoint['mention'], (slot: number, name: string) => string> = {
  at: (slot, name) => `${name} (@Image${slot})`,
  bracket: (slot, name) => `${name} ([Image ${slot}])`,
  plain: (_slot, name) => name,
};

/** Catalog endpoints worth offering in the model picker, by their category or their reference mode's name. */
export function offersEndpoint(kind: Kind, model: string, category?: string | null): boolean {
  const id = clean(model);
  if (kind === 'video') return category === 'text-to-video' || id.endsWith('/reference-to-video');
  return (category === 'text-to-image' && !id.endsWith('/text-to-vector')) || id.endsWith('/edit');
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

/** Statuses that end a request without a result. */
const FAILED_STATUSES = new Set(['FAILED', 'ERROR', 'CANCELLED', 'CANCELED']);

/**
 * The status endpoint: COMPLETED means the result can be read; a failed status, or an error on a record that is not
 * queued or running, ends the task. Anything else is pending: an unexpected body must not fail a request the
 * provider may still be rendering, and the poll timeout bounds the wait.
 */
function parseStatus(body: unknown): PollOutcome {
  const req = (body && typeof body === 'object' ? body : {}) as QueueRequest;
  const status = typeof req.status === 'string' ? req.status.toUpperCase() : undefined;
  if (status === 'COMPLETED') return { status: 'ready' };
  const error = errorText(req.error) || errorText(req.detail);
  const working = status === 'IN_QUEUE' || status === 'IN_PROGRESS';
  if ((status && FAILED_STATUSES.has(status)) || (error && !working)) {
    return { status: 'failed', error: error || `The ModelRunner request ended as ${status}` };
  }
  return { status: 'pending' };
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

/** Reference images an edit endpoint takes when its schema states no limit. */
const DEFAULT_IMAGE_REFS = 10;

/** ModelRunner queue, image endpoints: submit, then poll the request's result URL. */
export const modelrunnerImage: ImageAdapter = {
  provider: 'modelrunner',
  limits: { images: DEFAULT_IMAGE_REFS },
  // Inline reference images make the submit body large on a slow link.
  submitTimeoutMs: 120_000,
  async describeModel(model) {
    const { referenced } = await pairOf(model, 'image');
    return { images: referenced ? (referenced.imageMax ?? DEFAULT_IMAGE_REFS) : 0 };
  },
  async buildGenerateRequest(config, record) {
    const pair = await pairOf(config.model, 'image');
    const referencing = record.referenceImages.length > 0;
    const target = referencing ? pair.referenced : pair.plain;
    if (!target) {
      throw new ConfigError(`${clean(config.model)} ${referencing ? 'takes no reference images' : 'needs reference images, and none were sent'}`);
    }
    const body: Record<string, unknown> = { prompt: record.prompt };
    set(body, target.size, target.size && sizeValue(target.size, record.aspectRatio));
    set(body, target.aspect, target.aspect && imageAspect(target.aspect, record.aspectRatio));
    set(body, target.resolution, target.resolution && imageTierValue(target.resolution));
    placeImages(body, target, record.referenceImages);
    return submit(config, target.id, body);
  },
  ...polling,
};

/** What the two endpoints share, else the one that states it; the plain endpoint's when they share nothing. */
function shared<T>(plain: T[] | undefined, referenced: T[] | undefined): T[] | undefined {
  if (!plain?.length) return referenced?.length ? referenced : undefined;
  if (!referenced?.length) return plain;
  const both = plain.filter((x) => referenced.includes(x));
  return both.length > 0 ? both : plain;
}

/**
 * What a video model accepts, read from its endpoints: references from the reference endpoint (none without one),
 * length, tiers and shapes those both endpoints take. Only what the schemas state is returned; the rest keeps the
 * provider's defaults.
 */
async function describeVideo(model: string) {
  const { plain, referenced } = await pairOf(model, 'video');
  const both = <T>(of: (e: Endpoint) => T[] | undefined) => shared(plain && of(plain), referenced && of(referenced));
  const caps: Partial<VideoProviderCaps> = {
    images: referenced ? referenced.imageMax : 0,
    videos: 0,
    audios: plain?.audios ? plain.audioMax : referenced?.audios ? referenced.audioMax : 0,
    audioNeedsVisual: !plain?.audios && Boolean(referenced?.audios && referenced.imagesRequired),
    // A model without a resolution input renders one tier, so there is nothing to pick.
    resolutions: both((e) => e.resolution && tiersOf(e.resolution)) ?? [],
    aspectRatios: both((e) => e.aspect && aspectsOf(e.aspect)),
  };
  const seconds = both((e) => e.duration && secondsOf(e.duration));
  if (seconds) {
    caps.durationRange = [seconds[0]!, seconds.at(-1)!];
    // Discrete lengths only matter when they leave gaps (Veo's 4, 6 or 8 s).
    if (seconds.length <= seconds.at(-1)! - seconds[0]!) caps.durations = seconds;
  }
  for (const key of Object.keys(caps) as (keyof VideoProviderCaps)[]) if (caps[key] === undefined) delete caps[key];
  return { caps, formatMention: MENTION[(referenced ?? plain)?.mention ?? 'plain'] };
}

/** ModelRunner queue, video endpoints: references are addressed in the prompt the way the endpoint describes. */
export const modelrunnerVideo: VideoAdapter = {
  provider: 'modelrunner',
  submitTimeoutMs: 120_000,
  formatMention: MENTION.at,
  describeModel: describeVideo,
  async buildGenerateRequest(config, record) {
    if (record.referenceVideos.length > 0) throw new ConfigError('The ModelRunner video adapter sends no reference videos');
    const pair = await pairOf(config.model, 'video');
    const referencing = record.referenceImages.length > 0 || (record.referenceAudios.length > 0 && !pair.plain?.audios);
    const target = referencing ? pair.referenced : pair.plain;
    if (!target) {
      throw new ConfigError(`${clean(config.model)} ${referencing ? 'takes no reference images' : 'needs reference images, and none were sent'}`);
    }
    assertDefaultShape(target, target === pair.plain ? pair.referenced : pair.plain, record.aspectRatio);
    const body: Record<string, unknown> = { prompt: record.prompt };
    set(body, target.duration, target.duration && durationValue(target.duration, record.durationSeconds));
    set(body, target.resolution, target.resolution && resolutionValue(target.resolution, record.resolution));
    set(body, target.aspect, target.aspect && videoAspect(target.aspect, record.aspectRatio));
    set(body, target.audioFlag, record.generateAudio);
    placeImages(body, target, record.referenceImages);
    if (record.referenceAudios.length > 0) set(body, target.audios, record.referenceAudios);
    return submit(config, target.id, body);
  },
  ...polling,
};
