import { and, eq, isNull, max } from 'drizzle-orm';
import type { z } from 'zod';
import type { CreateEpisode, Episode, EpisodeView, LockedService, ServiceType, UpdateEpisode } from '@open-drama/contracts';
import { db } from '../../db/client';
import { episodes } from '../../db/schema';
import { assertSomething, notFound, precondition } from '../../http/errors';
import { resolveService } from '../configuration/services';
import { getDramaRow, touchDrama } from './dramas';

type Row = typeof episodes.$inferSelect;

export const toEpisode = ({ deletedAt: _deletedAt, ...row }: Row): Episode => row;

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
        imageServiceId: image!.row.id,
        videoServiceId: video!.row.id,
      })
      .returning({ id: episodes.id })
      .get().id;
  });
  touchDrama(drama.id);
  return getEpisodeView(id);
}

/** Field-based dispatch of UpdateEpisodeContent, SaveScript, SetEpisodeResolution and SetEpisodeStatus. */
export function updateEpisode(id: number, input: z.output<typeof UpdateEpisode>): EpisodeView {
  const row = getEpisodeRow(id);
  assertSomething(input);
  db.update(episodes).set(input).where(eq(episodes.id, id)).run();
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
  db.update(episodes).set({ scriptContent: row.content }).where(eq(episodes.id, id)).run();
  touchDrama(row.dramaId);
  return getEpisodeView(id);
}


