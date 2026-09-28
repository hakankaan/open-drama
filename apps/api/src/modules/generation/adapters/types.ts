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

/** A provider result: an URL to download, or inline base64 bytes. */
export interface ResultMedia {
  url?: string;
  base64?: { data: string; mimeType: string };
  durationSeconds?: number;
}

export type GenerateOutcome = { kind: 'async'; providerTaskId: string } | ({ kind: 'result' } & ResultMedia);

export type PollOutcome =
  | { status: 'pending' }
  | ({ status: 'completed' } & ResultMedia)
  | { status: 'failed'; error: string };

/**
 * One provider dialect for images (adr-0005): builds requests and parses responses; the engine owns the
 * lifecycle. `generateLocal` replaces HTTP for offline adapters.
 */
export interface ImageAdapter {
  provider: string;
  limits: { images: number };
  generateLocal?(record: ImageRecord): Promise<GenerateOutcome>;
  buildGenerateRequest?(config: ServiceConfig, record: ImageRecord): ProviderRequest;
  parseGenerateResponse?(body: unknown): GenerateOutcome;
  buildPollRequest?(config: ServiceConfig, providerTaskId: string): ProviderRequest;
  parsePollResponse?(body: unknown): PollOutcome;
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
