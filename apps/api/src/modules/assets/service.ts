import { existsSync } from 'node:fs';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import {
  coverOf,
  DESCRIBABLE_FIELDS,
  isNarrator,
  type AssetKind,
  type CharacterCard,
  type CreateCharacter,
  type CreateProp,
  type CreateScene,
  type DramaAssetLibrary,
  type EpisodeAssets,
  type EpisodeCharacterCard,
  type PropCard,
  type SceneCard,
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
import { ASSET_TASK_OWNER, notOutfitTasks, outfitTasksOf, processingImageTask } from '../generation/engine/images';
import { latestTasks } from '../generation/tasks';
import { latestExtractionJobs } from '../jobs/run-job';
import { getDramaRow, touchDrama } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';
import { markAssetPromptsStale, type Tx } from '../storyboard/service';
import { boundShots, markKeyframesStale } from '../storyboard/staleness';
import { changed, promptPatch } from './fields';
import { normaliseName, sceneKey } from './names';
import { VIEW_COLUMN, viewColumns, viewsOf } from './views';

type CharacterRow = typeof characters.$inferSelect;
type SceneRow = typeof scenes.$inferSelect;
type PropRow = typeof props.$inferSelect;

const now = () => new Date().toISOString();

// Latest image task per asset (readiness is derived from it plus the image, never stored)

// A character's outfit pictures are the episode's, not its own (adr-0023).
const latestImageTasks = (kind: AssetKind, ids: number[]) =>
  latestTasks('image', ASSET_TASK_OWNER[kind].column, ids, kind === 'character' ? notOutfitTasks : undefined);

/** The keyframes of the shots an asset is bound to were drawn from what it was (adr-0019). */
const staleKeyframes = (tx: Tx, asset: { kind: AssetKind; id: number }) => markKeyframesStale(tx, boundShots(tx, asset));

const strip = <T extends { deletedAt: string | null }>({ deletedAt: _d, ...row }: T) => row;

/** A character as the studio reads it: its views, and the cover that stands for it (adr-0018). */
const characterCard = (row: CharacterRow, task: CharacterCard['latestImageTask'] | undefined): CharacterCard => {
  const views = viewsOf(row);
  const { sheetPath: _s, headshotPath: _h, bodyPath: _b, sidePath: _si, backPath: _ba, ...fields } = row;
  return { ...strip(fields), imagePath: coverOf(views), views, latestImageTask: task ?? null };
};

const characterCards = (rows: CharacterRow[]): CharacterCard[] => {
  const tasks = latestImageTasks('character', rows.map((r) => r.id));
  return rows.filter((r) => !isNarrator(r.name, r.role)).map((r) => characterCard(r, tasks.get(r.id)));
};

/** The characters of an episode, each with what it wears there and the latest request for that picture (adr-0023). */
export function episodeCharacterCards(
  episodeId: number,
  rows: { row: CharacterRow; outfit: string; outfitPath: string | null }[],
): EpisodeCharacterCard[] {
  const worn = new Map(rows.map((r) => [r.row.id, r]));
  const tasks = latestTasks('image', generationTasks.characterId, [...worn.keys()], outfitTasksOf(episodeId));
  return characterCards(rows.map((r) => r.row)).map((card) => ({
    ...card,
    outfit: worn.get(card.id)!.outfit,
    outfitPath: worn.get(card.id)!.outfitPath,
    latestOutfitTask: tasks.get(card.id) ?? null,
  }));
}
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
    .select({ row: characters, outfit: episodeCharacters.outfit, outfitPath: episodeCharacters.outfitPath })
    .from(episodeCharacters)
    .innerJoin(characters, eq(characters.id, episodeCharacters.characterId))
    .where(and(eq(episodeCharacters.episodeId, episodeId), isNull(characters.deletedAt)))
    .orderBy(asc(characters.sortOrder), asc(characters.id))
    .all();
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
    characters: episodeCharacterCards(episodeId, chars),
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
 * An image task writes its result onto the asset when it completes, whatever happened meanwhile (adr-0024): the
 * asset is neither deleted nor described under it.
 */
export function assertNoImageInFlight(kind: AssetKind, id: number, action: string) {
  const running = processingImageTask(kind, id);
  if (running) throw conflict(`An image of this ${kind} is being generated; ${action} once the task has finished`, { taskId: running.id });
}

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
  return characterCard(row, null);
}

export function updateCharacter(id: number, input: z.output<typeof UpdateCharacter>): CharacterCard {
  const current = getCharacterRow(id);
  assertSomething(input);
  if (input.name !== undefined) assertUniqueCharacter(current.dramaId, input.name, id);
  const { views, ...fields } = input;
  for (const path of Object.values(views ?? {})) checkImagePath(path);
  checkImagePath(input.voiceSamplePath);
  // A running view chain draws its next views from the headshot and writes each result onto its view (adr-0018); an
  // outfit picture is drawn from the headshot too (adr-0023), so any image of the character counts here.
  const running = views && latestTasks('image', ASSET_TASK_OWNER.character.column, [id]).get(id);
  if (running?.status === 'processing') {
    throw conflict("A character's views cannot change while one of its images is generating", { taskId: running.id });
  }
  const row = db.transaction((tx) => {
    // Shot prompts mention the character by name.
    if (input.name !== undefined && input.name !== current.name) markAssetPromptsStale(tx, { kind: 'character', id });
    // Lines spoken in the old voice no longer match the character (adr-0021).
    if (changed(current, input, ['voice', 'voiceSamplePath'])) clearSpokenLines(tx, id);
    if (changed(current, { ...viewColumns(views), styling: input.styling }, [...Object.values(VIEW_COLUMN), 'styling'])) {
      staleKeyframes(tx, { kind: 'character', id });
    }
    return tx
      .update(characters)
      .set({ ...fields, ...viewColumns(views), ...promptPatch('character', current, input) })
      .where(eq(characters.id, id))
      .returning()
      .get();
  });
  touchDrama(current.dramaId);
  return characterCard(row, latestImageTasks('character', [id]).get(id));
}

/** Soft delete; the character leaves every episode and shot of the drama. */
export function deleteCharacter(id: number): { id: number } {
  const current = getCharacterRow(id);
  assertNoImageInFlight('character', id, 'delete it');
  db.transaction((tx) => {
    markAssetPromptsStale(tx, { kind: 'character', id });
    staleKeyframes(tx, { kind: 'character', id });
    tx.update(characters).set({ deletedAt: now() }).where(eq(characters.id, id)).run();
    tx.delete(episodeCharacters).where(eq(episodeCharacters.characterId, id)).run();
    tx.delete(shotCharacters).where(eq(shotCharacters.characterId, id)).run();
    clearSpokenLines(tx, id);
    tx.update(shots).set({ speakerId: null }).where(eq(shots.speakerId, id)).run();
  });
  touchDrama(current.dramaId);
  return { id };
}

/** The line audio of the shots a character speaks in: made in a voice that is no longer theirs. */
function clearSpokenLines(tx: Tx, characterId: number) {
  tx.update(shots).set({ lineAudioPath: null, lineAudioSeconds: null }).where(eq(shots.speakerId, characterId)).run();
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
  const row = db.transaction((tx) => {
    // Shot prompts mention the scene by its location and time.
    if (changed(current, input, ['location', 'time'])) markAssetPromptsStale(tx, { kind: 'scene', id });
    if (changed(current, input, ['imagePath', 'lighting'])) staleKeyframes(tx, { kind: 'scene', id });
    // A keyframe composed for a shot without a location of its own names the scene's (adr-0019).
    else if (changed(current, input, ['location'])) {
      const composed = tx
        .select({ id: shots.id })
        .from(shots)
        .where(and(eq(shots.sceneId, id), sql`trim(${shots.imagePrompt}) = ''`, sql`trim(${shots.location}) = ''`))
        .all();
      markKeyframesStale(tx, composed.map((s) => s.id));
    }
    return tx
      .update(scenes)
      .set({ ...input, ...promptPatch('scene', current, input) })
      .where(eq(scenes.id, id))
      .returning()
      .get();
  });
  touchDrama(current.dramaId);
  return { ...strip(row), latestImageTask: latestImageTasks('scene', [id]).get(id) ?? null };
}

/** Soft delete; the scene leaves every episode, and shots that used it lose the binding. */
export function deleteScene(id: number): { id: number } {
  const current = getSceneRow(id);
  assertNoImageInFlight('scene', id, 'delete it');
  db.transaction((tx) => {
    markAssetPromptsStale(tx, { kind: 'scene', id });
    staleKeyframes(tx, { kind: 'scene', id });
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
  const row = db.transaction((tx) => {
    // Shot prompts mention the prop by name.
    if (input.name !== undefined && input.name !== current.name) markAssetPromptsStale(tx, { kind: 'prop', id });
    if (changed(current, input, ['imagePath'])) staleKeyframes(tx, { kind: 'prop', id });
    return tx
      .update(props)
      .set({ ...input, ...promptPatch('prop', current, input) })
      .where(eq(props.id, id))
      .returning()
      .get();
  });
  touchDrama(current.dramaId);
  return { ...strip(row), latestImageTask: latestImageTasks('prop', [id]).get(id) ?? null };
}

export function deleteProp(id: number): { id: number } {
  const current = getPropRow(id);
  assertNoImageInFlight('prop', id, 'delete it');
  db.transaction((tx) => {
    markAssetPromptsStale(tx, { kind: 'prop', id });
    staleKeyframes(tx, { kind: 'prop', id });
    tx.update(props).set({ deletedAt: now() }).where(eq(props.id, id)).run();
    tx.delete(episodeProps).where(eq(episodeProps.propId, id)).run();
    tx.delete(shotProps).where(eq(shotProps.propId, id)).run();
  });
  touchDrama(current.dramaId);
  return { id };
}

// One asset by kind

export type AssetCard = CharacterCard | SceneCard | PropCard;

/** The card of one live asset, as the lists show it. */
export function getAsset(kind: AssetKind, id: number): AssetCard {
  if (kind === 'character') return characterCard(getCharacterRow(id), latestImageTasks('character', [id]).get(id));
  if (kind === 'scene') return { ...strip(getSceneRow(id)), latestImageTask: latestImageTasks('scene', [id]).get(id) ?? null };
  return { ...strip(getPropRow(id)), latestImageTask: latestImageTasks('prop', [id]).get(id) ?? null };
}

const updateAsset = (kind: AssetKind, id: number, patch: Record<string, string>): AssetCard =>
  kind === 'character'
    ? updateCharacter(id, patch as z.output<typeof UpdateCharacter>)
    : kind === 'scene'
      ? updateScene(id, patch as z.output<typeof UpdateScene>)
      : updateProp(id, patch as z.output<typeof UpdateProp>);

/** An asset's describable fields (DESCRIBABLE_FIELDS) split by whether they hold text yet. */
export function describableFields(kind: AssetKind, id: number): { empty: string[]; filled: string[] } {
  const row = getAsset(kind, id) as unknown as Record<string, unknown>;
  const empty = DESCRIBABLE_FIELDS[kind].filter((k) => !String(row[k] ?? '').trim());
  return { empty, filled: DESCRIBABLE_FIELDS[kind].filter((k) => !empty.includes(k)) };
}

/**
 * DescribeAsset's write (adr-0024): of the fields the designer sent, the describable ones, kept to the empty ones
 * unless the run may replace; an identity field is never among them. It goes through the manual update, so the
 * final prompt goes stale and the keyframes drawn from a styling or a lighting with it. Nothing to write is the
 * agent's mistake, named back to it so the run can send the right fields.
 */
export function writeDescription(kind: AssetKind, id: number, fields: Record<string, string | undefined>, replace: boolean) {
  const { empty } = describableFields(kind, id);
  const patch: Record<string, string> = {};
  for (const key of DESCRIBABLE_FIELDS[kind]) {
    const value = fields[key]?.trim();
    if (value && (replace || empty.includes(key))) patch[key] = value;
  }
  const written = Object.keys(patch);
  if (written.length === 0) {
    throw invalid(
      replace
        ? `Nothing was written: send the fields to write afresh (${DESCRIBABLE_FIELDS[kind].join(', ')})`
        : `Nothing was written: the filled fields are kept; send the empty ones (${empty.join(', ')})`,
    );
  }
  const asset = updateAsset(kind, id, patch);
  return { asset, written, kept: DESCRIBABLE_FIELDS[kind].filter((k) => !written.includes(k)) };
}
