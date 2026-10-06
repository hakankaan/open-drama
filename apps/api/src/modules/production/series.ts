import { and, asc, eq, isNull, lt } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { EarlierEpisode, SeriesContext } from '@open-drama/contracts';
import { db } from '../../db/client';
import { episodes } from '../../db/schema';
import { notFound } from '../../http/errors';
import { logger } from '../../http/logger';
import { getDramaRow } from './dramas';
import { isRecapStale } from './episodes';

/** Characters of recap text the block may carry; beyond it the oldest recaps are dropped and named as omitted. */
const RECAP_BUDGET = 40_000;

/**
 * SeriesContext (adr-0014): what the script and storyboard agents are told about the rest of the drama. Always the
 * premise (title, synopsis, genre when set); for a serial drama also the earlier live episodes in order, each with
 * its recap and whether that recap is ready, stale (the script changed since) or missing, so gaps are named rather
 * than silently absent.
 */
export function seriesContext(dramaId: number, episodeId: number, log: Logger = logger): SeriesContext {
  const drama = getDramaRow(dramaId);
  const series: SeriesContext = { title: drama.title, serial: drama.serial };
  if (drama.description.trim()) series.description = drama.description.trim();
  if (drama.genre.trim()) series.genre = drama.genre.trim();
  if (!drama.serial) {
    log.info({ dramaId, episodeId, serial: false }, 'series context attached');
    return series;
  }
  const current = db.select({ episodeNumber: episodes.episodeNumber }).from(episodes).where(eq(episodes.id, episodeId)).get();
  if (!current) throw notFound('Episode');
  const rows = db
    .select({
      episodeNumber: episodes.episodeNumber,
      title: episodes.title,
      recap: episodes.recap,
      recapRevision: episodes.recapRevision,
      scriptRevision: episodes.scriptRevision,
    })
    .from(episodes)
    .where(and(eq(episodes.dramaId, dramaId), isNull(episodes.deletedAt), lt(episodes.episodeNumber, current.episodeNumber)))
    .orderBy(asc(episodes.episodeNumber))
    .all();
  const earlier: EarlierEpisode[] = rows.map((r) => {
    const recap = r.recap.trim();
    if (!recap) return { episodeNumber: r.episodeNumber, title: r.title, status: 'missing' };
    return { episodeNumber: r.episodeNumber, title: r.title, status: isRecapStale(r) ? 'stale' : 'ready', recap };
  });
  // The budget is the serialized block: premise, every entry (a missing one still names itself) and the recaps.
  // Only recaps can be dropped, oldest first; what remains is at least the list of episode numbers and statuses.
  const omitted: number[] = [];
  const size = (value: unknown) => JSON.stringify(value).length;
  let used = size(series) + earlier.reduce((n, e) => n + size(e), 0);
  while (used > RECAP_BUDGET) {
    const oldest = earlier.findIndex((e) => e.recap !== undefined);
    if (oldest === -1) break;
    const [dropped] = earlier.splice(oldest, 1);
    used -= size(dropped);
    omitted.push(dropped!.episodeNumber);
  }
  series.earlierEpisodes = earlier;
  if (omitted.length > 0) series.omittedEpisodes = omitted;
  const count = (status: EarlierEpisode['status']) => earlier.filter((e) => e.status === status).length;
  log.info(
    { dramaId, episodeId, serial: true, ready: count('ready'), stale: count('stale'), missing: count('missing'), omitted: omitted.length },
    'series context attached',
  );
  return series;
}
