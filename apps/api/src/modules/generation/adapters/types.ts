import type { AspectRatio, Resolution, VideoProviderCaps } from '@open-drama/contracts';

export interface ServiceConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ProviderRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string | FormData;
  /** Redirect handling; `error` for requests that carry a key a redirect target must not receive. */
  redirect?: 'follow' | 'error' | 'manual';
}

export interface ImageRecord {
  taskId: number;
  prompt: string;
  /** Normalised reference images as data URLs (at most `limits.images`). */
  referenceImages: string[];
  /** The shape the image should have. */
  aspectRatio: AspectRatio;
  resolution?: Resolution;
}

export interface VideoRecord {
  taskId: number;
  /** The prompt with mentions already rendered in the provider's token syntax. */
  prompt: string;
  /** Reference images as data URLs, in slot order (slot N is index N-1). */
  referenceImages: string[];
  /** Reference videos and audio as URLs the provider can fetch. */
  referenceVideos: string[];
  referenceAudios: string[];
  /** Whole seconds, already clamped into the provider's range. */
  durationSeconds: number;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  generateAudio: boolean;
}

/** A provider result: an URL to download, inline base64 bytes, or a file an offline adapter already stored. */
export interface ResultMedia {
  url?: string;
  base64?: { data: string; mimeType: string };
  /** A stored media path (`static/…`). */
  file?: string;
  durationSeconds?: number;
}

export type GenerateOutcome = { kind: 'async'; providerTaskId: string } | ({ kind: 'result' } & ResultMedia);

export type PollOutcome =
  | { status: 'pending' }
  | ({ status: 'completed' } & ResultMedia)
  | { status: 'failed'; error: string; code?: string }
  /** The provider finished; the result is read with a separate request (`buildResultRequest`). */
  | { status: 'ready' };

/**
 * One provider dialect (adr-0005): builds requests and parses responses; the engine owns the lifecycle.
 * `generateLocal` replaces HTTP for offline adapters.
 */
export interface Dialect<R> {
  provider: string;
  /**
   * How long the generate request may take. Asynchronous providers answer with a task id within seconds, so they
   * set a short one; synchronous image APIs render before answering and keep the engine's default.
   */
  submitTimeoutMs?: number;
  generateLocal?(record: R): Promise<GenerateOutcome>;
  /** Async for adapters that read the model's inputs from the provider first (ModelRunner). */
  buildGenerateRequest?(config: ServiceConfig, record: R): ProviderRequest | Promise<ProviderRequest>;
  parseGenerateResponse?(body: unknown, config: ServiceConfig): GenerateOutcome;
  buildPollRequest?(config: ServiceConfig, providerTaskId: string): ProviderRequest;
  parsePollResponse?(body: unknown): PollOutcome;
  /** For providers whose status endpoint does not carry the result: read it once the poll says `ready`. */
  buildResultRequest?(config: ServiceConfig, providerTaskId: string): ProviderRequest;
  parseResultResponse?(body: unknown): PollOutcome;
}

export interface ImageAdapter extends Dialect<ImageRecord> {
  limits: { images: number };
  /** The configured model's own limit, for adapters that read it from the provider; it replaces `limits`. */
  describeModel?(model: string): Promise<{ images: number }>;
}

export type FormatMention = (slot: number, name: string) => string;

/** Video adapters take their reference limits from the shared caps table (`videoCapsFor` in contracts). */
export interface VideoAdapter extends Dialect<VideoRecord> {
  /** The provider's token for reference image slot N (1-based), or the plain name when it has none. */
  formatMention: FormatMention;
  /**
   * What the configured model accepts, for adapters that read it from the provider: the caps it states (laid over
   * the table's) and its mention syntax when that differs per model.
   */
  describeModel?(model: string): Promise<{ caps: Partial<VideoProviderCaps>; formatMention?: FormatMention }>;
}

/** An error the provider reported, with its HTTP status when there was one. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}
