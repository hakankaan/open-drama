import { randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';
import {
  clampDuration,
  LINE_LEAD_IN_SECONDS,
  fitResolution,
  imageLimitOf,
  MENTION,
  planShotReferences,
  videoCapsFor,
  type AspectRatio,
  type ContentLanguage,
  type ReferenceKind,
  type Resolution,
  type RequestShotVideo,
  type SentView,
  type ShotVideoStarted,
} from '@open-drama/contracts';
import { db } from '../../db/client';
import { characters, episodes, generationTasks, shots } from '../../db/schema';
import { env } from '../../env';
import { invalid, precondition } from '../../http/errors';
import { logger } from '../../http/logger';
import { toAbsolute } from '../../lib/paths';
import { withStylePrefix } from '../assets/extraction';
import { composeSheet } from '../assets/views';
import { getAppSettings } from '../configuration/settings';
import type { FormatMention, VideoAdapter } from '../generation/adapters/types';
import { resolveLipSync } from '../generation/engine/lipsync';
import { videoAdapterFor } from '../generation/adapters/registry';
import { failTask, resolveGeneration } from '../generation/engine/lifecycle';
import { dispatchShotVideo, resolveVideo, submitShotVideo, WAITING_TO_CONTINUE } from '../generation/engine/videos';
import { getDramaRow, touchDrama } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';
import { chainSource, continuedByNext, firstFrameFrom } from './chain';
import { assertNoBreakdown, characterStyling, getShotRow, loadBindings, sceneLighting } from './service';

/** A sub-shot line timed the way earlier prompts were written (`0-3s:`, `0〜3秒：`, `0~3초:`); models keep no such timing (adr-0017). */
const TIMED_LINE = /^\s*\d+(?:\.\d+)?\s*(?:[-–~〜～]|to|至|到)\s*\d+(?:\.\d+)?\s*(?:s(?:ec(?:onds?)?)?|秒|초)\s*[:：]\s*/i;
/** Dialogue as the skill writes it (`{…}`), or quoted as earlier prompts did. */
const DIALOGUE = /\{[^{}\n]+\}|"[^"\n]+"|“[^”\n]+”|「[^」\n]+」|『[^』\n]+』/;

const SPOKEN: Record<ContentLanguage, string> = { en: 'English', zh: 'Mandarin Chinese', ja: 'Japanese', ko: 'Korean' };
const IDENTITY = 'Each character keeps the face, hair and outfit of their reference images throughout; faces stay stable without deformation, and movements are natural and smooth.';
/** An episode outfit not pictured yet (adr-0023): the references show the usual clothes, the wardrobe line the outfit. */
const IDENTITY_OUTFIT = 'Each character keeps the face and hair of their reference images and wears what is described above throughout; faces stay stable without deformation, and movements are natural and smooth.';
/** The same, for a video that starts from the shot's keyframe and gets no reference images. */
const IDENTITY_FROM_FRAME = 'Each character keeps the face, hair and outfit they have in the first frame throughout; faces stay stable without deformation, and movements are natural and smooth.';
/** Opens the prompt of a shot that continues the previous one from its last frame (adr-0020). */
const CONTINUES = 'This shot continues the previous shot in one unbroken take, without a cut: it starts exactly on the first frame given, with the same people, place and light.';
/** Ends the prompt of a shot the next one continues, so the frame it starts from is clean (adr-0020). */
const ENDS_STEADY = 'The shot ends on a steady moment: movement settles and the camera holds still for the last half second, faces clearly visible.';
/** What a character's slot shows, in the legend (adr-0018); a sheet is named as one person, never several. */
export const VIEW_LABEL: Record<SentView, string> = {
  headshot: 'face close-up',
  body: 'full body',
  side: 'side view',
  back: 'back view',
  sheet: 'one person in several views',
  composed: 'one person in several views',
};
/** Pinned voices (adr-0021): a shot without a line is asked for silence, so nobody's mouth moves to no sound. */
const NOBODY_SPEAKS = 'Nobody speaks.';
/** Pinned voices: the speaker's face stays in view, since the lip sync needs a face in every frame. */
const speaksOf = (name: string) => `${name} is the one speaking, face clearly visible and turned toward the camera throughout.`;
/** A character's outfit, as much as a prompt line carries. */
const WARDROBE_CHARS = 160;
export const CLEAN_FRAME = 'No subtitles, captions, logos or watermarks.';
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
export function headcountOf(cast: string[]): string {
  if (cast.length === 0) return '';
  if (cast.length === 1) return `${cast[0]} appears as one single person, never duplicated.`;
  return `${listOf(cast)} are ${cast.length} different people, each appearing once, never duplicated.`;
}

/** Text cut at a word boundary to at most `max` characters. */
export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat.replace(/[.\s]+$/, '');
  return flat.slice(0, flat.lastIndexOf(' ', max) > 0 ? flat.lastIndexOf(' ', max) : max).replace(/[,;:.\s]+$/, '');
}

/**
 * What the people sent wear, as one line (`Wardrobe: Mei: red coat; Jun: grey suit.`): the episode's outfit where the
 * binding carries one (adr-0023), else the character's styling; '' when nobody's outfit is stated.
 */
export function wardrobeOf(people: { id: number; name: string; outfit?: string }[]): string {
  const styling = characterStyling(people.filter((c) => !c.outfit).map((c) => c.id));
  const outfits = people.flatMap((c) => {
    const text = clip(c.outfit || (styling.get(c.id) ?? ''), WARDROBE_CHARS);
    return text ? [`${c.name}: ${text}`] : [];
  });
  return outfits.length ? `Wardrobe: ${outfits.join('; ')}.` : '';
}

/** Timed sub-shot lines become `Shot 1:`, `Shot 2:`… in order; untimed text is left as written. */
export function untimed(prompt: string): string {
  let n = 0;
  return prompt
    .split('\n')
    .map((line) => (TIMED_LINE.test(line) ? line.replace(TIMED_LINE, () => `Shot ${++n}: `) : line))
    .join('\n');
}

/** Whether the shot's keyframe goes as the first frame, and why not (`ShotVideoStarted.keyframe`). */
function keyframeUse(
  keyframePath: string | null,
  wanted: boolean | undefined,
  firstFrame: boolean,
  otherMedia: number,
): ShotVideoStarted['keyframe'] {
  if (!keyframePath) return null;
  if (wanted === false) return 'off';
  return firstFrame && otherMedia === 0 ? 'sent' : 'unsupported';
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
 * whose shape the model does not render (412). A shot with a keyframe starts from it on a model that takes a first
 * frame (unless the request says otherwise or carries reference video or audio): the keyframe goes alone, without
 * reference images, since it was drawn from them, and the prompt names the people the plan would have sent. A shot
 * marked as continuing the previous one starts from that shot's last frame instead, the same way (adr-0020): taken when
 * its video is ready (the task waits for one still generating), and refused when it cannot (`chainSource`: on Veo, or
 * from another scene, among others). A shot the next one can continue is asked to end on a steady moment. In a drama that pins voices (adr-0021) a shot with a line is
 * made silent, long enough for its line audio (412 without one, or past the model's longest), and lip-synced once
 * stored; a shot without a line is asked for silence. Otherwise the speaker's voice sample goes as reference audio
 * where the model has room for it.
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

  // Pinned voices (adr-0021): a spoken line is made silent at a length that holds it, then lip-synced to its audio. A
  // line whose speaker was unbound would otherwise be made as a shot where nobody speaks.
  if (drama.pinnedVoices && shot.line.trim() !== '' && shot.speakerId === null) {
    throw precondition('This project pins voices: the shot has a line but nobody to say it; pick its speaker or clear the line');
  }
  const spoken = shot.line.trim() !== '' && shot.speakerId !== null;
  const lipSync = drama.pinnedVoices && spoken;
  let durationSeconds = clampDuration(caps, body.durationSeconds ?? shot.durationSeconds);
  if (lipSync) {
    if (!shot.lineAudioPath || !shot.lineAudioSeconds || !existsSync(toAbsolute(shot.lineAudioPath))) {
      throw precondition('This project pins voices: generate the shot’s line audio first, and the video is lip-synced to it');
    }
    const needed = LINE_LEAD_IN_SECONDS + shot.lineAudioSeconds;
    if (durationSeconds < needed) durationSeconds = clampDuration(caps, Math.ceil(needed));
    if (durationSeconds < needed) {
      throw precondition(`The line runs ${needed.toFixed(1)} s with its lead-in, longer than the ${durationSeconds} s ${resolved.model} makes; shorten the line or pick a model that makes longer videos`);
    }
    // Refused now rather than after the video is paid for.
    resolveLipSync();
  }

  const chain = chainSource(shot, { model: resolved.model, firstFrame: caps.firstFrame, otherMedia: videos.length + audios.length });
  const keyframe = chain ? null : keyframeUse(shot.keyframePath, body.useKeyframe, caps.firstFrame, videos.length + audios.length);
  const firstFrame = keyframe === 'sent' ? shot.keyframePath! : undefined;
  // A first frame, given now or taken later from the shot it continues: either way no reference image goes with it.
  const fromFrame = Boolean(firstFrame || chain);
  if (firstFrame && !existsSync(toAbsolute(firstFrame))) throw precondition('The shot’s keyframe file is missing; generate the keyframe again');

  const imageLimit = imageLimitOf(caps, videos.length, audios.length);
  const raw = (body.prompt ?? shot.videoPrompt).trim();
  const bindings = loadBindings([shot]).get(shot.id)!;
  const extras = [...new Set([...(shot.referenceMedia.imageUrls ?? []), ...(body.extraReferenceImageUrls ?? [])])];
  // Which assets and which images of each character this model gets (adr-0017, adr-0018).
  const plan = planShotReferences({ bindings, prompt: raw, imageLimit, reserved: extras, model: resolved.model });
  const dropped: string[] = [];
  const slots: Slot[] = [];
  if (fromFrame) {
    // The first frame stands in for every reference image, so no asset is over the limit; the shot's own uploads are not sent.
    dropped.push(...extras);
  } else {
    dropped.push(...plan.dropped);
    for (const s of plan.slots) slots.push({ path: s.path ?? (await composeSheet(s.compose!)), name: s.name, kind: s.kind, view: s.view });
    for (const path of extras) {
      if (slots.some((s) => s.path === path)) continue;
      if (slots.length < imageLimit) slots.push({ path });
      else dropped.push(path);
    }
  }
  if (caps.audioNeedsVisual && audios.length > 0 && slots.length === 0 && videos.length === 0) {
    throw invalid('Reference audio needs at least one reference image or video');
  }

  if (!raw && slots.length === 0 && videos.length === 0 && !fromFrame) {
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
  // The people sent (or, from a first frame, the ones the plan chose), by name, and what they wear: these open the prompt
  // with the legend, so a provider that cuts a long prompt keeps them.
  const cast = [...new Set(plan.slots.flatMap((s) => (s.kind === 'character' ? [s.name] : [])))];
  const speaker = spoken ? bindings.characters.find((c) => c.id === shot.speakerId) : undefined;
  // Without pinned voices, the speaker's recorded voice goes as reference audio where the model takes one (an interim
  // style anchor): the provider fetches it, so only with PUBLIC_BASE_URL, and never beside a first frame.
  const sample = !drama.pinnedVoices && speaker && !fromFrame ? voiceSampleOf(speaker.id) : null;
  if (
    sample &&
    env.PUBLIC_BASE_URL &&
    !audios.includes(sample) &&
    audios.length < caps.audios &&
    (!caps.audioNeedsVisual || slots.length > 0 || videos.length > 0)
  ) {
    audios.push(sample);
  }
  const people = bindings.characters.filter((c) => cast.includes(c.name));
  // A prompt left empty for references alone is still framed around them.
  const framed = (rendered || slots.length > 0 || fromFrame) && [
    chain ? CONTINUES : '',
    legendOf(slots, formatMention),
    headcountOf(cast),
    wardrobeOf(people),
    rendered,
    lighting && `Lighting: ${lighting}.`,
    [
      cast.length === 0 ? '' : fromFrame ? IDENTITY_FROM_FRAME : people.some((c) => c.outfit && !c.views?.body) ? IDENTITY_OUTFIT : IDENTITY,
      continuedByNext(shot, resolved.model) ? ENDS_STEADY : '',
      lipSync && speaker ? speaksOf(speaker.name) : '',
      drama.pinnedVoices && !spoken ? NOBODY_SPEAKS : '',
      CLEAN_FRAME,
      DIALOGUE.test(rendered) ? `All dialogue is spoken in ${SPOKEN[getAppSettings().contentLanguage]}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  ]
    .filter(Boolean)
    .join('\n');

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
    // A lip-synced video gets its sound from the line; the model's own would be replaced anyway.
    generateAudio: lipSync ? false : (body.generateAudio ?? true),
    seed: caps.seed ? (body.seed ?? randomInt(0, 2_147_483_648)) : undefined,
    negativePrompt: NEGATIVE_PROMPT,
    firstFrame,
    ...(chain ? { firstFrameFrom: (taskId: number) => firstFrameFrom(taskId, chain) } : {}),
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
      ...(firstFrame ? { firstFrame } : {}),
      // Completed with the frame, its time and the video it came from once that is ready (firstFrameFrom); until then
      // the task it waits for lets a restart pick it up again (resumeWaitingContinuations).
      ...(chain ? { chainedFrom: { shotId: chain.shotId, shotNumber: chain.shotNumber, waitingFor: chain.waitingFor } } : {}),
      // The line audio the video's length was fitted to: only that one is lip-synced to it once it is done.
      ...(lipSync ? { autoLipSync: shot.lineAudioPath } : {}),
      ...(audios.includes(sample ?? '') ? { voiceSample: sample } : {}),
    },
  });
  touchDrama(ep.dramaId);
  return {
    taskId,
    unmatchedMentions,
    droppedReferences: dropped,
    keyframe,
    continues: chain ? { shotNumber: chain.shotNumber, waiting: chain.waitingFor !== null } : null,
    lipSync,
  };
}

/**
 * After a restart, picks up the videos that were still waiting to continue the shot before them (adr-0020): nothing
 * of them was sent, so each is dispatched again as it was recorded, in its service and model, and waits again for the
 * video it waited for. That video's task decides: still generating (resumed after the restart), it is waited for;
 * failed (also when the restart failed it), this one fails too; done, its frame is taken. The shot must still continue
 * the same shot (firstFrameFrom checks). A task that cannot be rebuilt (its service gone or changed, its shot deleted,
 * or recorded before restarts could pick it up) fails as an interrupted task did before.
 */
export function resumeWaitingContinuations(): { redispatched: number } {
  const tasks = db.select().from(generationTasks).where(and(eq(generationTasks.status, 'processing'), WAITING_TO_CONTINUE)).all();
  let redispatched = 0;
  for (const task of tasks) {
    try {
      redispatch(task);
      redispatched++;
    } catch (err) {
      failTask(task.id, err, 'video');
    }
  }
  return { redispatched };
}

function redispatch(task: typeof generationTasks.$inferSelect) {
  const interrupted = (why: string) => new Error(`Interrupted by a server restart while waiting for the shot it continues, and ${why}; nothing was sent to the provider`);
  const p = task.params;
  const from = p.chainedFrom as { shotId?: unknown; shotNumber?: unknown; waitingFor?: unknown };
  if (typeof from.shotId !== 'number' || typeof from.shotNumber !== 'number' || !('waitingFor' in from)) {
    throw interrupted('it was recorded before a restart could pick it up again');
  }
  const refs = (p.references ?? {}) as { images?: number; videos?: number; audios?: number };
  if ((refs.images ?? 0) + (refs.videos ?? 0) + (refs.audios ?? 0) > 0) throw interrupted('it cannot be rebuilt');
  if (typeof p.durationSeconds !== 'number' || typeof p.aspectRatio !== 'string' || typeof p.resolution !== 'string') {
    throw interrupted('it cannot be rebuilt');
  }
  const owner =
    task.shotId === null
      ? undefined
      : db
          .select({ episodeId: shots.episodeId, dramaId: episodes.dramaId, deletedAt: episodes.deletedAt })
          .from(shots)
          .innerJoin(episodes, eq(episodes.id, shots.episodeId))
          .where(eq(shots.id, task.shotId))
          .get();
  if (!owner || owner.deletedAt) throw interrupted('its shot was deleted');
  if (!env.OPEN_DRAMA_STUB_PROVIDERS && task.serviceId === null) throw interrupted('it has no service to go to');
  let resolved: ReturnType<typeof resolveGeneration<VideoAdapter>> | null = null;
  try {
    resolved = resolveGeneration('video', videoAdapterFor, { explicitId: task.serviceId ?? undefined, model: task.model });
  } catch {
    // Deleted, disabled, retyped or keyless: reported below like a service that moved.
  }
  if (!resolved || resolved.provider !== task.provider || resolved.model !== task.model) {
    throw interrupted('its service was removed or changed meanwhile');
  }
  const waitingFor = typeof from.waitingFor === 'number' ? from.waitingFor : null;
  const source = { shotId: from.shotId, shotNumber: from.shotNumber, waitingFor };
  logger.info({ taskId: task.id, shotId: task.shotId, waitingFor }, 'video task waiting to continue a shot picked up after restart');
  dispatchShotVideo(
    task.id,
    // The model's limits from the table: it sends no reference image, so nothing is asked of the provider at boot.
    { ...resolved, caps: videoCapsFor(resolved.provider, resolved.model), formatMention: resolved.adapter.formatMention },
    {
      shotId: task.shotId!,
      episodeId: owner.episodeId,
      dramaId: owner.dramaId,
      prompt: task.prompt,
      referenceImages: [],
      referenceVideos: [],
      referenceAudios: [],
      durationSeconds: p.durationSeconds,
      aspectRatio: p.aspectRatio as AspectRatio,
      resolution: p.resolution as Resolution,
      generateAudio: p.generateAudio !== false,
      seed: typeof p.seed === 'number' ? p.seed : undefined,
      negativePrompt: NEGATIVE_PROMPT,
      firstFrameFrom: (taskId) => firstFrameFrom(taskId, source),
    },
  );
}

/** A character's stored voice sample, or null. */
function voiceSampleOf(characterId: number): string | null {
  const path = db.select({ path: characters.voiceSamplePath }).from(characters).where(eq(characters.id, characterId)).get()?.path;
  return path && existsSync(toAbsolute(path)) ? path : null;
}
