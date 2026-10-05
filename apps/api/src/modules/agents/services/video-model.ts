import { clampDuration, videoCapsFor, type VideoProviderCaps } from '@open-drama/contracts';
import { logger } from '../../../http/logger';
import { resolveService } from '../../configuration/services';
import { videoCapsOf } from '../../generation/engine/videos';

/** Shots aim for 8-15 s; a model that cannot render that gets the lengths nearest it. */
const PREFERRED = { min: 8, max: 15 };

const serviceOf = (lockedVideoServiceId: number | null) => resolveService('video', { lockedId: lockedVideoServiceId })?.row;

/** How agent messages name the episode's video model. */
export function videoModelLabel(lockedVideoServiceId: number | null): string {
  const service = serviceOf(lockedVideoServiceId);
  return service ? `${service.models[0] ?? service.name} (${service.provider})` : 'the default video model';
}

/** The shot lengths to ask for, as a phrase: "between 8 and 15 seconds long", "10 seconds long", "6 or 10 seconds long". */
function lengthsOf(caps: VideoProviderCaps): string {
  const [low, high] = caps.durationRange;
  const min = Math.min(Math.max(PREFERRED.min, low), high);
  const max = Math.max(Math.min(PREFERRED.max, high), min);
  if (caps.durations?.length) {
    const fits = caps.durations.filter((d) => d >= min && d <= max);
    const lengths = fits.length > 0 ? fits : [clampDuration(caps, min)];
    return `${lengths.length > 1 ? `${lengths.slice(0, -1).join(', ')} or ` : ''}${lengths.at(-1)} seconds long`;
  }
  return min === max ? `${min} seconds long` : `between ${min} and ${max} seconds long`;
}

/**
 * The episode's video model and the lengths it renders per shot, so the storyboard respects it (domain
 * VideoPromptBatch invariant). A storyboard needs only a text model, so a video model whose limits cannot be read,
 * or that cannot be driven, falls back to the caps table here instead of blocking it.
 */
export async function describeVideoModel(lockedVideoServiceId: number | null): Promise<{ label: string; lengths: string }> {
  const service = serviceOf(lockedVideoServiceId);
  const model = service?.models[0];
  const caps = service
    ? await videoCapsOf(service.provider, model).catch((err: unknown) => {
        logger.warn({ provider: service.provider, model, err: (err as Error).message }, 'video model limits unavailable for the storyboard');
        return videoCapsFor(service.provider, model);
      })
    : videoCapsFor(null);
  return { label: videoModelLabel(lockedVideoServiceId), lengths: lengthsOf(caps) };
}
