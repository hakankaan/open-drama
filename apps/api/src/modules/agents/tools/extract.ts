import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/client';
import { characters, episodes, props, scenes } from '../../../db/schema';
import { saveExtractedCharacters, saveExtractedProps, saveExtractedScenes } from '../../assets/extraction';
import { defineTool } from '../runtime/tool';

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

export const readExistingCharacters = defineTool({
  id: 'read_existing_characters',
  description: 'List the characters the drama already has. Reuse their exact names for anyone who appears again.',
  input: z.object({}),
  execute: (_input, ctx) => ({
    items: db
      .select({ name: characters.name, role: characters.role, appearance: characters.appearance, styling: characters.styling })
      .from(characters)
      .where(and(eq(characters.dramaId, ctx.dramaId), isNull(characters.deletedAt)))
      .all(),
  }),
});

export const readExistingScenes = defineTool({
  id: 'read_existing_scenes',
  description: 'List the scenes (location + time) the drama already has. Reuse them for places that appear again.',
  input: z.object({}),
  execute: (_input, ctx) => ({
    items: db
      .select({ location: scenes.location, time: scenes.time, prompt: scenes.prompt, lighting: scenes.lighting })
      .from(scenes)
      .where(and(eq(scenes.dramaId, ctx.dramaId), isNull(scenes.deletedAt)))
      .all(),
  }),
});

export const readExistingProps = defineTool({
  id: 'read_existing_props',
  description: 'List the props the drama already has. Reuse their exact names for objects that appear again.',
  input: z.object({}),
  execute: (_input, ctx) => ({
    items: db
      .select({ name: props.name, type: props.type, description: props.description })
      .from(props)
      .where(and(eq(props.dramaId, ctx.dramaId), isNull(props.deletedAt)))
      .all(),
  }),
});

const text = (max: number) => z.string().max(max).optional();

export const saveDedupCharacters = defineTool({
  id: 'save_dedup_characters',
  description: 'Save every character of this episode. Existing names are linked to the episode, not duplicated.',
  input: z.object({
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(80),
          role: text(80),
          appearance: text(4000),
          styling: text(4000),
          description: text(4000),
        }),
      )
      .max(40),
  }),
  execute: ({ items }, ctx) => saveExtractedCharacters(ctx.dramaId, ctx.episodeId, items),
});

export const saveDedupScenes = defineTool({
  id: 'save_dedup_scenes',
  description: 'Save every scene (location + time) of this episode. Existing ones are linked, not duplicated.',
  input: z.object({
    items: z
      .array(z.object({ location: z.string().min(1).max(120), time: text(60), prompt: text(4000), lighting: text(1000) }))
      .max(40),
  }),
  execute: ({ items }, ctx) => saveExtractedScenes(ctx.dramaId, ctx.episodeId, items),
});

export const saveDedupProps = defineTool({
  id: 'save_dedup_props',
  description: 'Save the plot-critical props of this episode (0 to 3). An empty list is valid.',
  input: z.object({
    items: z.array(z.object({ name: z.string().min(1).max(80), type: text(60), description: text(4000) })).max(10),
  }),
  execute: ({ items }, ctx) => saveExtractedProps(ctx.dramaId, ctx.episodeId, items),
});
