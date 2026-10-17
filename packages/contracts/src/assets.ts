import { z } from 'zod';
import { ExtractionTarget, MediaPath, Timestamp } from './common';
import { TaskSummary } from './generation';
import { AgentJob } from './jobs';

export const AssetKind = z.enum(['character', 'scene', 'prop']);
export type AssetKind = z.infer<typeof AssetKind>;

const base = {
  id: z.number().int(),
  dramaId: z.number().int(),
  finalPrompt: z.string().nullable(),
  finalPromptStale: z.boolean(),
  imagePath: MediaPath.nullable(),
  sortOrder: z.number().int(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  latestImageTask: TaskSummary.nullable(),
};

/**
 * A character's reference images (adr-0018): separate views, the headshot first and the others drawn from it, plus a
 * multi-view sheet (one generated before views existed, or uploaded).
 */
export const CharacterView = z.enum(['headshot', 'body', 'side', 'back', 'sheet']);
export type CharacterView = z.infer<typeof CharacterView>;

/** The views the studio generates; a sheet is only kept, uploaded, or composed for a video that needs one. */
export const GeneratedView = z.enum(['headshot', 'body', 'side', 'back']);
export type GeneratedView = z.infer<typeof GeneratedView>;

export const CharacterViews = z.object({
  headshot: MediaPath.nullable(),
  body: MediaPath.nullable(),
  side: MediaPath.nullable(),
  back: MediaPath.nullable(),
  sheet: MediaPath.nullable(),
});
export type CharacterViews = z.infer<typeof CharacterViews>;

/**
 * The view that stands for a character where a single image is shown (cards, shot strips, readiness) or sent (a video
 * call with room for one image): its headshot, else its full body, its sheet, a side or a back view.
 */
export const coverViewOf = (v: CharacterViews): CharacterView | null =>
  (['headshot', 'body', 'sheet', 'side', 'back'] as const).find((k) => v[k]) ?? null;

export const coverOf = (v: CharacterViews): string | null => {
  const view = coverViewOf(v);
  return view ? v[view] : null;
};

export const CharacterCard = z.object({
  ...base,
  /** The cover (`coverOf`); the images themselves are in `views`. */
  views: CharacterViews,
  name: z.string(),
  role: z.string(),
  description: z.string(),
  appearance: z.string(),
  styling: z.string(),
  /** The speech model's voice the character's lines are read in; '' for none (adr-0021). */
  voice: z.string(),
  /** A recording of the character's voice: cloned by speech models that take one, else sent as reference audio. */
  voiceSamplePath: MediaPath.nullable(),
});
export type CharacterCard = z.infer<typeof CharacterCard>;

export const SceneCard = z.object({
  ...base,
  location: z.string(),
  time: z.string(),
  prompt: z.string(),
  lighting: z.string(),
});
export type SceneCard = z.infer<typeof SceneCard>;

export const PropCard = z.object({
  ...base,
  name: z.string(),
  type: z.string(),
  description: z.string(),
});
export type PropCard = z.infer<typeof PropCard>;

export const DramaAssetLibrary = z.object({
  dramaId: z.number().int(),
  characters: z.array(CharacterCard),
  scenes: z.array(SceneCard),
  props: z.array(PropCard),
});
export type DramaAssetLibrary = z.infer<typeof DramaAssetLibrary>;

export const EpisodeAssets = z.object({
  episodeId: z.number().int(),
  characters: z.array(CharacterCard),
  scenes: z.array(SceneCard),
  props: z.array(PropCard),
  extraction: z.record(ExtractionTarget, AgentJob.nullable()),
});
export type EpisodeAssets = z.infer<typeof EpisodeAssets>;

const text = (max: number) => z.string().trim().max(max);
const link = { dramaId: z.number().int().positive(), episodeId: z.number().int().positive().optional() };

export const CreateCharacter = z.object({
  ...link,
  name: text(80).min(1),
  role: text(80).default(''),
  description: text(4000).default(''),
  appearance: text(4000).default(''),
  styling: text(4000).default(''),
});
export type CreateCharacter = z.input<typeof CreateCharacter>;

export const CreateScene = z.object({
  ...link,
  location: text(120).min(1),
  time: text(60).default(''),
  prompt: text(4000).default(''),
  lighting: text(1000).default(''),
});
export type CreateScene = z.input<typeof CreateScene>;

export const CreateProp = z.object({
  ...link,
  name: text(80).min(1),
  type: text(60).default(''),
  description: text(4000).default(''),
});
export type CreateProp = z.input<typeof CreateProp>;

/**
 * Updates: describing-field edits keep finalPrompt and set finalPromptStale; an explicit finalPrompt in the same
 * request wins and clears the flag. imagePath attaches an uploaded or generated image (null detaches it); a
 * character's images are attached per view.
 */
const common = {
  finalPrompt: text(8000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
};
const imagePath = MediaPath.nullable().optional();

export const UpdateCharacter = z.strictObject({
  name: text(80).min(1).optional(),
  role: text(80).optional(),
  description: text(4000).optional(),
  appearance: text(4000).optional(),
  styling: text(4000).optional(),
  views: CharacterViews.partial().strict().optional(),
  /** Changing the voice or its sample clears the line audio of the shots the character speaks in. */
  voice: text(80).optional(),
  voiceSamplePath: MediaPath.nullable().optional(),
  ...common,
});
export type UpdateCharacter = z.input<typeof UpdateCharacter>;

export const UpdateScene = z.strictObject({
  location: text(120).min(1).optional(),
  time: text(60).optional(),
  prompt: text(4000).optional(),
  lighting: text(1000).optional(),
  imagePath,
  ...common,
});
export type UpdateScene = z.input<typeof UpdateScene>;

export const UpdateProp = z.strictObject({
  name: text(80).min(1).optional(),
  type: text(60).optional(),
  description: text(4000).optional(),
  imagePath,
  ...common,
});
export type UpdateProp = z.input<typeof UpdateProp>;

// Agent- and generation-backed asset commands

export const StartExtraction = z.object({
  target: ExtractionTarget,
  model: z.string().trim().max(200).optional(),
  textServiceId: z.number().int().positive().optional(),
});
export type StartExtraction = z.input<typeof StartExtraction>;

/** Generate*FinalPrompt: runs the prompt generator in the episode's context; synchronous. */
export const GenerateFinalPrompt = z.object({
  episodeId: z.number().int().positive(),
  force: z.boolean().optional(),
  model: z.string().trim().max(200).optional(),
  textServiceId: z.number().int().positive().optional(),
});
export type GenerateFinalPrompt = z.input<typeof GenerateFinalPrompt>;

export const FinalPromptResult = z.object({ finalPrompt: z.string() });

/**
 * Request*Image: ensures the final prompt (text model), then submits an image task (image model). A character
 * generates the given views in order, the headshot first (adr-0018); default headshot and full body.
 */
export const RequestAssetImage = z.object({
  episodeId: z.number().int().positive(),
  views: z
    .array(GeneratedView)
    .min(1)
    .max(4)
    .refine((v) => new Set(v).size === v.length, 'Each view at most once')
    .optional(),
  model: z.string().trim().max(200).optional(),
  imageServiceId: z.number().int().positive().optional(),
  textModel: z.string().trim().max(200).optional(),
  textServiceId: z.number().int().positive().optional(),
});
export type RequestAssetImage = z.input<typeof RequestAssetImage>;

export const TaskStarted = z.object({ taskId: z.number().int() });
export type TaskStarted = z.infer<typeof TaskStarted>;
