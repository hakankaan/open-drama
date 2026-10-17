import { existsSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { CheckShot, QaCheck, Shot, ShotQa } from '@open-drama/contracts';
import { db } from '../../db/client';
import { shots } from '../../db/schema';
import { nowIso } from '../../db/schema/columns';
import { ApiError, precondition } from '../../http/errors';
import { logger } from '../../http/logger';
import { ffmpegBin, probeClip, run } from '../../lib/ffmpeg';
import { toAbsolute } from '../../lib/paths';
import { scrubSecrets } from '../../lib/secrets';
import { resolveVisionModel } from '../agents/runtime/model';
import { askAboutImages, isApiCallError } from '../agents/runtime/sdk';
import { getAppSettings } from '../configuration/settings';
import { getEpisodeRow } from '../production/episodes';
import { loadBindings, getShotRow, toShot } from './service';
import { wardrobeOf } from './video';

/** Each picture of a contact sheet fits this box; three frames of a 16:9 clip make a 1536 x 288 sheet. */
const TILE = 512;
/** Frames at these fractions of the clip: clear of the fade-in and of the steady ending a continued shot is asked for. */
const AT = [1 / 6, 1 / 2, 5 / 6];
const TIMEOUT_MS = 90_000;
const LANGUAGE = { en: 'English', zh: 'Simplified Chinese', ja: 'Japanese', ko: 'Korean' } as const;

/** The model's answer: a result and a note per point (skipped ones are set in code). */
const Answer = z.object({
  people: z.object({ ok: z.boolean(), note: z.string() }),
  outfit: z.object({ ok: z.boolean(), note: z.string() }),
  scene: z.object({ ok: z.boolean(), note: z.string() }),
  artifacts: z.object({ ok: z.boolean(), note: z.string() }),
});

const INSTRUCTIONS = `You check one shot of a generated video for a film studio. You get two pictures: first a strip of three frames from the shot, left to right in time; then a strip of reference images, described in the message. Look only at what is visible.

Judge four points and answer with JSON only, no prose and no code fence:
{"people":{"ok":true,"note":""},"outfit":{"ok":true,"note":""},"scene":{"ok":true,"note":""},"artifacts":{"ok":true,"note":""}}

- people: false when the frames show more people than the expected cast, or the same person twice. Fewer is fine (someone may be out of frame).
- outfit: false when someone's clothing is clearly unlike their reference (another garment, another colour), not when light or angle changes it.
- scene: false when the place is clearly unlike the scene reference (indoors for outdoors, another kind of room, day for night).
- artifacts: false for visible defects: deformed faces or hands, extra limbs, melting objects, text, subtitles, logos, watermarks, frozen or broken frames.

Do not judge whether faces match the references: identity is not part of this check. Each note is one short sentence on what you saw.`;

/** Scales a still or a frame into the tile box, padded to a square so pictures of any shape line up. */
const tileFilter = (pad: boolean) =>
  `scale=${TILE}:${TILE}:force_original_aspect_ratio=decrease${pad ? `,pad=${TILE}:${TILE}:(ow-iw)/2:(oh-ih)/2:color=gray` : ''},setsar=1`;

/** One JPEG of the inputs side by side; `seek` gives each input's time, for frames of a video. */
async function strip(paths: string[], seek: number[] | null): Promise<Uint8Array> {
  const inputs = paths.flatMap((p, i) => [...(seek ? ['-ss', seek[i]!.toFixed(3)] : []), '-i', toAbsolute(p)]);
  const scaled = paths.map((_, i) => `[${i}:v]${tileFilter(!seek)}[t${i}]`).join(';');
  const joined = paths.length > 1 ? `;${paths.map((_, i) => `[t${i}]`).join('')}hstack=inputs=${paths.length}[out]` : '';
  const out = paths.length > 1 ? '[out]' : '[t0]';
  const result = await run(
    ffmpegBin(),
    ['-v', 'error', ...inputs, '-filter_complex', scaled + joined, '-map', out, '-frames:v', '1', '-q:v', '4', '-f', 'image2pipe', '-c:v', 'mjpeg', 'pipe:1'],
    60_000,
  );
  if (result.code !== 0 || result.bytes.length === 0) {
    throw new Error(`The pictures for the check could not be prepared: ${result.stderr.trim().slice(-300) || 'no output'}`);
  }
  return result.bytes;
}

/** The first JSON object in a reply, read past code fences and stray prose. */
function parseAnswer(text: string): z.infer<typeof Answer> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = Answer.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function providerError(err: unknown, model: string): ApiError {
  if (err instanceof ApiError) return err;
  if (isApiCallError(err)) {
    const status = err.statusCode ? ` (${err.statusCode})` : '';
    if (err.statusCode === 401 || err.statusCode === 403) return new ApiError('PROVIDER_ERROR', `The vision provider rejected the API key${status}`);
    return new ApiError('PROVIDER_ERROR', scrubSecrets(`${model} could not check the shot${status}: ${err.message.slice(0, 300)}`));
  }
  if (err instanceof Error && err.name === 'TimeoutError') return new ApiError('PROVIDER_ERROR', `${model} did not answer within ${TIMEOUT_MS / 1000} s`);
  return new ApiError('PROVIDER_ERROR', scrubSecrets(err instanceof Error ? err.message : String(err)));
}

/**
 * CheckShot (adr-0022): three frames of the shot's current video and its references (each character's full body, else
 * its cover, at most four, then the scene's image) go to the vision service as two contact sheets. The model flags
 * extra people, outfits and settings unlike their references, and visible defects; it never scores identity. A point
 * with nothing to compare with is skipped. Stored on the shot with the video it judged; a signal, never a gate.
 */
export async function checkShot(shotId: number, body: z.output<typeof CheckShot>): Promise<Shot> {
  const resolved = resolveVisionModel({ model: body.model, serviceId: body.visionServiceId });
  const shot = getShotRow(shotId);
  getEpisodeRow(shot.episodeId); // a shot of a deleted episode is not checked (404)
  const videoPath = shot.videoPath;
  if (!videoPath) throw precondition('The shot has no video to check yet');
  if (!existsSync(toAbsolute(videoPath))) throw precondition('The shot’s video file is missing; generate it again');
  const seconds = (await probeClip(toAbsolute(videoPath)))?.durationSeconds ?? shot.videoDurationSeconds;
  if (!seconds) throw precondition('The shot’s video could not be read');

  const bindings = loadBindings([shot]).get(shot.id)!;
  // Everyone bound may appear (narrators are not bound); only the first four are pictured, as in a video's references.
  const cast = bindings.characters;
  // In an episode where a character wears another outfit, its full body is that outfit's picture (adr-0023).
  const pictured = cast.slice(0, 4).flatMap((c) => {
    const body = c.views?.body ?? null;
    const path = body ?? c.imagePath;
    const kind = body ? (c.outfit ? "full body in this episode's outfit" : 'full body') : 'cover';
    return path && existsSync(toAbsolute(path)) ? [{ name: c.name, kind, path }] : [];
  });
  const scene = bindings.scene?.imagePath && existsSync(toAbsolute(bindings.scene.imagePath)) ? bindings.scene : null;
  const references = [...pictured, ...(scene ? [{ name: scene.name, kind: 'scene', path: scene.imagePath! }] : [])];

  const frames = await strip([videoPath, videoPath, videoPath], AT.map((f) => f * seconds));
  const images = [frames, ...(references.length > 0 ? [await strip(references.map((r) => r.path), null)] : [])];
  const language = LANGUAGE[getAppSettings().contentLanguage];
  const text = [
    `Expected cast (${cast.length}): ${cast.length > 0 ? cast.map((c) => c.name).join(', ') : 'nobody; any person is extra'}.`,
    references.length > 0
      ? `Reference strip, left to right: ${references.map((r, i) => `${i + 1}. ${r.name} (${r.kind})`).join('; ')}.`
      : 'There is no reference strip.',
    wardrobeOf(cast),
    `What the shot shows: ${shot.description.trim().slice(0, 1200) || '(no description)'}`,
    `Write the notes in ${language}.`,
  ]
    .filter(Boolean)
    .join('\n');

  let answer: z.infer<typeof Answer> | null;
  try {
    const reply = await askAboutImages({ model: resolved.model, instructions: INSTRUCTIONS, text, images, temperature: resolved.temperature, timeoutMs: TIMEOUT_MS });
    answer = parseAnswer(reply.text);
  } catch (err) {
    throw providerError(err, resolved.modelId);
  }
  if (!answer) throw new ApiError('PROVIDER_ERROR', `${resolved.modelId} answered something other than the check; try again or pick another vision model`);

  const point = (p: { ok: boolean; note: string }, judged = true): QaCheck =>
    judged ? { result: p.ok ? 'ok' : 'flag', note: p.note.trim().slice(0, 300) } : { result: 'skipped', note: '' };
  const checks: ShotQa['checks'] = {
    people: point(answer.people),
    outfit: point(answer.outfit, pictured.length > 0),
    scene: point(answer.scene, scene !== null),
    artifacts: point(answer.artifacts),
  };
  const qa: ShotQa = {
    videoPath,
    checkedAt: nowIso(),
    model: resolved.modelId,
    verdict: Object.values(checks).some((c) => c.result === 'flag') ? 'check' : 'ok',
    checks,
  };
  // The video may have changed while the model looked: the check is kept only for the video it judged.
  db.transaction((tx) => {
    const current = tx.select({ videoPath: shots.videoPath }).from(shots).where(eq(shots.id, shot.id)).get();
    if (current?.videoPath === videoPath) tx.update(shots).set({ qa }).where(eq(shots.id, shot.id)).run();
  });
  logger.info({ shotId: shot.id, model: resolved.modelId, verdict: qa.verdict }, 'shot checked');
  return toShot(getShotRow(shot.id));
}
