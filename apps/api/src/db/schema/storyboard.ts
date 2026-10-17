import { sql } from 'drizzle-orm';
import type { ShotQa } from '@open-drama/contracts';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { bool, createdAt, id, json, updatedAt } from './columns';
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
    // The keyframe's prompt; empty means one is composed from the shot when the keyframe is requested.
    imagePrompt: text().notNull().default(''),
    videoPrompt: text().notNull().default(''),
    // A field the video prompt was written from changed since (duration, description, bindings…).
    videoPromptStale: bool().notNull().default(false),
    bgmPrompt: text().notNull().default(''),
    soundEffect: text().notNull().default(''),
    durationSeconds: real().notNull().default(10),
    sceneId: integer().references(() => scenes.id),
    referenceMedia: json<ReferenceMedia>().notNull().default({}),
    videoPath: text(),
    videoDurationSeconds: real(),
    // The still the shot's video starts from, where the video model takes a first frame.
    keyframePath: text(),
    // One unbroken take with the previous shot: the video starts from that shot's last frame.
    continuesPrevious: bool().notNull().default(false),
    // Who speaks the shot's line (one speaker per shot), and the line itself (adr-0021).
    speakerId: integer().references(() => characters.id),
    line: text().notNull().default(''),
    // The line spoken in the speaker's voice; cleared when the line, the speaker or their voice changes.
    lineAudioPath: text(),
    lineAudioSeconds: real(),
    // The latest check of the shot's video by the vision service, with the video it judged (adr-0022).
    qa: json<ShotQa>(),
    // Set while a breakdown job has parked this row; parked rows are restored if the job fails (adr-0008).
    parkedByJobId: integer(),
    // The breakdown job that wrote this row; a failed job removes exactly its own rows.
    createdByJobId: integer(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('shots_episode_idx').on(t.episodeId),
    // Deleting a scene unbinds its shots.
    index('shots_scene_idx').on(t.sceneId),
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
  // The second index serves the reverse lookup (deleting or renaming a character).
  (t) => [primaryKey({ columns: [t.shotId, t.characterId] }), index('shot_characters_character_idx').on(t.characterId)],
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
  (t) => [primaryKey({ columns: [t.shotId, t.propId] }), index('shot_props_prop_idx').on(t.propId)],
);
