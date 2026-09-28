'use client';

import { videoCapsFor, type EpisodeView } from '@open-drama/contracts';
import { useModelServices } from '../configuration/api';
import type { ModelPicks } from '../configuration/model-picks';

/**
 * The video model a generation will use, as the API resolves it: the creator's pick, else the episode's locked
 * service with its first model. Carries that provider's caps (durations, resolution tiers) for the pickers.
 */
export function useVideoTarget(episode: EpisodeView, picks: ModelPicks) {
  const services = useModelServices('video', true);
  const picked = picks.video ? services.data?.find((s) => s.id === picks.video!.serviceId) : undefined;
  const locked = episode.services.video;
  const provider = picked?.provider ?? locked?.provider ?? null;
  const model = picked ? picks.video!.model : (locked?.defaultModel ?? null);
  const caps = videoCapsFor(provider);
  const clamp = (seconds: number) => Math.min(caps.durationRange[1], Math.max(caps.durationRange[0], Math.round(seconds)));
  return { provider, model, caps, clamp, lockedName: locked?.name ?? null };
}
