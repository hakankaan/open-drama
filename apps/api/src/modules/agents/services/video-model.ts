import { clampDuration, targetTolerance, videoCapsFor, type VideoProviderCaps } from '@open-drama/contracts';
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

/** The preferred shot lengths narrowed to what the model renders. */
function preferredRange(caps: VideoProviderCaps): [number, number] {
  const [low, high] = caps.durationRange;
  const min = Math.min(Math.max(PREFERRED.min, low), high);
  return [min, Math.max(Math.min(PREFERRED.max, high), min)];
}

/** The whole-second lengths the model renders within [low, high]; a fixed-length model with none there gets the nearest. */
function lengthsWithin(caps: VideoProviderCaps, [low, high]: [number, number]): number[] {
  if (!caps.durations?.length) return Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const fits = caps.durations.filter((d) => d >= low && d <= high);
  return fits.length > 0 ? fits : [clampDuration(caps, low)];
}

/** The shot lengths to ask for, as a phrase: "between 8 and 15 seconds long", "10 seconds long", "6 or 10 seconds long". */
function phraseOf(caps: VideoProviderCaps, lengths: number[]): string {
  const min = lengths[0]!;
  const max = lengths.at(-1)!;
  if (caps.durations?.length) return `${lengths.length > 1 ? `${lengths.slice(0, -1).join(', ')} or ` : ''}${max} seconds long`;
  return min === max ? `${min} seconds long` : `between ${min} and ${max} seconds long`;
}

/** Whether some shots of these lengths add up to the target, give or take the tolerance. */
function reaches(lengths: number[], seconds: number, tolerance: number): boolean {
  const sums = [true];
  for (let s = 1; s <= seconds + tolerance; s++) {
    sums[s] = lengths.some((l) => l <= s && sums[s - l]);
    if (sums[s] && s >= seconds - tolerance) return true;
  }
  return false;
}

export interface VideoModelBrief {
  label: string;
  lengths: string;
  caps: VideoProviderCaps;
}

/**
 * The episode's video model and the lengths it renders per shot, so the storyboard respects it (domain
 * VideoPromptBatch invariant). A storyboard needs only a text model, so a video model whose limits cannot be read,
 * or that cannot be driven, falls back to the caps table here instead of blocking it.
 */
export async function describeVideoModel(lockedVideoServiceId: number | null): Promise<VideoModelBrief> {
  const service = serviceOf(lockedVideoServiceId);
  const model = service?.models[0];
  const caps = service
    ? await videoCapsOf(service.provider, model).catch((err: unknown) => {
        logger.warn({ provider: service.provider, model, err: (err as Error).message }, 'video model limits unavailable for the storyboard');
        return videoCapsFor(service.provider, model);
      })
    : videoCapsFor(null);
  return { label: videoModelLabel(lockedVideoServiceId), lengths: phraseOf(caps, lengthsWithin(caps, preferredRange(caps))), caps };
}

export interface TargetFit {
  seconds: number;
  /** How far the rendered shot lengths may add up from the target. */
  tolerance: number;
  /** The length a shot of this duration is rendered at. */
  rendered: (durationSeconds: number) => number;
  /** The per-shot lengths phrase, for the agent. */
  lengths: string;
  /** Whether any storyboard of these lengths meets the target; one that cannot is not worth an agent run. */
  reachable: boolean;
  /** What the breakdown agent is told. */
  brief: string;
}

/**
 * The episode's target length as the breakdown must meet it. Shot lengths are summed as the model renders them, so
 * the film runs what the creator asked for. Shots keep to the preferred lengths unless no sum of them meets the
 * target (a model that renders only 5 or 10 s, a 12 s episode); then every length the model renders is allowed. A
 * target even those cannot meet (a model whose shortest clip is 15 s, a 10 s episode) is reported unreachable.
 */
export function targetFit(seconds: number, video: VideoModelBrief): TargetFit {
  const { caps } = video;
  const tolerance = targetTolerance(caps);
  const preferred = lengthsWithin(caps, preferredRange(caps));
  const all = lengthsWithin(caps, caps.durationRange);
  const lengths = reaches(preferred, seconds, tolerance) ? preferred : all;
  const fewest = Math.max(1, Math.ceil((seconds - tolerance) / lengths.at(-1)!));
  const most = Math.max(fewest, Math.floor((seconds + tolerance) / lengths[0]!));
  const count = fewest === most ? `${fewest} shot${fewest === 1 ? '' : 's'}` : `${fewest} to ${most} shots`;
  return {
    seconds,
    tolerance,
    rendered: (d) => clampDuration(caps, d),
    lengths: phraseOf(caps, lengths),
    reachable: lengths === preferred || reaches(all, seconds, tolerance),
    brief:
      `The episode runs ${seconds} seconds: the shots' durationSeconds must add up to ${seconds}, give or take ${tolerance} s, so plan about ${count}. ` +
      'If the script holds more than fits, keep its story beats in order and tell them in fewer, shorter sub-shots; leave out only minor moments.',
  };
}
