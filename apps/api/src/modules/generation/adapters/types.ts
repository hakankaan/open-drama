import type { AspectRatio, Resolution } from '@open-drama/contracts';

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
  | { status: 'failed'; error: string; code?: string };

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
  buildGenerateRequest?(config: ServiceConfig, record: R): ProviderRequest;
  parseGenerateResponse?(body: unknown): GenerateOutcome;
  buildPollRequest?(config: ServiceConfig, providerTaskId: string): ProviderRequest;
  parsePollResponse?(body: unknown): PollOutcome;
}

export interface ImageAdapter extends Dialect<ImageRecord> {
  limits: { images: number };
}

/** Video adapters take their reference limits from the shared caps table (`videoCapsFor` in contracts). */
export interface VideoAdapter extends Dialect<VideoRecord> {
  /** The provider's token for reference image slot N (1-based), or the plain name when it has none. */
  formatMention(slot: number, name: string): string;
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
