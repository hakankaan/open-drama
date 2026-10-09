import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { bool, createdAt, deletedAt, id, updatedAt } from './columns';
import { dramas, episodes } from './production';

export const characters = sqliteTable(
  'characters',
  {
    id: id(),
    dramaId: integer()
      .notNull()
      .references(() => dramas.id),
    name: text().notNull(),
    role: text().notNull().default(''),
    description: text().notNull().default(''),
    appearance: text().notNull().default(''),
    styling: text().notNull().default(''),
    finalPrompt: text(),
    finalPromptStale: bool().notNull().default(false),
    imagePath: text(),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index('characters_drama_idx').on(t.dramaId)],
);

export const scenes = sqliteTable(
  'scenes',
  {
    id: id(),
    dramaId: integer()
      .notNull()
      .references(() => dramas.id),
    location: text().notNull(),
    time: text().notNull().default(''),
    prompt: text().notNull().default(''),
    lighting: text().notNull().default(''),
    finalPrompt: text(),
    finalPromptStale: bool().notNull().default(false),
    imagePath: text(),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index('scenes_drama_idx').on(t.dramaId)],
);

export const props = sqliteTable(
  'props',
  {
    id: id(),
    dramaId: integer()
      .notNull()
      .references(() => dramas.id),
    name: text().notNull(),
    type: text().notNull().default(''),
    description: text().notNull().default(''),
    finalPrompt: text(),
    finalPromptStale: bool().notNull().default(false),
    imagePath: text(),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index('props_drama_idx').on(t.dramaId)],
);

const episodeRef = () =>
  integer()
    .notNull()
    .references(() => episodes.id);

export const episodeCharacters = sqliteTable(
  'episode_characters',
  {
    episodeId: episodeRef(),
    characterId: integer()
      .notNull()
      .references(() => characters.id),
    createdAt: createdAt(),
  },
  // The second index serves the reverse lookup (deleting a character).
  (t) => [primaryKey({ columns: [t.episodeId, t.characterId] }), index('episode_characters_character_idx').on(t.characterId)],
);

export const episodeScenes = sqliteTable(
  'episode_scenes',
  {
    episodeId: episodeRef(),
    sceneId: integer()
      .notNull()
      .references(() => scenes.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.sceneId] }), index('episode_scenes_scene_idx').on(t.sceneId)],
);

export const episodeProps = sqliteTable(
  'episode_props',
  {
    episodeId: episodeRef(),
    propId: integer()
      .notNull()
      .references(() => props.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.propId] }), index('episode_props_prop_idx').on(t.propId)],
);
