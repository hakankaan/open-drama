import type { z } from 'zod';
import { MENTION, type RequestShotKeyframe, type TaskStarted } from '@open-drama/contracts';
import { precondition } from '../../http/errors';
import { withStylePrefix } from '../assets/extraction';
import { submitImage } from '../generation/engine/images';
import { getDramaRow, touchDrama } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';
import { assertNoBreakdown, getShotRow, loadBindings, sceneLighting, type ShotBindings } from './service';
import { CLEAN_FRAME, clip, headcountOf, untimed, VIEW_LABEL, wardrobeOf } from './video';

/** Characters a keyframe draws from images, as many as a video call sends (adr-0017). */
const MAX_CAST = 4;
const OPENING = /^\s*Shot\s*1\s*[:：]\s*/i;
const FRAME = "A single still frame from a film: the opening moment of the shot, as the camera sees it.";
const IDENTITY = 'Each character has the face, hair and outfit of their reference images.';
/** An episode outfit not pictured yet (adr-0023): the references show the usual clothes, the wardrobe line the outfit. */
const IDENTITY_OUTFIT = 'Each character has the face and hair of their reference images, and wears what is described above.';
const REFERENCE_REQUIRED =
  'The keyframe is drawn from the characters’ images, and this image model takes no reference image, so it would draw other people; pick an image model that edits images.';

/**
 * The images a keyframe is drawn from, each with what it shows: every character's face (the headshot, else the
 * image it has), then the scene, then full bodies, then props, so a model that takes few images keeps the faces and
 * the place. The characters the prompts mention come first, as a video request picks them, so a video started from
 * the keyframe names the people it shows. The image engine cuts the list at the model's limit.
 */
function keyframeReferences(bindings: ShotBindings, prompts: string) {
  const mentioned = new Set([...prompts.matchAll(MENTION)].map((m) => m[1]!.trim().toLowerCase()));
  const drawn = bindings.characters.filter((c) => c.imagePath);
  const isMentioned = (c: { name: string }) => mentioned.has(c.name.trim().toLowerCase());
  const cast = [...drawn.filter(isMentioned), ...drawn.filter((c) => !isMentioned(c))].slice(0, MAX_CAST);
  const refs: { path: string; label: string }[] = [];
  for (const c of cast) {
    const view = c.views?.headshot ? 'headshot' : c.views?.sheet === c.imagePath ? 'sheet' : null;
    refs.push({ path: c.imagePath!, label: view ? `${c.name} (${VIEW_LABEL[view]})` : c.name });
  }
  if (bindings.scene?.imagePath) refs.push({ path: bindings.scene.imagePath, label: `the location ${bindings.scene.name}` });
  for (const c of cast) {
    if (c.views?.headshot && c.views.body) refs.push({ path: c.views.body, label: `${c.name} (${VIEW_LABEL.body})` });
  }
  for (const p of bindings.props) if (p.imagePath) refs.push({ path: p.imagePath, label: `the prop ${p.name}` });
  const seen = new Set<string>();
  return { cast, refs: refs.filter((r) => !seen.has(r.path) && seen.add(r.path)) };
}

/** The first `Shot 1:` beat of a video prompt (timed lines read as numbered), without its label; '' without one. */
function openingBeat(videoPrompt: string): string {
  const line = untimed(videoPrompt).split('\n').find((l) => OPENING.test(l));
  return line ? line.replace(OPENING, '').trim() : '';
}

const plainNames = (text: string) => text.replace(MENTION, (_m, name: string) => name.trim());

/**
 * What the keyframe shows, when the shot has no keyframe prompt: its framing, the opening beat of its video prompt
 * (else its description), and where and when it happens.
 */
function composedMoment(shot: ReturnType<typeof getShotRow>, sceneName: string | undefined): string {
  const framing = [shot.shotType, shot.angle].map((s) => s.trim()).filter(Boolean).join(', ');
  const beat = openingBeat(shot.videoPrompt) || shot.description.trim() || clip(untimed(shot.videoPrompt), 600);
  const place = [shot.location.trim() || sceneName, shot.time.trim()].filter(Boolean).join(', ');
  return [framing && `Framing: ${framing}.`, beat && plainNames(beat), place && `Location: ${place}.`].filter(Boolean).join('\n');
}

/**
 * RequestShotKeyframe: a still of the shot's opening moment, drawn in the drama's shape and the episode's locked
 * image service (claimed on first use, adr-0016) from the bound characters' faces and bodies, the scene and the
 * props. The prompt is the request's, else the shot's keyframe prompt, else one composed from the shot; the code
 * frames it with the people, what they wear, the scene's lighting and identity and clean-frame sentences. The result
 * becomes the shot's keyframe. Refused while the shot already has a keyframe generating (409), and on an image model
 * that takes no reference image when characters must be drawn (the task fails before anything is paid).
 */
export function requestShotKeyframe(shotId: number, body: z.output<typeof RequestShotKeyframe>): TaskStarted {
  const shot = getShotRow(shotId);
  const ep = getEpisodeRow(shot.episodeId);
  assertNoBreakdown(ep.id);
  const bindings = loadBindings([shot]).get(shot.id)!;
  const { cast, refs } = keyframeReferences(bindings, `${body.prompt ?? shot.imagePrompt}\n${shot.videoPrompt}`);
  const moment = plainNames((body.prompt ?? shot.imagePrompt).trim()) || composedMoment(shot, bindings.scene?.name);
  if (!moment) throw precondition('Write a keyframe prompt, a description or a video prompt before generating a keyframe');
  const lighting = sceneLighting(shot.sceneId).replace(/[.\s]+$/, '');
  const prompt = [
    FRAME,
    headcountOf(cast.map((c) => c.name)),
    wardrobeOf(cast),
    moment,
    lighting && `Lighting: ${lighting}.`,
    [cast.length ? (cast.some((c) => c.outfit && !c.views?.body) ? IDENTITY_OUTFIT : IDENTITY) : '', CLEAN_FRAME].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('\n');
  const { taskId } = submitImage({
    owner: { kind: 'shot', id: shot.id },
    dramaId: ep.dramaId,
    prompt: withStylePrefix(ep.dramaId, prompt),
    aspectRatio: getDramaRow(ep.dramaId).aspectRatio,
    referenceImages: refs.map((r) => r.path),
    legend: refs.map((r) => r.label),
    ...(cast.length ? { referenceRequired: REFERENCE_REQUIRED } : {}),
    model: body.model,
    imageServiceId: body.imageServiceId,
    lockedServiceId: ep.imageServiceId,
    lockFor: ep.id,
    keyframeRevision: shot.keyframeRevision,
  });
  touchDrama(ep.dramaId);
  return { taskId };
}
