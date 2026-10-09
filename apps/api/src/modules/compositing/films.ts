import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Film, MergeShots, MergeStarted } from '@open-drama/contracts';
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
import { touchDrama } from '../production/dramas';
import { assertNoBreakdown, liveShotRows } from '../storyboard/service';
import { ENCODER, renderFilm, type FilmClip } from './render';

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

/**
 * The length a shot's video was generated at. Providers return a few frames more than asked (9.056 s for 9 s), which
 * would add up across the film; null when the video's task is not found.
 */
function requestedSeconds(shotId: number, videoPath: string): number | null {
  const task = db
    .select({ params: generationTasks.params })
    .from(generationTasks)
    .where(
      and(
        eq(generationTasks.shotId, shotId),
        eq(generationTasks.type, 'video'),
        eq(generationTasks.status, 'completed'),
        eq(generationTasks.localPath, videoPath),
      ),
    )
    .orderBy(desc(generationTasks.id))
    .get();
  const seconds = task?.params.durationSeconds;
  return typeof seconds === 'number' && seconds > 0 ? seconds : null;
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
  const filmId = db.transaction((tx) => {
    const running = tx
      .select({ id: films.id })
      .from(films)
      .where(and(eq(films.episodeId, ep.id), eq(films.status, 'processing')))
      .get();
    if (running) throw conflict('A merge of this episode is already running', { filmId: running.id });
    return tx
      .insert(films)
      .values({ episodeId: ep.id, dramaId: ep.dramaId, clipPaths, encoder: ENCODER })
      .returning({ id: films.id })
      .get().id;
  });
  touchDrama(ep.dramaId);
  const planned = clips.map((s) => ({ shotNumber: s.shotNumber, path: s.videoPath!, requested: requestedSeconds(s.id, s.videoPath!) }));
  void render(filmId, ep.id, planned)
    .catch((err) => failMerge(filmId, err))
    .catch((err) => logger.error({ filmId, err: (err as Error).message }, 'merge crashed'));
  return { filmId };
}

/**
 * RunFfmpegConcat → CompleteMerge: probe, render, poster (DerivePosterForFilm), then attach (PublishFilmToEpisode).
 * Each clip plays for the length it was generated at, or its own length when shorter.
 */
async function render(filmId: number, episodeId: number, clips: { shotNumber: number; path: string; requested: number | null }[]) {
  const inputs: FilmClip[] = [];
  for (const clip of clips) {
    const absPath = toAbsolute(clip.path);
    const info = await probeClip(absPath);
    if (!info) throw new Error(`The video of shot #${clip.shotNumber} is not a readable video file`);
    inputs.push({ absPath, info, seconds: Math.min(info.durationSeconds, clip.requested ?? Infinity) });
  }
  // Rendered under temp/ (cleared at boot) and moved into merged/ only when complete, so an interrupted render never
  // leaves a partial film behind.
  const name = `${randomUUID()}.mp4`;
  const partAbs = join(env.storageRoot, 'temp', name);
  const outAbs = join(env.storageRoot, 'merged', name);
  try {
    await renderFilm(inputs, partAbs);
    const info = await probeClip(partAbs);
    if (!info) throw new Error('The rendered film is not a readable video');
    await rename(partAbs, outAbs);
    const filmPath = toMediaPath(outAbs);
    await deriveRenditions(filmPath, 'video');
    const posterPath = existsSync(toAbsolute(posterFor(filmPath))) ? posterFor(filmPath) : null;
    db.transaction((tx) => {
      tx.update(films)
        .set({ status: 'completed', filmPath, durationSeconds: info.durationSeconds, posterPath, completedAt: nowIso() })
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
