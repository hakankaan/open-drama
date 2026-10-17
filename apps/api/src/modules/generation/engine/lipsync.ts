import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { LINE_LEAD_IN_SECONDS, VIDEO_TASK_TYPES } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { episodes, generationTasks, shots } from '../../../db/schema';
import { nowIso } from '../../../db/schema/columns';
import { env } from '../../../env';
import { ApiError, precondition } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { ffmpegBin, probeClip, run } from '../../../lib/ffmpeg';
import { toAbsolute, toMediaPath } from '../../../lib/paths';
import { assertVideo, deriveRenditions, storeRemoteFile } from '../../media/store';
import { lipSyncAdapterFor } from '../adapters/registry';
import { ProviderError, type LipSyncAdapter, type LipSyncRecord, type ResultMedia } from '../adapters/types';
import { classify, messageOf } from './errors';
import { claimTask, completeTask, detach, generate, recordResultUrl, resolveGeneration, type ResolvedGeneration } from './lifecycle';
import { deliverStoredFile } from './references';

/** Lip-sync polling profile: every 5 s, within 30 minutes. */
export const LIPSYNC_POLL = { intervalMs: 5_000, attempts: 360, maxMs: 30 * 60_000 };

type ShotRow = typeof shots.$inferSelect;
type TaskRow = typeof generationTasks.$inferSelect;
export type ResolvedLipSync = ResolvedGeneration<LipSyncAdapter>;

/** The lip-sync adapter and credentials for a request (explicit service → the highest-priority active one); no episode lock. */
export const resolveLipSync = (opts: { explicitId?: number; model?: string } = {}): ResolvedLipSync =>
  resolveGeneration('lipsync', lipSyncAdapterFor, opts);

const taskOf = (id: number) => db.select().from(generationTasks).where(eq(generationTasks.id, id)).get();

/**
 * The video a lip sync starts from, and the task that made it: the shot's current video, or, when that is itself a
 * lip sync, the video it was made from (a line re-spoken is synced to the original again, never to a synced copy).
 */
function sourceOf(shot: ShotRow): { path: string; task: TaskRow | undefined } {
  if (!shot.videoPath) throw precondition('The shot has no video to lip-sync yet; generate it first');
  const current = db
    .select()
    .from(generationTasks)
    .where(and(eq(generationTasks.shotId, shot.id), inArray(generationTasks.type, VIDEO_TASK_TYPES), eq(generationTasks.localPath, shot.videoPath)))
    .orderBy(desc(generationTasks.id))
    .get();
  if (current?.type === 'lipsync' && typeof current.params.sourceVideoPath === 'string') {
    const from = typeof current.params.sourceTaskId === 'number' ? taskOf(current.params.sourceTaskId) : undefined;
    return { path: current.params.sourceVideoPath, task: from };
  }
  return { path: shot.videoPath, task: current };
}

/**
 * What a lip sync needs from its shot (412 otherwise): a spoken line with its audio, and a video long enough to hold
 * the line after its lead-in (a longer line would be cut off).
 */
function lipSyncSource(shot: ShotRow) {
  if (!shot.line.trim() || shot.speakerId === null) throw precondition('The shot has no spoken line to lip-sync to');
  if (!shot.lineAudioPath || !shot.lineAudioSeconds) throw precondition('Generate the shot’s line audio first');
  if (!existsSync(toAbsolute(shot.lineAudioPath))) throw precondition('The line audio file is missing; generate it again');
  const source = sourceOf(shot);
  if (!existsSync(toAbsolute(source.path))) throw precondition('The video file to lip-sync is missing; generate the video again');
  const needed = LINE_LEAD_IN_SECONDS + shot.lineAudioSeconds;
  const seconds = source.task?.durationSeconds ?? shot.videoDurationSeconds;
  if (seconds && needed > seconds + 0.05) {
    throw precondition(`The line runs ${needed.toFixed(1)} s with its lead-in, longer than the ${seconds.toFixed(1)} s video; generate the video again so it fits`);
  }
  return { ...source, lineAudioPath: shot.lineAudioPath };
}

/**
 * The line as the provider and the film hear it: a half-second lead-in, then the line, then silence up to the video's
 * length, as mono AAC (M4A). Stored as kept audio, since the task reads it again when the result comes back.
 */
async function padLine(lineAudioPath: string, seconds: number): Promise<string> {
  const out = join(env.storageRoot, 'audio', `${randomUUID()}.m4a`);
  const result = await run(
    ffmpegBin(),
    [
      '-y', '-i', toAbsolute(lineAudioPath),
      '-af', `adelay=delays=${Math.round(LINE_LEAD_IN_SECONDS * 1000)}:all=1,apad`,
      '-t', seconds.toFixed(3), '-ac', '1', '-ar', '48000', '-c:a', 'aac', '-b:a', '128k', out,
    ],
    60_000,
  );
  if (result.code !== 0) throw new Error(`The line audio could not be prepared: ${result.stderr.trim().slice(-300)}`);
  return toMediaPath(out);
}

/** The provider's picture with our padded line as its sound: the provider's own audio track may be resampled or cut. */
async function withLine(videoPath: string, paddedPath: string): Promise<string> {
  const out = join(env.storageRoot, 'videos', `${randomUUID()}.mp4`);
  const result = await run(
    ffmpegBin(),
    [
      '-y', '-i', toAbsolute(videoPath), '-i', toAbsolute(paddedPath),
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out,
    ],
    120_000,
  );
  if (result.code !== 0) {
    await rm(out, { force: true });
    throw new Error(`The lip-synced video could not be given its line: ${result.stderr.trim().slice(-300)}`);
  }
  return toMediaPath(out);
}

/**
 * Stores the result with the padded line as its sound and, while the shot still plays the video the sync was asked
 * for and still has the same line audio, makes it the shot's current video; otherwise it only joins the shot's history.
 */
export async function completeLipSync(taskId: number, shotId: number, media: ResultMedia, serviceBaseUrl: string | undefined) {
  recordResultUrl(taskId, media.url);
  const raw = media.file ? media.file : media.url ? await storeRemoteFile(media.url, 'video', serviceBaseUrl) : null;
  if (!raw) throw new ProviderError('The provider returned no video');
  const params = taskOf(taskId)?.params ?? {};
  const padded = typeof params.paddedAudioPath === 'string' && existsSync(toAbsolute(params.paddedAudioPath)) ? params.paddedAudioPath : null;
  let path = raw;
  if (padded) {
    path = await withLine(raw, padded);
    await rm(toAbsolute(raw), { force: true });
  }
  const durationSeconds = await assertVideo(path);
  await deriveRenditions(path, 'video');
  completeTask(taskId, { localPath: path, durationSeconds }, (tx) => {
    const shot = tx.select({ videoPath: shots.videoPath, lineAudioPath: shots.lineAudioPath }).from(shots).where(eq(shots.id, shotId)).get();
    if (shot && shot.videoPath === params.replaces && shot.lineAudioPath === params.lineAudioPath) {
      tx.update(shots).set({ videoPath: path, videoDurationSeconds: durationSeconds }).where(eq(shots.id, shotId)).run();
    }
  });
  logger.info({ taskId, shotId, path, durationSeconds }, 'lip-sync task completed');
}

async function runLipSync(taskId: number, resolved: ResolvedLipSync, shotId: number, source: ReturnType<typeof lipSyncSource>) {
  if (taskOf(taskId)?.status !== 'processing') return;
  const seconds = (await probeClip(toAbsolute(source.path)))?.durationSeconds;
  if (!seconds) throw new Error('The video to lip-sync could not be read');
  const padded = await padLine(source.lineAudioPath, seconds);
  db.transaction((tx) => {
    const task = tx.select({ params: generationTasks.params }).from(generationTasks).where(eq(generationTasks.id, taskId)).get();
    if (task) tx.update(generationTasks).set({ params: { ...task.params, paddedAudioPath: padded } }).where(eq(generationTasks.id, taskId)).run();
  });
  const record: LipSyncRecord = { taskId, videoPath: source.path, audioPath: padded };
  if (!resolved.adapter.generateLocal) {
    record.videoUrl = await deliverStoredFile(source.path, 'video to lip-sync', source.task);
    record.audioUrl = await deliverStoredFile(padded, 'line audio');
  }
  // Preparing the inputs takes a moment: check once more right before the provider is paid.
  if (taskOf(taskId)?.status !== 'processing') return;
  await completeLipSync(taskId, shotId, await generate(taskId, resolved, record, LIPSYNC_POLL, 'lip sync'), resolved.config?.baseUrl);
}

/**
 * SubmitLipSync (adr-0021): re-syncs the shot's video to its line audio. Refused while the shot has a video or a
 * lip sync processing (409). The task carries what the merge reads from a video task (the length asked for, the first
 * frame and the shot it continues), copied from the source video's task, and the source's path, so a lip-synced
 * continuation still joins the shot before it without a cut.
 */
export function submitLipSync(resolved: ResolvedLipSync, shot: ShotRow, dramaId: number, opts: { auto: boolean }): number {
  const source = lipSyncSource(shot);
  const from = source.task?.params ?? {};
  const carried = Object.fromEntries(['durationSeconds', 'firstFrame', 'chainedFrom'].flatMap((k) => (from[k] !== undefined ? [[k, from[k]]] : [])));
  const taskId = claimTask(
    {
      type: 'lipsync',
      dramaId,
      shotId: shot.id,
      serviceId: resolved.serviceId,
      provider: resolved.provider,
      model: resolved.model,
      prompt: shot.line.trim(),
      params: {
        ...carried,
        sourceVideoPath: source.path,
        sourceTaskId: source.task?.id ?? null,
        lineAudioPath: source.lineAudioPath,
        // The video the shot played when asked: the result replaces only that one.
        replaces: shot.videoPath,
        auto: opts.auto,
      },
    },
    {
      column: generationTasks.shotId,
      id: shot.id,
      busyTypes: VIDEO_TASK_TYPES,
      busyMessage: 'A video is already being generated or lip-synced for this shot',
    },
  );
  logger.info({ taskId, provider: resolved.provider, model: resolved.model, shotId: shot.id, auto: opts.auto }, 'lip-sync task submitted');
  detach(taskId, 'lip sync', () => runLipSync(taskId, resolved, shot.id, source));
  return taskId;
}

/**
 * Pinned voices (adr-0021): a silent video made for a spoken line is lip-synced as soon as it is stored, to the line
 * audio its length was fitted to. A sync that cannot start (the line re-written or re-spoken meanwhile, no lip-sync
 * service any more) is recorded as a failed lip-sync task, so the shot shows why its video still has no voice. Nothing
 * more is paid for once the shot's episode (or its drama) was deleted.
 */
export function autoLipSync(videoTaskId: number, shotId: number, lineAudioPath: string) {
  const shot = db.select().from(shots).where(eq(shots.id, shotId)).get();
  const video = taskOf(videoTaskId);
  const episode = shot ? db.select({ deletedAt: episodes.deletedAt }).from(episodes).where(eq(episodes.id, shot.episodeId)).get() : undefined;
  if (!shot || !video?.dramaId || !episode || episode.deletedAt) return;
  try {
    // A newer line may be longer than the video: syncing it would cut it off, so the video is made again instead.
    if (shot.lineAudioPath !== lineAudioPath) {
      throw precondition('The line changed while the video was being generated; generate the video again for the new line');
    }
    submitLipSync(resolveLipSync(), shot, video.dramaId, { auto: true });
  } catch (err) {
    db.insert(generationTasks)
      .values({
        type: 'lipsync',
        dramaId: video.dramaId,
        shotId,
        prompt: shot.line.trim(),
        params: { auto: true, sourceTaskId: videoTaskId },
        status: 'failed',
        error: messageOf(err),
        errorClass: err instanceof ApiError ? 'config' : classify(err),
        completedAt: nowIso(),
      })
      .run();
    logger.warn({ videoTaskId, shotId, err: messageOf(err) }, 'automatic lip sync could not start');
  }
}
