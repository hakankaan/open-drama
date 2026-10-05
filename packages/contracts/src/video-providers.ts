import { z } from 'zod';
import { AspectRatio, Resolution, type ProviderName } from './common';

const Count = z.number().int().nonnegative();

/**
 * What a video provider accepts (adr-0013), shared by the API's request validation and the studio's pickers.
 * Reference counts are per kind; `audioNeedsVisual` means reference audio needs at least one image or video.
 */
export const VideoProviderCaps = z.object({
  images: Count,
  videos: Count,
  audios: Count,
  /** Cap on all references together, when the provider has one. */
  total: Count.optional(),
  audioNeedsVisual: z.boolean(),
  /** Whole seconds the provider can generate; requests are clamped into it. */
  durationRange: z.tuple([Count, Count]),
  /** The only lengths the model renders, when it does not take every second of the range (Veo 4, 6 or 8 s). */
  durations: z.array(Count).optional(),
  /** The tiers worth offering; other stored resolutions map to the nearest one. Empty when the model has no choice. */
  resolutions: z.array(Resolution),
  /** The shapes the model renders, when it states them; a video of any other shape is refused rather than reshaped. */
  aspectRatios: z.array(AspectRatio).optional(),
});
export type VideoProviderCaps = z.infer<typeof VideoProviderCaps>;

/** The model a video request would use, for asking what it accepts (`GET /video-models/caps`). */
export const VideoCapsQuery = z.object({
  provider: z.string().min(1).max(40),
  model: z.string().max(200).optional(),
});

/** A provider's defaults; `VIDEO_MODEL_CAPS` refines them for the models of a family that differ. */
export const VIDEO_PROVIDER_CAPS: Partial<Record<ProviderName, VideoProviderCaps>> = {
  // Ark Seedance 2.0 (Volcengine and BytePlus ModelArk publish the same limits).
  volcengine: { images: 9, videos: 3, audios: 3, audioNeedsVisual: true, durationRange: [4, 15], resolutions: ['480p', '720p', '1080p'] },
  byteplus: { images: 9, videos: 3, audios: 3, audioNeedsVisual: true, durationRange: [4, 15], resolutions: ['480p', '720p', '1080p'] },
  // ModelRunner's Seedance 2.0 reference-to-video endpoint. Each model's own limits are read from its endpoints'
  // input schemas (adr-0013 amendment 5); these apply only while they cannot be read.
  modelrunner: { images: 9, videos: 0, audios: 3, audioNeedsVisual: true, durationRange: [4, 15], resolutions: ['480p', '720p', '1080p'] },
  minimax: { images: 9, videos: 3, audios: 3, total: 12, audioNeedsVisual: false, durationRange: [4, 15], resolutions: ['720p', '1080p'] },
  aliyun: { images: 10, videos: 5, audios: 5, total: 20, audioNeedsVisual: false, durationRange: [2, 30], resolutions: ['480p', '720p', '1080p'] },
};

const ARK_SEEDANCE_25: Partial<VideoProviderCaps> = {
  images: 30,
  videos: 10,
  audios: 10,
  audioNeedsVisual: false,
  durationRange: [4, 30],
};
const ARK_SEEDANCE_20_LITE: Partial<VideoProviderCaps> = { resolutions: ['480p', '720p'] };

/**
 * Models whose limits differ from their provider's defaults, first match wins. Sources: the Seedance 2.5 tutorials of
 * Volcengine Ark and BytePlus ModelArk (model comparison table) and the MiniMax V2 video API reference.
 */
const VIDEO_MODEL_CAPS: Partial<Record<ProviderName, { model: RegExp; caps: Partial<VideoProviderCaps> }[]>> = {
  volcengine: [
    { model: /seedance-2-5/i, caps: ARK_SEEDANCE_25 },
    { model: /seedance-2-0-(fast|mini)/i, caps: ARK_SEEDANCE_20_LITE },
  ],
  byteplus: [
    { model: /seedance-2-5/i, caps: ARK_SEEDANCE_25 },
    { model: /seedance-2-0-(fast|mini)/i, caps: ARK_SEEDANCE_20_LITE },
  ],
  minimax: [{ model: /-max\b/i, caps: { durationRange: [5, 15], resolutions: ['480p', '720p'] } }],
};

/** Caps of the offline stub adapter, and the fallback for a provider without an entry. */
export const DEFAULT_VIDEO_CAPS: VideoProviderCaps = {
  images: 9,
  videos: 3,
  audios: 3,
  audioNeedsVisual: true,
  durationRange: [2, 15],
  resolutions: ['480p', '720p', '1080p'],
};

/** A model id as configured, without surrounding whitespace or leading and trailing slashes. */
export const cleanModelId = (model: string) => model.trim().replace(/^\/+|\/+$/g, '');

/** What a provider's model accepts: the provider's defaults, refined by the model's own limits where they differ. */
export function videoCapsFor(provider: string | null | undefined, model?: string | null): VideoProviderCaps {
  const base = (provider && VIDEO_PROVIDER_CAPS[provider as ProviderName]) || DEFAULT_VIDEO_CAPS;
  const id = model ? cleanModelId(model) : '';
  const refined = id ? VIDEO_MODEL_CAPS[provider as ProviderName]?.find((m) => m.model.test(id)) : undefined;
  return refined ? { ...base, ...refined.caps } : base;
}

/** The whole seconds a model renders for a requested length: clamped into its range, then the nearest allowed length (ties go longer). */
export function clampDuration(caps: VideoProviderCaps, seconds: number): number {
  const [min, max] = caps.durationRange;
  const clamped = Math.min(max, Math.max(min, Math.round(seconds)));
  if (!caps.durations?.length) return clamped;
  return caps.durations.reduce((best, d) => {
    const gap = Math.abs(d - clamped) - Math.abs(best - clamped);
    return gap < 0 || (gap === 0 && d > best) ? d : best;
  });
}

/** The tier a model renders for a requested resolution: the highest it offers up to the request, else its lowest. */
export function fitResolution(caps: VideoProviderCaps, requested: Resolution): Resolution {
  const tiers = Resolution.options.filter((r) => caps.resolutions.includes(r));
  const upTo = tiers.filter((r) => Resolution.options.indexOf(r) <= Resolution.options.indexOf(requested));
  return upTo.at(-1) ?? tiers[0] ?? requested;
}
