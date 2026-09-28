import type { z } from 'zod';
import type { RequestShotVideo, ShotVideoStarted } from '@open-drama/contracts';
import { invalid, precondition } from '../../http/errors';
import { withStylePrefix } from '../assets/extraction';
import { resolveVideo, submitShotVideo } from '../generation/engine/videos';
import { getDramaRow, touchDrama } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';
import { assertNoBreakdown, getShotRow, loadBindings } from './service';

/** `@[Name]`: brackets allow multi-word names (Plan 1 §6). */
const MENTION = /@\[([^\]\n]+)\]/g;

interface Slot {
  path: string;
  /** Set for bound assets, which prompts can mention by name. */
  name?: string;
}

const key = (name: string) => name.trim().toLowerCase();

/**
 * RequestShotVideo: builds the ordered reference slots (bound scene → characters → props, assets without an image
 * skipped, then the shot's uploaded images, then the request's extra images; deduplicated by path, capped by the
 * provider), turns each `@[Name]` of a bound asset into its slot token, prepends the drama's style, and submits the
 * task in the episode's locked video service. A shot whose video task is still processing is refused (409).
 */
export function requestShotVideo(shotId: number, body: z.output<typeof RequestShotVideo>): ShotVideoStarted {
  const shot = getShotRow(shotId);
  const ep = getEpisodeRow(shot.episodeId);
  assertNoBreakdown(ep.id);
  const drama = getDramaRow(ep.dramaId);
  const resolved = resolveVideo({ explicitId: body.videoServiceId, lockedId: ep.videoServiceId, model: body.model });
  const { caps, adapter } = resolved;

  const videos = [...new Set([...(shot.referenceMedia.videoUrls ?? []), ...(body.referenceVideoUrls ?? [])])];
  const audios = [...new Set([...(shot.referenceMedia.audioUrls ?? []), ...(body.referenceAudioUrls ?? [])])];
  if (videos.length > caps.videos || audios.length > caps.audios) {
    throw invalid(`This video model accepts at most ${caps.videos} reference videos and ${caps.audios} reference audio files`);
  }

  const bindings = loadBindings([shot]).get(shot.id)!;
  const candidates: Slot[] = [
    ...[bindings.scene, ...bindings.characters, ...bindings.props]
      .filter((a) => a?.imagePath)
      .map((a) => ({ path: a!.imagePath!, name: a!.name })),
    ...(shot.referenceMedia.imageUrls ?? []).map((path) => ({ path })),
    ...(body.extraReferenceImageUrls ?? []).map((path) => ({ path })),
  ];
  const imageLimit = Math.max(0, Math.min(caps.images, (caps.total ?? Infinity) - videos.length - audios.length));
  const slots: Slot[] = [];
  const dropped: string[] = [];
  for (const candidate of candidates) {
    if (slots.some((s) => s.path === candidate.path)) continue;
    if (slots.length < imageLimit) slots.push(candidate);
    else dropped.push(candidate.name ?? candidate.path);
  }
  if (caps.audioNeedsVisual && audios.length > 0 && slots.length === 0 && videos.length === 0) {
    throw invalid('Reference audio needs at least one reference image or video');
  }

  const raw = (body.prompt ?? shot.videoPrompt).trim();
  if (!raw && slots.length === 0 && videos.length === 0) {
    throw precondition('Write a video prompt or bind an asset with an image before generating');
  }

  // Bound names resolve to their slot (the first slot of a name wins, so a scene beats a same-named character);
  // bound assets without a slot and unbound names stay plain text, and unbound ones are reported.
  const slotOf = new Map<string, number>();
  slots.forEach((s, i) => s.name && !slotOf.has(key(s.name)) && slotOf.set(key(s.name), i + 1));
  const bound = new Set([bindings.scene, ...bindings.characters, ...bindings.props].filter(Boolean).map((a) => key(a!.name)));
  const unmatched = new Set<string>();
  const rendered = raw.replace(MENTION, (_m, name: string) => {
    const trimmed = name.trim();
    const slot = slotOf.get(key(trimmed));
    if (slot) return adapter.formatMention(slot, trimmed);
    if (!bound.has(key(trimmed))) unmatched.add(trimmed);
    return trimmed;
  });

  const [min, max] = caps.durationRange;
  const durationSeconds = Math.min(max, Math.max(min, Math.round(body.durationSeconds ?? shot.durationSeconds)));
  const unmatchedMentions = [...unmatched];
  const taskId = submitShotVideo(resolved, {
    shotId: shot.id,
    dramaId: ep.dramaId,
    prompt: rendered ? withStylePrefix(ep.dramaId, rendered) : '',
    referenceImages: slots.map((s) => s.path),
    referenceVideos: videos,
    referenceAudios: audios,
    durationSeconds,
    aspectRatio: drama.aspectRatio,
    resolution: ep.resolution,
    generateAudio: body.generateAudio ?? true,
    params: {
      slots: slots.map((s, i) => ({ slot: i + 1, name: s.name ?? null })),
      ...(unmatchedMentions.length ? { unmatchedMentions } : {}),
      ...(dropped.length ? { droppedReferences: dropped } : {}),
    },
  });
  touchDrama(ep.dramaId);
  return { taskId, unmatchedMentions, droppedReferences: dropped };
}
