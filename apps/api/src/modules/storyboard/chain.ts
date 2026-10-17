import { setTimeout as sleep } from 'node:timers/promises';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { VIDEO_TASK_TYPES } from '@open-drama/contracts';
import { db } from '../../db/client';
import { generationTasks, shots } from '../../db/schema';
import { invalid, precondition } from '../../http/errors';
import { ffmpegBin, probeDurationSeconds, run } from '../../lib/ffmpeg';
import { toAbsolute } from '../../lib/paths';
import { isShuttingDown } from '../../lib/shutdown';
import { logger } from '../../http/logger';
import { deriveRenditions, storeBuffer } from '../media/store';
import { liveShotRows } from './service';

/** At most this many shots in a row continue the one before: each one sees no reference image, so faces drift (adr-0020). */
export const MAX_CONTINUED = 2;
/** The film's frame rate (the merge renders at it). */
const FPS = 24;
/** The frame taken sits this far before the clip's end, where generated clips often fade or freeze. */
const TAIL_SECONDS = 6 / FPS;
const WAIT_MS = 3_000;

type ShotRow = typeof shots.$inferSelect;

/** The shot a continued shot starts from, and the task making its video when one is still running. */
export interface ChainSource {
  shotId: number;
  shotNumber: number;
  /** Its video task still processing: the continued shot waits for it. */
  waitingFor: number | null;
}

/** Whether the next live shot continues this one: its video then ends on a steady moment to start from. */
export function continuedByNext(shot: ShotRow): boolean {
  const live = liveShotRows(shot.episodeId);
  const i = live.findIndex((s) => s.id === shot.id);
  return Boolean(live[i + 1]?.continuesPrevious);
}

const processingVideo = (shotId: number) =>
  db
    .select({ id: generationTasks.id })
    .from(generationTasks)
    .where(and(eq(generationTasks.shotId, shotId), inArray(generationTasks.type, VIDEO_TASK_TYPES), eq(generationTasks.status, 'processing')))
    .orderBy(desc(generationTasks.id))
    .get()?.id ?? null;

/**
 * Where a shot marked as continuing the previous one starts (adr-0020), or null when it starts a take (it is the
 * first shot). Refused (412) when it cannot continue: the model takes no first frame, the request carries reference
 * video or audio, it would be the third shot in a row to continue, or the previous shot has no video and none generating.
 */
export function chainSource(shot: ShotRow, opts: { model: string; firstFrame: boolean; otherMedia: number }): ChainSource | null {
  if (!shot.continuesPrevious) return null;
  const live = liveShotRows(shot.episodeId);
  const i = live.findIndex((s) => s.id === shot.id);
  if (i <= 0) return null;
  const prev = live[i - 1]!;
  let depth = 1;
  // The first shot's mark means nothing: it has no shot before it to continue.
  while (depth <= MAX_CONTINUED && i - depth > 0 && live[i - depth]!.continuesPrevious) depth++;
  if (depth > MAX_CONTINUED) {
    throw precondition(
      `At most ${MAX_CONTINUED} shots in a row can continue the one before, since they get no reference image and faces drift; let this shot or one before it start a new take`,
    );
  }
  if (!opts.firstFrame) {
    throw precondition(`${opts.model} takes no first frame, so it cannot continue shot ${prev.shotNumber}; pick a model that does, or start a new take`);
  }
  if (opts.otherMedia > 0) throw invalid('A shot that continues the previous one starts from its last frame and takes no reference video or audio');
  const waitingFor = processingVideo(prev.id);
  if (waitingFor === null && !prev.videoPath) {
    throw precondition(`Shot ${prev.shotNumber} has no video yet; generate it first, since this shot starts from its last frame`);
  }
  return { shotId: prev.id, shotNumber: prev.shotNumber, waitingFor };
}

/** Whether the task's shot still continues the given one: still marked, and that shot still the live one before it. */
function stillContinues(taskId: number, prevId: number): boolean {
  const shotId = db.select({ shotId: generationTasks.shotId }).from(generationTasks).where(eq(generationTasks.id, taskId)).get()?.shotId;
  const shot = shotId != null ? db.select().from(shots).where(eq(shots.id, shotId)).get() : undefined;
  if (!shot?.continuesPrevious) return false;
  const live = liveShotRows(shot.episodeId);
  const i = live.findIndex((s) => s.id === shot.id);
  return i > 0 && live[i - 1]!.id === prevId;
}

const statusOf = (taskId: number) =>
  db.select({ status: generationTasks.status }).from(generationTasks).where(eq(generationTasks.id, taskId)).get()?.status;

/**
 * The first frame of a continued shot's task (`SubmitVideoInput.firstFrameFrom`): waits while the previous shot's video
 * is generating, then takes its frame a quarter second before the end of what the film shows (the clip, cut to the
 * length it was asked for), stores it as an image and records it on the task with where it came from, which the merge
 * reads to join the two clips without a cut. Null when the task stopped meanwhile (cancelled, or the server stopping:
 * a task left waiting fails at the next boot); throws when the previous video failed or is gone, or when the creator
 * changed the take while it waited (the shot no longer continues, or another shot now comes before it).
 */
export async function firstFrameFrom(taskId: number, source: ChainSource): Promise<string | null> {
  if (source.waitingFor !== null) logger.info({ taskId, waitingFor: source.waitingFor }, 'video task waiting for the shot it continues');
  for (;;) {
    if (isShuttingDown() || statusOf(taskId) !== 'processing') return null;
    if (source.waitingFor === null) break;
    const dep = statusOf(source.waitingFor);
    if (dep === 'failed') throw new Error(`Shot ${source.shotNumber}'s video failed, and this shot starts from it; nothing was sent to the provider`);
    if (dep !== 'processing') break;
    await sleep(WAIT_MS);
  }
  if (!stillContinues(taskId, source.shotId)) {
    throw new Error(`This shot no longer continues shot ${source.shotNumber}; generate it again. Nothing was sent to the provider`);
  }

  const prev = db.select().from(shots).where(eq(shots.id, source.shotId)).get();
  if (!prev?.videoPath) throw new Error(`Shot ${source.shotNumber} has no video to continue from; nothing was sent to the provider`);
  const videoPath = prev.videoPath;
  const made = db
    .select({ id: generationTasks.id, params: generationTasks.params })
    .from(generationTasks)
    .where(and(eq(generationTasks.shotId, prev.id), inArray(generationTasks.type, VIDEO_TASK_TYPES), eq(generationTasks.localPath, videoPath)))
    .orderBy(desc(generationTasks.id))
    .get();
  const abs = toAbsolute(videoPath);
  const actual = (await probeDurationSeconds(abs)) ?? prev.videoDurationSeconds ?? 0;
  const requested = typeof made?.params.durationSeconds === 'number' ? made.params.durationSeconds : actual;
  const at = Math.round(Math.max(0, Math.min(actual, requested) - TAIL_SECONDS) * 1000) / 1000;

  const frame = await run(ffmpegBin(), ['-v', 'error', '-ss', String(at), '-i', abs, '-frames:v', '1', '-q:v', '2', '-f', 'image2pipe', '-c:v', 'mjpeg', 'pipe:1'], 60_000);
  if (frame.code !== 0 || frame.bytes.length === 0) {
    throw new Error(`The last frame of shot ${source.shotNumber} could not be read: ${frame.stderr.trim().slice(-300) || 'no frame'}`);
  }
  const firstFrame = await storeBuffer('images', '.jpg', frame.bytes);
  await deriveRenditions(firstFrame, 'image');

  const chainedFrom = { shotId: prev.id, shotNumber: source.shotNumber, taskId: made?.id ?? null, videoPath, at };
  db.transaction((tx) => {
    const task = tx.select({ params: generationTasks.params }).from(generationTasks).where(eq(generationTasks.id, taskId)).get();
    if (task) tx.update(generationTasks).set({ params: { ...task.params, firstFrame, chainedFrom } }).where(eq(generationTasks.id, taskId)).run();
  });
  logger.info({ taskId, from: videoPath, at }, 'continued shot starts from the previous last frame');
  return firstFrame;
}
