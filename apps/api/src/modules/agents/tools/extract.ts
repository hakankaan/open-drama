import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/client';
import { episodes } from '../../../db/schema';
import { saveExtractedCharacters, saveExtractedProps, saveExtractedScenes } from '../../assets/extraction';
import { defineTool } from '../runtime/tool';
import { CharacterItem, PropItem, SceneItem } from './design';

// The extractor's tools; its read_existing_* tools are the designer's, shared from design.ts (adr-0024).

export const readScriptForExtraction = defineTool({
  id: 'read_script_for_extraction',
  description: "Read the episode's script (or its raw content when no script was saved).",
  input: z.object({}),
  execute: (_input, ctx) => {
    const ep = db.select().from(episodes).where(eq(episodes.id, ctx.episodeId)).get();
    if (!ep) return { error: 'Episode not found' };
    return { episodeNumber: ep.episodeNumber, script: ep.scriptContent?.trim() || ep.content };
  },
});

/** An extracted character may carry the outfit this episode dresses them in (adr-0023), the same text as SetEpisodeOutfit's. */
const DressedCharacter = CharacterItem.extend({ outfit: z.string().max(2000).optional() });

export const saveDedupCharacters = defineTool({
  id: 'save_dedup_characters',
  description:
    'Save every character of this episode. Existing names are linked to the episode, not duplicated; names the creator deleted come back as skipped. An outfit on an existing character dresses them for this episode only, while the episode has no outfit for them yet; a new character needs none, their styling is what this script shows.',
  input: z.object({ items: z.array(DressedCharacter).max(40) }),
  execute: ({ items }, ctx) => saveExtractedCharacters(ctx.dramaId, ctx.episodeId, items),
});

export const saveDedupScenes = defineTool({
  id: 'save_dedup_scenes',
  description: 'Save every scene (location + time) of this episode. Existing ones are linked, not duplicated; scenes the creator deleted come back as skipped.',
  input: z.object({ items: z.array(SceneItem).max(40) }),
  execute: ({ items }, ctx) => saveExtractedScenes(ctx.dramaId, ctx.episodeId, items),
});

export const saveDedupProps = defineTool({
  id: 'save_dedup_props',
  description: 'Save the plot-critical props of this episode (0 to 3). An empty list is valid; props the creator deleted come back as skipped.',
  input: z.object({ items: z.array(PropItem).max(10) }),
  execute: ({ items }, ctx) => saveExtractedProps(ctx.dramaId, ctx.episodeId, items),
});
