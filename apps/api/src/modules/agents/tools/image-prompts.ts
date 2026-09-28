import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/client';
import { characters, props, scenes } from '../../../db/schema';
import { withStylePrefix } from '../../assets/extraction';
import { defineTool } from '../runtime/tool';

const ids = z.object({ ids: z.array(z.number().int()).max(50).optional().describe('Ids to read; omit for all') });

export const readCharacters = defineTool({
  id: 'read_characters',
  description: "Read characters of the drama with their describing fields.",
  input: ids,
  execute: ({ ids: wanted }, ctx) => ({
    items: db
      .select({ id: characters.id, name: characters.name, role: characters.role, appearance: characters.appearance, styling: characters.styling, description: characters.description })
      .from(characters)
      .where(and(eq(characters.dramaId, ctx.dramaId), isNull(characters.deletedAt), wanted?.length ? inArray(characters.id, wanted) : undefined))
      .all(),
  }),
});

export const readScenes = defineTool({
  id: 'read_scenes',
  description: 'Read scenes of the drama with their set dressing and lighting.',
  input: ids,
  execute: ({ ids: wanted }, ctx) => ({
    items: db
      .select({ id: scenes.id, location: scenes.location, time: scenes.time, prompt: scenes.prompt, lighting: scenes.lighting })
      .from(scenes)
      .where(and(eq(scenes.dramaId, ctx.dramaId), isNull(scenes.deletedAt), wanted?.length ? inArray(scenes.id, wanted) : undefined))
      .all(),
  }),
});

export const readProps = defineTool({
  id: 'read_props',
  description: 'Read props of the drama with their physical description.',
  input: ids,
  execute: ({ ids: wanted }, ctx) => ({
    items: db
      .select({ id: props.id, name: props.name, type: props.type, description: props.description })
      .from(props)
      .where(and(eq(props.dramaId, ctx.dramaId), isNull(props.deletedAt), wanted?.length ? inArray(props.id, wanted) : undefined))
      .all(),
  }),
});

const prompt = z.string().min(10).max(8000);

/** Save*FinalPrompt: the style fragment is prepended here, never by the model; the stale flag is cleared. */
export const saveCharacterFinalPrompt = defineTool({
  id: 'save_character_final_prompt',
  description: 'Save the turnaround-sheet prompt of one character.',
  input: z.object({ characterId: z.number().int(), prompt }),
  execute: ({ characterId, prompt: text }, ctx) => {
    if (ctx.target && (ctx.target.kind !== 'character' || ctx.target.id !== characterId)) {
      return { error: `This run writes the prompt of ${ctx.target.kind} ${ctx.target.id} only` };
    }
    const row = db
      .update(characters)
      .set({ finalPrompt: withStylePrefix(ctx.dramaId, text), finalPromptStale: false })
      .where(and(eq(characters.id, characterId), eq(characters.dramaId, ctx.dramaId), isNull(characters.deletedAt)))
      .returning({ id: characters.id })
      .get();
    return row ? { saved: true } : { error: `No character ${characterId} in this drama` };
  },
});

export const saveSceneFinalPrompt = defineTool({
  id: 'save_scene_final_prompt',
  description: 'Save the establishing-shot prompt of one scene (no people).',
  input: z.object({ sceneId: z.number().int(), prompt }),
  execute: ({ sceneId, prompt: text }, ctx) => {
    if (ctx.target && (ctx.target.kind !== 'scene' || ctx.target.id !== sceneId)) {
      return { error: `This run writes the prompt of ${ctx.target.kind} ${ctx.target.id} only` };
    }
    const row = db
      .update(scenes)
      .set({ finalPrompt: withStylePrefix(ctx.dramaId, text), finalPromptStale: false })
      .where(and(eq(scenes.id, sceneId), eq(scenes.dramaId, ctx.dramaId), isNull(scenes.deletedAt)))
      .returning({ id: scenes.id })
      .get();
    return row ? { saved: true } : { error: `No scene ${sceneId} in this drama` };
  },
});

export const savePropFinalPrompt = defineTool({
  id: 'save_prop_final_prompt',
  description: 'Save the product-shot prompt of one prop.',
  input: z.object({ propId: z.number().int(), prompt }),
  execute: ({ propId, prompt: text }, ctx) => {
    if (ctx.target && (ctx.target.kind !== 'prop' || ctx.target.id !== propId)) {
      return { error: `This run writes the prompt of ${ctx.target.kind} ${ctx.target.id} only` };
    }
    const row = db
      .update(props)
      .set({ finalPrompt: withStylePrefix(ctx.dramaId, text), finalPromptStale: false })
      .where(and(eq(props.id, propId), eq(props.dramaId, ctx.dramaId), isNull(props.deletedAt)))
      .returning({ id: props.id })
      .get();
    return row ? { saved: true } : { error: `No prop ${propId} in this drama` };
  },
});
