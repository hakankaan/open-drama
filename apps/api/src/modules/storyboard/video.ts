import { randomInt } from 'node:crypto';
import type { z } from 'zod';
import {
  clampDuration,
  fitResolution,
  imageLimitOf,
  MENTION,
  planShotReferences,
  type ContentLanguage,
  type ReferenceKind,
  type RequestShotVideo,
  type SentView,
  type ShotVideoStarted,
} from '@open-drama/contracts';
import { invalid, precondition } from '../../http/errors';
import { withStylePrefix } from '../assets/extraction';
import { composeSheet } from '../assets/views';
import { getAppSettings } from '../configuration/settings';
import type { FormatMention } from '../generation/adapters/types';
import { resolveVideo, submitShotVideo } from '../generation/engine/videos';
import { getDramaRow, touchDrama } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';
import { assertNoBreakdown, characterStyling, getShotRow, loadBindings, sceneLighting } from './service';

/** A sub-shot line timed the way earlier prompts were written (`0-3s:`, `0〜3秒：`, `0~3초:`); models keep no such timing (adr-0017). */
const TIMED_LINE = /^\s*\d+(?:\.\d+)?\s*(?:[-–~〜～]|to|至|到)\s*\d+(?:\.\d+)?\s*(?:s(?:ec(?:onds?)?)?|秒|초)\s*[:：]\s*/i;
/** Dialogue as the skill writes it (`{…}`), or quoted as earlier prompts did. */
const DIALOGUE = /\{[^{}\n]+\}|"[^"\n]+"|“[^”\n]+”|「[^」\n]+」|『[^』\n]+』/;

const SPOKEN: Record<ContentLanguage, string> = { en: 'English', zh: 'Mandarin Chinese', ja: 'Japanese', ko: 'Korean' };
const IDENTITY = 'Each character keeps the face, hair and outfit of their reference images throughout; faces stay stable without deformation, and movements are natural and smooth.';
/** What a character's slot shows, in the legend (adr-0018); a sheet is named as one person, never several. */
const VIEW_LABEL: Record<SentView, string> = {
  headshot: 'face close-up',
  body: 'full body',
  side: 'side view',
  back: 'back view',
  sheet: 'one person in several views',
  composed: 'one person in several views',
};
/** A character's outfit, as much as a prompt line carries. */
const WARDROBE_CHARS = 160;
const CLEAN_FRAME = 'No subtitles, captions, logos or watermarks.';
/** Sent to every model that takes a negative prompt (adr-0017); short enough for Wan's 500 characters. */
const NEGATIVE_PROMPT =
  'duplicate person, twins, cloned face, identity change, face morphing, distorted face, deformed hands, extra limbs, subtitles, captions, watermark, logo, flicker, blurry';

interface Slot {
  path: string;
  /** Set for bound assets, which prompts can mention by name. */
  name?: string;
  kind?: ReferenceKind;
  /** Which image of a character the slot holds (adr-0018). */
  view?: SentView | null;
}

const key = (name: string) => name.trim().toLowerCase();

/** A provider whose prompts name references plainly has no token a legend could explain. */
const tokenless = (formatMention: FormatMention) => formatMention(1, 'x') === 'x';

const listOf = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/**
 * Which slot holds what, opening the prompt: `Characters: Mei (@Image1) face close-up, Mei (@Image2) full body.
 * Location: Night market (@Image3).` A provider without slot tokens gets the images by their order instead
 * (adr-0018): `Reference images in order: 1 Mei (face close-up); 2 Mei (full body); 3 the location Night market.`
 */
function legendOf(slots: Slot[], formatMention: FormatMention): string {
  const label = (s: Slot) => (s.view ? VIEW_LABEL[s.view] : '');
  if (tokenless(formatMention)) {
    const article: Record<ReferenceKind, string> = { character: '', scene: 'the location ', prop: 'the prop ' };
    const parts = slots.flatMap((s, i) => (s.name ? [`${i + 1} ${article[s.kind!]}${s.name}${s.view ? ` (${label(s)})` : ''}`] : []));
    return parts.length ? `Reference images in order: ${parts.join('; ')}.` : '';
  }
  const of = (kind: ReferenceKind) =>
    slots.flatMap((s, i) => (s.kind === kind ? [[formatMention(i + 1, s.name!), label(s)].filter(Boolean).join(' ')] : []));
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

/**
 * The people a shot sends, counted in positive words (adr-0018): several images of one person, or a sheet, can
 * otherwise come out as twins, and Seedance, Veo's reference mode and MiniMax take no negative prompt.
 */
function headcountOf(cast: string[]): string {
  if (cast.length === 0) return '';
  if (cast.length === 1) return `${cast[0]} appears as one single person, never duplicated.`;
  return `${listOf(cast)} are ${cast.length} different people, each appearing once, never duplicated.`;
}

/** Text cut at a word boundary to at most `max` characters. */
function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat.replace(/[.\s]+$/, '');
  return flat.slice(0, flat.lastIndexOf(' ', max) > 0 ? flat.lastIndexOf(' ', max) : max).replace(/[,;:.\s]+$/, '');
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
 * RequestShotVideo: builds the ordered reference slots (`planReferences`: bound characters, then the scene, then
 * props, at most four characters and five bound assets, the ones the prompt mentions chosen first, and the images of
 * each character the model takes; then the shot's uploaded images and the request's extra images; deduplicated by
 * path, capped by the model), turns each `@[Name]` of a bound asset into its first slot's token, and frames the
 * prompt (adr-0017, adr-0018): the drama's style, a legend of the slots, the people sent and what they wear, untimed
 * `Shot N` lines, the scene's lighting verbatim, identity and clean-frame sentences, and the dialogue's language. A
 * model that takes a seed gets the request's or a drawn one, recorded for retakes; the task runs in the episode's
 * locked service and pinned model. A shot whose video task is still processing is refused (409), and so is a drama
 * whose shape the model does not render (412).
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

  const imageLimit = imageLimitOf(caps, videos.length, audios.length);
  const raw = (body.prompt ?? shot.videoPrompt).trim();
  const bindings = loadBindings([shot]).get(shot.id)!;
  const extras = [...new Set([...(shot.referenceMedia.imageUrls ?? []), ...(body.extraReferenceImageUrls ?? [])])];
  // Which assets and which images of each character this model gets (adr-0017, adr-0018).
  const plan = planShotReferences({ bindings, prompt: raw, imageLimit, reserved: extras, model: resolved.model });
  const dropped = [...plan.dropped];
  const slots: Slot[] = [];
  for (const s of plan.slots) slots.push({ path: s.path ?? (await composeSheet(s.compose!)), name: s.name, kind: s.kind, view: s.view });
  for (const path of extras) {
    if (slots.some((s) => s.path === path)) continue;
    if (slots.length < imageLimit) slots.push({ path });
    else dropped.push(path);
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
  // The people sent, by name, and what they wear: these open the prompt with the legend, so a provider that cuts a
  // long prompt keeps them.
  const cast = [...new Set(slots.flatMap((s) => (s.kind === 'character' ? [s.name!] : [])))];
  const styling = characterStyling(bindings.characters.filter((c) => cast.includes(c.name)).map((c) => c.id));
  const outfits = bindings.characters.flatMap((c) => {
    const text = cast.includes(c.name) ? clip(styling.get(c.id) ?? '', WARDROBE_CHARS) : '';
    return text ? [`${c.name}: ${text}`] : [];
  });
  // A prompt left empty for references alone is still framed around them.
  const framed = (rendered || slots.length > 0) && [
    legendOf(slots, formatMention),
    headcountOf(cast),
    outfits.length ? `Wardrobe: ${outfits.join('; ')}.` : '',
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
      // A composed sheet is named here, so the stored file stays referenced while the task does.
      slots: slots.map((s, i) => ({
        slot: i + 1,
        name: s.name ?? null,
        ...(s.view ? { view: s.view } : {}),
        ...(s.view === 'composed' ? { path: s.path } : {}),
      })),
      ...(unmatchedMentions.length ? { unmatchedMentions } : {}),
      ...(dropped.length ? { droppedReferences: dropped } : {}),
    },
  });
  touchDrama(ep.dramaId);
  return { taskId, unmatchedMentions, droppedReferences: dropped };
}
