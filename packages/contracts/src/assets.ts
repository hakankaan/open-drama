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

export const CharacterCard = z.object({
  ...base,
  name: z.string(),
  role: z.string(),
  description: z.string(),
  appearance: z.string(),
  styling: z.string(),
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
 * request wins and clears the flag. imagePath attaches an uploaded or generated image (null detaches it).
 */
const common = {
  finalPrompt: text(8000).nullable().optional(),
  imagePath: MediaPath.nullable().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
};

export const UpdateCharacter = z.strictObject({
  name: text(80).min(1).optional(),
  role: text(80).optional(),
  description: text(4000).optional(),
  appearance: text(4000).optional(),
  styling: text(4000).optional(),
  ...common,
});
export type UpdateCharacter = z.input<typeof UpdateCharacter>;

export const UpdateScene = z.strictObject({
  location: text(120).min(1).optional(),
  time: text(60).optional(),
  prompt: text(4000).optional(),
  lighting: text(1000).optional(),
  ...common,
});
export type UpdateScene = z.input<typeof UpdateScene>;

export const UpdateProp = z.strictObject({
  name: text(80).min(1).optional(),
  type: text(60).optional(),
  description: text(4000).optional(),
  ...common,
});
export type UpdateProp = z.input<typeof UpdateProp>;
