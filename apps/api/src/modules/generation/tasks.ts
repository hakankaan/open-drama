import { and, count, desc, eq, inArray, isNotNull, max, or, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { z } from 'zod';
import type {
  EpisodeGenerationTasks,
  EpisodeTaskRow,
  GenerationTask,
  GenerationTaskList,
  GenerationTaskListQuery,
  GenerationType,
  ShotVideo,
  TaskOwner,
  TaskSummary,
} from '@open-drama/contracts';
import { db } from '../../db/client';
import {
  characters,
  episodeCharacters,
  episodeProps,
  episodeScenes,
  films,
  generationTasks,
  props,
  scenes,
  shots,
} from '../../db/schema';
import { conflict, notFound } from '../../http/errors';
import { toFilm } from '../compositing/films';

type TaskRow = typeof generationTasks.$inferSelect;

/** The provider's task id and result URL stay internal (the result URL may be signed). */
export const toGenerationTask = ({ providerTaskId: _p, resultUrl: _r, ...row }: TaskRow): GenerationTask => row;

/** The latest task of a type per owner id (the owner column is characterId, sceneId, propId or shotId). */
export function latestTasks(type: GenerationType, column: SQLiteColumn, ids: number[]): Map<number, TaskSummary> {
  const map = new Map<number, TaskSummary>();
  if (ids.length === 0) return map;
  // Only each owner's newest row is read, not its whole history.
  const newest = db
    .select({ id: max(generationTasks.id) })
    .from(generationTasks)
    .where(and(eq(generationTasks.type, type), inArray(column, ids)))
    .groupBy(column);
  const rows = db
    .select({
      ownerId: column,
      id: generationTasks.id,
      status: generationTasks.status,
      error: generationTasks.error,
      errorClass: generationTasks.errorClass,
      createdAt: generationTasks.createdAt,
      completedAt: generationTasks.completedAt,
    })
    .from(generationTasks)
    .where(inArray(generationTasks.id, newest))
    .all();
  for (const { ownerId, ...task } of rows) {
    if (typeof ownerId === 'number') map.set(ownerId, task);
  }
  return map;
}

export function listTasks(query: z.output<typeof GenerationTaskListQuery>): GenerationTaskList {
  const where = and(
    query.type ? eq(generationTasks.type, query.type) : undefined,
    query.dramaId ? eq(generationTasks.dramaId, query.dramaId) : undefined,
    query.shotId ? eq(generationTasks.shotId, query.shotId) : undefined,
    query.status ? eq(generationTasks.status, query.status) : undefined,
  );
  const total = db.select({ n: count() }).from(generationTasks).where(where).get()?.n ?? 0;
  const items = db
    .select()
    .from(generationTasks)
    .where(where)
    .orderBy(desc(generationTasks.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
    .all()
    .map(toGenerationTask);
  return { items, page: query.page, pageSize: query.pageSize, total };
}

function getTaskRow(id: number): TaskRow {
  const row = db.select().from(generationTasks).where(eq(generationTasks.id, id)).get();
  if (!row) throw notFound('Generation task');
  return row;
}

export const getTask = (id: number): GenerationTask => toGenerationTask(getTaskRow(id));

/**
 * DeleteGenerationTask: removes the record (a history entry). The stored file stays, since the owner may still use
 * it; a task still processing cannot be deleted.
 */
export function deleteTask(id: number): { id: number } {
  const row = getTaskRow(id);
  if (row.status === 'processing') throw conflict('The task is still running; delete it once it has finished');
  if (row.shotId && row.localPath) {
    const shot = db.select({ videoPath: shots.videoPath }).from(shots).where(eq(shots.id, row.shotId)).get();
    if (shot?.videoPath === row.localPath) throw conflict('This is the shot’s current video; pick another one before deleting it');
  }
  db.delete(generationTasks).where(eq(generationTasks.id, id)).run();
  return { id };
}

/** Completed videos of a shot, newest first; `current` marks the one the shot plays. */
export function shotVideos(shotId: number, currentPath: string | null): ShotVideo[] {
  return db
    .select()
    .from(generationTasks)
    .where(and(eq(generationTasks.type, 'video'), eq(generationTasks.shotId, shotId), eq(generationTasks.status, 'completed'), isNotNull(generationTasks.localPath)))
    .orderBy(desc(generationTasks.id))
    .all()
    .map((t) => ({
      taskId: t.id,
      videoPath: t.localPath!,
      durationSeconds: t.durationSeconds,
      provider: t.provider,
      model: t.model,
      prompt: t.prompt,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      current: t.localPath === currentPath,
    }));
}

const ids = <T extends { id: number }>(rows: T[]) => rows.map((r) => r.id);

/**
 * EpisodeGenerationTasks: tasks of the episode's shots and of the assets linked to it, newest first, labelled with
 * their owner, plus the episode's merges. Capped (default 50 tasks, 20 films).
 */
export function episodeGenerationTasks(episodeId: number, limit: number): EpisodeGenerationTasks {
  const shotRows = db.select({ id: shots.id, shotNumber: shots.shotNumber }).from(shots).where(eq(shots.episodeId, episodeId)).all();
  const charRows = db
    .select({ id: characters.id, label: characters.name })
    .from(episodeCharacters)
    .innerJoin(characters, eq(characters.id, episodeCharacters.characterId))
    .where(eq(episodeCharacters.episodeId, episodeId))
    .all();
  const sceneRows = db
    .select({ id: scenes.id, location: scenes.location, time: scenes.time })
    .from(episodeScenes)
    .innerJoin(scenes, eq(scenes.id, episodeScenes.sceneId))
    .where(eq(episodeScenes.episodeId, episodeId))
    .all();
  const propRows = db
    .select({ id: props.id, label: props.name })
    .from(episodeProps)
    .innerJoin(props, eq(props.id, episodeProps.propId))
    .where(eq(episodeProps.episodeId, episodeId))
    .all();

  const owners: [SQLiteColumn, number[]][] = [
    [generationTasks.shotId, ids(shotRows)],
    [generationTasks.characterId, ids(charRows)],
    [generationTasks.sceneId, ids(sceneRows)],
    [generationTasks.propId, ids(propRows)],
  ];
  const clauses = owners.filter(([, list]) => list.length > 0).map(([column, list]) => inArray(column, list)) as SQL[];
  const taskRows = clauses.length
    ? db.select().from(generationTasks).where(or(...clauses)).orderBy(desc(generationTasks.id)).limit(limit).all()
    : [];

  const shotLabel = new Map(shotRows.map((s) => [s.id, `#${s.shotNumber}`]));
  const charLabel = new Map(charRows.map((c) => [c.id, c.label]));
  const sceneLabel = new Map(sceneRows.map((s) => [s.id, s.time ? `${s.location} (${s.time})` : s.location]));
  const propLabel = new Map(propRows.map((p) => [p.id, p.label]));
  const ownerOf = (t: TaskRow): TaskOwner | null => {
    if (t.shotId && shotLabel.has(t.shotId)) return { kind: 'shot', id: t.shotId, label: shotLabel.get(t.shotId)! };
    if (t.characterId && charLabel.has(t.characterId)) return { kind: 'character', id: t.characterId, label: charLabel.get(t.characterId)! };
    if (t.sceneId && sceneLabel.has(t.sceneId)) return { kind: 'scene', id: t.sceneId, label: sceneLabel.get(t.sceneId)! };
    if (t.propId && propLabel.has(t.propId)) return { kind: 'prop', id: t.propId, label: propLabel.get(t.propId)! };
    return null;
  };
  const tasks: EpisodeTaskRow[] = taskRows.map((t) => ({ ...toGenerationTask(t), owner: ownerOf(t) }));
  const filmRows = db.select().from(films).where(eq(films.episodeId, episodeId)).orderBy(desc(films.id)).limit(20).all();
  return { episodeId, tasks, films: filmRows.map(toFilm) };
}
