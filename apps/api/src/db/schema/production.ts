import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { AspectRatio, DramaStatus, EpisodeStatus, Resolution } from '@open-drama/contracts';
import { createdAt, deletedAt, id, json, updatedAt } from './columns';

export const dramas = sqliteTable('dramas', {
  id: id(),
  title: text().notNull(),
  description: text().notNull().default(''),
  genre: text().notNull().default(''),
  style: text().notNull(),
  aspectRatio: text().$type<AspectRatio>().notNull(),
  status: text().$type<DramaStatus>().notNull().default('draft'),
  tags: json<string[]>().notNull().default([]),
  thumbnail: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

export const episodes = sqliteTable(
  'episodes',
  {
    id: id(),
    dramaId: integer()
      .notNull()
      .references(() => dramas.id),
    episodeNumber: integer().notNull(),
    title: text().notNull(),
    description: text().notNull().default(''),
    content: text().notNull().default(''),
    scriptContent: text(),
    status: text().$type<EpisodeStatus>().notNull().default('draft'),
    resolution: text().$type<Resolution>().notNull().default('720p'),
    // Locked services are plain ids: services are hard-deleted and episodes then fall back to the active one.
    imageServiceId: integer(),
    videoServiceId: integer(),
    filmPath: text(),
    filmDurationSeconds: real(),
    durationSeconds: real().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index('episodes_drama_idx').on(t.dramaId),
    uniqueIndex('episodes_drama_number_live_uq')
      .on(t.dramaId, t.episodeNumber)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
