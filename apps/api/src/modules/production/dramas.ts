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
import { getDramaJobs } from '../jobs/run-job';
import { toEpisode } from './episodes';

type Row = typeof dramas.$inferSelect;

/** The outline stays off the list rows (up to 20 000 characters each); DramaDetail carries it. */
const toDrama = ({ deletedAt: _deletedAt, outline: _outline, ...row }: Row): Drama => row;

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

/** UpdateDrama, including the creator's outline edit, which is refused while the story writer holds the outline (adr-0015). */
export function updateDrama(id: number, input: z.output<typeof UpdateDrama>): Drama {
  const current = getDramaRow(id);
  assertSomething(input);
  if (input.outline !== undefined && getDramaJobs(id).outline?.status === 'running') {
    throw conflict('The outline is being written; edit it once it is saved');
  }
  if (input.style !== undefined && input.style !== current.style) {
    const preset = getPresetByValue(input.style);
    if (!preset || !preset.isActive) throw invalid(`Unknown or disabled visual style: ${input.style}`);
  }
  return toDrama(db.update(dramas).set(input).where(eq(dramas.id, id)).returning().get());
}

/** Soft delete: episodes, assets and generation records stay on disk but become unreachable. */
export function deleteDrama(id: number): { id: number } {
  getDramaRow(id);
  db.update(dramas).set({ deletedAt: new Date().toISOString() }).where(eq(dramas.id, id)).run();
  return { id };
}

/** DramaDetail: the drama with its live episodes (with shot counts) and asset counts. */
export function getDramaDetail(id: number): DramaDetail {
  const row = getDramaRow(id);
  const drama = { ...toDrama(row), outline: row.outline };
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
