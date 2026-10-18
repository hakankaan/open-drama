import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { DESIGN_CAPS, type AssetKind, type DesignTarget } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { characters, props, scenes } from '../../../db/schema';
import { saveExtractedCharacters, saveExtractedProps, saveExtractedScenes, type SaveResult } from '../../assets/extraction';
import { writeDescription } from '../../assets/service';
import { getPresetByValue } from '../../configuration/presets';
import { mergeProgress } from '../../jobs/run-job';
import { getDramaRow, touchDrama } from '../../production/dramas';
import { episodeStates, type EpisodeState } from '../../production/episodes';
import { fitRecaps } from '../../production/series';
import type { DramaAgentContext } from '../runtime/context';
import { defineDramaTool } from '../runtime/tool';

// The asset designer's tools (adr-0024): the story to design from, the drama's existing assets of a kind (shared with
// the extractor), one save per kind that takes the whole set, and one describe per kind for a single asset.

interface StoryEpisode {
  episodeNumber: number;
  title: string;
  state: EpisodeState['state'];
  synopsis: string;
  recap?: string;
}

/**
 * The designer's source: the premise, the visual style by name (never to be written into a field), the outline with
 * its revision, and every episode's synopsis with the recap of the written ones, the oldest dropped beyond the series
 * budget (adr-0014). Inside a design job the outline revision read here lands on the job's progress, so the studio
 * can say when the outline moved on after the design.
 */
export const readStoryForDesign = defineDramaTool({
  id: 'read_story_for_design',
  description:
    "Read the project's premise (title, synopsis, genre, tags, whether the episodes continue one story), its visual style's name, the story outline, and every episode with its synopsis and, for written ones, its recap. omittedRecaps names the episodes whose recap was left out for size.",
  input: z.object({}),
  execute: (_input, ctx) => {
    const drama = getDramaRow(ctx.dramaId);
    const premise = {
      title: drama.title,
      synopsis: drama.description,
      genre: drama.genre,
      tags: drama.tags,
      serial: drama.serial,
      style: getPresetByValue(drama.style)?.name ?? drama.style,
    };
    const episodes = episodeStates(ctx.dramaId).map((e): StoryEpisode => {
      const entry: StoryEpisode = { episodeNumber: e.episodeNumber, title: e.title, state: e.state, synopsis: e.synopsis };
      if (e.recap) entry.recap = e.recap;
      return entry;
    });
    const base = { premise, outline: drama.outline, outlineRevision: drama.outlineRevision };
    const omittedRecaps = fitRecaps(episodes, base);
    if (ctx.jobId !== undefined) mergeProgress(ctx.jobId, { outlineRevision: drama.outlineRevision });
    return { ...base, episodes, ...(omittedRecaps.length > 0 ? { omittedRecaps } : {}) };
  },
});

export const readExistingCharacters = defineDramaTool({
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

export const readExistingScenes = defineDramaTool({
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

export const readExistingProps = defineDramaTool({
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

/** The item shapes of a bulk save, shared by the extractor's and the designer's save tools. */
export const CharacterItem = z.object({
  name: z.string().min(1).max(80),
  role: text(80),
  appearance: text(4000),
  styling: text(4000),
  description: text(4000),
});
export const SceneItem = z.object({ location: z.string().min(1).max(120), time: text(60), prompt: text(4000), lighting: text(1000) });
export const PropItem = z.object({ name: z.string().min(1).max(80), type: text(60), description: text(4000) });

/**
 * A designed asset carries the field its look is drawn from (adr-0024): the extractor may catalogue a name alone,
 * the designer may not. The cast and the places are never empty; a story may need no plot-critical prop.
 */
const DesignedCharacter = CharacterItem.extend({ appearance: z.string().min(1).max(4000) });
const DesignedScene = SceneItem.extend({ prompt: z.string().min(1).max(4000) });
const DesignedProp = PropItem.extend({ description: z.string().min(1).max(4000) });

/** What a design save reports to the agent and to the job (DesignProgress): skipped covers deleted and claimed names. */
const designed = (result: SaveResult, overflow: string[]) => ({
  saved: result.created.length,
  filled: result.filled.length,
  skipped: [...result.skipped, ...result.claimed],
  overflow,
});

/**
 * SaveDesigned*: one call with the whole set, capped here (DESIGN_CAPS) with the overflow named so the agent does
 * not retry; the extraction merge with no episode (adr-0024), so nothing is linked. The counts land on the job's
 * progress and are the run's outcome.
 */
function saveDesigned<T extends { name?: string; location?: string }>(
  target: DesignTarget,
  ctx: { dramaId: number; jobId?: number },
  items: T[],
  save: (kept: T[]) => SaveResult,
) {
  const cap = DESIGN_CAPS[target];
  const overflow = items.slice(cap).map((i) => (i.name ?? i.location ?? '').trim()).filter(Boolean);
  const result = designed(save(items.slice(0, cap)), overflow);
  if (ctx.jobId !== undefined) mergeProgress(ctx.jobId, result);
  if (result.saved > 0 || result.filled > 0) touchDrama(ctx.dramaId);
  return result;
}

const capNote = (target: DesignTarget, one: string) =>
  `Call once with every ${one} of the project, at most ${DESIGN_CAPS[target]}: any beyond that are named in overflow and not saved; do not call again for them. Existing names get their empty fields filled and keep the rest; names the creator deleted and assets whose image is being made come back as skipped.`;

export const saveDesignedCharacters = defineDramaTool({
  id: 'save_designed_characters',
  description: `Save the designed cast on the project. ${capNote('characters', 'character')}`,
  input: z.object({ items: z.array(DesignedCharacter).min(1).max(40) }),
  execute: ({ items }, ctx) => saveDesigned('characters', ctx, items, (kept) => saveExtractedCharacters(ctx.dramaId, null, kept)),
});

export const saveDesignedScenes = defineDramaTool({
  id: 'save_designed_scenes',
  description: `Save the designed places (location + time of day) on the project. ${capNote('scenes', 'scene')}`,
  input: z.object({ items: z.array(DesignedScene).min(1).max(40) }),
  execute: ({ items }, ctx) => saveDesigned('scenes', ctx, items, (kept) => saveExtractedScenes(ctx.dramaId, null, kept)),
});

export const saveDesignedProps = defineDramaTool({
  id: 'save_designed_props',
  description: `Save the designed plot-critical props on the project; an empty list is valid. ${capNote('props', 'prop')}`,
  input: z.object({ items: z.array(DesignedProp).max(40) }),
  execute: ({ items }, ctx) => saveDesigned('props', ctx, items, (kept) => saveExtractedProps(ctx.dramaId, null, kept)),
});

/**
 * Describe*: the describable fields of the run's one target (DescribeAsset, adr-0024). The target and whether its
 * filled fields may be written over come from the run's context, never from the model; the write keeps the filled
 * fields unless the run replaces, and names what it wrote and what it kept.
 */
function describeOne(kind: AssetKind, input: Record<string, string | undefined>, ctx: DramaAgentContext) {
  const target = ctx.target;
  if (!target || target.kind !== kind) return { error: `This run describes no ${kind}` };
  const { written, kept } = writeDescription(kind, target.id, input, ctx.replace === true);
  return { written, kept };
}

const describeNote = 'The filled fields are kept unless the request says to write them afresh; the reply names what was written and what was kept. The name of the asset is never written.';

export const describeCharacter = defineDramaTool({
  id: 'describe_character',
  description: `Write the describing fields of the one character named in the request, from the story. ${describeNote}`,
  input: z.object({ role: text(80), appearance: text(4000), styling: text(4000), description: text(4000) }),
  execute: (input, ctx) => describeOne('character', input, ctx),
});

export const describeScene = defineDramaTool({
  id: 'describe_scene',
  description: `Write the describing fields (set dressing as prompt, and lighting) of the one scene named in the request, from the story. ${describeNote}`,
  input: z.object({ prompt: text(4000), lighting: text(1000) }),
  execute: (input, ctx) => describeOne('scene', input, ctx),
});

export const describeProp = defineDramaTool({
  id: 'describe_prop',
  description: `Write the describing fields of the one prop named in the request, from the story. ${describeNote}`,
  input: z.object({ type: text(60), description: text(4000) }),
  execute: (input, ctx) => describeOne('prop', input, ctx),
});
