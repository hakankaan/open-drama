import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import { VIDEO_TASK_TYPES, type Film, type MergeShots, type MergeStarted } from '@open-drama/contracts';
import { db } from '../../db/client';
import { films, generationTasks } from '../../db/schema';
import { nowIso } from '../../db/schema/columns';
import { env } from '../../env';
import { conflict, invalid, precondition } from '../../http/errors';
import { logger } from '../../http/logger';
import { ffmpegAvailable, probeClip } from '../../lib/ffmpeg';
import { toAbsolute, toMediaPath } from '../../lib/paths';
import { deriveRenditions } from '../media/store';
import { attachEpisodeFilm, getEpisodeRow } from '../production/episodes';
import { isShuttingDown } from '../../lib/shutdown';
import { getDramaRow, touchDrama } from '../production/dramas';
import { assertNoBreakdown, liveShotRows } from '../storyboard/service';
import { colourStats, gradeTowards, type ColourStats } from './colour';
import { ENCODER, filmFrame, FPS, renderFilm, type FilmClip, type FilmOptions } from './render';

type FilmRow = typeof films.$inferSelect;

export const toFilm = ({ dramaId: _d, encoder: _e, clipPaths, ...row }: FilmRow): Film => ({ ...row, clipCount: clipPaths.length });

const posterFor = (mediaPath: string) => mediaPath.slice(0, mediaPath.length - extname(mediaPath).length) + '_poster.jpg';

/** EpisodeFilms: the episode's merges, newest first. */
export function episodeFilms(episodeId: number): Film[] {
  getEpisodeRow(episodeId);
  return db.select().from(films).where(eq(films.episodeId, episodeId)).orderBy(desc(films.id)).all().map(toFilm);
}

/** LatestMergeStatus: the most recent merge, polled while it renders; null before the first merge. */
export function latestFilm(episodeId: number): Film | null {
  getEpisodeRow(episodeId);
  const row = db.select().from(films).where(eq(films.episodeId, episodeId)).orderBy(desc(films.id)).get();
  return row ? toFilm(row) : null;
}

interface ClipTask {
  seconds: number | null;
  firstFrame: string | null;
  /** The shot and video it continues, and the time of the frame it started from (adr-0020). */
  chainedFrom: { shotId: number; videoPath: string; at: number } | null;
  /** For a lip sync, the video it re-synced (adr-0021): the take a continued shot started from. */
  sourceVideoPath: string | null;
}

/**
 * What a shot's video was generated with: its length, since providers return a few frames more than asked (9.056 s
 * for 9 s), which would add up across the film; the still it started from; and the video it continues. Nulls when
 * the task is not found.
 */
function clipTask(shotId: number, videoPath: string): ClipTask {
  const task = db
    .select({ params: generationTasks.params })
    .from(generationTasks)
    .where(
      and(
        eq(generationTasks.shotId, shotId),
        inArray(generationTasks.type, VIDEO_TASK_TYPES),
        eq(generationTasks.status, 'completed'),
        eq(generationTasks.localPath, videoPath),
      ),
    )
    .orderBy(desc(generationTasks.id))
    .get();
  const { durationSeconds: seconds, firstFrame, chainedFrom, sourceVideoPath } = task?.params ?? {};
  const from = chainedFrom as Partial<NonNullable<ClipTask['chainedFrom']>> | undefined;
  return {
    seconds: typeof seconds === 'number' && seconds > 0 ? seconds : null,
    firstFrame: typeof firstFrame === 'string' ? firstFrame : null,
    chainedFrom:
      typeof from?.shotId === 'number' && typeof from.videoPath === 'string' && typeof from.at === 'number'
        ? { shotId: from.shotId, videoPath: from.videoPath, at: from.at }
        : null,
    sourceVideoPath: typeof sourceVideoPath === 'string' ? sourceVideoPath : null,
  };
}

/** A clip as the merge plans it; `joinsAt` is set when it continues the clip before it in this film. */
interface PlannedClip {
  shotNumber: number;
  path: string;
  requested: number | null;
  reference: string | null;
  /** The time in the clip before it of the frame this one starts from (adr-0020). */
  joinsAt: number | null;
}

/**
 * MergeShots: the episode's live shots with a video (all of them, or exactly the selected ones) in shot-number order.
 * Rejected when FFmpeg is unavailable, while a breakdown runs, when a selected shot has no video or its file is
 * missing (naming the shots), when nothing is left to merge, and while another merge of the episode is processing
 * (409). Rendering runs detached (RunFfmpegConcat).
 */
export async function mergeShots(episodeId: number, input: z.output<typeof MergeShots>): Promise<MergeStarted> {
  // The only await comes first: from the guards to the insert everything is synchronous, so a breakdown or another
  // merge cannot start in between.
  if (!(await ffmpegAvailable())) throw precondition('FFmpeg is not available on the server; set FFMPEG_BIN');
  const ep = getEpisodeRow(episodeId);
  assertNoBreakdown(ep.id);
  const live = liveShotRows(ep.id);
  let clips = live.filter((s) => s.videoPath);
  if (input.shotIds) {
    const wanted = new Set(input.shotIds);
    const selected = live.filter((s) => wanted.has(s.id));
    if (selected.length !== wanted.size) throw invalid('Some selected shots do not belong to this episode');
    const without = selected.filter((s) => !s.videoPath).map((s) => s.shotNumber);
    if (without.length > 0) {
      throw precondition(`Shot ${without.map((n) => `#${n}`).join(', ')} has no video yet; generate it or leave it out`, {
        shotNumbers: without,
      });
    }
    clips = selected;
  }
  if (clips.length === 0) throw precondition('No shot of this episode has a video yet');
  const missing = clips.filter((s) => !existsSync(toAbsolute(s.videoPath!))).map((s) => s.shotNumber);
  if (missing.length > 0) {
    throw precondition(`The video file of shot ${missing.map((n) => `#${n}`).join(', ')} is missing; regenerate it before merging`, {
      shotNumbers: missing,
    });
  }
  const clipPaths = clips.map((s) => s.videoPath!);
  const drama = getDramaRow(ep.dramaId);
  const options: FilmOptions = { frame: filmFrame(drama.aspectRatio, ep.resolution), look: drama.look };
  const frame = options.frame ? `${options.frame.width}x${options.frame.height}` : 'first clip';
  const encoderWith = (match: string, joins = 0) =>
    `${ENCODER} · ${frame} ${FPS} fps · ${match} · look ${options.look} · loudnorm -16 LUFS${joins ? ` · ${joins} continuous ${joins === 1 ? 'join' : 'joins'}` : ''}`;
  const encoder = encoderWith(input.colorMatch ? 'colour match to keyframes' : 'no colour match');
  const filmId = db.transaction((tx) => {
    const running = tx
      .select({ id: films.id })
      .from(films)
      .where(and(eq(films.episodeId, ep.id), eq(films.status, 'processing')))
      .get();
    if (running) throw conflict('A merge of this episode is already running', { filmId: running.id });
    return tx
      .insert(films)
      .values({ episodeId: ep.id, dramaId: ep.dramaId, clipPaths, encoder })
      .returning({ id: films.id })
      .get().id;
  });
  touchDrama(ep.dramaId);
  // A clip is matched to the keyframe it started from, else to its shot's keyframe; one without either stays as it is.
  // A clip that continues the clip before it (the same video it was started from) joins it without a cut; one that
  // continued another version started from a frame of a clip not in the film, so only its shot's keyframe counts. A
  // lip sync of the video it continues is the same take, its mouth re-drawn (adr-0021).
  const tasks = clips.map((s) => clipTask(s.id, s.videoPath!));
  const planned: PlannedClip[] = clips.map((s, i) => {
    const task = tasks[i]!;
    const before = clips[i - 1];
    const takes = before ? [before.videoPath, tasks[i - 1]!.sourceVideoPath] : [];
    const joins = task.chainedFrom && before && task.chainedFrom.shotId === before.id && takes.includes(task.chainedFrom.videoPath);
    return {
      shotNumber: s.shotNumber,
      path: s.videoPath!,
      requested: task.seconds,
      reference: input.colorMatch ? (task.chainedFrom ? s.keyframePath : (task.firstFrame ?? s.keyframePath)) : null,
      joinsAt: joins ? task.chainedFrom!.at : null,
    };
  });
  const joins = planned.filter((c) => c.joinsAt !== null).length;
  const describe = (graded: number) =>
    encoderWith(input.colorMatch ? `colour matched to keyframes (${graded} of ${planned.length} clips)` : 'no colour match', joins);
  void render(filmId, ep.id, planned, options, describe)
    .catch((err) => failMerge(filmId, err))
    .catch((err) => logger.error({ filmId, err: (err as Error).message }, 'merge crashed'));
  return { filmId };
}

/**
 * RunFfmpegConcat → CompleteMerge: probe, grade, render, poster (DerivePosterForFilm), then attach (PublishFilmToEpisode).
 * Each clip plays for the length it was generated at, or its own length when shorter, and is graded towards its
 * reference image when it has one (a reference or clip FFmpeg cannot read leaves the clip ungraded). A clip that
 * continues the one before takes its grade, and the one before ends on the frame it starts from (adr-0020). The film's
 * encoder line records how many clips were graded and joined.
 */
async function render(
  filmId: number,
  episodeId: number,
  clips: PlannedClip[],
  options: FilmOptions,
  describe: (graded: number) => string,
) {
  const inputs: FilmClip[] = [];
  const stills = new Map<string, Promise<ColourStats | null>>();
  for (const [i, clip] of clips.entries()) {
    const absPath = toAbsolute(clip.path);
    const info = await probeClip(absPath);
    if (!info) throw new Error(`The video of shot #${clip.shotNumber} is not a readable video file`);
    const joinsNext = clips[i + 1]?.joinsAt ?? null;
    const skip = clip.joinsAt === null ? 0 : 1;
    const length = Math.min(info.durationSeconds, clip.requested ?? Infinity, joinsNext === null ? Infinity : joinsNext + 1 / FPS);
    const seconds = Math.max(1 / FPS, length - skip / FPS);
    let grade: FilmClip['grade'] = null;
    if (clip.joinsAt !== null) grade = inputs[i - 1]?.grade ?? null;
    else if (clip.reference) {
      const ref = clip.reference;
      if (!stills.has(ref)) stills.set(ref, existsSync(toAbsolute(ref)) ? colourStats(toAbsolute(ref), null) : Promise.resolve(null));
      const [target, own] = await Promise.all([stills.get(ref)!, colourStats(absPath, seconds)]);
      if (target && own) grade = gradeTowards(own, target);
    }
    inputs.push({ absPath, info, seconds, skip, grade });
  }
  // Rendered under temp/ (cleared at boot) and moved into merged/ only when complete, so an interrupted render never
  // leaves a partial film behind.
  const name = `${randomUUID()}.mp4`;
  const partAbs = join(env.storageRoot, 'temp', name);
  const outAbs = join(env.storageRoot, 'merged', name);
  try {
    await renderFilm(inputs, options, partAbs);
    const info = await probeClip(partAbs);
    if (!info) throw new Error('The rendered film is not a readable video');
    await rename(partAbs, outAbs);
    const filmPath = toMediaPath(outAbs);
    await deriveRenditions(filmPath, 'video');
    const posterPath = existsSync(toAbsolute(posterFor(filmPath))) ? posterFor(filmPath) : null;
    db.transaction((tx) => {
      const encoder = describe(inputs.filter((c) => c.grade).length);
      tx.update(films)
        .set({ status: 'completed', filmPath, durationSeconds: info.durationSeconds, posterPath, encoder, completedAt: nowIso() })
        .where(eq(films.id, filmId))
        .run();
      attachEpisodeFilm(tx, episodeId, filmPath, info.durationSeconds);
    });
    logger.info({ filmId, episodeId, clips: clips.length, durationSeconds: info.durationSeconds }, 'film rendered');
  } catch (err) {
    await rm(partAbs, { force: true });
    await rm(outAbs, { force: true });
    await rm(posterFor(outAbs), { force: true });
    throw err;
  }
}

/** FailMerge: the error is shown on the export stage; the creator can merge again. A render cut short by shutdown is left to boot cleanup. */
function failMerge(filmId: number, err: unknown) {
  if (isShuttingDown()) return;
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 1000);
  logger.warn({ filmId, err: message }, 'merge failed');
  db.update(films).set({ status: 'failed', error: message, completedAt: nowIso() }).where(eq(films.id, filmId)).run();
}
