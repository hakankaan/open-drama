import { videoCapsFor } from '@open-drama/contracts';
import { resolveService } from '../../configuration/services';

/**
 * How agent messages name the episode's video model and the seconds it can render per shot, so the storyboard
 * respects it (domain VideoPromptBatch invariant). Shots stay within 8-15 s inside the model's range.
 */
export function describeVideoModel(lockedVideoServiceId: number | null): { label: string; min: number; max: number } {
  const service = resolveService('video', { lockedId: lockedVideoServiceId })?.row;
  const [low, high] = videoCapsFor(service?.provider, service?.models[0]).durationRange;
  const label = service ? `${service.models[0] ?? service.name} (${service.provider})` : 'the default video model';
  return { label, min: Math.max(low, 8), max: Math.min(high, 15) };
}
