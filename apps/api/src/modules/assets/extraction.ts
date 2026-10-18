import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { characters, episodeCharacters, episodeProps, episodeScenes, props, scenes } from '../../db/schema';
import { boundShots, markKeyframesStale } from '../storyboard/staleness';
import { isClaimed } from './claims';
import { touchesPrompt } from './fields';
import { normaliseName, sceneKey } from './names';
import { setEpisodeOutfitIfEmpty } from './outfits';

export interface ExtractedCharacter {
  name: string;
  role?: string;
  appearance?: string;
  styling?: string;
  description?: string;
  /** What the episode dresses an existing character in, when it differs from the styling (adr-0023, adr-0024). */
  outfit?: string;
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

/**
 * What one bulk save did, by name: `created` on the drama, `reused` (an existing asset, linked to the episode when
 * there is one), of which `filled` got at least one empty field filled, `skipped` (matching only a deleted asset, or
 * beyond the episode's prop cap) and `claimed` (an existing asset left as it is while its image or prompt is being
 * made; still linked).
 */
export interface SaveResult {
  created: string[];
  reused: string[];
  filled: string[];
  skipped: string[];
  claimed: string[];
}

/** The characters' save also says whose episode outfit it wrote (`dressed`) and whose it left as it was (`keptOutfit`). */
export interface CharacterSaveResult extends SaveResult {
  dressed: string[];
  keptOutfit: string[];
}

const emptyResult = (): SaveResult => ({ created: [], reused: [], filled: [], skipped: [], claimed: [] });

/** Only fields that are still empty are filled from a bulk save; the creator's edits always win. */
function fillEmpty<K extends string>(current: Record<NoInfer<K>, unknown>, incoming: Partial<Record<K, string | undefined>>) {
  const patch: Partial<Record<K, string>> = {};
  for (const [key, value] of Object.entries(incoming) as [K, string | undefined][]) {
    if (value && value.trim() && !String(current[key] ?? '').trim()) patch[key] = value.trim();
  }
  return patch;
}

const MAX_PROPS = 3;

/**
 * SaveExtractedCharacters, and SaveDesignedCharacters with no episode (adr-0024): near-name dedup against the drama's
 * live characters, then, when an episode is given, a link from every result to it. Existing characters only get
 * their empty fields filled; a filled field that the final prompt reads marks the prompt stale. Deleting an asset is
 * the creator's verdict: a name matching only a deleted one is reported as skipped instead of coming back. One under
 * claim is left as it is (the same rules hold for scenes and props). With an episode, an `outfit` on an existing
 * character dresses them for that episode while its outfit for them is empty (adr-0024); a new character carries no
 * outfit, since its fields describe it as this script shows it, and a claimed one is not dressed either.
 */
export function saveExtractedCharacters(dramaId: number, episodeId: number | null, items: ExtractedCharacter[]): CharacterSaveResult {
  const result: CharacterSaveResult = { ...emptyResult(), dressed: [], keptOutfit: [] };
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
      let dress = false;
      if (row) {
        if (isClaimed('character', row.id)) {
          result.claimed.push(row.name);
        } else {
          dress = true;
          const patch = fillEmpty(row, { role: item.role, appearance: item.appearance, styling: item.styling, description: item.description });
          if (Object.keys(patch).length > 0) {
            tx.update(characters)
              .set({ ...patch, ...(touchesPrompt('character', patch) && row.finalPrompt ? { finalPromptStale: true } : {}) })
              .where(eq(characters.id, row.id))
              .run();
            // The keyframes' wardrobe line comes from the styling (adr-0019).
            if ('styling' in patch) markKeyframesStale(tx, boundShots(tx, { kind: 'character', id: row.id }));
            result.filled.push(row.name);
          }
          result.reused.push(row.name);
        }
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
      if (episodeId !== null) {
        tx.insert(episodeCharacters).values({ episodeId, characterId: row.id }).onConflictDoNothing().run();
        const outfit = item.outfit?.trim();
        if (outfit && dress) (setEpisodeOutfitIfEmpty(tx, episodeId, row.id, outfit) ? result.dressed : result.keptOutfit).push(row.name);
      }
    }
  });
  return result;
}

export function saveExtractedScenes(dramaId: number, episodeId: number | null, items: ExtractedScene[]): SaveResult {
  const result = emptyResult();
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
        if (isClaimed('scene', row.id)) {
          result.claimed.push(label);
        } else {
          const patch = fillEmpty(row, { prompt: item.prompt, lighting: item.lighting });
          if (Object.keys(patch).length > 0) {
            tx.update(scenes)
              .set({ ...patch, ...(touchesPrompt('scene', patch) && row.finalPrompt ? { finalPromptStale: true } : {}) })
              .where(eq(scenes.id, row.id))
              .run();
            if ('lighting' in patch) markKeyframesStale(tx, boundShots(tx, { kind: 'scene', id: row.id }));
            result.filled.push(label);
          }
          result.reused.push(label);
        }
      } else {
        row = tx
          .insert(scenes)
          .values({ dramaId, location, time, prompt: item.prompt?.trim() ?? '', lighting: item.lighting?.trim() ?? '', sortOrder: live.length })
          .returning()
          .get();
        live.push(row);
        result.created.push(label);
      }
      if (episodeId !== null) tx.insert(episodeScenes).values({ episodeId, sceneId: row.id }).onConflictDoNothing().run();
    }
  });
  return result;
}

/**
 * Props are plot-critical: with an episode they are capped at 3 linked to it, counting props already linked, and
 * props beyond the cap are reported as skipped. Existing links are never removed (the creator may have linked them
 * by hand). A design run has no episode and caps its own set in the tool (adr-0024).
 */
export function saveExtractedProps(dramaId: number, episodeId: number | null, items: ExtractedProp[]): SaveResult {
  const result = emptyResult();
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
      episodeId === null
        ? []
        : tx
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
      const overCap = episodeId !== null && !(row && linked.has(row.id)) && linked.size >= MAX_PROPS;
      if ((!row && deleted.has(key)) || overCap) {
        result.skipped.push(name);
        continue;
      }
      if (row) {
        if (isClaimed('prop', row.id)) {
          result.claimed.push(row.name);
        } else {
          const patch = fillEmpty(row, { type: item.type, description: item.description });
          if (Object.keys(patch).length > 0) {
            tx.update(props)
              .set({ ...patch, ...(touchesPrompt('prop', patch) && row.finalPrompt ? { finalPromptStale: true } : {}) })
              .where(eq(props.id, row.id))
              .run();
            result.filled.push(row.name);
          }
          result.reused.push(row.name);
        }
      } else {
        row = tx
          .insert(props)
          .values({ dramaId, name, type: item.type?.trim() ?? '', description: item.description?.trim() ?? '', sortOrder: live.length })
          .returning()
          .get();
        live.push(row);
        result.created.push(name);
      }
      if (episodeId !== null) {
        linked.add(row.id);
        tx.insert(episodeProps).values({ episodeId, propId: row.id }).onConflictDoNothing().run();
      }
    }
  });
  return result;
}

export { withStylePrefix, withoutStylePrefix } from './style';
