import { and, eq, isNull, max } from 'drizzle-orm';
import type { z } from 'zod';
import type { CreateEpisode, Episode, EpisodeView, LockedService, RecapStatus, Resolution, ServiceType, UpdateEpisode } from '@open-drama/contracts';
import { db } from '../../db/client';
import { episodes } from '../../db/schema';
import { assertSomething, conflict, notFound, precondition } from '../../http/errors';
import { resolveService } from '../configuration/services';
import { getEpisodeJobs, runningJobKinds } from '../jobs/run-job';
import { getDramaRow, touchDrama } from './dramas';

type Row = typeof episodes.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/** A recap written for another revision of the script is stale (adr-0014); an empty one is simply missing. */
export const isRecapStale = (row: Pick<Row, 'recap' | 'recapRevision' | 'scriptRevision'>) =>
  row.recap !== '' && row.recapRevision !== row.scriptRevision;

/** The revision numbers stay internal; the view carries the derived staleness instead. */
export const toEpisode = ({ deletedAt: _deletedAt, scriptRevision: _s, recapRevision: _r, ...row }: Row): Episode => ({
  ...row,
  recapStale: isRecapStale({ recap: row.recap, scriptRevision: _s, recapRevision: _r }),
});

/** A live episode of a live drama. */
export function getEpisodeRow(id: number): Row {
  const row = db
    .select()
    .from(episodes)
    .where(and(eq(episodes.id, id), isNull(episodes.deletedAt)))
    .get();
  if (!row) throw notFound('Episode');
  getDramaRow(row.dramaId);
  return row;
}

function lockedService(type: ServiceType, lockedId: number | null): LockedService | null {
  const resolved = resolveService(type, { lockedId });
  if (!resolved) return null;
  const { row, locked } = resolved;
  return { id: row.id, name: row.name, provider: row.provider, defaultModel: row.models[0] ?? null, locked };
}

export function getEpisodeView(id: number): EpisodeView {
  const row = getEpisodeRow(id);
  return {
    ...toEpisode(row),
    services: {
      image: lockedService('image', row.imageServiceId),
      video: lockedService('video', row.videoServiceId),
    },
  };
}

/**
 * CreateEpisode: next number (max + 1 among live episodes), default title, and the image and video services
 * snapshotted from the explicit ids or the highest-priority active ones. Rejected when either type has none.
 */
export function createEpisode(input: z.output<typeof CreateEpisode>): EpisodeView {
  const drama = getDramaRow(input.dramaId);
  const services = lockServices(input);
  const { id } = db.transaction((tx) =>
    insertEpisode(tx, {
      dramaId: drama.id,
      title: input.title?.trim(),
      resolution: input.resolution,
      targetDurationSeconds: input.targetDurationSeconds ?? null,
      ...services,
    }),
  );
  touchDrama(drama.id);
  return getEpisodeView(id);
}

/**
 * The image and video services a new episode locks: the explicit ids or the highest-priority active ones. Rejected
 * with the same wording for CreateEpisode and PlanEpisodes when either type has none.
 */
export function lockServices(input: { imageServiceId?: number; videoServiceId?: number }): { imageServiceId: number; videoServiceId: number } {
  const image = resolveService('image', { explicitId: input.imageServiceId });
  const video = resolveService('video', { explicitId: input.videoServiceId });
  const missing = [!image && 'image', !video && 'video'].filter(Boolean);
  if (missing.length > 0) {
    throw precondition(`Add an active ${missing.join(' and ')} service with an API key in Settings before creating an episode`, {
      missingTypes: missing,
    });
  }
  return { imageServiceId: image!.row.id, videoServiceId: video!.row.id };
}

/** What an episode holds, as the story writer and the planner read it (adr-0015). */
export interface EpisodeState {
  id: number;
  episodeNumber: number;
  title: string;
  /** written: it has a script; planned: beats (raw content) but no script; empty: neither. */
  state: 'written' | 'planned' | 'empty';
  synopsis: string;
  targetDurationSeconds: number | null;
  /** Written episodes only. */
  recapStatus?: RecapStatus;
  recap?: string;
  /** Planned episodes only: the beat sheet. */
  beats?: string;
}

/** The live episodes of a drama in order, each with its state (adr-0015). */
export function episodeStates(dramaId: number): EpisodeState[] {
  return db
    .select()
    .from(episodes)
    .where(and(eq(episodes.dramaId, dramaId), isNull(episodes.deletedAt)))
    .orderBy(episodes.episodeNumber)
    .all()
    .map((row) => {
      const base = { id: row.id, episodeNumber: row.episodeNumber, title: row.title, synopsis: row.description, targetDurationSeconds: row.targetDurationSeconds };
      if (row.scriptContent?.trim()) {
        const recap = row.recap.trim();
        const recapStatus: RecapStatus = !recap ? 'missing' : isRecapStale(row) ? 'stale' : 'ready';
        return { ...base, state: 'written' as const, recapStatus, ...(recap ? { recap } : {}) };
      }
      const beats = row.content.trim();
      if (beats) return { ...base, state: 'planned' as const, beats };
      return { ...base, state: 'empty' as const };
    });
}

export interface NewEpisode {
  dramaId: number;
  /** Empty or absent: `Episode N`. */
  title?: string;
  description?: string;
  content?: string;
  resolution: Resolution;
  targetDurationSeconds: number | null;
  imageServiceId: number;
  videoServiceId: number;
}

/**
 * The one insert of an episode row, used by CreateEpisode and by the planner's batches (adr-0015): the next number
 * (max + 1 among live episodes) is taken inside the caller's transaction, so concurrent inserts never collide.
 */
export function insertEpisode(tx: Tx, values: NewEpisode): { id: number; episodeNumber: number } {
  const last =
    tx
      .select({ n: max(episodes.episodeNumber) })
      .from(episodes)
      .where(and(eq(episodes.dramaId, values.dramaId), isNull(episodes.deletedAt)))
      .get()?.n ?? 0;
  const episodeNumber = last + 1;
  const { id } = tx
    .insert(episodes)
    .values({
      dramaId: values.dramaId,
      episodeNumber,
      title: values.title?.trim() || `Episode ${episodeNumber}`,
      description: values.description ?? '',
      content: values.content ?? '',
      resolution: values.resolution,
      targetDurationSeconds: values.targetDurationSeconds,
      imageServiceId: values.imageServiceId,
      videoServiceId: values.videoServiceId,
    })
    .returning({ id: episodes.id })
    .get();
  return { id, episodeNumber };
}

/**
 * SaveScript: the one writer of scriptContent. The script revision moves only when the text actually changes,
 * so a recap stays fresh across a no-op save. Returns the revision the script now has.
 */
export function writeScript(id: number, text: string, tx: Db = db): number {
  const row = tx
    .select({ scriptContent: episodes.scriptContent, scriptRevision: episodes.scriptRevision })
    .from(episodes)
    .where(eq(episodes.id, id))
    .get();
  if (!row) throw notFound('Episode');
  if (row.scriptContent === text) return row.scriptRevision;
  const scriptRevision = row.scriptRevision + 1;
  tx.update(episodes).set({ scriptContent: text, scriptRevision }).where(eq(episodes.id, id)).run();
  return scriptRevision;
}

/**
 * SaveRecap, pinned to a script revision: the creator's edit pins to the current one (forRevision omitted), the
 * recap writer passes the revision its job started from. The write is refused (false) once the script has moved on,
 * so a slow recap never claims a newer script.
 */
export function writeRecap(id: number, text: string, forRevision?: number, tx: Db = db): boolean {
  const revision =
    forRevision ??
    tx.select({ scriptRevision: episodes.scriptRevision }).from(episodes).where(eq(episodes.id, id)).get()?.scriptRevision;
  if (revision === undefined) throw notFound('Episode');
  const result = tx
    .update(episodes)
    .set({ recap: text, recapRevision: revision })
    .where(and(eq(episodes.id, id), eq(episodes.scriptRevision, revision)))
    .run();
  return result.changes > 0;
}

/** The jobs that write the script, and those that work from it as they read it at their start. */
const SCRIPT_WRITERS = {
  rewrite: 'The script is being rewritten',
  write: 'The script is being written from its beats',
} as const;
const SCRIPT_READERS = {
  breakdown: 'The storyboard is being broken down from the script',
  extraction: 'Assets are being extracted from the script',
} as const;

/**
 * Nothing is writing the script (adr-0015): a 409 naming the running rewrite or write, with `action` saying what to
 * do once it is saved. Checked before reading the script or its source (a breakdown, an extraction, a source edit).
 */
export function assertScriptSettled(id: number, action: string) {
  const running = runningJobKinds(id);
  for (const kind of ['rewrite', 'write'] as const) {
    if (running.has(kind)) throw conflict(`${SCRIPT_WRITERS[kind]}; ${action} once it is saved`);
  }
}

/**
 * The script may change: nothing writes it and nothing works from it. A breakdown or an extraction keeps the script
 * it read, so a script changed under it would leave shots or assets that no longer match. `except` is the writer the
 * caller is about to start; its own duplicate is runJob's business. Recaps are pinned to a revision instead.
 */
export function assertScriptFree(id: number, action: string, except?: keyof typeof SCRIPT_WRITERS) {
  const running = runningJobKinds(id);
  for (const kind of ['rewrite', 'write'] as const) {
    if (kind !== except && running.has(kind)) throw conflict(`${SCRIPT_WRITERS[kind]}; ${action} once it is saved`);
  }
  for (const kind of ['breakdown', 'extraction'] as const) {
    if (running.has(kind)) throw conflict(`${SCRIPT_READERS[kind]}; ${action} once that is done`);
  }
}

/**
 * Field-based dispatch of UpdateEpisodeContent, SaveScript, SaveRecap, SetEpisodeResolution, SetEpisodeTargetDuration
 * and SetEpisodeStatus.
 * A patch carrying both the script and the recap writes the script first, so the recap is pinned to the new revision.
 * The script, its source and the recap are refused while an agent is writing from or to them: the agent's save would
 * silently replace the creator's text (the same rule as creator shot commands during a breakdown).
 */
export function updateEpisode(id: number, input: z.output<typeof UpdateEpisode>): EpisodeView {
  const row = getEpisodeRow(id);
  assertSomething(input);
  const { scriptContent, recap, ...rest } = input;
  if (scriptContent !== undefined) assertScriptFree(id, 'edit it');
  else if (rest.content !== undefined) assertScriptSettled(id, 'edit the source text');
  if (recap !== undefined && getEpisodeJobs(id).recap?.status === 'running') throw conflict('The recap is being written; edit it once it is saved');
  db.transaction((tx) => {
    if (Object.keys(rest).length > 0) tx.update(episodes).set(rest).where(eq(episodes.id, id)).run();
    if (scriptContent !== undefined) writeScript(id, scriptContent, tx);
    if (recap !== undefined) writeRecap(id, recap, undefined, tx);
  });
  touchDrama(row.dramaId);
  return getEpisodeView(id);
}

export function deleteEpisode(id: number): { id: number } {
  const row = getEpisodeRow(id);
  db.update(episodes).set({ deletedAt: new Date().toISOString() }).where(eq(episodes.id, id)).run();
  touchDrama(row.dramaId);
  return { id };
}

/** SkipRewrite: the raw content becomes the script, so the skip is persisted and survives reloads. */
export function skipRewrite(id: number): EpisodeView {
  const row = getEpisodeRow(id);
  if (!row.content.trim()) throw precondition('Paste the raw content before skipping the rewrite');
  assertScriptFree(id, 'use the raw content');
  writeScript(id, row.content);
  touchDrama(row.dramaId);
  return getEpisodeView(id);
}

/** AttachEpisodeFilm: the latest rendered film becomes the episode's video (issued by compositing on completion). */
export function attachEpisodeFilm(tx: Tx, episodeId: number, filmPath: string, durationSeconds: number) {
  tx.update(episodes).set({ filmPath, filmDurationSeconds: durationSeconds }).where(eq(episodes.id, episodeId)).run();
}
