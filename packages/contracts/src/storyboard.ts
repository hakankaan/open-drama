import { z } from 'zod';
import { MediaPath, Timestamp } from './common';
import { TaskSummary } from './generation';
import { AgentJob, JobStarted } from './jobs';
import { TextModelOverride } from './agents';
import { SentView } from './references';
import { CharacterViews } from './assets';
import { cleanModelId } from './video-providers';

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
  /** A character's cover (`coverOf`). */
  imagePath: MediaPath.nullable(),
  /**
   * A character's images, from which a video call picks per model (adr-0018). In an episode where it wears another
   * outfit (adr-0023) the full body is that outfit's picture, and the views showing its own clothes are left out.
   */
  views: CharacterViews.optional(),
  /** What a character wears in the shot's episode, when that differs from its own styling (adr-0023). */
  outfit: z.string().optional(),
});
export type ShotAssetRef = z.infer<typeof ShotAssetRef>;

/** One point of a shot check: fine, worth a look, or not judged (nothing to compare with). */
export const QaCheck = z.object({
  result: z.enum(['ok', 'flag', 'skipped']),
  /** One sentence on what was seen, in the content language; '' when skipped. */
  note: z.string(),
});
export type QaCheck = z.infer<typeof QaCheck>;

/**
 * CheckShot's result (adr-0022): a vision model's look at three frames of the video beside the references. A signal,
 * never a gate; it does not judge whether faces match (models do that unreliably).
 */
export const ShotQa = z.object({
  /** The video that was checked; a check of an earlier video is not shown. */
  videoPath: MediaPath,
  checkedAt: Timestamp,
  model: z.string(),
  /** `check` when any point is flagged. */
  verdict: z.enum(['ok', 'check']),
  checks: z.object({
    /** More people than the shot's cast, or one person twice. */
    people: QaCheck,
    /** Clothing unlike the characters' references. */
    outfit: QaCheck,
    /** A setting unlike the scene's reference. */
    scene: QaCheck,
    /** Deformed faces or hands, melting objects, text, logos or watermarks, glitches. */
    artifacts: QaCheck,
  }),
});
export type ShotQa = z.infer<typeof ShotQa>;

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
  /** The keyframe's prompt; empty composes one from the shot when the keyframe is requested. */
  imagePrompt: z.string(),
  videoPrompt: z.string(),
  /** A field the video prompt was written from (duration, description, bindings…) changed since it was written. */
  videoPromptStale: z.boolean(),
  bgmPrompt: z.string(),
  soundEffect: z.string(),
  durationSeconds: z.number(),
  sceneId: z.number().int().nullable(),
  referenceMedia: ReferenceMedia,
  videoPath: MediaPath.nullable(),
  videoDurationSeconds: z.number().nullable(),
  /** The still the shot's video starts from, on a model that takes a first frame. */
  keyframePath: MediaPath.nullable(),
  /**
   * Something the keyframe was drawn from changed since (the cast, the scene, its framing or prompt, an episode
   * outfit): it still goes as the first frame until it is redrawn, removed or kept (adr-0019).
   */
  keyframeStale: z.boolean(),
  /** One unbroken take with the previous shot: its video starts from that shot's last frame (at most two in a row). */
  continuesPrevious: z.boolean(),
  /** The character who speaks the shot's line: one of its bound characters (adr-0021). */
  speakerId: z.number().int().nullable(),
  /** What the speaker says, as spoken, without quotes or stage directions; '' when nobody speaks. */
  line: z.string(),
  /** The line in the speaker's voice; cleared when the line, the speaker or their voice changes. */
  lineAudioPath: MediaPath.nullable(),
  lineAudioSeconds: z.number().nullable(),
  /** The latest check of the shot's current video (adr-0022); null when it was never checked or the video changed since. */
  qa: ShotQa.nullable(),
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
  latestKeyframeTask: TaskSummary.nullable(),
  latestLineAudioTask: TaskSummary.nullable(),
  latestLipSyncTask: TaskSummary.nullable(),
  /**
   * Marked as continuing the previous shot, but its video does not start from that shot's current video (it was
   * generated again, another version was picked, the shots were reordered, or the video predates the mark): the merge
   * cuts there until this shot is generated again (adr-0020).
   */
  continuationStale: z.boolean(),
});
export type ShotCard = z.infer<typeof ShotCard>;

const VEO = /\bveo\b/i;

/**
 * What stops a shot marked as continuing the one before from being one take with it (adr-0020), beside the model's
 * caps, so the API's refusal and the studio's warning agree: Veo makes no continued takes (its shots start from their
 * keyframe or reference images), and a take does not move to another scene. Null when nothing does.
 */
export function continuityBreak(
  shot: { sceneId: number | null },
  previous: { sceneId: number | null },
  model: string | null | undefined,
): 'model' | 'scene' | null {
  if (model && VEO.test(cleanModelId(model))) return 'model';
  if (shot.sceneId !== null && previous.sceneId !== null && shot.sceneId !== previous.sceneId) return 'scene';
  return null;
}

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
  line: text(1000),
}).partial();

/** One of the shot's bound characters, or null for nobody; unbinding the speaker clears it. */
const speakerId = z.number().int().positive().nullable().optional();

/** CreateShot: a manual shot; shotNumber defaults to the next free number. */
export const CreateShot = ShotText.extend({
  episodeId: z.number().int().positive(),
  shotNumber: z.number().int().min(1).max(10_000).optional(),
  durationSeconds: ShotDuration.default(10),
  sceneId: z.number().int().positive().nullable().optional(),
  characterIds: ids.default([]),
  propIds: ids.default([]),
  speakerId,
});
export type CreateShot = z.input<typeof CreateShot>;

/**
 * UpdateShot: any field, bindings (validated against the drama and linked to the episode), uploaded reference
 * media, `videoPath` to make one of the shot's earlier results the current video, or the keyframe.
 */
export const UpdateShot = z.strictObject({
  ...ShotText.shape,
  durationSeconds: ShotDuration.optional(),
  sceneId: z.number().int().positive().nullable().optional(),
  characterIds: ids.optional(),
  propIds: ids.optional(),
  referenceMedia: ReferenceMedia.optional(),
  videoPath: MediaPath.optional(),
  /** An uploaded still to start the video from, or null to start without one. */
  keyframePath: MediaPath.nullable().optional(),
  /** false keeps a keyframe marked stale as it is (the creator judged it still fits). */
  keyframeStale: z.literal(false).optional(),
  continuesPrevious: z.boolean().optional(),
  speakerId,
});
export type UpdateShot = z.input<typeof UpdateShot>;

// Agent- and generation-backed storyboard commands

export const StartVideoPromptBatch = TextModelOverride.extend({
  /** When given, exactly these shots are regenerated; otherwise every shot whose prompt is missing or stale. */
  shotIds: z.array(z.number().int().positive()).min(1).max(500).optional(),
});
export type StartVideoPromptBatch = z.input<typeof StartVideoPromptBatch>;

export const VideoPromptBatchStarted = JobStarted.extend({ total: z.number().int() });
export type VideoPromptBatchStarted = z.infer<typeof VideoPromptBatchStarted>;

export const VideoPromptResult = z.object({ videoPrompt: z.string() });

/** A video seed every provider that takes one accepts (Wan stops at 2^31 - 1). */
export const VideoSeed = z.number().int().min(0).max(2_147_483_647);

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
  /** For a model that takes one (adr-0017); without it a seed is drawn and recorded, so a retake can reuse it. */
  seed: VideoSeed.optional(),
  /** Start from the shot's keyframe where the model takes a first frame (default true); false sends references instead. */
  useKeyframe: z.boolean().optional(),
});
export type RequestShotVideo = z.input<typeof RequestShotVideo>;

export const ShotVideoStarted = z.object({
  taskId: z.number().int(),
  /** `@[Name]` mentions that matched no bound asset; they were sent as plain text. */
  unmatchedMentions: z.array(z.string()),
  /**
   * References left out (asset names, or paths for uploads): bound characters past four and bound assets past five per
   * call (adr-0017), then anything past the provider's limit.
   */
  droppedReferences: z.array(z.string()),
  /**
   * The shot's keyframe: `sent` as the first frame (no reference images go with it), `off` when the request asked for
   * references, `unsupported` when the model takes no first frame or the request carries reference video or audio;
   * null when the shot has none or continues the previous shot.
   */
  keyframe: z.enum(['sent', 'off', 'unsupported']).nullable(),
  /**
   * The shot it continues, whose last frame it starts from; `waiting` while that shot's video is still generating
   * (the task starts when it completes and fails if it fails). Null for a shot that starts a take.
   */
  continues: z.object({ shotNumber: z.number().int(), waiting: z.boolean() }).nullable(),
  /** Pinned voices (adr-0021): the video is made silent and lip-synced to the shot's line audio once it is done. */
  lipSync: z.boolean(),
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
  /** The seed it was made with; null when the model takes none (adr-0017). */
  seed: z.number().int().nullable(),
  /** Bound assets and images this version left out: past the per-call caps (adr-0017) or the model's limit. */
  droppedReferences: z.array(z.string()),
  /** The images each character was sent as, by name (adr-0018); empty for versions made before views. */
  sentViews: z.record(z.string(), z.array(SentView)),
  /** The still the version started from (its keyframe, or the last frame of the shot it continues); null when it was made from references. */
  firstFrame: MediaPath.nullable(),
  /** The number the continued shot had when this version was requested; null when the version started a take. */
  continues: z.number().int().nullable(),
  /** A lip sync of another version to the shot's line audio (adr-0021). */
  lipSynced: z.boolean(),
  createdAt: Timestamp,
  completedAt: Timestamp.nullable(),
  current: z.boolean(),
});
export type ShotVideo = z.infer<typeof ShotVideo>;

/** RequestShotKeyframe: a still of the shot's opening, drawn from its bound assets' images in the episode's image service. */
export const RequestShotKeyframe = z.object({
  /** Replaces the stored keyframe prompt for this request; neither given, one is composed from the shot. */
  prompt: text(8000).optional(),
  model: z.string().trim().max(200).optional(),
  imageServiceId: z.number().int().positive().optional(),
});
export type RequestShotKeyframe = z.input<typeof RequestShotKeyframe>;

/** RequestLineAudio: the shot's line spoken in its speaker's voice by the speech service (adr-0021). */
export const RequestLineAudio = z.object({
  model: z.string().trim().max(200).optional(),
  speechServiceId: z.number().int().positive().optional(),
});
export type RequestLineAudio = z.input<typeof RequestLineAudio>;

/** RequestLipSync: the shot's current video re-synced to its line audio by the lip-sync service (adr-0021). */
export const RequestLipSync = z.object({
  model: z.string().trim().max(200).optional(),
  lipsyncServiceId: z.number().int().positive().optional(),
});
export type RequestLipSync = z.input<typeof RequestLipSync>;

/** CheckShot: the shot's current video looked over by the vision service (adr-0022). */
export const CheckShot = z.object({
  model: z.string().trim().max(200).optional(),
  visionServiceId: z.number().int().positive().optional(),
});
export type CheckShot = z.input<typeof CheckShot>;

/** What the speech service can read lines in: the model's named voices, and whether it clones a voice sample. */
export const SpeechVoices = z.object({
  /** The model a line request without a pick runs; null without a speech service. */
  model: z.string().nullable(),
  voices: z.array(z.string()),
  cloning: z.boolean(),
});
export type SpeechVoices = z.infer<typeof SpeechVoices>;

/** Silence before the line in a lip-synced shot: the speaker draws breath before talking (adr-0021). */
export const LINE_LEAD_IN_SECONDS = 0.5;
/** Room after the line, so a shot grown to fit it does not cut the last word. */
export const LINE_TAIL_SECONDS = 0.5;
