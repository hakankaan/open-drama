import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { FilmStatus } from '@open-drama/contracts';
import { createdAt, id, json } from './columns';

export const films = sqliteTable(
  'films',
  {
    id: id(),
    episodeId: integer().notNull(),
    dramaId: integer().notNull(),
    clipPaths: json<string[]>().notNull().default([]),
    encoder: text().notNull().default(''),
    status: text().$type<FilmStatus>().notNull().default('processing'),
    filmPath: text(),
    durationSeconds: real(),
    posterPath: text(),
    error: text(),
    createdAt: createdAt(),
    completedAt: text(),
  },
  (t) => [index('films_episode_idx').on(t.episodeId)],
);
