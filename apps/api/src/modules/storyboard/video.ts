import { randomInt } from 'node:crypto';
import type { z } from 'zod';
import { clampDuration, fitResolution, type ContentLanguage, type RequestShotVideo, type ShotVideoStarted } from '@open-drama/contracts';
import { invalid, precondition } from '../../http/errors';
import { withStylePrefix } from '../assets/extraction';
import { getAppSettings } from '../configuration/settings';
import type { FormatMention } from '../generation/adapters/types';
import { resolveVideo, submitShotVideo } from '../generation/engine/videos';
import { getDramaRow, touchDrama } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';
import { assertNoBreakdown, getShotRow, loadBindings, sceneLighting } from './service';

/** `@[Name]`: brackets allow multi-word names (Plan 1 §6). */
const MENTION = /@\[([^\]\n]+)\]/g;

/**
 * Bound assets one call shows the model (adr-0017): the Seedance guide reports output stability dropping past four
 * people and recommends four or five assets in total. Uploaded and extra images come after, within the model's limit.
 */
const MAX_CHARACTER_SLOTS = 4;
const MAX_ASSET_SLOTS = 5;

/** A sub-shot line timed the way earlier prompts were written (`0-3s:`, `0〜3秒：`, `0~3초:`); models keep no such timing (adr-0017). */
const TIMED_LINE = /^\s*\d+(?:\.\d+)?\s*(?:[-–~〜～]|to|至|到)\s*\d+(?:\.\d+)?\s*(?:s(?:ec(?:onds?)?)?|秒|초)\s*[:：]\s*/i;
/** Dialogue as the skill writes it (`{…}`), or quoted as earlier prompts did. */
const DIALOGUE = /\{[^{}\n]+\}|"[^"\n]+"|“[^”\n]+”|「[^」\n]+」|『[^』\n]+』/;

const SPOKEN: Record<ContentLanguage, string> = { en: 'English', zh: 'Mandarin Chinese', ja: 'Japanese', ko: 'Korean' };
const IDENTITY = 'Each character keeps the face, hair and outfit of their reference image throughout; faces stay stable without deformation, and movements are natural and smooth.';
const CLEAN_FRAME = 'No subtitles, captions, logos or watermarks.';
/** Sent to every model that takes a negative prompt (adr-0017); short enough for Wan's 500 characters. */
const NEGATIVE_PROMPT =
  'duplicate person, twins, cloned face, identity change, face morphing, distorted face, deformed hands, extra limbs, subtitles, captions, watermark, logo, flicker, blurry';

type Kind = 'character' | 'scene' | 'prop';

interface Slot {
  path: string;
  /** Set for bound assets, which prompts can mention by name. */
  name?: string;
  kind?: Kind;
}

const key = (name: string) => name.trim().toLowerCase();

/** A provider whose prompts name references plainly has no token a legend could explain. */
const tokenless = (formatMention: FormatMention) => formatMention(1, 'x') === 'x';

/** `Characters: Mei (@Image1). Location: Night market (@Image2).`: which slot holds what, opening the prompt. */
function legendOf(slots: Slot[], formatMention: FormatMention): string {
  if (tokenless(formatMention)) return '';
  const of = (kind: Kind) => slots.flatMap((s, i) => (s.kind === kind ? [formatMention(i + 1, s.name!)] : []));
  const groups: [string, string[]][] = [
    ['Characters', of('character')],
    ['Location', of('scene')],
    ['Props', of('prop')],
  ];
  return groups
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => `${label}: ${list.join(', ')}.`)
    .join(' ');
}

/** Timed sub-shot lines become `Shot 1:`, `Shot 2:`… in order; untimed text is left as written. */
function untimed(prompt: string): string {
  let n = 0;
  return prompt
    .split('\n')
    .map((line) => (TIMED_LINE.test(line) ? line.replace(TIMED_LINE, () => `Shot ${++n}: `) : line))
    .join('\n');
}

/**
 * RequestShotVideo: builds the ordered reference slots (bound characters, then the scene, then props; at most four
 * characters and five bound assets, the ones the prompt mentions chosen first; assets without an image skipped; then
 * the shot's uploaded images and the request's extra images; deduplicated by path, capped by the model), turns each
 * `@[Name]` of a bound asset into its slot token, and
 * frames the prompt (adr-0017): the drama's style, a legend of the slots, untimed `Shot N` lines, the scene's
 * lighting verbatim, identity and clean-frame sentences, and the dialogue's language. A model that takes a seed gets
 * the request's or a drawn one, recorded for retakes; the task runs in the episode's locked service and pinned model.
 * A shot whose video task is still processing is refused (409), and so is a drama whose shape the model does not
 * render (412).
 */
export async function requestShotVideo(shotId: number, body: z.output<typeof RequestShotVideo>): Promise<ShotVideoStarted> {
  // The first video generation of the episode claims its video lock and model pin as the service resolves (adr-0016, adr-0017).
  const episodeId = getShotRow(shotId).episodeId;
  const resolved = await resolveVideo({ explicitId: body.videoServiceId, lockedId: getEpisodeRow(episodeId).videoServiceId, lockFor: episodeId, model: body.model });
  const { caps, formatMention } = resolved;
  if (body.seed !== undefined && !caps.seed) throw invalid(`${resolved.model} takes no seed`);
  // Reading the model's limits can take seconds: the shot and its episode are read, and checked, after it.
  const shot = getShotRow(shotId);
  const ep = getEpisodeRow(shot.episodeId);
  assertNoBreakdown(ep.id);
  const drama = getDramaRow(ep.dramaId);
  if (drama.aspectRatio !== 'adaptive' && caps.aspectRatios && !caps.aspectRatios.includes(drama.aspectRatio)) {
    throw precondition(`${resolved.model} renders no ${drama.aspectRatio} video; it offers ${caps.aspectRatios.join(', ')}`);
  }

  const videos = [...new Set([...(shot.referenceMedia.videoUrls ?? []), ...(body.referenceVideoUrls ?? [])])];
  const audios = [...new Set([...(shot.referenceMedia.audioUrls ?? []), ...(body.referenceAudioUrls ?? [])])];
  if (videos.length > caps.videos || audios.length > caps.audios) {
    throw invalid(`This video model accepts at most ${caps.videos} reference videos and ${caps.audios} reference audio files`);
  }

  const imageLimit = Math.max(0, Math.min(caps.images, (caps.total ?? Infinity) - videos.length - audios.length));
  const raw = (body.prompt ?? shot.videoPrompt).trim();
  const mentioned = new Set([...raw.matchAll(MENTION)].map((m) => key(m[1]!)));
  const bindings = loadBindings([shot]).get(shot.id)!;
  const slotsOf = (kind: Kind, list: { name: string; imagePath: string | null }[]): Slot[] =>
    list.flatMap((a) => (a.imagePath ? [{ path: a.imagePath, name: a.name, kind }] : []));
  const assets = [
    ...slotsOf('character', bindings.characters),
    ...slotsOf('scene', bindings.scene ? [bindings.scene] : []),
    ...slotsOf('prop', bindings.props),
  ];
  // Mentioned assets take the capped slots (and a model limit below the cap) first; the chosen ones keep the kind order above.
  const isMentioned = (s: Slot) => mentioned.has(key(s.name!));
  const budget = Math.min(MAX_ASSET_SLOTS, imageLimit);
  const chosen = new Set<Slot>();
  const dropped: string[] = [];
  for (const s of [...assets.filter(isMentioned), ...assets.filter((a) => !isMentioned(a))]) {
    const characters = [...chosen].filter((c) => c.kind === 'character').length;
    if (chosen.size < budget && (s.kind !== 'character' || characters < MAX_CHARACTER_SLOTS)) chosen.add(s);
    else dropped.push(s.name!);
  }
  const candidates: Slot[] = [
    ...assets.filter((a) => chosen.has(a)),
    ...(shot.referenceMedia.imageUrls ?? []).map((path) => ({ path })),
    ...(body.extraReferenceImageUrls ?? []).map((path) => ({ path })),
  ];
  const slots: Slot[] = [];
  for (const candidate of candidates) {
    if (slots.some((s) => s.path === candidate.path)) continue;
    if (slots.length < imageLimit) slots.push(candidate);
    else dropped.push(candidate.name ?? candidate.path);
  }
  if (caps.audioNeedsVisual && audios.length > 0 && slots.length === 0 && videos.length === 0) {
    throw invalid('Reference audio needs at least one reference image or video');
  }

  if (!raw && slots.length === 0 && videos.length === 0) {
    throw precondition('Write a video prompt or bind an asset with an image before generating');
  }

  // Bound names resolve to their slot (the first slot of a name wins, so a character beats a same-named scene);
  // bound assets without a slot and unbound names stay plain text, and unbound ones are reported.
  const slotOf = new Map<string, number>();
  slots.forEach((s, i) => s.name && !slotOf.has(key(s.name)) && slotOf.set(key(s.name), i + 1));
  const bound = new Set([bindings.scene, ...bindings.characters, ...bindings.props].filter(Boolean).map((a) => key(a!.name)));
  const unmatched = new Set<string>();
  const rendered = untimed(raw).replace(MENTION, (_m, name: string) => {
    const trimmed = name.trim();
    const slot = slotOf.get(key(trimmed));
    if (slot) return formatMention(slot, trimmed);
    if (!bound.has(key(trimmed))) unmatched.add(trimmed);
    return trimmed;
  });

  const lighting = sceneLighting(shot.sceneId).replace(/[.\s]+$/, '');
  // A prompt left empty for references alone is still framed around them.
  const framed = (rendered || slots.length > 0) && [
    legendOf(slots, formatMention),
    rendered,
    lighting && `Lighting: ${lighting}.`,
    [
      slots.some((s) => s.kind === 'character') ? IDENTITY : '',
      CLEAN_FRAME,
      DIALOGUE.test(rendered) ? `All dialogue is spoken in ${SPOKEN[getAppSettings().contentLanguage]}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  ]
    .filter(Boolean)
    .join('\n');

  const durationSeconds = clampDuration(caps, body.durationSeconds ?? shot.durationSeconds);
  const unmatchedMentions = [...unmatched];
  const taskId = submitShotVideo(resolved, {
    shotId: shot.id,
    episodeId: ep.id,
    dramaId: ep.dramaId,
    prompt: framed ? withStylePrefix(ep.dramaId, framed) : '',
    referenceImages: slots.map((s) => s.path),
    referenceVideos: videos,
    referenceAudios: audios,
    durationSeconds,
    aspectRatio: drama.aspectRatio,
    resolution: fitResolution(caps, ep.resolution),
    generateAudio: body.generateAudio ?? true,
    seed: caps.seed ? (body.seed ?? randomInt(0, 2_147_483_648)) : undefined,
    negativePrompt: NEGATIVE_PROMPT,
    params: {
      slots: slots.map((s, i) => ({ slot: i + 1, name: s.name ?? null })),
      ...(unmatchedMentions.length ? { unmatchedMentions } : {}),
      ...(dropped.length ? { droppedReferences: dropped } : {}),
    },
  });
  touchDrama(ep.dramaId);
  return { taskId, unmatchedMentions, droppedReferences: dropped };
}
