import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { characters, dramas, episodeCharacters, episodeProps, episodeScenes, props, scenes } from '../../db/schema';
import { getDramaStylePrompt } from '../configuration/presets';
import { normaliseName, sceneKey } from './names';

export interface ExtractedCharacter {
  name: string;
  role?: string;
  appearance?: string;
  styling?: string;
  description?: string;
}
export interface ExtractedScene {
  location: string;
  time?: string;
  prompt?: string;
  lighting?: string;
}
export interface ExtractedProp {
  name: string;
  type?: string;
  description?: string;
}

export interface SaveResult {
  created: string[];
  reused: string[];
  skipped: string[];
}

/** Only fields that are still empty are filled from an extraction; the creator's edits always win. */
function fillEmpty<K extends string>(current: Record<NoInfer<K>, unknown>, incoming: Partial<Record<K, string | undefined>>) {
  const patch: Partial<Record<K, string>> = {};
  for (const [key, value] of Object.entries(incoming) as [K, string | undefined][]) {
    if (value && value.trim() && !String(current[key] ?? '').trim()) patch[key] = value.trim();
  }
  return patch;
}

const MAX_PROPS = 3;

/**
 * SaveExtractedCharacters: near-name dedup against the drama's live characters, then link every result to the
 * episode. Existing characters only get their empty fields filled. Deleting an asset is the creator's verdict: a
 * name matching only a deleted one is reported as skipped instead of coming back (the same rule holds for scenes
 * and props).
 */
export function saveExtractedCharacters(dramaId: number, episodeId: number, items: ExtractedCharacter[]): SaveResult {
  const result: SaveResult = { created: [], reused: [], skipped: [] };
  db.transaction((tx) => {
    const live = tx
      .select()
      .from(characters)
      .where(and(eq(characters.dramaId, dramaId), isNull(characters.deletedAt)))
      .all();
    const deleted = new Set(
      tx
        .select({ name: characters.name })
        .from(characters)
        .where(and(eq(characters.dramaId, dramaId), isNotNull(characters.deletedAt)))
        .all()
        .map((c) => normaliseName(c.name)),
    );
    for (const item of items) {
      const name = item.name?.trim();
      if (!name) continue;
      const key = normaliseName(name);
      let row = live.find((c) => normaliseName(c.name) === key);
      if (!row && deleted.has(key)) {
        result.skipped.push(name);
        continue;
      }
      if (row) {
        const patch = fillEmpty(row, { role: item.role, appearance: item.appearance, styling: item.styling, description: item.description });
        if (Object.keys(patch).length > 0) {
          const describing = 'appearance' in patch || 'styling' in patch;
          tx.update(characters)
            .set({ ...patch, ...(describing && row.finalPrompt ? { finalPromptStale: true } : {}) })
            .where(eq(characters.id, row.id))
            .run();
        }
        result.reused.push(row.name);
      } else {
        row = tx
          .insert(characters)
          .values({
            dramaId,
            name,
            role: item.role?.trim() ?? '',
            appearance: item.appearance?.trim() ?? '',
            styling: item.styling?.trim() ?? '',
            description: item.description?.trim() ?? '',
            sortOrder: live.length,
          })
          .returning()
          .get();
        live.push(row);
        result.created.push(name);
      }
      tx.insert(episodeCharacters).values({ episodeId, characterId: row.id }).onConflictDoNothing().run();
    }
  });
  return result;
}

export function saveExtractedScenes(dramaId: number, episodeId: number, items: ExtractedScene[]): SaveResult {
  const result: SaveResult = { created: [], reused: [], skipped: [] };
  db.transaction((tx) => {
    const live = tx
      .select()
      .from(scenes)
      .where(and(eq(scenes.dramaId, dramaId), isNull(scenes.deletedAt)))
      .all();
    const deleted = new Set(
      tx
        .select({ location: scenes.location, time: scenes.time })
        .from(scenes)
        .where(and(eq(scenes.dramaId, dramaId), isNotNull(scenes.deletedAt)))
        .all()
        .map((s) => sceneKey(s.location, s.time)),
    );
    for (const item of items) {
      const location = item.location?.trim();
      if (!location) continue;
      const time = item.time?.trim() ?? '';
      const key = sceneKey(location, time);
      const label = time ? `${location} (${time})` : location;
      let row = live.find((s) => sceneKey(s.location, s.time) === key);
      if (!row && deleted.has(key)) {
        result.skipped.push(label);
        continue;
      }
      if (row) {
        const patch = fillEmpty(row, { prompt: item.prompt, lighting: item.lighting });
        if (Object.keys(patch).length > 0) {
          tx.update(scenes)
            .set({ ...patch, ...(row.finalPrompt ? { finalPromptStale: true } : {}) })
            .where(eq(scenes.id, row.id))
            .run();
        }
        result.reused.push(label);
      } else {
        row = tx
          .insert(scenes)
          .values({ dramaId, location, time, prompt: item.prompt?.trim() ?? '', lighting: item.lighting?.trim() ?? '', sortOrder: live.length })
          .returning()
          .get();
        live.push(row);
        result.created.push(label);
      }
      tx.insert(episodeScenes).values({ episodeId, sceneId: row.id }).onConflictDoNothing().run();
    }
  });
  return result;
}

/**
 * Props are plot-critical and capped at 3 per episode, counting props already linked to it; props beyond the cap
 * are reported as skipped. Existing links are never removed (the creator may have linked them by hand).
 */
export function saveExtractedProps(dramaId: number, episodeId: number, items: ExtractedProp[]): SaveResult {
  const result: SaveResult = { created: [], reused: [], skipped: [] };
  db.transaction((tx) => {
    const live = tx
      .select()
      .from(props)
      .where(and(eq(props.dramaId, dramaId), isNull(props.deletedAt)))
      .all();
    const deleted = new Set(
      tx
        .select({ name: props.name })
        .from(props)
        .where(and(eq(props.dramaId, dramaId), isNotNull(props.deletedAt)))
        .all()
        .map((p) => normaliseName(p.name)),
    );
    const linked = new Set(
      tx
        .select({ id: episodeProps.propId })
        .from(episodeProps)
        .innerJoin(props, eq(props.id, episodeProps.propId))
        .where(and(eq(episodeProps.episodeId, episodeId), isNull(props.deletedAt)))
        .all()
        .map((r) => r.id),
    );
    for (const item of items) {
      const name = item.name?.trim();
      if (!name) continue;
      const key = normaliseName(name);
      let row = live.find((p) => normaliseName(p.name) === key);
      if ((!row && deleted.has(key)) || (!(row && linked.has(row.id)) && linked.size >= MAX_PROPS)) {
        result.skipped.push(name);
        continue;
      }
      if (row) {
        const patch = fillEmpty(row, { type: item.type, description: item.description });
        if (Object.keys(patch).length > 0) {
          tx.update(props)
            .set({ ...patch, ...('description' in patch && row.finalPrompt ? { finalPromptStale: true } : {}) })
            .where(eq(props.id, row.id))
            .run();
        }
        result.reused.push(row.name);
      } else {
        row = tx
          .insert(props)
          .values({ dramaId, name, type: item.type?.trim() ?? '', description: item.description?.trim() ?? '', sortOrder: live.length })
          .returning()
          .get();
        live.push(row);
        result.created.push(name);
      }
      linked.add(row.id);
      tx.insert(episodeProps).values({ episodeId, propId: row.id }).onConflictDoNothing().run();
    }
  });
  return result;
}

/** The drama's style fragment, prepended once (Save*FinalPrompt: the model never writes style words). */
export function withStylePrefix(dramaId: number, prompt: string): string {
  const drama = db.select({ style: dramas.style }).from(dramas).where(eq(dramas.id, dramaId)).get();
  const style = drama ? getDramaStylePrompt(drama.style).trim() : '';
  const body = prompt.trim();
  if (!style || body.toLowerCase().startsWith(style.toLowerCase())) return body;
  return `${style}. ${body}`;
}
