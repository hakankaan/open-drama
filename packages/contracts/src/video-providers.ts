import type { ProviderName, Resolution } from './common';

/**
 * What a video provider accepts (adr-0013), shared by the API's request validation and the studio's pickers.
 * Reference counts are per kind; `audioNeedsVisual` means reference audio needs at least one image or video.
 */
export interface VideoProviderCaps {
  images: number;
  videos: number;
  audios: number;
  /** Cap on all references together, when the provider has one. */
  total?: number;
  audioNeedsVisual: boolean;
  /** Whole seconds the provider can generate; requests are clamped into it. */
  durationRange: [number, number];
  /** The tiers worth offering; other stored resolutions map to the nearest one. */
  resolutions: Resolution[];
}

export const VIDEO_PROVIDER_CAPS: Partial<Record<ProviderName, VideoProviderCaps>> = {
  volcengine: { images: 9, videos: 3, audios: 3, audioNeedsVisual: true, durationRange: [4, 15], resolutions: ['480p', '720p'] },
  // The same Seedance 2.0 family on BytePlus ModelArk.
  byteplus: { images: 9, videos: 3, audios: 3, audioNeedsVisual: true, durationRange: [4, 15], resolutions: ['480p', '720p'] },
  minimax: { images: 9, videos: 3, audios: 3, total: 12, audioNeedsVisual: false, durationRange: [4, 15], resolutions: ['720p', '1080p'] },
  aliyun: { images: 10, videos: 5, audios: 5, total: 20, audioNeedsVisual: false, durationRange: [2, 30], resolutions: ['480p', '720p', '1080p'] },
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

export const videoCapsFor = (provider: string | null | undefined): VideoProviderCaps =>
  (provider && VIDEO_PROVIDER_CAPS[provider as ProviderName]) || DEFAULT_VIDEO_CAPS;
