import { existsSync } from 'node:fs';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import {
  isNarrator,
  type AssetKind,
  type CharacterCard,
  type CreateCharacter,
  type CreateProp,
  type CreateScene,
  type DramaAssetLibrary,
  type EpisodeAssets,
  type PropCard,
  type SceneCard,
  type TaskSummary,
  type UpdateCharacter,
  type UpdateProp,
  type UpdateScene,
} from '@open-drama/contracts';
import { db } from '../../db/client';
import {
  characters,
  episodeCharacters,
  episodeProps,
  episodeScenes,
  generationTasks,
  props,
  scenes,
  shotCharacters,
  shotProps,
  shots,
} from '../../db/schema';
import { assertSomething, conflict, invalid, notFound } from '../../http/errors';
import { toAbsolute } from '../../lib/paths';
import { latestExtractionJobs } from '../jobs/run-job';
import { getDramaRow, touchDrama } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';
import { normaliseName, sceneKey } from './names';

type CharacterRow = typeof characters.$inferSelect;
type SceneRow = typeof scenes.$inferSelect;
type PropRow = typeof props.$inferSelect;

const now = () => new Date().toISOString();

// Latest image task per asset (readiness is derived from it plus imagePath, never stored)

const OWNER_COLUMN = {
  character: generationTasks.characterId,
  scene: generationTasks.sceneId,
  prop: generationTasks.propId,
} as const;

function latestImageTasks(kind: AssetKind, ids: number[]): Map<number, TaskSummary> {
  const map = new Map<number, TaskSummary>();
  if (ids.length === 0) return map;
  const column = OWNER_COLUMN[kind];
  const rows = db
    .select({
      ownerId: column,
      id: generationTasks.id,
      status: generationTasks.status,
      error: generationTasks.error,
      errorClass: generationTasks.errorClass,
      createdAt: generationTasks.createdAt,
      completedAt: generationTasks.completedAt,
    })
    .from(generationTasks)
    .where(and(eq(generationTasks.type, 'image'), inArray(column, ids)))
    .orderBy(desc(generationTasks.id))
    .all();
  for (const { ownerId, ...task } of rows) {
    if (ownerId !== null && !map.has(ownerId)) map.set(ownerId, task);
  }
  return map;
}

const strip = <T extends { deletedAt: string | null }>({ deletedAt: _d, ...row }: T) => row;

const characterCards = (rows: CharacterRow[]): CharacterCard[] => {
  const tasks = latestImageTasks('character', rows.map((r) => r.id));
  return rows
    .filter((r) => !isNarrator(r.name, r.role))
    .map((r) => ({ ...strip(r), latestImageTask: tasks.get(r.id) ?? null }));
};
const sceneCards = (rows: SceneRow[]): SceneCard[] => {
  const tasks = latestImageTasks('scene', rows.map((r) => r.id));
  return rows.map((r) => ({ ...strip(r), latestImageTask: tasks.get(r.id) ?? null }));
};
const propCards = (rows: PropRow[]): PropCard[] => {
  const tasks = latestImageTasks('prop', rows.map((r) => r.id));
  return rows.map((r) => ({ ...strip(r), latestImageTask: tasks.get(r.id) ?? null }));
};

// Read models

/** DramaAssetLibrary: every live asset of the drama, regardless of episode. */
export function getDramaAssets(dramaId: number): DramaAssetLibrary {
  getDramaRow(dramaId);
  const live = <T extends typeof characters | typeof scenes | typeof props>(t: T) =>
    and(eq(t.dramaId, dramaId), isNull(t.deletedAt));
  return {
    dramaId,
    characters: characterCards(
      db.select().from(characters).where(live(characters)).orderBy(asc(characters.sortOrder), asc(characters.id)).all(),
    ),
    scenes: sceneCards(db.select().from(scenes).where(live(scenes)).orderBy(asc(scenes.sortOrder), asc(scenes.id)).all()),
    props: propCards(db.select().from(props).where(live(props)).orderBy(asc(props.sortOrder), asc(props.id)).all()),
  };
}

/** EpisodeAssets: the assets linked to the episode, with the extraction job per target. */
export function getEpisodeAssets(episodeId: number): EpisodeAssets {
  getEpisodeRow(episodeId);
  const chars = db
    .select({ row: characters })
    .from(episodeCharacters)
    .innerJoin(characters, eq(characters.id, episodeCharacters.characterId))
    .where(and(eq(episodeCharacters.episodeId, episodeId), isNull(characters.deletedAt)))
    .orderBy(asc(characters.sortOrder), asc(characters.id))
    .all()
    .map((r) => r.row);
  const scs = db
    .select({ row: scenes })
    .from(episodeScenes)
    .innerJoin(scenes, eq(scenes.id, episodeScenes.sceneId))
    .where(and(eq(episodeScenes.episodeId, episodeId), isNull(scenes.deletedAt)))
    .orderBy(asc(scenes.sortOrder), asc(scenes.id))
    .all()
    .map((r) => r.row);
  const prs = db
    .select({ row: props })
    .from(episodeProps)
    .innerJoin(props, eq(props.id, episodeProps.propId))
    .where(and(eq(episodeProps.episodeId, episodeId), isNull(props.deletedAt)))
    .orderBy(asc(props.sortOrder), asc(props.id))
    .all()
    .map((r) => r.row);
  return {
    episodeId,
    characters: characterCards(chars),
    scenes: sceneCards(scs),
    props: propCards(prs),
    extraction: latestExtractionJobs(episodeId),
  };
}

// Helpers

/** The episode to link to, which must belong to the same drama. */
function linkTarget(dramaId: number, episodeId: number | undefined) {
  if (episodeId === undefined) return undefined;
  const ep = getEpisodeRow(episodeId);
  if (ep.dramaId !== dramaId) throw invalid('The episode belongs to another project');
  return ep.id;
}

/** An attached image must be a stored media file. */
function checkImagePath(path: string | null | undefined) {
  if (path == null) return;
  if (!existsSync(toAbsolute(path))) throw invalid(`No stored file at ${path}`);
}

/**
 * The finalPrompt rule shared by all three kinds: an explicit finalPrompt wins and clears the stale flag;
 * otherwise a change to a describing field keeps the prompt and marks it stale.
 */
function promptPatch(
  current: { finalPrompt: string | null },
  input: { finalPrompt?: string | null },
  describingChanged: boolean,
) {
  if (input.finalPrompt !== undefined) return { finalPrompt: input.finalPrompt, finalPromptStale: false };
  if (describingChanged && current.finalPrompt) return { finalPromptStale: true };
  return {};
}

const changed = <T extends object>(current: T, input: Partial<T>, keys: (keyof T)[]) =>
  keys.some((k) => input[k] !== undefined && input[k] !== current[k]);

// Characters

function getCharacterRow(id: number): CharacterRow {
  const row = db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
    .get();
  if (!row) throw notFound('Character');
  return row;
}

function assertUniqueCharacter(dramaId: number, name: string, exceptId?: number) {
  const key = normaliseName(name);
  const clash = db
    .select({ id: characters.id, name: characters.name })
    .from(characters)
    .where(and(eq(characters.dramaId, dramaId), isNull(characters.deletedAt)))
    .all()
    .find((c) => c.id !== exceptId && normaliseName(c.name) === key);
  if (clash) throw conflict(`A character named "${clash.name}" already exists`, { existingId: clash.id });
}

export function createCharacter(input: z.output<typeof CreateCharacter>): CharacterCard {
  getDramaRow(input.dramaId);
  const episodeId = linkTarget(input.dramaId, input.episodeId);
  assertUniqueCharacter(input.dramaId, input.name);
  const { episodeId: _e, ...values } = input;
  const row = db.transaction((tx) => {
    const created = tx.insert(characters).values(values).returning().get();
    if (episodeId) tx.insert(episodeCharacters).values({ episodeId, characterId: created.id }).run();
    return created;
  });
  touchDrama(input.dramaId);
  return characterCards([row])[0] ?? { ...strip(row), latestImageTask: null };
}

export function updateCharacter(id: number, input: z.output<typeof UpdateCharacter>): CharacterCard {
  const current = getCharacterRow(id);
  assertSomething(input);
  if (input.name !== undefined) assertUniqueCharacter(current.dramaId, input.name, id);
  checkImagePath(input.imagePath);
  const row = db
    .update(characters)
    .set({ ...input, ...promptPatch(current, input, changed(current, input, ['appearance', 'styling'])) })
    .where(eq(characters.id, id))
    .returning()
    .get();
  touchDrama(current.dramaId);
  return { ...strip(row), latestImageTask: latestImageTasks('character', [id]).get(id) ?? null };
}

/** Soft delete; the character leaves every episode and shot of the drama. */
export function deleteCharacter(id: number): { id: number } {
  const current = getCharacterRow(id);
  db.transaction((tx) => {
    tx.update(characters).set({ deletedAt: now() }).where(eq(characters.id, id)).run();
    tx.delete(episodeCharacters).where(eq(episodeCharacters.characterId, id)).run();
    tx.delete(shotCharacters).where(eq(shotCharacters.characterId, id)).run();
  });
  touchDrama(current.dramaId);
  return { id };
}

// Scenes

function getSceneRow(id: number): SceneRow {
  const row = db
    .select()
    .from(scenes)
    .where(and(eq(scenes.id, id), isNull(scenes.deletedAt)))
    .get();
  if (!row) throw notFound('Scene');
  return row;
}

function assertUniqueScene(dramaId: number, location: string, time: string, exceptId?: number) {
  const key = sceneKey(location, time);
  const clash = db
    .select({ id: scenes.id, location: scenes.location, time: scenes.time })
    .from(scenes)
    .where(and(eq(scenes.dramaId, dramaId), isNull(scenes.deletedAt)))
    .all()
    .find((s) => s.id !== exceptId && sceneKey(s.location, s.time) === key);
  if (clash) {
    const label = clash.time ? `${clash.location} (${clash.time})` : clash.location;
    throw conflict(`The scene "${label}" already exists`, { existingId: clash.id });
  }
}

export function createScene(input: z.output<typeof CreateScene>): SceneCard {
  getDramaRow(input.dramaId);
  const episodeId = linkTarget(input.dramaId, input.episodeId);
  assertUniqueScene(input.dramaId, input.location, input.time);
  const { episodeId: _e, ...values } = input;
  const row = db.transaction((tx) => {
    const created = tx.insert(scenes).values(values).returning().get();
    if (episodeId) tx.insert(episodeScenes).values({ episodeId, sceneId: created.id }).run();
    return created;
  });
  touchDrama(input.dramaId);
  return { ...strip(row), latestImageTask: null };
}

export function updateScene(id: number, input: z.output<typeof UpdateScene>): SceneCard {
  const current = getSceneRow(id);
  assertSomething(input);
  if (input.location !== undefined || input.time !== undefined) {
    assertUniqueScene(current.dramaId, input.location ?? current.location, input.time ?? current.time, id);
  }
  checkImagePath(input.imagePath);
  const row = db
    .update(scenes)
    .set({ ...input, ...promptPatch(current, input, changed(current, input, ['prompt', 'lighting'])) })
    .where(eq(scenes.id, id))
    .returning()
    .get();
  touchDrama(current.dramaId);
  return { ...strip(row), latestImageTask: latestImageTasks('scene', [id]).get(id) ?? null };
}

/** Soft delete; the scene leaves every episode, and shots that used it lose the binding. */
export function deleteScene(id: number): { id: number } {
  const current = getSceneRow(id);
  db.transaction((tx) => {
    tx.update(scenes).set({ deletedAt: now() }).where(eq(scenes.id, id)).run();
    tx.delete(episodeScenes).where(eq(episodeScenes.sceneId, id)).run();
    tx.update(shots).set({ sceneId: null }).where(eq(shots.sceneId, id)).run();
  });
  touchDrama(current.dramaId);
  return { id };
}

// Props

function getPropRow(id: number): PropRow {
  const row = db
    .select()
    .from(props)
    .where(and(eq(props.id, id), isNull(props.deletedAt)))
    .get();
  if (!row) throw notFound('Prop');
  return row;
}

function assertUniqueProp(dramaId: number, name: string, exceptId?: number) {
  const key = normaliseName(name);
  const clash = db
    .select({ id: props.id, name: props.name })
    .from(props)
    .where(and(eq(props.dramaId, dramaId), isNull(props.deletedAt)))
    .all()
    .find((p) => p.id !== exceptId && normaliseName(p.name) === key);
  if (clash) throw conflict(`A prop named "${clash.name}" already exists`, { existingId: clash.id });
}

export function createProp(input: z.output<typeof CreateProp>): PropCard {
  getDramaRow(input.dramaId);
  const episodeId = linkTarget(input.dramaId, input.episodeId);
  assertUniqueProp(input.dramaId, input.name);
  const { episodeId: _e, ...values } = input;
  const row = db.transaction((tx) => {
    const created = tx.insert(props).values(values).returning().get();
    if (episodeId) tx.insert(episodeProps).values({ episodeId, propId: created.id }).run();
    return created;
  });
  touchDrama(input.dramaId);
  return { ...strip(row), latestImageTask: null };
}

export function updateProp(id: number, input: z.output<typeof UpdateProp>): PropCard {
  const current = getPropRow(id);
  assertSomething(input);
  if (input.name !== undefined) assertUniqueProp(current.dramaId, input.name, id);
  checkImagePath(input.imagePath);
  const row = db
    .update(props)
    .set({ ...input, ...promptPatch(current, input, changed(current, input, ['description'])) })
    .where(eq(props.id, id))
    .returning()
    .get();
  touchDrama(current.dramaId);
  return { ...strip(row), latestImageTask: latestImageTasks('prop', [id]).get(id) ?? null };
}

export function deleteProp(id: number): { id: number } {
  const current = getPropRow(id);
  db.transaction((tx) => {
    tx.update(props).set({ deletedAt: now() }).where(eq(props.id, id)).run();
    tx.delete(episodeProps).where(eq(episodeProps.propId, id)).run();
    tx.delete(shotProps).where(eq(shotProps.propId, id)).run();
  });
  touchDrama(current.dramaId);
  return { id };
}
