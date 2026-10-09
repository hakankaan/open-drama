import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { AspectRatio, DramaStatus, EpisodeStatus, Resolution } from '@open-drama/contracts';
import { bool, createdAt, deletedAt, id, json, updatedAt } from './columns';

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
  // Episodes continue one story: earlier episodes' recaps are given to the agents (adr-0014).
  serial: bool().notNull().default(true),
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
    // Bumped on every change of scriptContent; a recap is fresh while recapRevision matches it (adr-0014).
    scriptRevision: integer().notNull().default(0),
    recap: text().notNull().default(''),
    recapRevision: integer().notNull().default(0),
    status: text().$type<EpisodeStatus>().notNull().default('draft'),
    resolution: text().$type<Resolution>().notNull().default('720p'),
    // Locked services are plain ids: services are hard-deleted and episodes then fall back to the active one.
    imageServiceId: integer(),
    videoServiceId: integer(),
    filmPath: text(),
    filmDurationSeconds: real(),
    durationSeconds: real().notNull().default(0),
    // The length the creator wants the episode to run; the rewrite and the breakdown fit it. Null: follow the script.
    targetDurationSeconds: integer(),
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
