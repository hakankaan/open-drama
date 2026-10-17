import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { AspectRatio, DramaLook, DramaStatus, EpisodeStatus, Resolution } from '@open-drama/contracts';
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
  // The series look the merge grades every episode's film with.
  look: text().$type<DramaLook>().notNull().default('none'),
  // Lines are spoken in each character's pinned voice and lip-synced onto silent videos (adr-0021).
  pinnedVoices: bool().notNull().default(false),
  // The story outline the episodes are planned from (adr-0015); Markdown, empty until written.
  outline: text().notNull().default(''),
  // Bumped on every change of the outline, whoever writes it (adr-0016).
  outlineRevision: integer().notNull().default(0),
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
    // Bumped on every change of content (the beat sheet), whoever writes it (adr-0016).
    beatsRevision: integer().notNull().default(0),
    scriptContent: text(),
    // Bumped on every change of scriptContent; a recap is fresh while recapScriptRevision matches it (adr-0014).
    scriptRevision: integer().notNull().default(0),
    recap: text().notNull().default(''),
    // The script revision the recap was written for (adr-0014): fresh while it equals scriptRevision. Column name kept.
    recapScriptRevision: integer('recap_revision').notNull().default(0),
    // Bumped on every change of the recap text, whoever writes it (adr-0016): the assistant's freshness token.
    recapRevision: integer('recap_text_revision').notNull().default(0),
    status: text().$type<EpisodeStatus>().notNull().default('draft'),
    resolution: text().$type<Resolution>().notNull().default('720p'),
    // Locked services are plain ids: services are hard-deleted and episodes then fall back to the active one.
    imageServiceId: integer(),
    videoServiceId: integer(),
    // The video model the episode is pinned to (adr-0017): claimed with its first video, kept while the service lists it.
    videoModel: text(),
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
