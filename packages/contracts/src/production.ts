import { z } from 'zod';
import {
  AspectRatio,
  DramaStatus,
  EpisodeStatus,
  MediaPath,
  PageQuery,
  paginated,
  ProviderName,
  Resolution,
  StylePresetValueRef,
  Timestamp,
} from './common';

// Dramas

export const Drama = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string(),
  genre: z.string(),
  style: z.string(),
  aspectRatio: AspectRatio,
  status: DramaStatus,
  tags: z.array(z.string()),
  thumbnail: MediaPath.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Drama = z.infer<typeof Drama>;

/** A DramaList row. */
export const DramaListItem = Drama.extend({
  episodeCount: z.number().int(),
  characterCount: z.number().int(),
  sceneCount: z.number().int(),
});
export type DramaListItem = z.infer<typeof DramaListItem>;

export const DramaListResponse = paginated(DramaListItem);
export type DramaListResponse = z.infer<typeof DramaListResponse>;

export const DramaListQuery = PageQuery.extend({
  status: DramaStatus.optional(),
  q: z.string().trim().max(200).optional(),
});

export const DramaStats = z.object({
  total: z.number().int(),
  byStatus: z.array(z.object({ status: DramaStatus, count: z.number().int() })),
});
export type DramaStats = z.infer<typeof DramaStats>;

const tags = z.array(z.string().trim().min(1).max(40)).max(20);

export const CreateDrama = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(''),
  genre: z.string().trim().max(60).default(''),
  style: StylePresetValueRef,
  aspectRatio: AspectRatio.default('16:9'),
  tags: tags.default([]),
});
export type CreateDrama = z.input<typeof CreateDrama>;

/** aspectRatio is fixed at creation, so it is not accepted here (a strict schema rejects it). */
export const UpdateDrama = z.strictObject({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  genre: z.string().trim().max(60).optional(),
  style: StylePresetValueRef.optional(),
  status: DramaStatus.optional(),
  tags: tags.optional(),
});
export type UpdateDrama = z.input<typeof UpdateDrama>;

// Episodes

export const Episode = z.object({
  id: z.number().int(),
  dramaId: z.number().int(),
  episodeNumber: z.number().int(),
  title: z.string(),
  description: z.string(),
  content: z.string(),
  scriptContent: z.string().nullable(),
  status: EpisodeStatus,
  resolution: Resolution,
  imageServiceId: z.number().int().nullable(),
  videoServiceId: z.number().int().nullable(),
  filmPath: MediaPath.nullable(),
  filmDurationSeconds: z.number().nullable(),
  durationSeconds: z.number(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Episode = z.infer<typeof Episode>;

/** The service an episode will use for a type: its lock when still active, otherwise the fallback. */
export const LockedService = z.object({
  id: z.number().int(),
  name: z.string(),
  provider: ProviderName,
  defaultModel: z.string().nullable(),
  /** false when the locked service is gone or inactive and this is the fallback. */
  locked: z.boolean(),
});
export type LockedService = z.infer<typeof LockedService>;

export const EpisodeView = Episode.extend({
  services: z.object({ image: LockedService.nullable(), video: LockedService.nullable() }),
});
export type EpisodeView = z.infer<typeof EpisodeView>;

/** Episode card on the project page. */
export const EpisodeSummary = Episode.omit({ content: true, scriptContent: true }).extend({
  hasContent: z.boolean(),
  hasScript: z.boolean(),
  shotCount: z.number().int(),
});
export type EpisodeSummary = z.infer<typeof EpisodeSummary>;

export const DramaDetail = Drama.extend({
  episodes: z.array(EpisodeSummary),
  counts: z.object({ characters: z.number().int(), scenes: z.number().int(), props: z.number().int() }),
});
export type DramaDetail = z.infer<typeof DramaDetail>;

export const CreateEpisode = z.object({
  dramaId: z.number().int().positive(),
  title: z.string().trim().max(120).optional(),
  resolution: Resolution.default('720p'),
  imageServiceId: z.number().int().positive().optional(),
  videoServiceId: z.number().int().positive().optional(),
});
export type CreateEpisode = z.input<typeof CreateEpisode>;

/** Field-based dispatch: content → UpdateEpisodeContent, scriptContent → SaveScript, resolution, status. */
export const UpdateEpisode = z.strictObject({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  content: z.string().max(200_000).optional(),
  scriptContent: z.string().max(400_000).optional(),
  resolution: Resolution.optional(),
  status: EpisodeStatus.optional(),
});
export type UpdateEpisode = z.input<typeof UpdateEpisode>;

// EpisodePipelineStatus (the stage rail, derived on read)

export const StepState = z.enum(['empty', 'ready', 'in_progress', 'done']);
export type StepState = z.infer<typeof StepState>;

export const StepStatus = z.object({
  state: StepState,
  done: z.number().int(),
  total: z.number().int(),
});
export type StepStatus = z.infer<typeof StepStatus>;

export const EpisodePipelineStatus = z.object({
  episodeId: z.number().int(),
  script: StepStatus,
  characters: StepStatus,
  scenes: StepStatus,
  props: StepStatus,
  shots: StepStatus,
  videos: StepStatus,
  merge: StepStatus,
  completed: z.boolean(),
});
export type EpisodePipelineStatus = z.infer<typeof EpisodePipelineStatus>;
