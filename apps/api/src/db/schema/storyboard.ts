import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, id, json, updatedAt } from './columns';
import { characters, props, scenes } from './assets';
import { episodes } from './production';

export interface ReferenceMedia {
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
}

export const shots = sqliteTable(
  'shots',
  {
    id: id(),
    episodeId: integer()
      .notNull()
      .references(() => episodes.id),
    shotNumber: integer().notNull(),
    title: text().notNull().default(''),
    shotType: text().notNull().default(''),
    angle: text().notNull().default(''),
    movement: text().notNull().default(''),
    location: text().notNull().default(''),
    time: text().notNull().default(''),
    description: text().notNull().default(''),
    result: text().notNull().default(''),
    atmosphere: text().notNull().default(''),
    imagePrompt: text().notNull().default(''),
    videoPrompt: text().notNull().default(''),
    bgmPrompt: text().notNull().default(''),
    soundEffect: text().notNull().default(''),
    durationSeconds: real().notNull().default(10),
    sceneId: integer().references(() => scenes.id),
    referenceMedia: json<ReferenceMedia>().notNull().default({}),
    videoPath: text(),
    videoDurationSeconds: real(),
    // Set while a breakdown job has parked this row; parked rows are restored if the job fails (adr-0008).
    parkedByJobId: integer(),
    // The breakdown job that wrote this row; a failed job removes exactly its own rows.
    createdByJobId: integer(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('shots_episode_idx').on(t.episodeId),
    uniqueIndex('shots_episode_number_live_uq')
      .on(t.episodeId, t.shotNumber)
      .where(sql`${t.parkedByJobId} IS NULL`),
  ],
);

export const shotCharacters = sqliteTable(
  'shot_characters',
  {
    shotId: integer()
      .notNull()
      .references(() => shots.id, { onDelete: 'cascade' }),
    characterId: integer()
      .notNull()
      .references(() => characters.id),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.shotId, t.characterId] })],
);

export const shotProps = sqliteTable(
  'shot_props',
  {
    shotId: integer()
      .notNull()
      .references(() => shots.id, { onDelete: 'cascade' }),
    propId: integer()
      .notNull()
      .references(() => props.id),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.shotId, t.propId] })],
);
