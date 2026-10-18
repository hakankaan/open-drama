import { z } from 'zod';
import { DesignTarget, ExtractionTarget, JobKind, JobStatus, Timestamp } from './common';

/** Which aggregate a job kind belongs to (adr-0015): a drama-scoped job carries no episode. */
export type JobScope = 'drama' | 'episode';
export const JOB_SCOPE: Record<JobKind, JobScope> = {
  rewrite: 'episode',
  extraction: 'episode',
  breakdown: 'episode',
  videoPromptBatch: 'episode',
  recap: 'episode',
  write: 'episode',
  outline: 'drama',
  plan: 'drama',
  design: 'drama',
};

/** One agent job (rewrite, extraction per target, breakdown, video-prompt batch, recap, episode write, outline, plan, design per target), adr-0008. */
export const AgentJob = z.object({
  id: z.number().int(),
  kind: JobKind,
  /** Null for a drama-scoped job (outline, plan). */
  episodeId: z.number().int().nullable(),
  target: z.string(),
  status: JobStatus,
  /** Per kind: steps and model once settled; a plan's request and written ids; a write/rewrite's `recapJobId` (adr-0016); a design's `DesignProgress`. */
  progress: z.record(z.string(), z.unknown()),
  error: z.string().nullable(),
  startedAt: Timestamp,
  finishedAt: Timestamp.nullable(),
});
export type AgentJob = z.infer<typeof AgentJob>;

/** Response of every job-starting endpoint; a duplicate start returns the running job. */
export const JobStarted = z.object({
  jobId: z.number().int(),
  alreadyRunning: z.boolean(),
});
export type JobStarted = z.infer<typeof JobStarted>;

/** EpisodeJobs: the latest job per kind (and per target for extraction). */
export const EpisodeJobs = z.object({
  episodeId: z.number().int(),
  rewrite: AgentJob.nullable(),
  /** The episode writer expanding the beat sheet into the script (adr-0015); never beside a rewrite. */
  write: AgentJob.nullable(),
  extraction: z.record(ExtractionTarget, AgentJob.nullable()),
  breakdown: AgentJob.nullable(),
  videoPromptBatch: AgentJob.nullable(),
  /** The latest recap job of the episode, whichever script revision it was keyed by (adr-0014). */
  recap: AgentJob.nullable(),
});
export type EpisodeJobs = z.infer<typeof EpisodeJobs>;

/** DramaJobs: the latest drama-scoped job per kind (adr-0015). */
export const DramaJobs = z.object({
  dramaId: z.number().int(),
  outline: AgentJob.nullable(),
  /** Its progress carries the request and the ids of the episodes added so far. */
  plan: AgentJob.nullable(),
  /** The asset designer per kind (adr-0024); the three run in parallel. */
  design: z.record(DesignTarget, AgentJob.nullable()),
});
export type DramaJobs = z.infer<typeof DramaJobs>;

/**
 * A design job's progress (adr-0024): the outline revision its read tool saw (so the studio can say the outline moved
 * on since), then what its one save did. Every field is set by a tool, so each is optional until that tool ran.
 */
export const DesignProgress = z.object({
  outlineRevision: z.number().int().optional(),
  /** New assets inserted on the drama. */
  saved: z.number().int().optional(),
  /** Existing assets whose empty fields were filled. */
  filled: z.number().int().optional(),
  /** Names skipped: matching only a deleted asset, or an asset under claim while its image or prompt is made. */
  skipped: z.array(z.string()).optional(),
  /** Names beyond the per-run cap, not saved; the agent is told not to retry them. */
  overflow: z.array(z.string()).optional(),
  steps: z.number().int().optional(),
  model: z.string().optional(),
});
export type DesignProgress = z.infer<typeof DesignProgress>;
