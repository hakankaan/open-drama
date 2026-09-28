import { z } from 'zod';
import { MediaPath, Timestamp } from './common';
import { TaskSummary } from './generation';
import { AgentJob, JobStarted } from './jobs';
import { TextModelOverride } from './agents';

/** Shot duration bounds (domain Shot invariant); agents target 8-15 s. */
export const SHOT_DURATION_MIN = 2;
export const SHOT_DURATION_MAX = 30;
export const ShotDuration = z.number().min(SHOT_DURATION_MIN).max(SHOT_DURATION_MAX);

/** Uploaded per-shot reference material, sent after the bound assets' images. */
export const ReferenceMedia = z.object({
  imageUrls: z.array(MediaPath).max(9).optional(),
  videoUrls: z.array(MediaPath).max(3).optional(),
  audioUrls: z.array(MediaPath).max(3).optional(),
});
export type ReferenceMedia = z.infer<typeof ReferenceMedia>;

/** A bound asset as the workbench shows it: enough to render the reference strip and the mention picker. */
export const ShotAssetRef = z.object({
  id: z.number().int(),
  name: z.string(),
  imagePath: MediaPath.nullable(),
});
export type ShotAssetRef = z.infer<typeof ShotAssetRef>;

export const Shot = z.object({
  id: z.number().int(),
  episodeId: z.number().int(),
  shotNumber: z.number().int(),
  title: z.string(),
  shotType: z.string(),
  angle: z.string(),
  movement: z.string(),
  location: z.string(),
  time: z.string(),
  description: z.string(),
  result: z.string(),
  atmosphere: z.string(),
  imagePrompt: z.string(),
  videoPrompt: z.string(),
  bgmPrompt: z.string(),
  soundEffect: z.string(),
  durationSeconds: z.number(),
  sceneId: z.number().int().nullable(),
  referenceMedia: ReferenceMedia,
  videoPath: MediaPath.nullable(),
  videoDurationSeconds: z.number().nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Shot = z.infer<typeof Shot>;

/**
 * One row of EpisodeShotList. Bindings are in binding order (narrators left out); latestVideoTask is the single
 * source of the shot's generating / failed state.
 */
export const ShotCard = Shot.extend({
  bindings: z.object({
    scene: ShotAssetRef.nullable(),
    characters: z.array(ShotAssetRef),
    props: z.array(ShotAssetRef),
  }),
  latestVideoTask: TaskSummary.nullable(),
});
export type ShotCard = z.infer<typeof ShotCard>;

export const EpisodeShotList = z.object({
  episodeId: z.number().int(),
  shots: z.array(ShotCard),
  breakdown: AgentJob.nullable(),
  videoPromptBatch: AgentJob.nullable(),
  generatedCount: z.number().int(),
  totalDurationSeconds: z.number(),
});
export type EpisodeShotList = z.infer<typeof EpisodeShotList>;

const text = (max: number) => z.string().trim().max(max);
const ids = z.array(z.number().int().positive()).max(50);

/** The shot's text fields; omitted ones keep their stored value (or the empty default on create). */
const ShotText = z.object({
  title: text(200),
  shotType: text(60),
  angle: text(60),
  movement: text(120),
  location: text(200),
  time: text(60),
  description: text(8000),
  result: text(2000),
  atmosphere: text(2000),
  imagePrompt: text(8000),
  videoPrompt: text(8000),
  bgmPrompt: text(1000),
  soundEffect: text(1000),
}).partial();

/** CreateShot: a manual shot; shotNumber defaults to the next free number. */
export const CreateShot = ShotText.extend({
  episodeId: z.number().int().positive(),
  shotNumber: z.number().int().min(1).max(10_000).optional(),
  durationSeconds: ShotDuration.default(10),
  sceneId: z.number().int().positive().nullable().optional(),
  characterIds: ids.default([]),
  propIds: ids.default([]),
});
export type CreateShot = z.input<typeof CreateShot>;

/**
 * UpdateShot: any field, bindings (validated against the drama and linked to the episode), uploaded reference
 * media, or `videoPath` to make one of the shot's earlier results the current video.
 */
export const UpdateShot = z.strictObject({
  ...ShotText.shape,
  durationSeconds: ShotDuration.optional(),
  sceneId: z.number().int().positive().nullable().optional(),
  characterIds: ids.optional(),
  propIds: ids.optional(),
  referenceMedia: ReferenceMedia.optional(),
  videoPath: MediaPath.optional(),
});
export type UpdateShot = z.input<typeof UpdateShot>;

// Agent- and generation-backed storyboard commands

export const StartVideoPromptBatch = TextModelOverride.extend({
  /** When given, exactly these shots are regenerated; otherwise every shot without a prompt is filled. */
  shotIds: z.array(z.number().int().positive()).min(1).max(500).optional(),
});
export type StartVideoPromptBatch = z.input<typeof StartVideoPromptBatch>;

export const VideoPromptBatchStarted = JobStarted.extend({ total: z.number().int() });
export type VideoPromptBatchStarted = z.infer<typeof VideoPromptBatchStarted>;

export const VideoPromptResult = z.object({ videoPrompt: z.string() });

/** RequestShotVideo. Media references are stored paths (`static/…`) or http(s) URLs. */
export const RequestShotVideo = z.object({
  prompt: text(8000).optional(),
  model: z.string().trim().max(200).optional(),
  videoServiceId: z.number().int().positive().optional(),
  durationSeconds: ShotDuration.optional(),
  extraReferenceImageUrls: z.array(z.string().max(2000)).max(9).optional(),
  referenceVideoUrls: z.array(z.string().max(2000)).max(5).optional(),
  referenceAudioUrls: z.array(z.string().max(2000)).max(5).optional(),
  generateAudio: z.boolean().optional(),
});
export type RequestShotVideo = z.input<typeof RequestShotVideo>;

export const ShotVideoStarted = z.object({
  taskId: z.number().int(),
  /** `@[Name]` mentions that matched no bound asset; they were sent as plain text. */
  unmatchedMentions: z.array(z.string()),
  /** References left out because the provider's limit was reached (asset names, or paths for uploads). */
  droppedReferences: z.array(z.string()),
});
export type ShotVideoStarted = z.infer<typeof ShotVideoStarted>;

/** One completed video of a shot (history), newest first. */
export const ShotVideo = z.object({
  taskId: z.number().int(),
  videoPath: MediaPath,
  durationSeconds: z.number().nullable(),
  provider: z.string(),
  model: z.string(),
  prompt: z.string(),
  createdAt: Timestamp,
  completedAt: Timestamp.nullable(),
  current: z.boolean(),
});
export type ShotVideo = z.infer<typeof ShotVideo>;
