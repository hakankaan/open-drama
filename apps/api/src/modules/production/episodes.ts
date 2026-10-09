import { and, eq, isNull, max } from 'drizzle-orm';
import type { z } from 'zod';
import type { CreateEpisode, Episode, EpisodeView, LockedService, ServiceType, UpdateEpisode } from '@open-drama/contracts';
import { db } from '../../db/client';
import { episodes } from '../../db/schema';
import { assertSomething, conflict, notFound, precondition } from '../../http/errors';
import { resolveService } from '../configuration/services';
import { getEpisodeJobs } from '../jobs/run-job';
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
  const image = resolveService('image', { explicitId: input.imageServiceId });
  const video = resolveService('video', { explicitId: input.videoServiceId });
  const missing = [!image && 'image', !video && 'video'].filter(Boolean);
  if (missing.length > 0) {
    throw precondition(`Add an active ${missing.join(' and ')} service with an API key in Settings before creating an episode`, {
      missingTypes: missing,
    });
  }
  const id = db.transaction((tx) => {
    const last =
      tx
        .select({ n: max(episodes.episodeNumber) })
        .from(episodes)
        .where(and(eq(episodes.dramaId, drama.id), isNull(episodes.deletedAt)))
        .get()?.n ?? 0;
    const number = last + 1;
    return tx
      .insert(episodes)
      .values({
        dramaId: drama.id,
        episodeNumber: number,
        title: input.title?.trim() || `Episode ${number}`,
        resolution: input.resolution,
        targetDurationSeconds: input.targetDurationSeconds ?? null,
        imageServiceId: image!.row.id,
        videoServiceId: video!.row.id,
      })
      .returning({ id: episodes.id })
      .get().id;
  });
  touchDrama(drama.id);
  return getEpisodeView(id);
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

/**
 * Field-based dispatch of UpdateEpisodeContent, SaveScript, SaveRecap, SetEpisodeResolution, SetEpisodeTargetDuration
 * and SetEpisodeStatus.
 * A patch carrying both the script and the recap writes the script first, so the recap is pinned to the new revision.
 * The script and the recap are refused while their agent is writing them: the agent's save would silently replace
 * the creator's text (the same rule as creator shot commands during a breakdown).
 */
export function updateEpisode(id: number, input: z.output<typeof UpdateEpisode>): EpisodeView {
  const row = getEpisodeRow(id);
  assertSomething(input);
  const { scriptContent, recap, ...rest } = input;
  if (scriptContent !== undefined || recap !== undefined) {
    const jobs = getEpisodeJobs(id);
    if (scriptContent !== undefined && jobs.rewrite?.status === 'running') throw conflict('The script is being rewritten; edit it once it is saved');
    if (recap !== undefined && jobs.recap?.status === 'running') throw conflict('The recap is being written; edit it once it is saved');
  }
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
  writeScript(id, row.content);
  touchDrama(row.dramaId);
  return getEpisodeView(id);
}

/** AttachEpisodeFilm: the latest rendered film becomes the episode's video (issued by compositing on completion). */
export function attachEpisodeFilm(tx: Tx, episodeId: number, filmPath: string, durationSeconds: number) {
  tx.update(episodes).set({ filmPath, filmDurationSeconds: durationSeconds }).where(eq(episodes.id, episodeId)).run();
}
