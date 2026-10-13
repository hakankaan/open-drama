import { and, count, desc, eq, inArray, isNull, like, or } from 'drizzle-orm';
import type { z } from 'zod';
import {
  DramaStatus as DramaStatusEnum,
  isNarrator,
  type CreateDrama,
  type Drama,
  type DramaDetail,
  type DramaListItem,
  type DramaListQuery,
  type DramaStats,
  type DramaStatus,
  type UpdateDrama,
} from '@open-drama/contracts';
import { db } from '../../db/client';
import { characters, dramas, episodes, props, scenes, shots } from '../../db/schema';
import { assertSomething, conflict, invalid, notFound } from '../../http/errors';
import { getPresetByValue } from '../configuration/presets';
import { dramaHasRunningJob, getDramaJobs } from '../jobs/run-job';
import { toEpisode } from './episodes';

type Row = typeof dramas.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/** The outline stays off the list rows (up to 20 000 characters each); DramaDetail carries it with its revision. */
const toDrama = ({ deletedAt: _deletedAt, outline: _outline, outlineRevision: _revision, ...row }: Row): Drama => row;

export function getDramaRow(id: number): Row {
  const row = db
    .select()
    .from(dramas)
    .where(and(eq(dramas.id, id), isNull(dramas.deletedAt)))
    .get();
  if (!row) throw notFound('Project');
  return row;
}

/** Live characters per drama, narrators excluded (they are voices, not assets). */
function characterCounts(ids: number[]) {
  const map = new Map<number, number>();
  if (ids.length === 0) return map;
  const rows = db
    .select({ dramaId: characters.dramaId, name: characters.name, role: characters.role })
    .from(characters)
    .where(and(inArray(characters.dramaId, ids), isNull(characters.deletedAt)))
    .all();
  for (const r of rows) if (!isNarrator(r.name, r.role)) map.set(r.dramaId, (map.get(r.dramaId) ?? 0) + 1);
  return map;
}

/** Live-row counts per drama for one table. */
function countsBy(table: typeof episodes | typeof scenes, ids: number[]) {
  if (ids.length === 0) return new Map<number, number>();
  const rows = db
    .select({ dramaId: table.dramaId, n: count() })
    .from(table)
    .where(and(inArray(table.dramaId, ids), isNull(table.deletedAt)))
    .groupBy(table.dramaId)
    .all();
  return new Map(rows.map((r) => [r.dramaId, r.n]));
}

/** DramaList: live dramas, most recently updated first, with episode/character/scene counts. */
export function listDramas(query: z.output<typeof DramaListQuery>) {
  const where = and(
    isNull(dramas.deletedAt),
    query.status ? eq(dramas.status, query.status) : undefined,
    query.q ? or(like(dramas.title, `%${query.q}%`), like(dramas.style, `%${query.q}%`)) : undefined,
  );
  const total = db.select({ n: count() }).from(dramas).where(where).get()?.n ?? 0;
  const rows = db
    .select()
    .from(dramas)
    .where(where)
    .orderBy(desc(dramas.updatedAt), desc(dramas.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
    .all();
  const ids = rows.map((r) => r.id);
  const [ep, ch, sc] = [countsBy(episodes, ids), characterCounts(ids), countsBy(scenes, ids)];
  const items: DramaListItem[] = rows.map((row) => ({
    ...toDrama(row),
    episodeCount: ep.get(row.id) ?? 0,
    characterCount: ch.get(row.id) ?? 0,
    sceneCount: sc.get(row.id) ?? 0,
  }));
  return { items, page: query.page, pageSize: query.pageSize, total };
}

export function getDramaStats(): DramaStats {
  const rows = db
    .select({ status: dramas.status, n: count() })
    .from(dramas)
    .where(isNull(dramas.deletedAt))
    .groupBy(dramas.status)
    .all();
  const map = new Map(rows.map((r) => [r.status, r.n]));
  const byStatus = DramaStatusEnum.options.map((status: DramaStatus) => ({ status, count: map.get(status) ?? 0 }));
  return { total: byStatus.reduce((sum, s) => sum + s.count, 0), byStatus };
}

/** style must reference an active preset at creation (Drama invariant). */
export function createDrama(input: z.output<typeof CreateDrama>): Drama {
  const preset = getPresetByValue(input.style);
  if (!preset || !preset.isActive) throw invalid(`Unknown or disabled visual style: ${input.style}`);
  return toDrama(db.insert(dramas).values(input).returning().get());
}

/**
 * The outline has one writer at a time: a running outline job owns it (adr-0015), and a running plan reads it batch
 * by batch, so an edit meanwhile would plan one season from two outlines (adr-0016).
 */
export function assertOutlineEditable(id: number) {
  const jobs = getDramaJobs(id);
  if (jobs.outline?.status === 'running') throw conflict('The outline is being written; edit it once it is saved');
  if (jobs.plan?.status === 'running') throw conflict('Episodes are being planned from the outline; edit it once the plan is done');
}

/** UpdateDrama, including the creator's outline edit, which is refused while the story writer holds the outline (adr-0015). */
export function updateDrama(id: number, input: z.output<typeof UpdateDrama>): Drama {
  const current = getDramaRow(id);
  assertSomething(input);
  const { outline, ...rest } = input;
  if (outline !== undefined) assertOutlineEditable(id);
  if (rest.style !== undefined && rest.style !== current.style) {
    const preset = getPresetByValue(rest.style);
    if (!preset || !preset.isActive) throw invalid(`Unknown or disabled visual style: ${rest.style}`);
  }
  db.transaction((tx) => {
    if (Object.keys(rest).length > 0) tx.update(dramas).set(rest).where(eq(dramas.id, id)).run();
    if (outline !== undefined) writeOutline(id, outline, tx);
  });
  return toDrama(getDramaRow(id));
}

/**
 * SaveOutline: the one writer of the outline, for the creator's edit, the story writer's save and an assistant's
 * save alike. The outline revision moves only when the text changes (adr-0016). Returns the revision it now has.
 */
export function writeOutline(id: number, text: string, tx: Db = db): number {
  const row = tx.select({ outline: dramas.outline, outlineRevision: dramas.outlineRevision }).from(dramas).where(eq(dramas.id, id)).get();
  if (!row) throw notFound('Project');
  if (row.outline === text) return row.outlineRevision;
  const outlineRevision = row.outlineRevision + 1;
  tx.update(dramas).set({ outline: text, outlineRevision }).where(eq(dramas.id, id)).run();
  return outlineRevision;
}

/** ReadOutline for an assistant: the text with the revision to pass back when saving it (adr-0016). */
export function readOutline(id: number): { text: string; revision: number; characters: number } {
  const row = getDramaRow(id);
  return { text: row.outline, revision: row.outlineRevision, characters: row.outline.length };
}

/**
 * SaveOutline with a freshness token (adr-0016): written only while the outline is still at the revision the caller
 * read, checked inside the transaction; otherwise CONFLICT names both revisions.
 */
export function saveOutlineText(id: number, text: string, ifRevision: number): { revision: number; characters: number; changed: boolean } {
  getDramaRow(id);
  assertOutlineEditable(id);
  return db.transaction((tx) => {
    const row = tx.select({ outline: dramas.outline, outlineRevision: dramas.outlineRevision }).from(dramas).where(eq(dramas.id, id)).get();
    if (!row) throw notFound('Project');
    if (row.outlineRevision !== ifRevision) {
      throw conflict(`The outline is at revision ${row.outlineRevision}; you read revision ${ifRevision}. Read it again before saving.`, {
        revision: row.outlineRevision,
        ifRevision,
      });
    }
    return { revision: writeOutline(id, text, tx), characters: text.length, changed: row.outline !== text };
  });
}

/**
 * DeleteDrama: soft-deletes the drama with its live episodes and assets, one timestamp in one transaction, so nothing
 * under it stays live (a queued generation sees its shot's episode or its asset deleted and is never sent). Refused
 * while one of its jobs runs, since that job would go on adding episodes or assets under the deleted drama.
 */
export function deleteDrama(id: number): { id: number } {
  getDramaRow(id);
  if (dramaHasRunningJob(id)) throw conflict('A job is still running in this project; cancel it or let it finish, then delete the project');
  const deletedAt = new Date().toISOString();
  db.transaction((tx) => {
    tx.update(dramas).set({ deletedAt }).where(eq(dramas.id, id)).run();
    for (const table of [episodes, characters, scenes, props]) {
      tx.update(table).set({ deletedAt }).where(and(eq(table.dramaId, id), isNull(table.deletedAt))).run();
    }
  });
  return { id };
}

/** DramaDetail: the drama with its live episodes (with shot counts) and asset counts. */
export function getDramaDetail(id: number): DramaDetail {
  const row = getDramaRow(id);
  const drama = { ...toDrama(row), outline: row.outline, outlineRevision: row.outlineRevision };
  const eps = db
    .select()
    .from(episodes)
    .where(and(eq(episodes.dramaId, id), isNull(episodes.deletedAt)))
    .orderBy(episodes.episodeNumber)
    .all();
  const shotCounts = new Map(
    eps.length === 0
      ? []
      : db
          .select({ episodeId: shots.episodeId, n: count() })
          .from(shots)
          .where(and(inArray(shots.episodeId, eps.map((e) => e.id)), isNull(shots.parkedByJobId)))
          .groupBy(shots.episodeId)
          .all()
          .map((r) => [r.episodeId, r.n]),
  );
  const liveCount = (table: typeof scenes | typeof props) =>
    db
      .select({ n: count() })
      .from(table)
      .where(and(eq(table.dramaId, id), isNull(table.deletedAt)))
      .get()?.n ?? 0;
  return {
    ...drama,
    episodes: eps.map((row) => {
      const { content, scriptContent, recap, ...e } = toEpisode(row);
      return {
        ...e,
        hasContent: content.trim().length > 0,
        hasScript: scriptContent !== null && scriptContent.trim().length > 0,
        hasRecap: recap.trim().length > 0,
        shotCount: shotCounts.get(e.id) ?? 0,
      };
    }),
    counts: { characters: characterCounts([id]).get(id) ?? 0, scenes: liveCount(scenes), props: liveCount(props) },
  };
}

/** Bumps updatedAt so the launcher's "recently updated" order reflects work inside the project. */
export const touchDrama = (id: number) =>
  db.update(dramas).set({ updatedAt: new Date().toISOString() }).where(eq(dramas.id, id)).run();
