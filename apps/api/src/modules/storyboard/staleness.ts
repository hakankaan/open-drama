import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { VIDEO_TASK_TYPES, type AssetKind } from '@open-drama/contracts';
import { db } from '../../db/client';
import { generationTasks, shotCharacters, shotProps, shots } from '../../db/schema';
import type { Tx } from '../generation/engine/lifecycle';

// What makes a shot's keyframe or its continuation out of date. Kept apart from the storyboard service so the image
// engine and the merge can use it without importing the service.

/** The shots an asset is bound to, in every episode or in one. */
export function boundShots(tx: Tx, asset: { kind: AssetKind; id: number }, episodeId?: number): number[] {
  const inEpisode = episodeId === undefined ? undefined : eq(shots.episodeId, episodeId);
  const rows =
    asset.kind === 'scene'
      ? tx.select({ id: shots.id }).from(shots).where(and(eq(shots.sceneId, asset.id), inEpisode)).all()
      : asset.kind === 'character'
        ? tx
            .select({ id: shotCharacters.shotId })
            .from(shotCharacters)
            .innerJoin(shots, eq(shots.id, shotCharacters.shotId))
            .where(and(eq(shotCharacters.characterId, asset.id), inEpisode))
            .all()
        : tx
            .select({ id: shotProps.shotId })
            .from(shotProps)
            .innerJoin(shots, eq(shots.id, shotProps.shotId))
            .where(and(eq(shotProps.propId, asset.id), inEpisode))
            .all();
  return rows.map((r) => r.id);
}

/**
 * Something the keyframes of these shots are drawn from changed (adr-0019): their revision moves on, so a keyframe
 * drawn or kept before, or being drawn now, is stale until it is redrawn, replaced or kept.
 */
export function markKeyframesStale(tx: Tx, shotIds: number[]) {
  if (shotIds.length === 0) return;
  tx.update(shots).set({ keyframeRevision: sql`${shots.keyframeRevision} + 1` }).where(inArray(shots.id, shotIds)).run();
}

export interface ClipTask {
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
export function clipTask(shotId: number, videoPath: string): ClipTask {
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

/**
 * Whether a clip continues the clip before it without a cut (adr-0020): it was started from a frame of that shot's
 * video, the one shown there or the take a lip sync of it re-synced (the same take, its mouth re-drawn, adr-0021). A
 * clip that continued another version of that shot, or another shot, is cut to like any other.
 */
export function joinsBefore(task: ClipTask, before: { id: number; videoPath: string }, beforeTask: ClipTask): boolean {
  if (!task.chainedFrom || task.chainedFrom.shotId !== before.id) return false;
  return [before.videoPath, beforeTask.sourceVideoPath].includes(task.chainedFrom.videoPath);
}

/**
 * Whether a shot marked as continuing the previous one (`continuationStale`) shows a video that does not join the
 * live shot before it: that shot was generated again or another version of it was picked, the shots were reordered,
 * or the video was made before the mark. The merge cuts there until the shot is generated again.
 */
export function continuationStale(
  shot: { id: number; videoPath: string | null; continuesPrevious: boolean },
  before: { id: number; videoPath: string | null } | undefined,
): boolean {
  if (!shot.continuesPrevious || !shot.videoPath || !before) return false;
  if (!before.videoPath) return true;
  const prev = { id: before.id, videoPath: before.videoPath };
  return !joinsBefore(clipTask(shot.id, shot.videoPath), prev, clipTask(prev.id, prev.videoPath));
}
