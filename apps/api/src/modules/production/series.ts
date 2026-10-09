import { and, asc, eq, isNull, lt } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { EarlierEpisode, SeriesContext } from '@open-drama/contracts';
import { db } from '../../db/client';
import { episodes } from '../../db/schema';
import { logger } from '../../http/logger';
import { getDramaRow } from './dramas';
import { isRecapStale } from './episodes';

/** Characters the serialized block may carry; beyond it the oldest recaps are dropped and named as omitted. */
const SERIES_BUDGET = 60_000;

/**
 * Fits recap-bearing entries into the budget beside `base` (the rest of the block they travel with): the oldest recap
 * texts are removed first, and their episode numbers are returned oldest first, so the reader is told what is missing
 * rather than finding a gap. Shared by the series block and the story and planner read tools (adr-0015). Mutates.
 */
export function fitRecaps<T extends { episodeNumber: number; recap?: string }>(entries: T[], base: unknown): number[] {
  const size = (value: unknown) => JSON.stringify(value).length;
  let used = size(base) + entries.reduce((n, e) => n + size(e), 0);
  const omitted: number[] = [];
  while (used > SERIES_BUDGET) {
    const oldest = entries.find((e) => e.recap !== undefined);
    if (!oldest) break;
    const before = size(oldest);
    delete oldest.recap;
    used -= before - size(oldest);
    omitted.push(oldest.episodeNumber);
  }
  return omitted;
}

export interface SeriesScope {
  dramaId: number;
  /** Episode-scoped runs: only the live episodes numbered below this one; absent, every live episode. */
  beforeEpisodeNumber?: number;
}

/**
 * SeriesContext (adr-0014, adr-0015): what the agents are told about the rest of the drama. Always the premise
 * (title, synopsis, genre when set) and the story outline when written; for a serial drama also the earlier live
 * episodes in order, each with its recap and whether that recap is ready, stale (the script changed since) or
 * missing, so gaps are named rather than silently absent. Only recaps are dropped for the budget, never the outline.
 */
export function seriesContext({ dramaId, beforeEpisodeNumber }: SeriesScope, log: Logger = logger): SeriesContext {
  const drama = getDramaRow(dramaId);
  const series: SeriesContext = { title: drama.title, serial: drama.serial };
  if (drama.description.trim()) series.description = drama.description.trim();
  if (drama.genre.trim()) series.genre = drama.genre.trim();
  if (drama.outline.trim()) series.outline = drama.outline.trim();
  if (!drama.serial) {
    log.info({ dramaId, beforeEpisodeNumber, serial: false, outline: series.outline !== undefined }, 'series context attached');
    return series;
  }
  const rows = db
    .select({
      episodeNumber: episodes.episodeNumber,
      title: episodes.title,
      recap: episodes.recap,
      recapRevision: episodes.recapRevision,
      scriptRevision: episodes.scriptRevision,
    })
    .from(episodes)
    .where(
      and(
        eq(episodes.dramaId, dramaId),
        isNull(episodes.deletedAt),
        beforeEpisodeNumber === undefined ? undefined : lt(episodes.episodeNumber, beforeEpisodeNumber),
      ),
    )
    .orderBy(asc(episodes.episodeNumber))
    .all();
  const earlier: EarlierEpisode[] = rows.map((r) => {
    const recap = r.recap.trim();
    if (!recap) return { episodeNumber: r.episodeNumber, title: r.title, status: 'missing' };
    return { episodeNumber: r.episodeNumber, title: r.title, status: isRecapStale(r) ? 'stale' : 'ready', recap };
  });
  // The budget is the serialized block: premise, outline, every entry (a missing one still names itself) and the
  // recaps. Only recaps can be dropped, oldest first; an entry whose recap went is listed as omitted instead.
  const omitted = fitRecaps(earlier, series);
  const kept = earlier.filter((e) => !omitted.includes(e.episodeNumber));
  series.earlierEpisodes = kept;
  if (omitted.length > 0) series.omittedEpisodes = omitted;
  const count = (status: EarlierEpisode['status']) => kept.filter((e) => e.status === status).length;
  log.info(
    {
      dramaId,
      beforeEpisodeNumber,
      serial: true,
      outline: series.outline !== undefined,
      ready: count('ready'),
      stale: count('stale'),
      missing: count('missing'),
      omitted: omitted.length,
    },
    'series context attached',
  );
  return series;
}
